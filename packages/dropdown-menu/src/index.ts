import {
  getPart,
  getRoots,
  getDataBool,
  getDataNumber,
  getDataString,
  getDataEnum,
  hasRootBinding,
  reuseRootBinding,
  setRootBinding,
  clearRootBinding,
  setAria,
  ensureId,
  on,
  emit,
  lockScroll,
  unlockScroll,
  computeFloatingPosition,
  computeFloatingTransformOrigin,
  measurePopupContentRect,
  ensureItemVisibleInContainer,
  focusElement,
  createPositionSync,
  createPortalLifecycle,
  createPresenceLifecycle,
  createDismissLayer,
  containsWithPortals,
} from "@data-slot/core";

/** Side of the trigger to place the content */
export type Side = "top" | "right" | "bottom" | "left";
const SIDES = ["top", "right", "bottom", "left"] as const;

/** Alignment of the content relative to the trigger */
export type Align = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;

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

interface DropdownMenuItemRecord {
  el: HTMLElement;
  type: DropdownMenuItemType;
  value: string | null;
}

interface OpenTransitionOptions {
  source: DropdownMenuOpenChangeSource;
  reason: DropdownMenuOpenChangeReason;
}

interface HighlightUpdateOptions {
  source: DropdownMenuSelectionSource;
  focus?: boolean;
  focusContentOnClear?: boolean;
}

interface CheckboxDiff {
  changedValue: string | null;
  checked: boolean | null;
  item: HTMLElement | null;
}

interface CacheItemsOptions {
  source?: DropdownMenuSelectionSource;
  emitSelectionInvalidation?: boolean;
}

const ROOT_BINDING_KEY = "@data-slot/dropdown-menu";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/dropdown-menu] createDropdownMenu() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";
const ITEM_SELECTOR =
  '[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-radio-item"], [data-slot="dropdown-menu-checkbox-item"]';

const hasOwn = <K extends string>(value: object, key: K): value is Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(value, key);

const setPresence = (el: Element, name: string, present: boolean): void => {
  if (present) {
    el.setAttribute(name, "");
  } else {
    el.removeAttribute(name);
  }
};

const arraysEqual = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
};

const dispatchCustomEvent = <T>(
  el: Element,
  name: string,
  detail: T,
  cancelable = false,
): boolean => {
  return el.dispatchEvent(
    new CustomEvent(name, {
      bubbles: true,
      cancelable,
      detail,
    }),
  );
};

const getItemRole = (type: DropdownMenuItemType): string => {
  switch (type) {
    case "radio":
      return "menuitemradio";
    case "checkbox":
      return "menuitemcheckbox";
    default:
      return "menuitem";
  }
};

const getItemType = (el: HTMLElement): DropdownMenuItemType => {
  const slot = el.getAttribute("data-slot");
  if (slot === "dropdown-menu-radio-item") return "radio";
  if (slot === "dropdown-menu-checkbox-item") return "checkbox";
  return "item";
};

const readSelectableValue = (el: HTMLElement): string | null => {
  const rawValue = el.dataset["value"];
  if (rawValue === undefined) return null;
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readActionValue = (item: DropdownMenuItemRecord): string => {
  if (item.type !== "item") {
    return item.value ?? "";
  }
  if (item.value) {
    return item.value;
  }
  return item.el.textContent?.trim() ?? "";
};

const parseDefaultValues = (raw: string | undefined): string[] => {
  if (raw === undefined) return [];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
};

/**
 * Create a dropdown menu controller for a root element.
 *
 * Supports Radix-compatible positioning props for precise placement:
 * - `side`: "top" | "right" | "bottom" | "left" (default: "bottom")
 * - `align`: "start" | "center" | "end" (default: "start")
 * - `sideOffset`: distance from trigger in px (default: 4)
 * - `alignOffset`: offset from alignment edge in px (default: 0)
 * - `avoidCollisions`: flip/shift to stay in viewport (default: true)
 * - `collisionPadding`: viewport edge padding in px (default: 8)
 *
 * ## Events
 * - **Outbound** `dropdown-menu:open-change` (on root): Fires when menu opens/closes.
 *   `event.detail: DropdownMenuOpenChangeDetail`
 * - **Outbound** `dropdown-menu:change` (on root): Deprecated alias for `dropdown-menu:open-change`.
 * - **Outbound** `dropdown-menu:highlight-change` (on root): Fires when highlight changes.
 *   `event.detail: DropdownMenuHighlightChangeDetail`
 * - **Outbound** `dropdown-menu:select` (on root): Cancelable user activation event fired before commit.
 *   `event.detail: DropdownMenuSelectDetail`
 * - **Outbound** `dropdown-menu:value-change` (on root): Fires when radio selection changes.
 *   `event.detail: DropdownMenuValueChangeDetail`
 * - **Outbound** `dropdown-menu:values-change` (on root): Fires when checkbox selection changes.
 *   `event.detail: DropdownMenuValuesChangeDetail`
 * - **Inbound** `dropdown-menu:set` (on root): Set open/highlight/selection state programmatically.
 *   `event.detail: DropdownMenuSetDetail`
 */
export function createDropdownMenu(
  root: Element,
  options: DropdownMenuOptions = {},
): DropdownMenuController {
  const existingController = reuseRootBinding<DropdownMenuController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING,
  );
  if (existingController) {
    return existingController;
  }

  const trigger = getPart<HTMLElement>(root, "dropdown-menu-trigger");
  const content = getPart<HTMLElement>(root, "dropdown-menu-content");
  const authoredPositionerCandidate = getPart<HTMLElement>(root, "dropdown-menu-positioner");
  const authoredPositioner =
    authoredPositionerCandidate && content && authoredPositionerCandidate.contains(content)
      ? authoredPositionerCandidate
      : null;
  const authoredPortalCandidate = getPart<HTMLElement>(root, "dropdown-menu-portal");
  const authoredPortal =
    authoredPortalCandidate && authoredPositioner && authoredPortalCandidate.contains(authoredPositioner)
      ? authoredPortalCandidate
      : null;

  if (!trigger || !content) {
    throw new Error("DropdownMenu requires trigger and content slots");
  }

  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const onOpenChange = options.onOpenChange;
  const onSelect = options.onSelect;
  const onValueChange = options.onValueChange;
  const onValuesChange = options.onValuesChange;
  const closeOnClickOutside = options.closeOnClickOutside ?? getDataBool(root, "closeOnClickOutside") ?? true;
  const closeOnEscape = options.closeOnEscape ?? getDataBool(root, "closeOnEscape") ?? true;
  const closeOnSelect = options.closeOnSelect ?? getDataBool(root, "closeOnSelect") ?? true;

  const getPlacementEnum = <T extends string>(key: string, allowed: readonly T[]): T | undefined =>
    getDataEnum(content, key, allowed) ??
    (authoredPositioner ? getDataEnum(authoredPositioner, key, allowed) : undefined) ??
    getDataEnum(root, key, allowed);
  const getPlacementNumber = (key: string): number | undefined =>
    getDataNumber(content, key) ??
    (authoredPositioner ? getDataNumber(authoredPositioner, key) : undefined) ??
    getDataNumber(root, key);
  const getPlacementBool = (key: string): boolean | undefined =>
    getDataBool(content, key) ??
    (authoredPositioner ? getDataBool(authoredPositioner, key) : undefined) ??
    getDataBool(root, key);

  const preferredSide = options.side ?? getPlacementEnum("side", SIDES) ?? "bottom";
  const preferredAlign = options.align ?? getPlacementEnum("align", ALIGNS) ?? "start";
  const sideOffset = options.sideOffset ?? getPlacementNumber("sideOffset") ?? 4;
  const alignOffset = options.alignOffset ?? getPlacementNumber("alignOffset") ?? 0;
  const avoidCollisions = options.avoidCollisions ?? getPlacementBool("avoidCollisions") ?? true;
  const collisionPadding = options.collisionPadding ?? getPlacementNumber("collisionPadding") ?? 8;
  const lockScrollOption = options.lockScroll ?? getDataBool(root, "lockScroll") ?? true;
  const highlightItemOnHover =
    options.highlightItemOnHover ?? getDataBool(root, "highlightItemOnHover") ?? true;

  const optionsHasDefaultValue = hasOwn(options, "defaultValue");
  const optionsHasDefaultValues = hasOwn(options, "defaultValues");
  const rootHasDefaultValue = root.hasAttribute("data-default-value");
  const rootHasDefaultValues = root.hasAttribute("data-default-values");
  const requestedDefaultValue = optionsHasDefaultValue
    ? options.defaultValue ?? null
    : rootHasDefaultValue
      ? getDataString(root, "defaultValue") ?? null
      : null;
  const requestedDefaultValues = optionsHasDefaultValues
    ? options.defaultValues ?? []
    : rootHasDefaultValues
      ? parseDefaultValues(getDataString(root, "defaultValues"))
      : [];

  let isOpen = false;
  let currentValue: string | null = null;
  let currentValues: string[] = [];
  let highlightedItem: HTMLElement | null = null;
  let previousActiveElement: HTMLElement | null = null;
  let typeaheadBuffer = "";
  let typeaheadTimeout: ReturnType<typeof setTimeout> | null = null;
  let keyboardMode = false;
  let didLockScroll = false;
  let isDestroyed = false;
  let pendingDismissMeta: Pick<DropdownMenuOpenChangeDetail, "source" | "reason"> | null = null;
  const cleanups: Array<() => void> = [];

  const portal = createPortalLifecycle({
    content,
    root,
    wrapperSlot: authoredPositioner ? undefined : "dropdown-menu-positioner",
    container: authoredPositioner ?? undefined,
    mountTarget: authoredPositioner ? authoredPortal ?? authoredPositioner : undefined,
  });

  let items: DropdownMenuItemRecord[] = [];
  let enabledItems: DropdownMenuItemRecord[] = [];
  let itemToEnabledIndex = new Map<HTMLElement, number>();

  const isDisabledEl = (el: HTMLElement): boolean =>
    el.hasAttribute("disabled") || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";
  const isHoverPointer = (e: PointerEvent) => e.pointerType !== "touch";
  const closestItem = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? (target.closest(ITEM_SELECTOR) as HTMLElement | null) : null;
  const getItemRecord = (el: HTMLElement | null): DropdownMenuItemRecord | null =>
    el ? items.find((item) => item.el === el) ?? null : null;
  const getRadioItems = (): DropdownMenuItemRecord[] => items.filter((item) => item.type === "radio");
  const getCheckboxItems = (): DropdownMenuItemRecord[] => items.filter((item) => item.type === "checkbox");
  const findRadioItemByValueIn = (
    records: readonly DropdownMenuItemRecord[],
    value: string,
  ): DropdownMenuItemRecord | null =>
    records.find((item) => item.type === "radio" && item.value === value) ?? null;
  const getResolvedValue = (item: DropdownMenuItemRecord | null): string | null => {
    if (!item) return null;
    if (item.type === "item") {
      return readActionValue(item);
    }
    return item.value;
  };
  const isInvalidSelectableItem = (item: DropdownMenuItemRecord): boolean =>
    (item.type === "radio" || item.type === "checkbox") && item.value === null;
  const isItemDisabled = (item: DropdownMenuItemRecord): boolean =>
    isDisabledEl(item.el) || isInvalidSelectableItem(item);
  const findRadioItemByValue = (value: string): DropdownMenuItemRecord | null =>
    getRadioItems().find((item) => item.value === value) ?? null;
  const findItemByResolvedValue = (value: string): DropdownMenuItemRecord | null =>
    enabledItems.find((item) => getResolvedValue(item) === value) ?? null;

  const getCheckboxDiff = (
    previousValues: readonly string[],
    nextValues: readonly string[],
    checkboxItems: readonly DropdownMenuItemRecord[] = getCheckboxItems(),
  ): CheckboxDiff => {
    const previousSet = new Set(previousValues);
    const nextSet = new Set(nextValues);
    let changedValue: string | null = null;
    let checked: boolean | null = null;
    let item: HTMLElement | null = null;

    for (const checkboxItem of checkboxItems) {
      if (checkboxItem.type !== "checkbox") continue;
      const value = checkboxItem.value;
      if (!value) continue;
      const wasChecked = previousSet.has(value);
      const isChecked = nextSet.has(value);
      if (wasChecked === isChecked) continue;
      if (changedValue !== null) {
        return { changedValue: null, checked: null, item: null };
      }
      changedValue = value;
      checked = isChecked;
      item = checkboxItem.el;
    }

    return { changedValue, checked, item };
  };

  const canonicalizeCheckboxValues = (
    rawValues: readonly unknown[],
    mode: "init" | "set",
  ): string[] | null => {
    const checkboxItems = getCheckboxItems().filter((item) => item.value !== null);
    if (checkboxItems.length === 0) return null;
    if (rawValues.length === 0) return [];

    const requested = new Set(
      rawValues
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );
    if (requested.size === 0) {
      return mode === "init" ? [] : null;
    }

    const canonical: string[] = [];
    for (const item of checkboxItems) {
      if (item.value && requested.has(item.value)) {
        canonical.push(item.value);
      }
    }

    if (canonical.length === 0) {
      return mode === "init" ? [] : null;
    }

    return canonical;
  };

  const syncItems = () => {
    for (const item of items) {
      const disabled = isItemDisabled(item);
      item.el.setAttribute("role", getItemRole(item.type));
      item.el.tabIndex = -1;
      if (disabled) {
        item.el.setAttribute("aria-disabled", "true");
      } else {
        item.el.removeAttribute("aria-disabled");
      }

      if (item.type === "radio") {
        const checked = item.value !== null && currentValue === item.value;
        setPresence(item.el, "data-checked", checked);
        setAria(item.el, "checked", item.value !== null ? checked : null);
      } else if (item.type === "checkbox") {
        const checked = item.value !== null && currentValues.includes(item.value);
        setPresence(item.el, "data-checked", checked);
        setAria(item.el, "checked", item.value !== null ? checked : null);
      } else {
        item.el.removeAttribute("data-checked");
        item.el.removeAttribute("aria-checked");
      }
    }

    if (getRadioItems().length > 0 && currentValue !== null) {
      root.setAttribute("data-value", currentValue);
    } else {
      root.removeAttribute("data-value");
    }
  };

  const syncHighlightState = () => {
    for (const item of items) {
      setPresence(item.el, "data-highlighted", item.el === highlightedItem);
    }
  };

  const cacheItems = ({
    source = "programmatic",
    emitSelectionInvalidation = false,
  }: CacheItemsOptions = {}) => {
    const previousItems = items;
    const previousValue = currentValue;
    const previousValues = [...currentValues];

    items = Array.from(content.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).map((el) => ({
      el,
      type: getItemType(el),
      value: readSelectableValue(el),
    }));

    const nextValue =
      previousValue !== null && findRadioItemByValue(previousValue) ? previousValue : null;
    const nextValues =
      previousValues.length > 0 ? canonicalizeCheckboxValues(previousValues, "init") ?? [] : [];

    currentValue = nextValue;
    currentValues = nextValues;

    enabledItems = items.filter((item) => !isItemDisabled(item));
    itemToEnabledIndex = new Map(enabledItems.map((item, index) => [item.el, index]));

    if (highlightedItem && !itemToEnabledIndex.has(highlightedItem)) {
      highlightedItem = null;
    }

    syncItems();
    syncHighlightState();

    if (emitSelectionInvalidation) {
      if (previousValue !== currentValue) {
        emitValueChange({
          value: currentValue,
          previousValue,
          item: currentValue === null ? null : findRadioItemByValue(currentValue)?.el ?? null,
          previousItem: previousValue === null ? null : findRadioItemByValueIn(previousItems, previousValue)?.el ?? null,
          source,
        });
      }

      if (!arraysEqual(previousValues, currentValues)) {
        const diff = getCheckboxDiff(
          previousValues,
          currentValues,
          previousItems.filter((item) => item.type === "checkbox"),
        );
        emitValuesChange({
          values: [...currentValues],
          previousValues,
          changedValue: diff.changedValue,
          checked: diff.checked,
          item: diff.item,
          source,
        });
      }
    }
  };

  const emitOpenChange = (detail: DropdownMenuOpenChangeDetail) => {
    emit(root, "dropdown-menu:open-change", detail);
    // TODO(next-major): remove deprecated dropdown-menu:change alias.
    emit(root, "dropdown-menu:change", detail);
    onOpenChange?.(detail.open);
  };

  const emitHighlightChange = (detail: DropdownMenuHighlightChangeDetail) => {
    emit(root, "dropdown-menu:highlight-change", detail);
  };

  const emitValueChange = (detail: DropdownMenuValueChangeDetail) => {
    emit(root, "dropdown-menu:value-change", detail);
    onValueChange?.(detail.value);
  };

  const emitValuesChange = (detail: DropdownMenuValuesChangeDetail) => {
    emit(root, "dropdown-menu:values-change", detail);
    onValuesChange?.([...detail.values]);
  };

  const updatePosition = () => {
    const positioner = portal.container as HTMLElement;
    const win = root.ownerDocument.defaultView ?? window;
    const triggerRect = trigger.getBoundingClientRect();
    const contentRect = measurePopupContentRect(content);
    const position = computeFloatingPosition({
      anchorRect: triggerRect,
      contentRect,
      side: preferredSide,
      align: preferredAlign,
      sideOffset,
      alignOffset,
      avoidCollisions,
      collisionPadding,
    });
    const transformOrigin = computeFloatingTransformOrigin({
      side: position.side,
      align: position.align,
      anchorRect: triggerRect,
      popupX: position.x,
      popupY: position.y,
    });

    if (lockScrollOption) {
      positioner.style.position = "fixed";
      positioner.style.top = "0px";
      positioner.style.left = "0px";
      positioner.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    } else {
      positioner.style.position = "absolute";
      positioner.style.top = "0px";
      positioner.style.left = "0px";
      positioner.style.transform = `translate3d(${position.x + win.scrollX}px, ${position.y + win.scrollY}px, 0)`;
    }

    positioner.style.setProperty("--transform-origin", transformOrigin);
    positioner.style.willChange = "transform";
    positioner.style.margin = "0";
    content.setAttribute("data-side", position.side);
    content.setAttribute("data-align", position.align);
    if (positioner !== content) {
      positioner.setAttribute("data-side", position.side);
      positioner.setAttribute("data-align", position.align);
    }
  };

  const positionSync = createPositionSync({
    observedElements: [trigger, content],
    isActive: () => isOpen,
    ancestorScroll: lockScrollOption,
    onUpdate: updatePosition,
  });

  const restoreFocus = () => {
    requestAnimationFrame(() => {
      if (previousActiveElement && document.contains(previousActiveElement)) {
        focusElement(previousActiveElement);
      } else if (document.contains(trigger)) {
        focusElement(trigger);
      }
      previousActiveElement = null;
    });
  };

  const presence = createPresenceLifecycle({
    element: content,
    onExitComplete: () => {
      if (isDestroyed) return;
      portal.restore();
      content.hidden = true;
      restoreFocus();
    },
  });

  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
    if (state === "open") {
      root.setAttribute("data-open", "");
      content.setAttribute("data-open", "");
      root.removeAttribute("data-closed");
      content.removeAttribute("data-closed");
    } else {
      root.setAttribute("data-closed", "");
      content.setAttribute("data-closed", "");
      root.removeAttribute("data-open");
      content.removeAttribute("data-open");
    }
  };

  const updateHighlight = (
    nextItem: HTMLElement | null,
    { source, focus = true, focusContentOnClear = false }: HighlightUpdateOptions,
  ): boolean => {
    if (nextItem && !itemToEnabledIndex.has(nextItem)) {
      return false;
    }

    const previousItem = highlightedItem;
    if (previousItem === nextItem) {
      if (nextItem && focus) {
        ensureItemVisibleInContainer(nextItem, content);
        focusElement(nextItem);
      } else if (!nextItem && focusContentOnClear) {
        focusElement(content);
      }
      return false;
    }

    highlightedItem = nextItem;
    syncHighlightState();

    if (nextItem) {
      ensureItemVisibleInContainer(nextItem, content);
      if (focus) {
        focusElement(nextItem);
      }
    } else if (focusContentOnClear) {
      focusElement(content);
    }

    emitHighlightChange({
      value: getResolvedValue(getItemRecord(nextItem)),
      previousValue: getResolvedValue(getItemRecord(previousItem)),
      item: nextItem,
      previousItem,
      source,
    });
    return true;
  };

  const applyRadioValue = (
    value: string | null,
    source: DropdownMenuSelectionSource,
    emitChange = true,
  ): boolean => {
    cacheItems({ source, emitSelectionInvalidation: emitChange });
    if (getRadioItems().length === 0) return false;

    const nextItem = value === null ? null : findRadioItemByValue(value);
    if (value !== null && !nextItem) return false;
    if (currentValue === value) return false;

    const previousValue = currentValue;
    const previousItem = previousValue === null ? null : findRadioItemByValue(previousValue);
    currentValue = value;
    syncItems();

    if (emitChange) {
      emitValueChange({
        value: currentValue,
        previousValue,
        item: nextItem?.el ?? null,
        previousItem: previousItem?.el ?? null,
        source,
      });
    }

    return true;
  };

  const applyCheckboxValues = (
    values: readonly string[],
    source: DropdownMenuSelectionSource,
    emitChange = true,
  ): boolean => {
    cacheItems({ source, emitSelectionInvalidation: emitChange });
    const nextValues = canonicalizeCheckboxValues(values, emitChange ? "set" : "init");
    if (nextValues === null) return false;
    if (arraysEqual(currentValues, nextValues)) return false;

    const previousValues = [...currentValues];
    const diff = getCheckboxDiff(previousValues, nextValues);
    currentValues = nextValues;
    syncItems();

    if (emitChange) {
      emitValuesChange({
        values: [...currentValues],
        previousValues,
        changedValue: diff.changedValue,
        checked: diff.checked,
        item: diff.item,
        source,
      });
    }

    return true;
  };

  const initializeSelectionState = () => {
    cacheItems();

    if (optionsHasDefaultValue || rootHasDefaultValue) {
      if (requestedDefaultValue !== null) {
        applyRadioValue(requestedDefaultValue, "programmatic", false);
      } else {
        currentValue = null;
      }
    } else {
      for (const radioItem of getRadioItems()) {
        if (radioItem.value !== null && getDataBool(radioItem.el, "defaultChecked")) {
          currentValue = radioItem.value;
          break;
        }
      }
    }

    if (optionsHasDefaultValues || rootHasDefaultValues) {
      const resolvedDefaults = canonicalizeCheckboxValues(requestedDefaultValues, "init");
      currentValues = resolvedDefaults ?? [];
    } else {
      const itemDefaults = getCheckboxItems()
        .filter((item) => item.value !== null && getDataBool(item.el, "defaultChecked"))
        .map((item) => item.value as string);
      currentValues = canonicalizeCheckboxValues(itemDefaults, "init") ?? [];
    }

    syncItems();
  };

  const updateOpenState = (open: boolean, { source, reason }: OpenTransitionOptions) => {
    if (isOpen === open) return;
    pendingDismissMeta = null;

    const previousOpen = isOpen;
    if (open) {
      previousActiveElement = document.activeElement as HTMLElement | null;
      isOpen = true;
      setAria(trigger, "expanded", true);
      portal.mount();
      content.hidden = false;
      setDataState("open");
      presence.enter();

      if (lockScrollOption && !didLockScroll) {
        lockScroll();
        didLockScroll = true;
      }

      cacheItems({
        source: source === "restore" ? "restore" : "programmatic",
        emitSelectionInvalidation: source !== "init",
      });
      keyboardMode = false;
      typeaheadBuffer = "";
      positionSync.start();
      updatePosition();
      positionSync.update();
      focusElement(content);
    } else {
      isOpen = false;
      setAria(trigger, "expanded", false);
      setDataState("closed");
      if (highlightedItem) {
        updateHighlight(null, {
          source: source === "init" ? "programmatic" : source,
          focus: false,
          focusContentOnClear: false,
        });
      }
      typeaheadBuffer = "";
      keyboardMode = false;

      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }

      positionSync.stop();
      presence.exit();
    }

    emitOpenChange({
      open: isOpen,
      previousOpen,
      source,
      reason,
    });
  };

  const setPendingDismissReason = (source: DropdownMenuUserSource, reason: "outside" | "escape") => {
    const nextMeta: Pick<DropdownMenuOpenChangeDetail, "source" | "reason"> = { source, reason };
    pendingDismissMeta = nextMeta;
    queueMicrotask(() => {
      if (pendingDismissMeta === nextMeta) {
        pendingDismissMeta = null;
      }
    });
  };

  const activateItem = (item: DropdownMenuItemRecord, source: DropdownMenuUserSource) => {
    if (isItemDisabled(item)) return;
    const value = getResolvedValue(item);
    if (value === null) return;

    let checked: boolean | undefined;
    if (item.type === "radio") {
      checked = true;
    } else if (item.type === "checkbox" && item.value !== null) {
      checked = !currentValues.includes(item.value);
    }

    const proceed = dispatchCustomEvent<DropdownMenuSelectDetail>(
      root,
      "dropdown-menu:select",
      {
        value,
        item: item.el,
        itemType: item.type,
        source,
        checked,
      },
      true,
    );
    if (!proceed) return;

    onSelect?.(value);

    if (item.type === "radio") {
      applyRadioValue(item.value, source, true);
    } else if (item.type === "checkbox" && item.value !== null) {
      const nextValues = new Set(currentValues);
      if (nextValues.has(item.value)) {
        nextValues.delete(item.value);
      } else {
        nextValues.add(item.value);
      }
      applyCheckboxValues([...nextValues], source, true);
    }

    if (closeOnSelect) {
      updateOpenState(false, { source, reason: "select" });
    }
  };

  const handleTypeahead = (char: string) => {
    if (typeaheadTimeout) clearTimeout(typeaheadTimeout);
    typeaheadTimeout = setTimeout(() => {
      typeaheadBuffer = "";
    }, 500);

    typeaheadBuffer += char;

    let matchIndex = enabledItems.findIndex((item) =>
      (item.el.textContent?.trim().toLowerCase() ?? "").startsWith(typeaheadBuffer),
    );

    if (matchIndex === -1 && typeaheadBuffer.length === 1) {
      const start = highlightedItem ? (itemToEnabledIndex.get(highlightedItem) ?? -1) + 1 : 0;
      for (let i = 0; i < enabledItems.length; i++) {
        const index = (start + i) % enabledItems.length;
        const item = enabledItems[index];
        if ((item?.el.textContent?.trim().toLowerCase() ?? "").startsWith(char)) {
          matchIndex = index;
          break;
        }
      }
    }

    if (matchIndex !== -1) {
      keyboardMode = true;
      updateHighlight(enabledItems[matchIndex]?.el ?? null, {
        source: "keyboard",
        focus: true,
      });
    }
  };

  const applySet = (detail: DropdownMenuSetDetail) => {
    const source = detail.source ?? "programmatic";
    if (detail.value !== undefined) {
      applyRadioValue(detail.value, source, true);
    }
    if (detail.values !== undefined) {
      applyCheckboxValues(detail.values, source, true);
    }
    if (detail.open !== undefined) {
      updateOpenState(detail.open, {
        source,
        reason: source === "restore" ? "programmatic" : "programmatic",
      });
    }
    if (detail.highlightedValue !== undefined) {
      if (!isOpen) return;
      if (detail.highlightedValue === null) {
        updateHighlight(null, {
          source,
          focus: false,
          focusContentOnClear: true,
        });
      } else {
        const nextItem = findItemByResolvedValue(detail.highlightedValue);
        if (nextItem) {
          updateHighlight(nextItem.el, {
            source,
            focus: true,
          });
        }
      }
    }
  };

  const triggerId = ensureId(trigger, "dropdown-menu-trigger");
  const contentId = ensureId(content, "dropdown-menu-content");
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-controls", contentId);
  content.setAttribute("role", "menu");
  content.setAttribute("aria-labelledby", triggerId);
  content.tabIndex = -1;
  setAria(trigger, "expanded", false);
  content.hidden = true;
  setDataState("closed");

  initializeSelectionState();

  cleanups.push(
    on(trigger, "click", () => {
      updateOpenState(!isOpen, {
        source: "pointer",
        reason: "trigger",
      });
    }),
    on(trigger, "keydown", (event) => {
      if ((event.key === "Enter" || event.key === " " || event.key === "ArrowDown") && !isOpen) {
        event.preventDefault();
        updateOpenState(true, {
          source: "keyboard",
          reason: "trigger",
        });
      }
    }),
  );

  cleanups.push(
    on(content, "keydown", (event) => {
      if (event.key === "Tab") {
        updateOpenState(false, {
          source: "keyboard",
          reason: "tab",
        });
        return;
      }

      const itemCount = enabledItems.length;
      if (itemCount === 0) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          keyboardMode = true;
          updateHighlight(
            enabledItems[
              highlightedItem ? ((itemToEnabledIndex.get(highlightedItem) ?? -1) + 1) % itemCount : 0
            ]?.el ?? null,
            { source: "keyboard", focus: true },
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          keyboardMode = true;
          updateHighlight(
            enabledItems[
              highlightedItem
                ? (itemToEnabledIndex.get(highlightedItem)! - 1 + itemCount) % itemCount
                : itemCount - 1
            ]?.el ?? null,
            { source: "keyboard", focus: true },
          );
          break;
        case "Home":
          event.preventDefault();
          keyboardMode = true;
          updateHighlight(enabledItems[0]?.el ?? null, {
            source: "keyboard",
            focus: true,
          });
          break;
        case "End":
          event.preventDefault();
          keyboardMode = true;
          updateHighlight(enabledItems[itemCount - 1]?.el ?? null, {
            source: "keyboard",
            focus: true,
          });
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (highlightedItem) {
            const highlightedRecord = getItemRecord(highlightedItem);
            if (highlightedRecord) {
              activateItem(highlightedRecord, "keyboard");
            }
          }
          break;
        default:
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            handleTypeahead(event.key.toLowerCase());
          }
      }
    }),
    on(content, "click", (event) => {
      const itemEl = closestItem(event.target);
      const item = getItemRecord(itemEl);
      if (!item) return;
      activateItem(item, "pointer");
    }),
    on(content, "pointermove", (event) => {
      if (!highlightItemOnHover || !isHoverPointer(event)) return;

      const itemEl = closestItem(event.target);
      if (keyboardMode) {
        keyboardMode = false;
        if (itemEl && itemEl === highlightedItem) {
          return;
        }
      }

      if (itemEl && itemToEnabledIndex.has(itemEl)) {
        updateHighlight(itemEl, {
          source: "pointer",
          focus: true,
        });
      } else if (highlightedItem) {
        updateHighlight(null, {
          source: "pointer",
          focus: false,
          focusContentOnClear: true,
        });
      }
    }),
    on(content, "pointerleave", (event) => {
      if (!highlightItemOnHover || !isHoverPointer(event) || keyboardMode || !highlightedItem) return;
      updateHighlight(null, {
        source: "pointer",
        focus: false,
        focusContentOnClear: true,
      });
    }),
  );

  const doc = root.ownerDocument ?? document;
  cleanups.push(
    on(
      doc,
      "pointerdown",
      (event) => {
        if (!isOpen || !closeOnClickOutside) return;
        const pointerEvent = event as PointerEvent;
        if (pointerEvent.pointerType === "touch") return;
        const target = event.target as Node | null;
        if (containsWithPortals(root, target)) return;
        setPendingDismissReason("pointer", "outside");
      },
      { capture: true },
    ),
    on(
      doc,
      "click",
      (event) => {
        if (!isOpen || !closeOnClickOutside) return;
        const target = event.target as Node | null;
        if (containsWithPortals(root, target)) return;
        setPendingDismissReason("pointer", "outside");
      },
      { capture: true },
    ),
    on(
      doc,
      "keydown",
      (event) => {
        if (!isOpen || !closeOnEscape || event.key !== "Escape" || event.defaultPrevented) return;
        setPendingDismissReason("keyboard", "escape");
      },
      { capture: true },
    ),
  );

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => isOpen,
      onDismiss: () => {
        const meta = pendingDismissMeta;
        pendingDismissMeta = null;
        if (meta?.reason === "escape") {
          updateOpenState(false, {
            source: meta.source as DropdownMenuOpenChangeSource,
            reason: "escape",
          });
          return;
        }
        updateOpenState(false, {
          source: meta?.source ?? "pointer",
          reason: meta?.reason ?? "outside",
        });
      },
      closeOnClickOutside,
      closeOnEscape,
    }),
  );

  cleanups.push(
    on(root, "dropdown-menu:set", (event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || typeof detail !== "object") return;

      const nextDetail: DropdownMenuSetDetail = {
        source:
          detail.source === "restore" || detail.source === "programmatic"
            ? detail.source
            : undefined,
      };

      if (detail.open !== undefined) {
        nextDetail.open = detail.open;
      }
      if (detail.values !== undefined) {
        nextDetail.values = Array.isArray(detail.values)
          ? detail.values.filter((value: unknown): value is string => typeof value === "string")
          : undefined;
      }
      if (detail.highlightedValue !== undefined) {
        nextDetail.highlightedValue =
          detail.highlightedValue === null || typeof detail.highlightedValue === "string"
            ? detail.highlightedValue
            : undefined;
      }

      if (detail.value !== undefined) {
        if (typeof detail.value === "boolean" && detail.open === undefined) {
          // TODO(next-major): remove deprecated dropdown-menu:set { value: boolean } compatibility.
          nextDetail.open = detail.value;
        } else if (detail.value === null || typeof detail.value === "string") {
          nextDetail.value = detail.value;
        }
      }

      applySet(nextDetail);
    }),
  );

  const controller: DropdownMenuController = {
    open: () =>
      updateOpenState(true, {
        source: "programmatic",
        reason: "programmatic",
      }),
    close: () =>
      updateOpenState(false, {
        source: "programmatic",
        reason: "programmatic",
      }),
    toggle: () =>
      updateOpenState(!isOpen, {
        source: "programmatic",
        reason: "programmatic",
      }),
    set: (detail) => {
      applySet(detail);
    },
    get isOpen() {
      return isOpen;
    },
    get value() {
      return currentValue;
    },
    get values() {
      return [...currentValues];
    },
    get highlightedValue() {
      return getResolvedValue(getItemRecord(highlightedItem));
    },
    destroy: () => {
      isDestroyed = true;
      if (typeaheadTimeout) clearTimeout(typeaheadTimeout);
      positionSync.stop();
      presence.cleanup();
      portal.cleanup();
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }
      cleanups.forEach((cleanup) => cleanup());
      cleanups.length = 0;
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(root, ROOT_BINDING_KEY, controller);

  if (defaultOpen) {
    updateOpenState(true, {
      source: "init",
      reason: "init",
    });
  }

  return controller;
}

/**
 * Find and bind all dropdown menu components in a scope.
 * Returns array of controllers for programmatic access.
 */
export function create(scope: ParentNode = document): DropdownMenuController[] {
  const controllers: DropdownMenuController[] = [];
  for (const root of getRoots(scope, "dropdown-menu")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createDropdownMenu(root));
  }
  return controllers;
}
