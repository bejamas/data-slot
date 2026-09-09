/** Side of the trigger to place the content */
export type Side = "top" | "bottom";

/** Alignment of the content relative to the trigger */
export type Align = "start" | "center" | "end";

/** Positioning mode for the content */
export type Position = "item-aligned" | "popper";

export interface SelectOptions {
  /** Initial selected value */
  defaultValue?: string;
  /** Callback when value changes */
  onValueChange?: (value: string | null) => void;
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Disable interaction */
  disabled?: boolean;
  /** Form validation required */
  required?: boolean;
  /** Form field name (auto-creates hidden input) */
  name?: string;

  /**
   * Positioning mode for the content.
   * - "item-aligned": Positions content so selected item aligns with trigger (like native select)
   * - "popper": Positions content below/above trigger like a dropdown
   * @default "item-aligned"
   */
  position?: Position;

  // Positioning props (Radix-compatible, used when position="popper")
  /**
   * The preferred side of the trigger to render against.
   * Will be reversed when collisions occur and `avoidCollisions` is enabled.
   * @default "bottom"
   */
  side?: Side;
  /**
   * The preferred alignment against the trigger.
   * May change when collisions occur.
   * @default "start"
   */
  align?: Align;
  /**
   * The distance in pixels from the trigger.
   * @default 4
   */
  sideOffset?: number;
  /**
   * An offset in pixels from the "start" or "end" alignment options.
   * @default 0
   */
  alignOffset?: number;
  /**
   * When true, overrides side/align preferences to prevent collisions with viewport edges.
   * @default true
   */
  avoidCollisions?: boolean;
  /**
   * The padding between the content and the viewport edges when avoiding collisions.
   * @default 8
   */
  collisionPadding?: number;
  /**
   * Lock body scroll when open.
   * @default true
   */
  lockScroll?: boolean;
  /**
   * Whether moving the pointer over items should highlight and focus them.
   * @default true
   */
  highlightItemOnHover?: boolean;
}

export interface SelectController {
  /** Current selected value */
  readonly value: string | null;
  /** Current open state */
  readonly isOpen: boolean;
  /** Select a value programmatically */
  select(value: string): void;
  /** Open the popup */
  open(): void;
  /** Close the popup */
  close(): void;
  /** Cleanup all event listeners */
  destroy(): void;
}
