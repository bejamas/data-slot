import {
  getPart,
  getRoots,
  getDataBool,
  hasRootBinding,
  reuseRootBinding,
  setRootBinding,
  clearRootBinding,
  setAria,
  ensureId,
  on,
  onRoot,
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
  createTerminalLifecycle,
  registerFloatingTerminalResources,
  createDismissLayer,
  containsWithPortals,
  createTypeahead,
} from "@data-slot/core";
import { resolveDropdownMenuOptions } from "./dropdown-menu-options";
import { createDropdownItemCollection } from "./dropdown-menu-items";
import type {
  CacheItemsOptions,
  DropdownMenuController,
  DropdownMenuHighlightChangeDetail,
  DropdownMenuItemRecord,
  DropdownMenuOpenChangeDetail,
  DropdownMenuOpenChangeSource,
  DropdownMenuOptions,
  DropdownMenuSelectDetail,
  DropdownMenuSelectionSource,
  DropdownMenuSetDetail,
  DropdownMenuUserSource,
  DropdownMenuValueChangeDetail,
  DropdownMenuValuesChangeDetail,
  HighlightUpdateOptions,
  OpenTransitionOptions,
} from "./dropdown-menu-types";

export type {
  Align,
  DropdownMenuController,
  DropdownMenuHighlightChangeDetail,
  DropdownMenuItemType,
  DropdownMenuOpenChangeDetail,
  DropdownMenuOpenChangeReason,
  DropdownMenuOpenChangeSource,
  DropdownMenuOptions,
  DropdownMenuSelectDetail,
  DropdownMenuSelectionSource,
  DropdownMenuSetDetail,
  DropdownMenuSetSource,
  DropdownMenuUserSource,
  DropdownMenuValueChangeDetail,
  DropdownMenuValuesChangeDetail,
  Side,
} from "./dropdown-menu-types";

const ROOT_BINDING_KEY = "@data-slot/dropdown-menu";
const DUPLICATE_BINDING_WARNING = "[@data-slot/dropdown-menu] createDropdownMenu() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";
const arraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const dispatchCustomEvent = <T>(el: Element, name: string, detail: T, cancelable = false): boolean =>
  el.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable, detail }));

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
  const { defaultOpen, closeOnClickOutside, closeOnEscape, closeOnSelect, preferredSide, preferredAlign, sideOffset, alignOffset, avoidCollisions, collisionPadding, lockScroll: lockScrollOption, highlightItemOnHover, optionsHasDefaultValue, optionsHasDefaultValues, rootHasDefaultValue, rootHasDefaultValues, requestedDefaultValue, requestedDefaultValues } = resolveDropdownMenuOptions(root, content, authoredPositioner, options);
  const onOpenChange = options.onOpenChange;
  const onSelect = options.onSelect;
  const onValueChange = options.onValueChange;
  const onValuesChange = options.onValuesChange;
  let isOpen = false;
  let currentValue: string | null = null;
  let currentValues: string[] = [];
  let highlightedItem: HTMLElement | null = null;
  let previousActiveElement: HTMLElement | null = null;
  const typeahead = createTypeahead();
  let keyboardMode = false;
  let didLockScroll = false;
  const terminalLifecycle = createTerminalLifecycle();
  terminalLifecycle.onDestroy(() => {
    if (didLockScroll) {
      unlockScroll();
      didLockScroll = false;
    }
  });
  let pendingDismissMeta: Pick<DropdownMenuOpenChangeDetail, "source" | "reason"> | null = null;
  const cleanups: Array<() => void> = [];
  const portal = createPortalLifecycle({
    content,
    root,
    wrapperSlot: authoredPositioner ? undefined : "dropdown-menu-positioner",
    container: authoredPositioner ?? undefined,
    mountTarget: authoredPositioner ? authoredPortal ?? authoredPositioner : undefined,
  });
  const itemCollection = createDropdownItemCollection(root, content);
  const isHoverPointer = (e: PointerEvent) => e.pointerType !== "touch";
  const syncItems = () => itemCollection.synchronizeSelection(currentValue, currentValues);

  const cacheItems = ({
    source = "programmatic",
    emitSelectionInvalidation = false,
  }: CacheItemsOptions = {}) => {
    const previousValue = currentValue;
    const previousValues = [...currentValues];
    const refreshed = itemCollection.refresh({
      value: previousValue,
      values: previousValues,
      highlightedItem,
    });
    const { previousItems } = refreshed;
    currentValue = refreshed.value;
    currentValues = refreshed.values;
    highlightedItem = refreshed.highlightedItem;

    if (emitSelectionInvalidation) {
      if (previousValue !== currentValue) {
        emitValueChange({
          value: currentValue,
          previousValue,
          item: currentValue === null ? null : itemCollection.radioFor(currentValue)?.el ?? null,
          previousItem: previousValue === null ? null : itemCollection.radioFor(previousValue, previousItems)?.el ?? null,
          source,
        });
      }
      if (!arraysEqual(previousValues, currentValues)) {
        const diff = itemCollection.checkboxDiff(
          previousValues,
          currentValues,
          previousItems,
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
    terminalLifecycle.trackRaf(() => {
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
      if (terminalLifecycle.isDestroyed) return;
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
    if (nextItem && !itemCollection.isEnabled(nextItem)) {
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
    itemCollection.highlight(highlightedItem);
    if (nextItem) {
      ensureItemVisibleInContainer(nextItem, content);
      if (focus) {
        focusElement(nextItem);
      }
    } else if (focusContentOnClear) {
      focusElement(content);
    }
    emitHighlightChange({
      value: itemCollection.valueFor(itemCollection.recordFor(nextItem)),
      previousValue: itemCollection.valueFor(itemCollection.recordFor(previousItem)),
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
    if (itemCollection.radios().length === 0) return false;
    const nextItem = value === null ? null : itemCollection.radioFor(value);
    if (value !== null && !nextItem) return false;
    if (currentValue === value) return false;
    const previousValue = currentValue;
    const previousItem = previousValue === null ? null : itemCollection.radioFor(previousValue);
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
    const nextValues = itemCollection.checkboxValues(values, emitChange ? "set" : "init");
    if (nextValues === null) return false;
    if (arraysEqual(currentValues, nextValues)) return false;
    const previousValues = [...currentValues];
    const diff = itemCollection.checkboxDiff(previousValues, nextValues);
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
      for (const radioItem of itemCollection.radios()) {
        if (radioItem.value !== null && getDataBool(radioItem.el, "defaultChecked")) {
          currentValue = radioItem.value;
          break;
        }
      }
    }
    if (optionsHasDefaultValues || rootHasDefaultValues) {
      const resolvedDefaults = itemCollection.checkboxValues(requestedDefaultValues, "init");
      currentValues = resolvedDefaults ?? [];
    } else {
      const itemDefaults = itemCollection.checkboxes()
        .filter((item) => item.value !== null && getDataBool(item.el, "defaultChecked"))
        .map((item) => item.value as string);
      currentValues = itemCollection.checkboxValues(itemDefaults, "init") ?? [];
    }
    syncItems();
  };
  const updateOpenState = (open: boolean, { source, reason }: OpenTransitionOptions) => {
    if (terminalLifecycle.isDestroyed) return;
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
      typeahead.reset();
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
      typeahead.reset();
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
    if (itemCollection.isDisabled(item)) return;
    const value = itemCollection.valueFor(item);
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
    const currentIndex = highlightedItem ? (itemCollection.enabledIndex(highlightedItem) ?? -1) : -1;
    const matchIndex = typeahead.match(
      char,
      itemCollection.enabled.map((item) => item.el.textContent?.trim() ?? ""),
      currentIndex,
    );

    if (matchIndex !== -1) {
      keyboardMode = true;
      updateHighlight(itemCollection.enabled[matchIndex]?.el ?? null, {
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
        const nextItem = itemCollection.itemForValue(detail.highlightedValue);
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
      const itemCount = itemCollection.enabled.length;
      if (itemCount === 0) return;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          keyboardMode = true;
          updateHighlight(
            itemCollection.enabled[
              highlightedItem ? ((itemCollection.enabledIndex(highlightedItem) ?? -1) + 1) % itemCount : 0
            ]?.el ?? null,
            { source: "keyboard", focus: true },
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          keyboardMode = true;
          updateHighlight(
            itemCollection.enabled[
              highlightedItem
                ? (itemCollection.enabledIndex(highlightedItem)! - 1 + itemCount) % itemCount
                : itemCount - 1
            ]?.el ?? null,
            { source: "keyboard", focus: true },
          );
          break;
        case "Home":
          event.preventDefault();
          keyboardMode = true;
          updateHighlight(itemCollection.enabled[0]?.el ?? null, {
            source: "keyboard",
            focus: true,
          });
          break;
        case "End":
          event.preventDefault();
          keyboardMode = true;
          updateHighlight(itemCollection.enabled[itemCount - 1]?.el ?? null, {
            source: "keyboard",
            focus: true,
          });
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (highlightedItem) {
            const highlightedRecord = itemCollection.recordFor(highlightedItem);
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
      const item = itemCollection.fromTarget(event.target);
      if (!item) return;
      activateItem(item, "pointer");
    }),
    on(content, "pointermove", (event) => {
      if (!highlightItemOnHover || !isHoverPointer(event)) return;
      const itemEl = itemCollection.fromTarget(event.target)?.el ?? null;
      if (keyboardMode) {
        keyboardMode = false;
        if (itemEl && itemEl === highlightedItem) {
          return;
        }
      }
      if (itemEl && itemCollection.isEnabled(itemEl)) {
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
    onRoot(root, "dropdown-menu:set", (event) => {
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
    open: () => !terminalLifecycle.isDestroyed &&
      updateOpenState(true, {
        source: "programmatic",
        reason: "programmatic",
      }),
    close: () => !terminalLifecycle.isDestroyed &&
      updateOpenState(false, {
        source: "programmatic",
        reason: "programmatic",
      }),
    toggle: () => !terminalLifecycle.isDestroyed &&
      updateOpenState(!isOpen, {
        source: "programmatic",
        reason: "programmatic",
      }),
    set: (detail) => {
      if (terminalLifecycle.isDestroyed) return;
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
      return itemCollection.valueFor(itemCollection.recordFor(highlightedItem));
    },
    destroy: () => {
      if (!terminalLifecycle.destroy()) return;
      typeahead.destroy();
      isOpen = false;
      setAria(trigger, "expanded", false);
      setDataState("closed");
      content.hidden = true;
    },
  };

  registerFloatingTerminalResources(terminalLifecycle, {
    cleanups,
    positionSync,
    presence,
    portal,
    unbind: () => clearRootBinding(root, ROOT_BINDING_KEY, controller),
  });

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
