import { ensureId, ensureItemVisibleInContainer, getPart, getOwnedElements, setAria } from "@data-slot/core";
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
  let labels: string[] = [];
  let groups: HTMLElement[] = [];
  let separators: HTMLElement[] = [];
  let enabledVisibleItems: HTMLElement[] = [];
  let itemToEnabledIndex = new Map<HTMLElement, number>();
  let highlightedIndex = -1;
  let itemToStringValue = initialItemToStringValue;

  // Same-value writes still run attribute-changed and style invalidation in Blink.
  const setHidden = (el: HTMLElement, hidden: boolean) => {
    if (el.hidden !== hidden) el.hidden = hidden;
  };

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
    return getOwnedElements<HTMLElement>(root, container, '[data-slot="combobox-item"]').find((item) => valueOf(item) === value) ?? null;
  };

  const labelFor = (value: string | null) => {
    const item = itemByValue(value);
    return itemToStringValue ? itemToStringValue(item, value) : item ? getItemLabel(item) : "";
  };

  const syncSelectedState = (items: HTMLElement[], value: string | null) => {
    for (const item of items) {
      const selected = valueOf(item) === value;
      setAria(item, "selected", selected);
      item.toggleAttribute("data-selected", selected);
    }
    for (const indicator of getOwnedElements<HTMLElement>(root, container, '[data-slot="combobox-item-indicator"]')) {
      const item = indicator.closest<HTMLElement>('[data-slot="combobox-item"]');
      if (item) indicator.hidden = !item.hasAttribute("data-selected");
    }
  };

  const clearHighlight = () => {
    enabledVisibleItems[highlightedIndex]?.removeAttribute("data-highlighted");
    highlightedIndex = -1;
    input.removeAttribute("aria-activedescendant");
  };

  const rebuildVisibleItems = () => {
    clearHighlight();
    enabledVisibleItems = allItems.filter((item) => !item.hidden && !isItemDisabled(item));
    itemToEnabledIndex = new Map(enabledVisibleItems.map((item, index) => [item, index]));
  };

  const normalizeVisibleSeparators = () => {
    if (separators.length === 0) return;
    for (const separator of separators) separator.hidden = true;
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

  return {
    cache(selectedValue) {
      allItems = getOwnedElements<HTMLElement>(root, container, '[data-slot="combobox-item"]');
      labels = allItems.map(getItemLabel);
      groups = getOwnedElements<HTMLElement>(root, container, '[data-slot="combobox-group"]');
      separators = getOwnedElements<HTMLElement>(root, container, '[data-slot="combobox-separator"]');
      for (const item of allItems) {
        item.setAttribute("role", "option");
        ensureId(item, "combobox-item");
        setAria(item, "disabled", isItemDisabled(item) || null);
      }
      syncSelectedState(allItems, selectedValue);
      for (const group of groups) {
        group.setAttribute("role", "group");
        const label = getOwnedElements<HTMLElement>(root, group, '[data-slot="combobox-label"]')[0];
        if (label) group.setAttribute("aria-labelledby", ensureId(label, "combobox-label"));
      }
    },
    filter(query) {
      const trimmed = query.trim();
      let visibleCount = 0;
      allItems.forEach((item, index) => {
        const matches = trimmed === "" || filter(trimmed, valueOf(item) ?? "", labels[index]!);
        setHidden(item, !matches);
        if (matches) visibleCount++;
      });
      for (const group of groups) {
        setHidden(group, getOwnedElements<HTMLElement>(root, group, '[data-slot="combobox-item"]').every((item) => item.hidden));
      }
      normalizeVisibleSeparators();
      if (emptySlot) setHidden(emptySlot, visibleCount > 0);
      content.toggleAttribute("data-empty", visibleCount === 0);
      rebuildVisibleItems();
    },
    select(value) {
      syncSelectedState(allItems.length > 0 ? allItems : getOwnedElements<HTMLElement>(root, container, '[data-slot="combobox-item"]'), value);
    },
    highlight(index) {
      const item = enabledVisibleItems[index];
      clearHighlight();
      if (!item) return;
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
    get enabled() { return enabledVisibleItems; },
    get highlightedIndex() { return highlightedIndex; },
    indexOf(item) { return itemToEnabledIndex.get(item); },
    isDisabled: isItemDisabled,
    valueOf,
    labelFor,
  };
}
