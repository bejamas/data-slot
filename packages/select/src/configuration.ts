import { getDataBool, getDataEnum, getDataNumber, getDataString } from "@data-slot/core";
import type { Align, Position, SelectOptions, Side } from "./types";

const SIDES = ["top", "bottom"] as const;
const ALIGNS = ["start", "center", "end"] as const;
const POSITIONS = ["item-aligned", "popper"] as const;

/** Resolves authored configuration once, preserving the documented precedence rules. */
export function resolveSelectConfiguration(
  root: Element, content: HTMLElement, valueSlot: HTMLElement | null,
  authoredPositioner: HTMLElement | null, options: SelectOptions,
) {
  const enumValue = <T extends string>(key: string, allowed: readonly T[]) =>
    getDataEnum(content, key, allowed) ?? (authoredPositioner ? getDataEnum(authoredPositioner, key, allowed) : undefined) ?? getDataEnum(root, key, allowed);
  const numberValue = (key: string) => getDataNumber(content, key) ?? (authoredPositioner ? getDataNumber(authoredPositioner, key) : undefined) ?? getDataNumber(root, key);
  const boolValue = (key: string) => getDataBool(content, key) ?? (authoredPositioner ? getDataBool(authoredPositioner, key) : undefined) ?? getDataBool(root, key);
  return {
    defaultValue: options.defaultValue ?? getDataString(root, "defaultValue") ?? null,
    defaultOpen: options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false,
    placeholder: options.placeholder ?? getDataString(root, "placeholder") ?? (valueSlot ? getDataString(valueSlot, "placeholder") : undefined) ?? "",
    disabled: options.disabled ?? getDataBool(root, "disabled") ?? false,
    required: options.required ?? getDataBool(root, "required") ?? false,
    name: options.name ?? getDataString(root, "name") ?? null,
    onValueChange: options.onValueChange,
    onOpenChange: options.onOpenChange,
    position: options.position ?? enumValue("position", POSITIONS) ?? "item-aligned" as Position,
    preferredSide: options.side ?? enumValue("side", SIDES) ?? "bottom" as Side,
    preferredAlign: options.align ?? enumValue("align", ALIGNS) ?? "start" as Align,
    sideOffset: options.sideOffset ?? numberValue("sideOffset") ?? 4,
    alignOffset: options.alignOffset ?? numberValue("alignOffset") ?? 0,
    avoidCollisions: options.avoidCollisions ?? boolValue("avoidCollisions") ?? true,
    collisionPadding: options.collisionPadding ?? numberValue("collisionPadding") ?? 8,
    lockScrollOption: options.lockScroll ?? getDataBool(root, "lockScroll") ?? true,
    highlightItemOnHover: options.highlightItemOnHover ?? getDataBool(root, "highlightItemOnHover") ?? true,
  };
}
