/** Side of the trigger to place the content */
export type Side = "top" | "right" | "bottom" | "left";

/** Alignment of the content relative to the trigger */
export type Align = "start" | "center" | "end";

export type DropdownMenuItemType = "item" | "radio" | "checkbox";
export type DropdownMenuUserSource = "pointer" | "keyboard";
export type DropdownMenuSetSource = "programmatic" | "restore";
export type DropdownMenuSelectionSource = DropdownMenuUserSource | DropdownMenuSetSource;
export type DropdownMenuOpenChangeSource = DropdownMenuSelectionSource | "init";
export type DropdownMenuOpenChangeReason =
  | "trigger"
  | "select"
  | "outside"
  | "escape"
  | "tab"
  | "programmatic"
  | "init";

export interface DropdownMenuOpenChangeDetail {
  open: boolean;
  previousOpen: boolean;
  source: DropdownMenuOpenChangeSource;
  reason: DropdownMenuOpenChangeReason;
}

export interface DropdownMenuHighlightChangeDetail {
  value: string | null;
  previousValue: string | null;
  item: HTMLElement | null;
  previousItem: HTMLElement | null;
  source: DropdownMenuSelectionSource;
}

export interface DropdownMenuSelectDetail {
  value: string;
  item: HTMLElement;
  itemType: DropdownMenuItemType;
  source: DropdownMenuUserSource;
  checked?: boolean;
}

export interface DropdownMenuValueChangeDetail {
  value: string | null;
  previousValue: string | null;
  item: HTMLElement | null;
  previousItem: HTMLElement | null;
  source: DropdownMenuSelectionSource;
}

export interface DropdownMenuValuesChangeDetail {
  values: string[];
  previousValues: string[];
  changedValue: string | null;
  checked: boolean | null;
  item: HTMLElement | null;
  source: DropdownMenuSelectionSource;
}

export interface DropdownMenuSetDetail {
  open?: boolean;
  value?: string | null;
  values?: string[];
  highlightedValue?: string | null;
  source?: DropdownMenuSetSource;
}

export interface DropdownMenuOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Initial radio selection state */
  defaultValue?: string | null;
  /** Initial checkbox selection state */
  defaultValues?: string[];
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Callback when a user activation is accepted */
  onSelect?: (value: string) => void;
  /** Callback when the committed radio value changes */
  onValueChange?: (value: string | null) => void;
  /** Callback when the committed checkbox values change */
  onValuesChange?: (values: string[]) => void;
  /** Close when clicking outside */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape */
  closeOnEscape?: boolean;
  /** Close when an item is selected */
  closeOnSelect?: boolean;

  // Positioning props (Radix-compatible)
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

export interface DropdownMenuController {
  /** Open the dropdown menu */
  open(): void;
  /** Close the dropdown menu */
  close(): void;
  /** Toggle the dropdown menu */
  toggle(): void;
  /** Set one or more dropdown menu state fields programmatically */
  set(detail: DropdownMenuSetDetail): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Current committed radio value */
  readonly value: string | null;
  /** Current committed checkbox values */
  readonly values: string[];
  /** Current highlighted value */
  readonly highlightedValue: string | null;
  /** Cleanup all event listeners */
  destroy(): void;
}

export interface DropdownMenuItemRecord {
  el: HTMLElement;
  type: DropdownMenuItemType;
  value: string | null;
}

export interface OpenTransitionOptions {
  source: DropdownMenuOpenChangeSource;
  reason: DropdownMenuOpenChangeReason;
}

export interface HighlightUpdateOptions {
  source: DropdownMenuSelectionSource;
  focus?: boolean;
  focusContentOnClear?: boolean;
}

export interface CheckboxDiff {
  changedValue: string | null;
  checked: boolean | null;
  item: HTMLElement | null;
}

export interface CacheItemsOptions {
  source?: DropdownMenuSelectionSource;
  emitSelectionInvalidation?: boolean;
}
