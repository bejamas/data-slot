import { ensureId, ensureItemVisibleInContainer, getPart, getParts, setAria } from "@data-slot/core";
import type { ComboboxItemToStringValue } from "./types";

type ComboboxFilter = (inputValue: string, itemValue: string, itemLabel: string) => boolean;

interface ComboboxCollectionOptions {
  root: Element;
  container: HTMLElement;
  input: HTMLInputElement;
  emptySlot: HTMLElement | null;
  filter: ComboboxFilter;
  itemToStringValue: ComboboxItemToStringValue | null;
}

export interface ComboboxCollection {
  cache(selectedValue: string | null): void;
  filter(query: string): void;
  select(value: string | null): void;
  highlight(index: number): void;
  clearHighlight(): void;
  setItemToStringValue(itemToStringValue: ComboboxItemToStringValue | null): void;
  readonly items: readonly HTMLElement[];
  readonly enabled: readonly HTMLElement[];
  readonly highlightedIndex: number;
  indexOf(item: HTMLElement): number | undefined;
  isDisabled(item: HTMLElement): boolean;
  valueOf(item: HTMLElement): string | undefined;
  labelFor(value: string | null): string;
}

export function createComboboxCollection({
  root,
  container,
  input,
  emptySlot,
  filter,
  itemToStringValue: initialItemToStringValue,
}: ComboboxCollectionOptions): ComboboxCollection {
  const content = getPart<HTMLElement>(root, "combobox-content") ?? container;
  let allItems: HTMLElement[] = [];
  let enabledVisibleItems: HTMLElement[] = [];
  let itemToEnabledIndex = new Map<HTMLElement, number>();
  let highlightedIndex = -1;
  let itemToStringValue = initialItemToStringValue;

  const isItemDisabled = (item: HTMLElement) =>
    item.hasAttribute("disabled") || item.hasAttribute("data-disabled") || item.getAttribute("aria-disabled") === "true";

  const getItemLabel = (item: HTMLElement) => {
    if (item.dataset["label"]) return item.dataset["label"];
    let directText = "";
    for (const node of item.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) directText += node.textContent;
    }
    return directText.trim() || item.textContent?.trim() || "";
  };

  const valueOf = (item: HTMLElement): string | undefined =>
    item.hasAttribute("data-value") ? item.getAttribute("data-value")! : undefined;

  const itemByValue = (value: string | null): HTMLElement | null => {
    if (value === null) return null;
    return getParts<HTMLElement>(container, "combobox-item").find((item) => valueOf(item) === value) ?? null;
  };

  const labelFor = (value: string | null) => {
    const item = itemByValue(value);
    return itemToStringValue ? itemToStringValue(item, value) : item ? getItemLabel(item) : "";
  };

  const syncItemSelectedState = (item: HTMLElement, selected: boolean) => {
    setAria(item, "selected", selected);
    item.toggleAttribute("data-selected", selected);
    for (const indicator of getParts<HTMLElement>(item, "combobox-item-indicator")) {
      indicator.hidden = !selected;
    }
  };

  const rebuildVisibleItems = () => {
    enabledVisibleItems = allItems.filter((item) => !item.hidden && !isItemDisabled(item));
    itemToEnabledIndex = new Map(enabledVisibleItems.map((item, index) => [item, index]));
  };

  const normalizeVisibleSeparators = () => {
    for (const separator of getParts<HTMLElement>(container, "combobox-separator")) separator.hidden = true;
    const children = Array.from(container.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    for (let index = 0; index < children.length; index++) {
      const current = children[index]!;
      if (current.dataset["slot"] === "combobox-separator" || current.hidden) continue;
      let firstVisibleSeparator: HTMLElement | null = null;
      for (let nextIndex = index + 1; nextIndex < children.length; nextIndex++) {
        const next = children[nextIndex]!;
        if (next.dataset["slot"] === "combobox-separator") {
          firstVisibleSeparator ??= next;
        } else if (!next.hidden) {
          if (firstVisibleSeparator) firstVisibleSeparator.hidden = false;
          break;
        }
      }
    }
  };

  const clearHighlight = () => {
    for (const item of allItems) item.removeAttribute("data-highlighted");
    highlightedIndex = -1;
    input.removeAttribute("aria-activedescendant");
  };

  return {
    cache(selectedValue) {
      allItems = getParts<HTMLElement>(container, "combobox-item");
      for (const item of allItems) {
        item.setAttribute("role", "option");
        ensureId(item, "combobox-item");
        item.toggleAttribute("aria-disabled", isItemDisabled(item));
        if (isItemDisabled(item)) item.setAttribute("aria-disabled", "true");
        syncItemSelectedState(item, valueOf(item) === selectedValue);
      }
      for (const group of getParts<HTMLElement>(container, "combobox-group")) {
        group.setAttribute("role", "group");
        const label = getPart<HTMLElement>(group, "combobox-label");
        if (label) group.setAttribute("aria-labelledby", ensureId(label, "combobox-label"));
      }
      rebuildVisibleItems();
    },
    filter(query) {
      const trimmed = query.trim();
      let visibleCount = 0;
      for (const item of allItems) {
        const matches = trimmed === "" || filter(trimmed, valueOf(item) ?? "", getItemLabel(item));
        item.hidden = !matches;
        if (matches) visibleCount++;
      }
      for (const group of getParts<HTMLElement>(container, "combobox-group")) {
        group.hidden = getParts<HTMLElement>(group, "combobox-item").every((item) => item.hidden);
      }
      normalizeVisibleSeparators();
      if (emptySlot) emptySlot.hidden = visibleCount > 0;
      content.toggleAttribute("data-empty", visibleCount === 0);
      rebuildVisibleItems();
    },
    select(value) {
      const items = allItems.length > 0 ? allItems : getParts<HTMLElement>(container, "combobox-item");
      for (const item of items) syncItemSelectedState(item, valueOf(item) === value);
    },
    highlight(index) {
      for (const item of allItems) item.removeAttribute("data-highlighted");
      const item = enabledVisibleItems[index];
      if (!item) return clearHighlight();
      item.setAttribute("data-highlighted", "");
      input.setAttribute("aria-activedescendant", item.id);
      const scrollContainer = container.contains(item) && container.scrollHeight > container.clientHeight
        ? container
        : content;
      ensureItemVisibleInContainer(item, scrollContainer);
      highlightedIndex = index;
    },
    clearHighlight,
    setItemToStringValue(nextItemToStringValue) {
      itemToStringValue = nextItemToStringValue;
    },
    get items() { return allItems; },
    get enabled() { return enabledVisibleItems; },
    get highlightedIndex() { return highlightedIndex; },
    indexOf(item) { return itemToEnabledIndex.get(item); },
    isDisabled: isItemDisabled,
    valueOf,
    labelFor,
  };
}
