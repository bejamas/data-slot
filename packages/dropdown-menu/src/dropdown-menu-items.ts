import type { DropdownMenuItemRecord, DropdownMenuItemType } from "./dropdown-menu-types";

/** Value and ARIA rules shared by the menu's item collection. */
export const hasOwn = <K extends string>(value: object, key: K): value is Record<K, unknown> => Object.prototype.hasOwnProperty.call(value, key);
export const setPresence = (el: Element, name: string, present: boolean): void => { if (present) el.setAttribute(name, ""); else el.removeAttribute(name); };
export const arraysEqual = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((value, index) => value === right[index]);
export const dispatchCustomEvent = <T>(el: Element, name: string, detail: T, cancelable = false): boolean => el.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable, detail }));
export const getItemRole = (type: DropdownMenuItemType): string => type === "radio" ? "menuitemradio" : type === "checkbox" ? "menuitemcheckbox" : "menuitem";
export const getItemType = (el: HTMLElement): DropdownMenuItemType => el.getAttribute("data-slot") === "dropdown-menu-radio-item" ? "radio" : el.getAttribute("data-slot") === "dropdown-menu-checkbox-item" ? "checkbox" : "item";
export const readSelectableValue = (el: HTMLElement): string | null => { const value = el.dataset.value?.trim(); return value || null; };
export const readActionValue = (item: DropdownMenuItemRecord): string => item.type === "item" ? item.value || item.el.textContent?.trim() || "" : item.value || "";
export const parseDefaultValues = (raw: string | undefined): string[] => { try { const values = JSON.parse(raw?.trim() || "[]"); return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean) : []; } catch { return []; } };
