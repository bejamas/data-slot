import { getDataBool, getDataEnum, getDataNumber, getDataString } from "@data-slot/core";
import type { Align, ComboboxOptions, Side } from "./types";

const SIDES = ["top", "bottom"] as const;
const ALIGNS = ["start", "center", "end"] as const;

/** Resolves authored configuration once, preserving the documented precedence rules. */
export function resolveComboboxConfiguration(
  root: Element, content: HTMLElement, authoredPositioner: HTMLElement | null, options: ComboboxOptions,
) {
  const enumValue = <T extends string>(key: string, allowed: readonly T[]) =>
    getDataEnum(content, key, allowed) ?? (authoredPositioner ? getDataEnum(authoredPositioner, key, allowed) : undefined) ?? getDataEnum(root, key, allowed);
  const numberValue = (key: string) => getDataNumber(content, key) ?? (authoredPositioner ? getDataNumber(authoredPositioner, key) : undefined) ?? getDataNumber(root, key);
  const boolValue = (key: string) => getDataBool(content, key) ?? (authoredPositioner ? getDataBool(authoredPositioner, key) : undefined) ?? getDataBool(root, key);
  return {
    defaultValue: options.defaultValue ?? getDataString(root, "defaultValue") ?? null,
    defaultOpen: options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false,
    placeholder: options.placeholder ?? getDataString(root, "placeholder") ?? "",
    disabled: options.disabled ?? getDataBool(root, "disabled") ?? false,
    required: options.required ?? getDataBool(root, "required") ?? false,
    name: options.name ?? getDataString(root, "name") ?? null,
    openOnFocus: options.openOnFocus ?? getDataBool(root, "openOnFocus") ?? true,
    autoHighlight: options.autoHighlight ?? getDataBool(root, "autoHighlight") ?? false,
    customFilter: options.filter ?? null,
    onValueChange: options.onValueChange,
    onOpenChange: options.onOpenChange,
    onInputValueChange: options.onInputValueChange,
    preferredSide: options.side ?? enumValue("side", SIDES) ?? "bottom" as Side,
    preferredAlign: options.align ?? enumValue("align", ALIGNS) ?? "start" as Align,
    sideOffset: options.sideOffset ?? numberValue("sideOffset") ?? 4,
    alignOffset: options.alignOffset ?? numberValue("alignOffset") ?? 0,
    avoidCollisions: options.avoidCollisions ?? boolValue("avoidCollisions") ?? true,
    collisionPadding: options.collisionPadding ?? numberValue("collisionPadding") ?? 8,
  };
}
