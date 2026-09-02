import {
  getPart,
  getOwnedElements,
  reuseRootBinding,
  setRootBinding,
  clearRootBinding,
  createTypeahead,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, onRoot, emit } from "@data-slot/core";
import { createFormFieldAdapter } from "@data-slot/core";
import type { FormFieldAdapter } from "@data-slot/core";
import { lockScroll, unlockScroll } from "@data-slot/core";
import {
  ensureItemVisibleInContainer,
  focusElement,
  createPortalLifecycle,
  createPresenceLifecycle,
  createTerminalLifecycle,
  registerFloatingTerminalResources,
  createDismissLayer,
} from "@data-slot/core";
import type { SelectController, SelectOptions } from "./types";
import { resolveSelectConfiguration } from "./configuration";
import { discoverSelects } from "./discovery";
import { createSelectPositioning } from "./select-positioning";

export type { Align, Position, SelectController, SelectOptions, Side } from "./types";

const ROOT_BINDING_KEY = "@data-slot/select";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/select] createSelect() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

/** Creates a select controller for a root element. Positioning supports:
 * - `side`: "top" | "bottom" (default: "bottom")
 * - `align`: "start" | "center" | "end" (default: "start")
 * - `sideOffset`: distance from trigger in px (default: 4)
 * - `alignOffset`: offset from alignment edge in px (default: 0)
 * - `avoidCollisions`: flip/shift to stay in viewport (default: true)
 * - `collisionPadding`: viewport edge padding in px (default: 8)
 * ## Events
 * - **Outbound** `select:change` (on root): Fires when value changes.
 *   `event.detail: { value: string | null }`
 * - **Outbound** `select:open-change` (on root): Fires when popup opens/closes.
 *   `event.detail: { open: boolean }`
 * - **Inbound** `select:set` (on root): Set value or open state.
 *   `event.detail: { value: string } | { open: boolean }`
 */
export function createSelect(
  root: Element,
  options: SelectOptions = {}
): SelectController {
  const existingController = reuseRootBinding<SelectController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) {
    return existingController;
  }

  const trigger = getPart<HTMLElement>(root, "select-trigger");
  const content = getPart<HTMLElement>(root, "select-content");
  const valueSlot = getPart<HTMLElement>(root, "select-value");
  const authoredPositionerCandidate = getPart<HTMLElement>(root, "select-positioner");
  const authoredPositioner =
    authoredPositionerCandidate && content && authoredPositionerCandidate.contains(content)
      ? authoredPositionerCandidate
      : null;
  const authoredPortalCandidate = getPart<HTMLElement>(root, "select-portal");
  const authoredPortal =
    authoredPortalCandidate && authoredPositioner && authoredPortalCandidate.contains(authoredPositioner)
      ? authoredPortalCandidate
      : null;

  if (!trigger || !content) {
    throw new Error("Select requires trigger and content slots");
  }

  const {
    defaultValue, defaultOpen, placeholder, disabled, required, name, onValueChange, onOpenChange,
    position, preferredSide, preferredAlign, sideOffset, alignOffset, avoidCollisions,
    collisionPadding, lockScrollOption, highlightItemOnHover,
  } = resolveSelectConfiguration(root, content, valueSlot, authoredPositioner, options);

  let isOpen = false;
  let currentValue: string | null = defaultValue;
  let previousActiveElement: HTMLElement | null = null;
  let highlightedIndex = -1;
  const typeahead = createTypeahead();
  let keyboardMode = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerType = "";
  let pendingPointerOpen = false;
  const cleanups: Array<() => void> = [];

  // Cached on open
  let items: HTMLElement[] = [];
  let enabledItems: HTMLElement[] = [];
  let itemToIndex = new Map<HTMLElement, number>();

  let formField: FormFieldAdapter | null = null;

  // Track if this instance locked scroll
  let didLockScroll = false;

  // Portal lifecycle for moving content to body
  const portal = createPortalLifecycle({
    content,
    root,
    wrapperSlot: authoredPositioner ? undefined : "select-positioner",
    container: authoredPositioner ?? undefined,
    mountTarget: authoredPositioner ? authoredPortal ?? authoredPositioner : undefined,
  });
  const terminalLifecycle = createTerminalLifecycle();
  terminalLifecycle.onDestroy(() => {
    if (didLockScroll) {
      unlockScroll();
      didLockScroll = false;
    }
  });
  let shouldRestoreFocusOnClose = true;

  const isItemDisabled = (el: HTMLElement) =>
    el.hasAttribute("disabled") || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";
  const isHoverPointer = (e: PointerEvent) => e.pointerType !== "touch";

  // ARIA setup
  const triggerId = ensureId(trigger, "select-trigger");
  const contentId = ensureId(content, "select-content");
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-controls", contentId);
  if (!trigger.hasAttribute("type")) {
    trigger.setAttribute("type", "button");
  }
  content.setAttribute("role", "listbox");
  content.setAttribute("aria-labelledby", triggerId);
  content.tabIndex = -1;

  // Native <label for="..."> support: find label whose `for` matches the trigger's id
  const nativeLabel = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(triggerId)}"]`);
  if (nativeLabel) {
    const labelId = ensureId(nativeLabel, "select-label");
    const existing = trigger.getAttribute("aria-labelledby");
    trigger.setAttribute("aria-labelledby", existing ? `${existing} ${labelId}` : labelId);
    cleanups.push(on(nativeLabel, "click", (e) => {
      e.preventDefault();
      if (!disabled) updateOpenState(!isOpen);
    }));
  }

  if (disabled) {
    trigger.setAttribute("aria-disabled", "true");
    trigger.setAttribute("data-disabled", "");
    if (trigger instanceof HTMLButtonElement) {
      trigger.disabled = true;
    }
  }
  if (required) {
    trigger.setAttribute("aria-required", "true");
  }


  // Cache items on open
  const cacheItems = () => {
    items = getOwnedElements<HTMLElement>(root, content, '[data-slot="select-item"]');

    for (const item of items) {
      item.setAttribute("role", "option");
      if (item.hasAttribute("data-disabled") || item.hasAttribute("disabled")) {
        item.setAttribute("aria-disabled", "true");
      } else {
        item.removeAttribute("aria-disabled");
      }
      item.tabIndex = -1;

      // Mark selected item
      const itemValue = item.dataset["value"];
      if (itemValue === currentValue) {
        setAria(item, "selected", true);
        item.setAttribute("data-selected", "");
      } else {
        setAria(item, "selected", false);
        item.removeAttribute("data-selected");
      }
    }

    enabledItems = items.filter((el) => !isItemDisabled(el));
    itemToIndex = new Map(enabledItems.map((el, i) => [el, i]));

    // Set groups' ARIA
    const groups = getOwnedElements<HTMLElement>(root, content, '[data-slot="select-group"]');
    for (const group of groups) {
      group.setAttribute("role", "group");
      const label = getOwnedElements<HTMLElement>(root, group, '[data-slot="select-label"]')[0] ?? null;
      if (label) {
        const labelId = ensureId(label, "select-label");
        group.setAttribute("aria-labelledby", labelId);
      }
    }
  };

  const getViewport = () =>
    getOwnedElements<HTMLElement>(root, content, '[data-slot="select-viewport"]')[0] ?? null;

  const getScrollContainer = () =>
    getViewport() ?? content;

  const getItemText = (item: HTMLElement) =>
    getOwnedElements<HTMLElement>(root, item, '[data-slot="select-item-text"]')[0] ?? null;

  const getTrimmedText = (element: HTMLElement | null | undefined) => {
    const text = element?.textContent?.trim();
    return text ? text : undefined;
  };

  const getItemLabelText = (
    item: HTMLElement | null | undefined,
    fallback = ""
  ) => {
    if (!item) return fallback;
    return (
      (item.dataset["label"]?.trim() || undefined) ??
      getTrimmedText(getItemText(item)) ??
      getTrimmedText(item) ??
      fallback
    );
  };

  const positioning = createSelectPositioning({
    root, trigger, content, valueSlot,
    getPositioner: () => portal.container as HTMLElement,
    getViewport,
    isOpen: () => isOpen,
    getCollection: () => ({ items, enabledItems, highlightedIndex, value: currentValue }),
    position, preferredSide, preferredAlign, sideOffset, alignOffset, avoidCollisions,
    collisionPadding, lockScroll: lockScrollOption,
  });

  const updateHighlight = (index: number, focus = true, ensureVisible = true) => {
    const scrollContainer = getScrollContainer();
    for (let i = 0; i < enabledItems.length; i++) {
      const el = enabledItems[i]!;
      if (i === index) {
        el.setAttribute("data-highlighted", "");
        if (ensureVisible) {
          ensureItemVisibleInContainer(el, scrollContainer);
        }
        if (focus) el.focus();
      } else {
        el.removeAttribute("data-highlighted");
      }
    }
    highlightedIndex = index;
  };

  const clearHighlight = () => {
    for (const el of items) el.removeAttribute("data-highlighted");
    highlightedIndex = -1;
  };
  const highlightSelectedItem = () => {
    const selectedIndex = enabledItems.findIndex((el) => el.dataset["value"] === currentValue);
    if (selectedIndex >= 0) {
      updateHighlight(selectedIndex, false, false);
    } else {
      clearHighlight();
    }
  };
  const clearHighlightAndFocusContent = () => {
    clearHighlight();
    focusElement(content);
  };

  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    trigger.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
    if (state === "open") {
      root.setAttribute("data-open", "");
      trigger.setAttribute("data-open", "");
      content.setAttribute("data-open", "");
      root.removeAttribute("data-closed");
      trigger.removeAttribute("data-closed");
      content.removeAttribute("data-closed");
    } else {
      root.setAttribute("data-closed", "");
      trigger.setAttribute("data-closed", "");
      content.setAttribute("data-closed", "");
      root.removeAttribute("data-open");
      trigger.removeAttribute("data-open");
      content.removeAttribute("data-open");
    }
  };

  const restoreFocus = () => {
    terminalLifecycle.trackRaf(() => {
      if (terminalLifecycle.isDestroyed) return;
      if (previousActiveElement && document.contains(previousActiveElement)) {
        focusElement(previousActiveElement);
      } else if (trigger && document.contains(trigger)) {
        focusElement(trigger);
      }
      previousActiveElement = null;
    });
  };

  const finishClose = () => {
    if (terminalLifecycle.isDestroyed) return;
    portal.restore();
    content.hidden = true;
    if (shouldRestoreFocusOnClose) {
      restoreFocus();
    } else {
      previousActiveElement = null;
    }
  };

  const presence = createPresenceLifecycle({
    element: content,
    onExitComplete: finishClose,
  });

  const updateValueDisplay = () => {
    if (!valueSlot) return;

    if (currentValue === null) {
      valueSlot.textContent = placeholder;
      trigger.setAttribute("data-placeholder", "");
    } else {
      const selectedItem = items.find((item) => item.dataset["value"] === currentValue);
      const label = getItemLabelText(selectedItem, currentValue);
      valueSlot.textContent = label;
      trigger.removeAttribute("data-placeholder");
    }
  };

  const updateOpenState = (
    open: boolean,
    options: { skipFocusRestore?: boolean; immediate?: boolean } = {}
  ) => {
    if (terminalLifecycle.isDestroyed) return;
    const { skipFocusRestore = false, immediate = false } = options;

    if (isOpen === open) return;
    if (disabled && open) return;

    if (open) {
      const openedByPointer = pendingPointerOpen;
      pendingPointerOpen = false;
      shouldRestoreFocusOnClose = true;
      previousActiveElement = document.activeElement as HTMLElement;
      isOpen = true;
      setAria(trigger, "expanded", true);
      portal.mount();
      content.hidden = false;
      setDataState("open");
      presence.enter();

      // Lock scroll
      if (lockScrollOption && !didLockScroll) {
        lockScroll();
        didLockScroll = true;
      }

      cacheItems();
      keyboardMode = false;
      highlightSelectedItem();

      positioning.start();
      positioning.update();
      positioning.sync();

      // Use rAF to refine position after browser has fully rendered content,
      // and to highlight item under cursor if pointer opened the select
      terminalLifecycle.trackRaf(() => {
        if (terminalLifecycle.isDestroyed || !isOpen) return;
        positioning.update();
        positioning.sync();

        // Highlight item under cursor if pointer opened the select
        if (
          openedByPointer &&
          highlightItemOnHover &&
          lastPointerType !== "touch" &&
          (lastPointerX !== 0 || lastPointerY !== 0)
        ) {
          const el = document.elementFromPoint(lastPointerX, lastPointerY);
          const item = el?.closest?.('[data-slot="select-item"]') as HTMLElement | null;
          if (item && !isItemDisabled(item) && content.contains(item)) {
            const index = itemToIndex.get(item);
            if (index !== undefined) {
              updateHighlight(index, true, false);
            }
          }
        }
      });

      content.focus();
    } else {
      isOpen = false;
      pendingPointerOpen = false;
      lastPointerX = 0;
      lastPointerY = 0;
      lastPointerType = "";
      setAria(trigger, "expanded", false);
      setDataState("closed");
      clearHighlight();
      typeahead.reset();
      keyboardMode = false;
      shouldRestoreFocusOnClose = !skipFocusRestore;

      // Unlock scroll
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }

      positioning.stop();
      if (immediate) {
        presence.cleanup();
        finishClose();
      } else {
        presence.exit();
      }
    }

    emit(root, "select:open-change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  const updateValue = (value: string | null, init = false) => {
    if (terminalLifecycle.isDestroyed) return;
    if (currentValue === value && !init) return;

    const oldValue = currentValue;
    currentValue = value;

    formField?.setValue(value);

    // Update root data-value
    if (value !== null) {
      root.setAttribute("data-value", value);
    } else {
      root.removeAttribute("data-value");
    }

    // Update selected state on items
    for (const item of items) {
      const itemValue = item.dataset["value"];
      if (itemValue === value) {
        setAria(item, "selected", true);
        item.setAttribute("data-selected", "");
      } else {
        setAria(item, "selected", false);
        item.removeAttribute("data-selected");
      }
    }

    updateValueDisplay();

    if (!init && oldValue !== value) {
      emit(root, "select:change", { value });
      onValueChange?.(value);
    }
  };

  const selectItem = (item: HTMLElement) => {
    if (isItemDisabled(item)) return;
    const value = item.dataset["value"];
    if (value === undefined) return;

    updateValue(value);
    updateOpenState(false, { immediate: true });
  };

  const handleKeydown = (e: KeyboardEvent) => {
    const len = enabledItems.length;
    if (len === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        keyboardMode = true;
        updateHighlight(
          highlightedIndex === -1 ? 0 : Math.min(highlightedIndex + 1, len - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        keyboardMode = true;
        updateHighlight(
          highlightedIndex === -1 ? len - 1 : Math.max(highlightedIndex - 1, 0)
        );
        break;
      case "Home":
        e.preventDefault();
        keyboardMode = true;
        updateHighlight(0);
        break;
      case "End":
        e.preventDefault();
        keyboardMode = true;
        updateHighlight(len - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightedIndex >= 0) selectItem(enabledItems[highlightedIndex]!);
        break;
      case "Tab":
        // Skip focus restore to allow normal tab navigation
        updateOpenState(false, { skipFocusRestore: true });
        break;
      case "Escape":
        e.preventDefault();
        updateOpenState(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleTypeahead(e.key.toLowerCase());
        }
    }
  };

  const handleTypeahead = (char: string) => {
    const matchIndex = typeahead.match(
      char,
      enabledItems.map((el) => getItemLabelText(el)),
      highlightedIndex
    );

    if (matchIndex !== -1) {
      keyboardMode = true;
      updateHighlight(matchIndex);
    }
  };

  const handleTriggerKeydown = (e: KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        pendingPointerOpen = false;
        updateOpenState(true);
        break;
    }
  };

  // Initialize
  setAria(trigger, "expanded", false);
  content.hidden = true;
  positioning.syncResolvedPositionAttributes();
  setDataState("closed");

  // Initial value display
  cacheItems();
  updateValue(currentValue, true);

  formField = createFormFieldAdapter({
    root,
    name,
    defaultValue,
    disabled,
    required,
    validationTarget: trigger,
    onReset: (value) => {
      updateValue(value, true);
      if (isOpen) {
        typeahead.reset();
        highlightSelectedItem();
      }
    },
  });

  // Trigger events
  cleanups.push(
    on(trigger, "pointerdown", (e) => {
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerType = e.pointerType;
      pendingPointerOpen = true;
    }),
    on(trigger, "click", () => {
      if (!disabled) updateOpenState(!isOpen);
    }),
    on(trigger, "keydown", handleTriggerKeydown)
  );

  // Content events
  cleanups.push(
    on(content, "keydown", handleKeydown),
    on(content, "click", (e) => {
      const item = (e.target as HTMLElement).closest?.('[data-slot="select-item"]') as HTMLElement | null;
      if (item && getOwnedElements(root, content, '[data-slot="select-item"]').includes(item)) {
        selectItem(item);
      }
    }),
    on(content, "pointermove", (e) => {
      if (!highlightItemOnHover || !isHoverPointer(e)) return;

      const item = (e.target as HTMLElement).closest?.('[data-slot="select-item"]') as HTMLElement | null;

      if (keyboardMode) {
        keyboardMode = false;
        if (item && itemToIndex.get(item) === highlightedIndex) return;
      }

      if (item && !isItemDisabled(item)) {
        const index = itemToIndex.get(item);
        if (index !== undefined && index !== highlightedIndex) {
          updateHighlight(index, true);
        }
      } else {
        // Clear highlight when moving to label, separator, or disabled item
        clearHighlightAndFocusContent();
      }
    }),
    on(content, "pointerleave", (e) => {
      if (!highlightItemOnHover || !isHoverPointer(e) || keyboardMode) return;
      clearHighlightAndFocusContent();
    })
  );

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => isOpen,
      onDismiss: () => updateOpenState(false),
      closeOnClickOutside: true,
      closeOnEscape: false,
    })
  );

  // Inbound event
  cleanups.push(
    onRoot(root, "select:set", (e) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.value !== undefined) {
        updateValue(detail.value);
      }
      if (detail?.open !== undefined) {
        updateOpenState(detail.open);
      }
    })
  );

  const controller: SelectController = {
    get value() { return currentValue; },
    get isOpen() { return isOpen; },
    select: (value: string) => { if (!terminalLifecycle.isDestroyed) updateValue(value); },
    open: () => { if (!terminalLifecycle.isDestroyed) updateOpenState(true); },
    close: () => { if (!terminalLifecycle.isDestroyed) updateOpenState(false); },
    destroy: () => {
      if (!terminalLifecycle.destroy()) return;
      typeahead.destroy();
      isOpen = false;
      setAria(trigger, "expanded", false);
      setDataState("closed");
      content.hidden = true;
      // Unlock scroll if still locked
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }
      formField?.destroy();
    },
  };

  registerFloatingTerminalResources(terminalLifecycle, {
    cleanups,
    positionSync: positioning,
    presence,
    portal,
    unbind: () => clearRootBinding(root, ROOT_BINDING_KEY, controller),
  });

  setRootBinding(root, ROOT_BINDING_KEY, controller);

  if (defaultOpen) updateOpenState(true);

  return controller;
}

export function create(scope: ParentNode = document): SelectController[] {
  return discoverSelects(scope, createSelect);
}
