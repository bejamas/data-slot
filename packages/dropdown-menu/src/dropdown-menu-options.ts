import { getDataBool, getDataEnum, getDataNumber, getDataString } from "@data-slot/core";
import type { Align, DropdownMenuOptions, Side } from "./dropdown-menu-types";

const sides = ["top", "right", "bottom", "left"] as const;
const aligns = ["start", "center", "end"] as const;

const hasOwn = <K extends string>(value: object, key: K): value is Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(value, key);

const parseDefaultValues = (raw: string | undefined): string[] => {
  try {
    const values = JSON.parse(raw?.trim() || "[]");
    return Array.isArray(values)
      ? values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

/** Resolves authored data attributes once, preserving option precedence. */
export const resolveDropdownMenuOptions = (root: Element, content: HTMLElement, positioner: HTMLElement | null, options: DropdownMenuOptions) => {
  const enumValue = <T extends string>(key: string, allowed: readonly T[]) => getDataEnum(content, key, allowed) ?? (positioner ? getDataEnum(positioner, key, allowed) : undefined) ?? getDataEnum(root, key, allowed);
  const numberValue = (key: string) => getDataNumber(content, key) ?? (positioner ? getDataNumber(positioner, key) : undefined) ?? getDataNumber(root, key);
  const boolValue = (key: string) => getDataBool(content, key) ?? (positioner ? getDataBool(positioner, key) : undefined) ?? getDataBool(root, key);
  const hasValue = hasOwn(options, "defaultValue");
  const hasValues = hasOwn(options, "defaultValues");
  const rootHasValue = root.hasAttribute("data-default-value");
  const rootHasValues = root.hasAttribute("data-default-values");
  return {
    defaultOpen: options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false,
    closeOnClickOutside: options.closeOnClickOutside ?? getDataBool(root, "closeOnClickOutside") ?? true,
    closeOnEscape: options.closeOnEscape ?? getDataBool(root, "closeOnEscape") ?? true,
    closeOnSelect: options.closeOnSelect ?? getDataBool(root, "closeOnSelect") ?? true,
    preferredSide: options.side ?? enumValue<Side>("side", sides) ?? "bottom",
    preferredAlign: options.align ?? enumValue<Align>("align", aligns) ?? "start",
    sideOffset: options.sideOffset ?? numberValue("sideOffset") ?? 4,
    alignOffset: options.alignOffset ?? numberValue("alignOffset") ?? 0,
    avoidCollisions: options.avoidCollisions ?? boolValue("avoidCollisions") ?? true,
    collisionPadding: options.collisionPadding ?? numberValue("collisionPadding") ?? 8,
    lockScroll: options.lockScroll ?? getDataBool(root, "lockScroll") ?? true,
    highlightItemOnHover: options.highlightItemOnHover ?? getDataBool(root, "highlightItemOnHover") ?? true,
    optionsHasDefaultValue: hasValue, optionsHasDefaultValues: hasValues,
    rootHasDefaultValue: rootHasValue, rootHasDefaultValues: rootHasValues,
    requestedDefaultValue: hasValue ? options.defaultValue ?? null : rootHasValue ? getDataString(root, "defaultValue") ?? null : null,
    requestedDefaultValues: hasValues ? options.defaultValues ?? [] : rootHasValues ? parseDefaultValues(getDataString(root, "defaultValues")) : [],
  };
};
