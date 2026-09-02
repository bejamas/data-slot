export type Side = "top" | "right" | "bottom" | "left";
export type Align = "start" | "center" | "end";
export type DropdownMenuItemType = "item" | "radio" | "checkbox";
export type DropdownMenuUserSource = "pointer" | "keyboard";
export type DropdownMenuSetSource = "programmatic" | "restore";
export type DropdownMenuSelectionSource = DropdownMenuUserSource | DropdownMenuSetSource;
export type DropdownMenuOpenChangeSource = DropdownMenuSelectionSource | "init";
export type DropdownMenuOpenChangeReason = "trigger" | "select" | "outside" | "escape" | "tab" | "programmatic" | "init";
export interface DropdownMenuOpenChangeDetail { open: boolean; previousOpen: boolean; source: DropdownMenuOpenChangeSource; reason: DropdownMenuOpenChangeReason; }
export interface DropdownMenuHighlightChangeDetail { value: string | null; previousValue: string | null; item: HTMLElement | null; previousItem: HTMLElement | null; source: DropdownMenuSelectionSource; }
export interface DropdownMenuSelectDetail { value: string; item: HTMLElement; itemType: DropdownMenuItemType; source: DropdownMenuUserSource; checked?: boolean; }
export interface DropdownMenuValueChangeDetail { value: string | null; previousValue: string | null; item: HTMLElement | null; previousItem: HTMLElement | null; source: DropdownMenuSelectionSource; }
export interface DropdownMenuValuesChangeDetail { values: string[]; previousValues: string[]; changedValue: string | null; checked: boolean | null; item: HTMLElement | null; source: DropdownMenuSelectionSource; }
export interface DropdownMenuSetDetail { open?: boolean; value?: string | null; values?: string[]; highlightedValue?: string | null; source?: DropdownMenuSetSource; }
export interface DropdownMenuOptions {
  defaultOpen?: boolean; defaultValue?: string | null; defaultValues?: string[];
  onOpenChange?: (open: boolean) => void; onSelect?: (value: string) => void;
  onValueChange?: (value: string | null) => void; onValuesChange?: (values: string[]) => void;
  closeOnClickOutside?: boolean; closeOnEscape?: boolean; closeOnSelect?: boolean;
  side?: Side; align?: Align; sideOffset?: number; alignOffset?: number;
  avoidCollisions?: boolean; collisionPadding?: number; lockScroll?: boolean; highlightItemOnHover?: boolean;
}
export interface DropdownMenuController { open(): void; close(): void; toggle(): void; set(detail: DropdownMenuSetDetail): void; readonly isOpen: boolean; readonly value: string | null; readonly values: string[]; readonly highlightedValue: string | null; destroy(): void; }
export interface DropdownMenuItemRecord { el: HTMLElement; type: DropdownMenuItemType; value: string | null; }
export interface OpenTransitionOptions { source: DropdownMenuOpenChangeSource; reason: DropdownMenuOpenChangeReason; }
export interface HighlightUpdateOptions { source: DropdownMenuSelectionSource; focus?: boolean; focusContentOnClear?: boolean; }
export interface CheckboxDiff { changedValue: string | null; checked: boolean | null; item: HTMLElement | null; }
export interface CacheItemsOptions { source?: DropdownMenuSelectionSource; emitSelectionInvalidation?: boolean; }
