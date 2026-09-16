import { getOwnedElements, setAria } from "@data-slot/core";
import type { CheckboxDiff, DropdownMenuItemRecord, DropdownMenuItemType } from "./dropdown-menu-types";

const ITEM_SELECTOR =
  '[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-radio-item"], [data-slot="dropdown-menu-checkbox-item"]';

interface DropdownItemState {
  value: string | null;
  values: readonly string[];
  highlightedItem: HTMLElement | null;
}

const getType = (el: HTMLElement): DropdownMenuItemType => {
  if (el.getAttribute("data-slot") === "dropdown-menu-radio-item") return "radio";
  if (el.getAttribute("data-slot") === "dropdown-menu-checkbox-item") return "checkbox";
  return "item";
};

const isDisabled = (item: DropdownMenuItemRecord): boolean =>
  item.el.hasAttribute("disabled") || item.el.hasAttribute("data-disabled") ||
  item.el.getAttribute("aria-disabled") === "true" ||
  ((item.type === "radio" || item.type === "checkbox") && item.value === null);

/** Owns menu item discovery, lookup, selection reconciliation, and item ARIA. */
export const createDropdownItemCollection = (root: Element, content: HTMLElement) => {
  let items: DropdownMenuItemRecord[] = [];
  let enabled: DropdownMenuItemRecord[] = [];
  let index = new Map<HTMLElement, number>();

  const radios = () => items.filter((item) => item.type === "radio");
  const checkboxes = () => items.filter((item) => item.type === "checkbox");
  const recordFor = (el: HTMLElement | null) => items.find((item) => item.el === el) ?? null;
  const fromTarget = (target: EventTarget | null) =>
    recordFor(target instanceof Element ? target.closest<HTMLElement>(ITEM_SELECTOR) : null);
  const radioFor = (value: string, records: readonly DropdownMenuItemRecord[] = items) =>
    records.find((item) => item.type === "radio" && item.value === value) ?? null;
  const valueFor = (item: DropdownMenuItemRecord | null): string | null => {
    if (!item) return null;
    return item.type === "item" ? item.value || item.el.textContent?.trim() || "" : item.value;
  };
  const itemForValue = (value: string) => enabled.find((item) => valueFor(item) === value) ?? null;

  const checkboxValues = (values: readonly unknown[], mode: "init" | "set"): string[] | null => {
    const available = checkboxes().filter((item) => item.value !== null);
    if (available.length === 0) return null;
    // An explicit empty array clears selection; invalid nonempty input is ignored on set.
    if (values.length === 0) return [];
    const requested = new Set(
      values.filter((value): value is string => typeof value === "string")
        .map((value) => value.trim()).filter(Boolean),
    );
    if (requested.size === 0) return mode === "init" ? [] : null;
    const canonical = available.flatMap((item) => item.value && requested.has(item.value) ? [item.value] : []);
    return canonical.length > 0 || mode === "init" ? canonical : null;
  };

  const checkboxDiff = (
    previousValues: readonly string[],
    nextValues: readonly string[],
    records: readonly DropdownMenuItemRecord[] = items,
  ): CheckboxDiff => {
    const previousSet = new Set(previousValues);
    const nextSet = new Set(nextValues);
    let changedValue: string | null = null;
    let checked: boolean | null = null;
    let item: HTMLElement | null = null;
    for (const record of records) {
      if (record.type !== "checkbox" || !record.value) continue;
      const wasChecked = previousSet.has(record.value);
      const isChecked = nextSet.has(record.value);
      if (wasChecked === isChecked) continue;
      if (changedValue !== null) return { changedValue: null, checked: null, item: null };
      changedValue = record.value;
      checked = isChecked;
      item = record.el;
    }
    return { changedValue, checked, item };
  };

  const synchronizeSelection = (value: string | null, values: readonly string[]): void => {
    for (const item of items) {
      item.el.setAttribute(
        "role",
        item.type === "radio" ? "menuitemradio" : item.type === "checkbox" ? "menuitemcheckbox" : "menuitem",
      );
      item.el.tabIndex = -1;
      setAria(item.el, "disabled", isDisabled(item) || null);
      if (item.type === "radio" || item.type === "checkbox") {
        const checked = item.value !== null && (item.type === "radio" ? value === item.value : values.includes(item.value));
        item.el.toggleAttribute("data-checked", checked);
        setAria(item.el, "checked", item.value === null ? null : checked);
      } else {
        item.el.removeAttribute("data-checked");
        item.el.removeAttribute("aria-checked");
      }
    }
    if (value !== null && radios().length > 0) root.setAttribute("data-value", value);
    else root.removeAttribute("data-value");
  };

  const highlight = (highlightedItem: HTMLElement | null): void => {
    for (const item of items) item.el.toggleAttribute("data-highlighted", item.el === highlightedItem);
  };

  const refresh = (state: DropdownItemState) => {
    const previousItems = items;
    items = getOwnedElements<HTMLElement>(root, content, ITEM_SELECTOR).map((el) => ({
      el,
      type: getType(el),
      value: el.dataset.value?.trim() || null,
    }));
    enabled = items.filter((item) => !isDisabled(item));
    index = new Map(enabled.map((item, position) => [item.el, position]));
    const value = state.value !== null && radioFor(state.value) ? state.value : null;
    const values = state.values.length ? checkboxValues(state.values, "init") ?? [] : [];
    const highlightedItem = state.highlightedItem && index.has(state.highlightedItem) ? state.highlightedItem : null;
    synchronizeSelection(value, values);
    highlight(highlightedItem);
    return { value, values, highlightedItem, previousItems };
  };

  return {
    refresh,
    synchronizeSelection,
    highlight,
    recordFor,
    fromTarget,
    radios,
    checkboxes,
    radioFor,
    valueFor,
    itemForValue,
    checkboxValues,
    checkboxDiff,
    isDisabled,
    get enabled(): readonly DropdownMenuItemRecord[] { return enabled; },
    enabledIndex: (el: HTMLElement) => index.get(el),
    isEnabled: (el: HTMLElement) => index.has(el),
  };
};
