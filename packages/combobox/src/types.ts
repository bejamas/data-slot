/** Side of the input to place the content */
export type Side = "top" | "bottom";

/** Alignment of the content relative to the input */
export type Align = "start" | "center" | "end";

export type ComboboxItemToStringValue = (item: HTMLElement | null, value: string | null) => string;

export interface ComboboxOptions {
  /** Initial selected value */
  defaultValue?: string;
  /** Callback when value changes */
  onValueChange?: (value: string | null) => void;
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Callback when user types in the input (not on programmatic syncs) */
  onInputValueChange?: (inputValue: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Disable interaction */
  disabled?: boolean;
  /** Form validation required */
  required?: boolean;
  /** Form field name (auto-creates hidden input) */
  name?: string;
  /** Open popup when input receives focus @default true */
  openOnFocus?: boolean;
  /** Auto-highlight first visible item when filtering @default false */
  autoHighlight?: boolean;
  /** Custom filter function. Return true to show item. */
  filter?: (inputValue: string, itemValue: string, itemLabel: string) => boolean;
  /** Custom text resolver for committed selected-value text (input in inline mode, combobox-value in popup-input mode) */
  itemToStringValue?: ComboboxItemToStringValue;

  // Positioning props
  /** @default "bottom" */
  side?: Side;
  /** @default "start" */
  align?: Align;
  /** @default 4 */
  sideOffset?: number;
  /** @default 0 */
  alignOffset?: number;
  /** @default true */
  avoidCollisions?: boolean;
  /** @default 8 */
  collisionPadding?: number;
}

export interface ComboboxController {
  /** Current selected value */
  readonly value: string | null;
  /** Current input text */
  readonly inputValue: string;
  /** Current open state */
  readonly isOpen: boolean;
  /** Select a value programmatically */
  select(value: string): void;
  /** Clear selected value */
  clear(): void;
  /** Open the popup */
  open(): void;
  /** Close the popup */
  close(): void;
  /** Set or clear runtime selected-value text resolver */
  setItemToStringValue(itemToStringValue: ComboboxItemToStringValue | null): void;
  /** Cleanup all event listeners */
  destroy(): void;
}
