import { setAria } from "@data-slot/core";
import type { DropdownMenuItemRecord, DropdownMenuItemType } from "./dropdown-menu-types";

const ITEM_SELECTOR = '[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-radio-item"], [data-slot="dropdown-menu-checkbox-item"]';

export interface DropdownItemState {
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

/** Owns the DOM-derived menu item model, including selection ARIA and typeahead lookup. */
export const createDropdownItemCollection = (root: Element, content: HTMLElement) => {
  let items: DropdownMenuItemRecord[] = [];
  let enabled: DropdownMenuItemRecord[] = [];
  let index = new Map<HTMLElement, number>();

  const radios = () => items.filter((item) => item.type === "radio");
  const checkboxes = () => items.filter((item) => item.type === "checkbox");
  const recordFor = (el: HTMLElement | null) => items.find((item) => item.el === el) ?? null;
  const radioFor = (value: string) => radios().find((item) => item.value === value) ?? null;
  const valueFor = (item: DropdownMenuItemRecord | null): string | null =>
    !item ? null : item.type === "item" ? item.value || item.el.textContent?.trim() || "" : item.value;
  const itemForValue = (value: string) => enabled.find((item) => valueFor(item) === value) ?? null;
  const checkboxValues = (values: readonly unknown[], mode: "init" | "set"): string[] | null => {
    const available = checkboxes().filter((item) => item.value !== null);
    if (available.length === 0) return null;
    const requested = new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean));
    if (requested.size === 0) return mode === "init" ? [] : null;
    const canonical = available.flatMap((item) => item.value && requested.has(item.value) ? [item.value] : []);
    return canonical.length > 0 || mode === "init" ? canonical : null;
  };
  const synchronize = ({ value, values, highlightedItem }: DropdownItemState): void => {
    for (const item of items) {
      const disabled = isDisabled(item);
      item.el.setAttribute("role", item.type === "radio" ? "menuitemradio" : item.type === "checkbox" ? "menuitemcheckbox" : "menuitem");
      item.el.tabIndex = -1;
      setAria(item.el, "disabled", disabled || null);
      if (item.type === "radio" || item.type === "checkbox") {
        const checked = item.value !== null && (item.type === "radio" ? value === item.value : values.includes(item.value));
        item.el.toggleAttribute("data-checked", checked);
        setAria(item.el, "checked", item.value === null ? null : checked);
      } else {
        item.el.removeAttribute("data-checked");
        item.el.removeAttribute("aria-checked");
      }
      item.el.toggleAttribute("data-highlighted", item.el === highlightedItem);
    }
    if (value !== null && radios().length > 0) root.setAttribute("data-value", value);
    else root.removeAttribute("data-value");
  };
  const refresh = (state: DropdownItemState) => {
    const previousItems = items;
    items = Array.from(content.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).map((el) => ({ el, type: getType(el), value: el.dataset.value?.trim() || null }));
    enabled = items.filter((item) => !isDisabled(item));
    index = new Map(enabled.map((item, position) => [item.el, position]));
    const value = state.value !== null && radioFor(state.value) ? state.value : null;
    const values = state.values.length ? checkboxValues(state.values, "init") ?? [] : [];
    const highlightedItem = state.highlightedItem && index.has(state.highlightedItem) ? state.highlightedItem : null;
    synchronize({ value, values, highlightedItem });
    return { value, values, highlightedItem, previousItems };
  };
  return { refresh, synchronize, recordFor, radios, checkboxes, radioFor, valueFor, itemForValue, checkboxValues, isDisabled, get items() { return items; }, get enabled() { return enabled; }, enabledIndex: (el: HTMLElement) => index.get(el), isEnabled: (el: HTMLElement) => index.has(el) };
};

export const arraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const dispatchCustomEvent = <T>(el: Element, name: string, detail: T, cancelable = false): boolean =>
  el.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable, detail }));

export const parseDefaultValues = (raw: string | undefined): string[] => {
  try {
    const values = JSON.parse(raw?.trim() || "[]");
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
};

// Transitional helpers keep the controller's event orchestration independent of
// DOM discovery while the collection remains the owner of item semantics.
export const hasOwn = <K extends string>(value: object, key: K): value is Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(value, key);

export const setPresence = (el: Element, name: string, present: boolean): void => {
  el.toggleAttribute(name, present);
};

export const getItemRole = (type: DropdownMenuItemType): string =>
  type === "radio" ? "menuitemradio" : type === "checkbox" ? "menuitemcheckbox" : "menuitem";

export const getItemType = getType;

export const readSelectableValue = (el: HTMLElement): string | null => el.dataset.value?.trim() || null;

export const readActionValue = (item: DropdownMenuItemRecord): string =>
  item.type === "item" ? item.value || item.el.textContent?.trim() || "" : item.value || "";
