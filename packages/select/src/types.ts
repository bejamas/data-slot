/** Side of the trigger to place the content. */
export type Side = "top" | "bottom";

/** Alignment of the content relative to the trigger. */
export type Align = "start" | "center" | "end";

/** Positioning mode for the content. */
export type Position = "item-aligned" | "popper";

export interface SelectOptions {
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  position?: Position;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
  lockScroll?: boolean;
  highlightItemOnHover?: boolean;
}

export interface SelectController {
  readonly value: string | null;
  readonly isOpen: boolean;
  select(value: string): void;
  open(): void;
  close(): void;
  destroy(): void;
}
