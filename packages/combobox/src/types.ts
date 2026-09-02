/** Side of the input to place the content. */
export type Side = "top" | "bottom";

/** Alignment of the content relative to the input. */
export type Align = "start" | "center" | "end";

export type ComboboxItemToStringValue = (item: HTMLElement | null, value: string | null) => string;

export interface ComboboxOptions {
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onInputValueChange?: (inputValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  openOnFocus?: boolean;
  autoHighlight?: boolean;
  filter?: (inputValue: string, itemValue: string, itemLabel: string) => boolean;
  itemToStringValue?: ComboboxItemToStringValue;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
}

export interface ComboboxController {
  readonly value: string | null;
  readonly inputValue: string;
  readonly isOpen: boolean;
  select(value: string): void;
  clear(): void;
  open(): void;
  close(): void;
  setItemToStringValue(itemToStringValue: ComboboxItemToStringValue | null): void;
  destroy(): void;
}
