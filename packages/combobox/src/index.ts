import {
  getPart,
  getOwnedElements,
  containsWithPortals,
  reuseRootBinding,
  setRootBinding,
  clearRootBinding,
  setAria,
  ensureId,
  on,
  onRoot,
  emit,
  computeFloatingPosition,
  computeFloatingTransformOrigin,
  measurePopupContentRect,
  createPositionSync,
  createPortalLifecycle,
  createPresenceLifecycle,
  createTerminalLifecycle,
  createDismissLayer,
  createFormFieldAdapter,
} from "@data-slot/core";
import type { FormFieldAdapter } from "@data-slot/core";
import type {
  ComboboxController,
  ComboboxItemToStringValue,
  ComboboxOptions,
  Side,
} from "./types";
import { resolveComboboxConfiguration } from "./configuration";
import { createComboboxCollection } from "./combobox-collection";
import { discoverComboboxes } from "./discovery";

export type {
  Align,
  ComboboxController,
  ComboboxItemToStringValue,
  ComboboxOptions,
  Side,
} from "./types";


const ROOT_BINDING_KEY = "@data-slot/combobox";
const SIDES = ["top", "bottom"] as const;
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/combobox] createCombobox() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

/**
 * Create a combobox controller for a root element.
 *
 * ## Events
 * - **Outbound** `combobox:change` (on root): Fires when value changes.
 *   `event.detail: { value: string | null }`
 * - **Outbound** `combobox:open-change` (on root): Fires when popup opens/closes.
 *   `event.detail: { open: boolean }`
 * - **Outbound** `combobox:input-change` (on root): Fires when user types.
 *   `event.detail: { inputValue: string }`
 * - **Inbound** `combobox:set` (on root): Set value, open state, or input value.
 *   `event.detail: { value?: string | null, open?: boolean, inputValue?: string, itemToStringValue?: ComboboxItemToStringValue | null }`
 */
export function createCombobox(
  root: Element,
  options: ComboboxOptions = {}
): ComboboxController {
  const existingController = reuseRootBinding<ComboboxController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  const input = getPart<HTMLInputElement>(root, "combobox-input");
  const content = getPart<HTMLElement>(root, "combobox-content");
  const list = getPart<HTMLElement>(root, "combobox-list") ??
    getOwnedElements<HTMLElement>(root, content ?? root, '[data-slot="combobox-list"]')[0] ??
    null;
  const trigger = getPart<HTMLElement>(root, "combobox-trigger");
  const clearButton = getPart<HTMLElement>(root, "combobox-clear");
  const valueSlot = getPart<HTMLElement>(root, "combobox-value");
  const emptySlot = getOwnedElements<HTMLElement>(
    root,
    list ?? content ?? root,
    '[data-slot="combobox-empty"]'
  )[0] ?? null;
  const authoredPositionerCandidate = getPart<HTMLElement>(root, "combobox-positioner");
  const authoredPositioner =
    authoredPositionerCandidate && content && authoredPositionerCandidate.contains(content)
      ? authoredPositionerCandidate
      : null;
  const authoredPortalCandidate = getPart<HTMLElement>(root, "combobox-portal");
  const authoredPortal =
    authoredPortalCandidate && authoredPositioner && authoredPortalCandidate.contains(authoredPositioner)
      ? authoredPortalCandidate
      : null;

  if (!input || !content) {
    throw new Error("Combobox requires combobox-input and combobox-content slots");
  }
  const isPopupInputMode = content.contains(input);
  const valueSlotPlaceholder = valueSlot?.textContent?.trim() ?? "";

  // Resolve options: JS > data-* > defaults
  const {
    defaultValue, defaultOpen, placeholder, disabled, required, name, openOnFocus, autoHighlight,
    customFilter, onValueChange, onOpenChange, onInputValueChange, preferredSide, preferredAlign,
    sideOffset, alignOffset, avoidCollisions, collisionPadding,
  } = resolveComboboxConfiguration(root, input, content, authoredPositioner, options);
  let itemToStringValue = options.itemToStringValue ?? null;

  // State
  let isOpen = false;
  let currentValue: string | null = defaultValue;
  let keyboardMode = false;
  let openRenderedSide: Side | null = null;
  const cleanups: Array<() => void> = [];
  const doc = root.ownerDocument ?? document;
  const win = doc.defaultView ?? window;
  const rootElement = root as HTMLElement;
  const FOCUS_OPEN_INTENT_WINDOW_MS = 750;
  let lastTabKeydownAt = -Infinity;
  let openOnNextFocusFromPointer = false;
  let suppressOpenOnNextFocus = false;

  let formField: FormFieldAdapter | null = null;

  // Portal lifecycle
  const portal = createPortalLifecycle({
    content,
    root,
    wrapperSlot: authoredPositioner ? undefined : "combobox-positioner",
    container: authoredPositioner ?? undefined,
    mountTarget: authoredPositioner ? authoredPortal ?? authoredPositioner : undefined,
  });
  const terminalLifecycle = createTerminalLifecycle();

  const matchesMediaQuery = (query: string): boolean => {
    if (typeof win.matchMedia !== "function") return false;
    return win.matchMedia(query).matches;
  };

  const isLikelyMobileTouchEnvironment = (): boolean => {
    const touchPoints = typeof win.navigator.maxTouchPoints === "number" ? win.navigator.maxTouchPoints : 0;
    const coarsePointer = matchesMediaQuery("(pointer: coarse)");
    const noHover = matchesMediaQuery("(hover: none)");
    return coarsePointer || (touchPoints > 0 && noHover);
  };

  const isMobileTouchEnvironment = isLikelyMobileTouchEnvironment();

  // ARIA setup
  const inputId = ensureId(input, "combobox-input");
  const listEl = list ?? content;
  const listId = ensureId(listEl, "combobox-list");

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-controls", listId);

  if (list) {
    list.setAttribute("role", "listbox");
  } else {
    content.setAttribute("role", "listbox");
  }

  if (trigger) {
    if (!trigger.hasAttribute("type")) {
      trigger.setAttribute("type", "button");
    }
    if (!trigger.hasAttribute("tabindex")) {
      trigger.tabIndex = -1;
    }
    trigger.setAttribute("aria-label", "Toggle");
  }

  if (clearButton instanceof HTMLButtonElement && !clearButton.hasAttribute("type")) {
    clearButton.setAttribute("type", "button");
  }
  if (clearButton && !clearButton.hasAttribute("tabindex")) {
    clearButton.tabIndex = -1;
  }

  // Native <label for="..."> support
  const nativeLabel = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(inputId)}"]`);
  if (nativeLabel) {
    const labelId = ensureId(nativeLabel, "combobox-label");
    const existing = input.getAttribute("aria-labelledby");
    input.setAttribute("aria-labelledby", existing ? `${existing} ${labelId}` : labelId);
    listEl.setAttribute("aria-labelledby", labelId);
  }

  if (disabled) {
    input.setAttribute("aria-disabled", "true");
    input.disabled = true;
    if (trigger) {
      trigger.setAttribute("aria-disabled", "true");
      trigger.setAttribute("data-disabled", "");
    }
  }
  if (required) {
    input.setAttribute("aria-required", "true");
    input.required = true;
  }

  // Sync native validity for required constraint
  const syncValidity = () => {
    if (!required) return;
    input.setCustomValidity(currentValue === null ? "Please select a value" : "");
  };

  // Placeholder
  if (placeholder) {
    input.placeholder = placeholder;
  }
  if (valueSlot) {
    valueSlot.textContent = valueSlotPlaceholder || placeholder;
    if (valueSlot.textContent.trim().length > 0) {
      valueSlot.setAttribute("data-placeholder", "");
      trigger?.setAttribute("data-placeholder", "");
    }
  }


  const collection = createComboboxCollection({
    root,
    container: list ?? content,
    input,
    emptySlot,
    filter: customFilter ?? ((inputValue, _itemValue, itemLabel) =>
      itemLabel.toLowerCase().includes(inputValue.toLowerCase())),
    itemToStringValue,
  });

  // Positioning
  const syncPositionCssVars = (positioner: HTMLElement, anchorRect: DOMRectReadOnly, side: Side) => {
    const visualViewport = win.visualViewport;
    const viewportY = visualViewport?.offsetTop ?? 0;
    const viewportWidth = visualViewport?.width ?? win.innerWidth;
    const viewportHeight = visualViewport?.height ?? win.innerHeight;
    const availableWidth = Math.max(0, viewportWidth - (collisionPadding * 2));
    const availableHeight =
      side === "top"
        ? Math.max(0, anchorRect.top - viewportY - collisionPadding - sideOffset)
        : Math.max(0, (viewportY + viewportHeight) - anchorRect.bottom - collisionPadding - sideOffset);

    // Snap anchor dimensions to device pixels so popup sizing matches the anchor visually.
    const dpr = win.devicePixelRatio || 1;
    const anchorWidth = (Math.round((anchorRect.x + anchorRect.width) * dpr) - Math.round(anchorRect.x * dpr)) / dpr;
    const anchorHeight = (Math.round((anchorRect.y + anchorRect.height) * dpr) - Math.round(anchorRect.y * dpr)) / dpr;

    const applyVars = (element: HTMLElement) => {
      element.style.setProperty("--available-width", `${availableWidth}px`);
      element.style.setProperty("--available-height", `${availableHeight}px`);
      element.style.setProperty("--anchor-width", `${anchorWidth}px`);
      element.style.setProperty("--anchor-height", `${anchorHeight}px`);
    };

    applyVars(content);
    if (positioner !== content) {
      applyVars(positioner);
    }
  };

  const updatePosition = () => {
    const positioner = portal.container as HTMLElement;
    const effectiveSide: Side = isMobileTouchEnvironment ? "bottom" : (openRenderedSide ?? preferredSide);
    const effectiveAvoidCollisions = isMobileTouchEnvironment ? false : avoidCollisions;
    // Anchor to root element (contains both input and trigger)
    const anchorRect = rootElement.getBoundingClientRect();
    content.style.minWidth = `${anchorRect.width}px`;
    const cr = measurePopupContentRect(content);
    const pos = computeFloatingPosition({
      anchorRect,
      contentRect: cr,
      side: effectiveSide,
      align: preferredAlign,
      sideOffset,
      alignOffset,
      avoidCollisions: effectiveAvoidCollisions,
      collisionPadding,
      allowedSides: SIDES,
    });
    const transformOrigin = computeFloatingTransformOrigin({
      side: pos.side,
      align: pos.align,
      anchorRect,
      popupX: pos.x,
      popupY: pos.y,
    });

    positioner.style.position = "absolute";
    positioner.style.top = "0px";
    positioner.style.left = "0px";
    positioner.style.transform = `translate3d(${pos.x + win.scrollX}px, ${pos.y + win.scrollY}px, 0)`;
    positioner.style.setProperty("--transform-origin", transformOrigin);
    positioner.style.willChange = "transform";
    positioner.style.margin = "0";
    syncPositionCssVars(positioner, anchorRect, pos.side as Side);
    if (!isMobileTouchEnvironment && effectiveAvoidCollisions) {
      openRenderedSide = pos.side as Side;
    }
    content.setAttribute("data-side", pos.side);
    content.setAttribute("data-align", pos.align);
    if (positioner !== content) {
      positioner.setAttribute("data-side", pos.side);
      positioner.setAttribute("data-align", pos.align);
    }
  };

  const positionSync = createPositionSync({
    observedElements: [root as HTMLElement, content],
    isActive: () => isOpen,
    ancestorScroll: true,
    onUpdate: updatePosition,
    ignoreScrollTarget: (target) => target instanceof Node && content.contains(target),
  });

  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
    if (trigger) trigger.setAttribute("data-state", state);
    if (state === "open") {
      root.setAttribute("data-open", "");
      content.setAttribute("data-open", "");
      if (trigger) trigger.setAttribute("data-open", "");
      root.removeAttribute("data-closed");
      content.removeAttribute("data-closed");
      if (trigger) trigger.removeAttribute("data-closed");
    } else {
      root.setAttribute("data-closed", "");
      content.setAttribute("data-closed", "");
      if (trigger) trigger.setAttribute("data-closed", "");
      root.removeAttribute("data-open");
      content.removeAttribute("data-open");
      if (trigger) trigger.removeAttribute("data-open");
    }
  };

  const presence = createPresenceLifecycle({
    element: content,
    onExitComplete: () => {
      if (terminalLifecycle.isDestroyed) return;
      portal.restore();
      content.hidden = true;
    },
  });

  // Shows the current results and highlights the committed value if visible.
  const syncOpenResults = () => {
    keyboardMode = false;
    // In popup-input mode, input text is transient search and should start empty.
    if (isPopupInputMode) {
      input.value = "";
    }
    collection.filter(input.value);
    const selectedIndex = collection.enabled.findIndex((item) => collection.valueOf(item) === currentValue);
    if (selectedIndex >= 0) {
      collection.highlight(selectedIndex);
    } else {
      collection.clearHighlight();
    }
  };

  const updateOpenState = (open: boolean, skipFocusRestore = false) => {
    if (terminalLifecycle.isDestroyed) return;
    if (isOpen === open) return;
    if (disabled && open) return;

    if (open) {
      isOpen = true;
      openRenderedSide = null;
      setAria(input, "expanded", true);
      portal.mount();
      content.hidden = false;
      setDataState("open");
      presence.enter();

      collection.cache(currentValue);
      syncOpenResults();

      positionSync.start();
      updatePosition();
      positionSync.update();

      terminalLifecycle.trackRaf(() => {
        if (terminalLifecycle.isDestroyed || !isOpen) return;
        positionSync.update();
      });
    } else {
      isOpen = false;
      openRenderedSide = null;
      setAria(input, "expanded", false);
      setDataState("closed");
      collection.clearHighlight();
      keyboardMode = false;

      positionSync.stop();
      presence.exit();

      if (isPopupInputMode) {
        input.value = "";
      } else {
        // Restore input text to committed value's label
        const committedLabel = collection.labelFor(currentValue);
        input.value = committedLabel;
      }

      if (!skipFocusRestore) {
        // Keep focus on input
      }
    }

    emit(root, "combobox:open-change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  const updateValue = (value: string | null, init = false) => {
    if (currentValue === value && !init) return;

    const oldValue = currentValue;
    currentValue = value;
    syncValidity();

    formField?.setValue(value);

    // Update root data-value
    if (value !== null) {
      root.setAttribute("data-value", value);
    } else {
      root.removeAttribute("data-value");
    }

    collection.select(value);

    const resolvedLabel = collection.labelFor(value);
    if (!isPopupInputMode) {
      input.value = resolvedLabel;
    }
    if (valueSlot) {
      if (value === null) {
        valueSlot.textContent = valueSlotPlaceholder || placeholder;
        if ((valueSlot.textContent ?? "").trim().length > 0) {
          valueSlot.setAttribute("data-placeholder", "");
          trigger?.setAttribute("data-placeholder", "");
        } else {
          valueSlot.removeAttribute("data-placeholder");
          trigger?.removeAttribute("data-placeholder");
        }
      } else {
        valueSlot.textContent = resolvedLabel;
        valueSlot.removeAttribute("data-placeholder");
        trigger?.removeAttribute("data-placeholder");
      }
    } else if (trigger) {
      if (value === null) {
        trigger.setAttribute("data-placeholder", "");
      } else {
        trigger.removeAttribute("data-placeholder");
      }
    }

    if (!init && oldValue !== value) {
      emit(root, "combobox:change", { value });
      onValueChange?.(value);
    }
  };

  const selectItem = (item: HTMLElement) => {
    if (collection.isDisabled(item)) return;
    const value = collection.valueOf(item);
    if (value === undefined) return;

    updateValue(value);
    updateOpenState(false);
  };

  const clearFromButton = () => {
    if (disabled || input.readOnly) return;
    if (clearButton && (clearButton.hasAttribute("disabled") || clearButton.getAttribute("aria-disabled") === "true")) {
      return;
    }

    updateValue(null);
    input.value = "";
    collection.clearHighlight();

    if (isOpen) {
      collection.filter(input.value);
      positionSync.update();
    }

    const shouldSuppressFocusOpen = doc.activeElement !== input;
    suppressOpenOnNextFocus = shouldSuppressFocusOpen;
    input.focus();
    if (!shouldSuppressFocusOpen) {
      suppressOpenOnNextFocus = false;
    }
  };

  // Keyboard navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (!isOpen) {
          updateOpenState(true);
          if (autoHighlight && collection.enabled.length > 0) {
            collection.highlight(0);
          }
          return;
        }
        keyboardMode = true;
        const len = collection.enabled.length;
        if (len === 0) return;
        collection.highlight(collection.highlightedIndex === -1 ? 0 : (collection.highlightedIndex + 1) % len);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!isOpen) {
          updateOpenState(true);
          if (autoHighlight && collection.enabled.length > 0) {
            collection.highlight(collection.enabled.length - 1);
          }
          return;
        }
        keyboardMode = true;
        const len = collection.enabled.length;
        if (len === 0) return;
        collection.highlight(collection.highlightedIndex === -1 ? len - 1 : (collection.highlightedIndex - 1 + len) % len);
        break;
      }
      case "Home":
        if (!isOpen) return;
        e.preventDefault();
        keyboardMode = true;
        if (collection.enabled.length > 0) collection.highlight(0);
        break;
      case "End":
        if (!isOpen) return;
        e.preventDefault();
        keyboardMode = true;
        if (collection.enabled.length > 0) collection.highlight(collection.enabled.length - 1);
        break;
      case "Enter":
        if (!isOpen) return;
        e.preventDefault();
        if (collection.highlightedIndex >= 0 && collection.highlightedIndex < collection.enabled.length) {
          selectItem(collection.enabled[collection.highlightedIndex]!);
        }
        break;
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          updateOpenState(false);
        } else if (currentValue !== null) {
          e.preventDefault();
          updateValue(null);
        }
        break;
      case "Tab":
        if (isOpen) {
          updateOpenState(false, true);
        }
        break;
    }
  };

  // Handle input events (user typing)
  const handleInput = () => {
    const val = input.value;
    const hasTypedQuery = val.trim() !== "";

    // Emit user-initiated input change
    emit(root, "combobox:input-change", { inputValue: val });
    onInputValueChange?.(val);

    // Open if not already open
    if (!isOpen) {
      updateOpenState(true);
      if (autoHighlight && hasTypedQuery && collection.enabled.length > 0) {
        collection.highlight(0);
      } else if (collection.highlightedIndex !== -1) {
        collection.clearHighlight();
      }
    } else {
      // Re-filter
      collection.filter(val);

      // Auto-highlight only after non-whitespace query input.
      if (autoHighlight && hasTypedQuery && collection.enabled.length > 0) {
        collection.highlight(0);
      } else {
        collection.clearHighlight();
      }

      // Update position after filter changes content size
      positionSync.update();
    }
  };

  // Focus handling
  const handleFocus = () => {
    if (disabled) return;
    if (suppressOpenOnNextFocus) {
      suppressOpenOnNextFocus = false;
      openOnNextFocusFromPointer = false;
      return;
    }
    // On touch/coarse-pointer devices, avoid forcing text selection on focus.
    // This can interfere with native viewport scrolling behavior on mobile Safari.
    if (!isMobileTouchEnvironment) {
      // Select all text for easy re-type
      input.select();
    }
    const now = Date.now();
    const hasIntent = openOnNextFocusFromPointer || now - lastTabKeydownAt <= FOCUS_OPEN_INTENT_WINDOW_MS;
    openOnNextFocusFromPointer = false;
    if (openOnFocus && !isOpen && hasIntent) {
      updateOpenState(true);
    }
  };

  // Initialize
  setAria(input, "expanded", false);
  content.hidden = true;
  setDataState("closed");

  // Set initial value and input text
  updateValue(currentValue, true);

  formField = createFormFieldAdapter({
    root,
    name,
    defaultValue,
    control: input,
    disabled,
    onReset: (value) => {
      updateValue(value, true);
      if (isOpen) {
        syncOpenResults();
        positionSync.update();
      }
    },
  });

  // Event listeners
  cleanups.push(
    on(doc, "keydown", (e) => {
      if ((e as KeyboardEvent).key === "Tab") {
        lastTabKeydownAt = Date.now();
      }
    }, { capture: true }),
    on(input, "pointerdown", () => {
      openOnNextFocusFromPointer = true;
    }),
    on(input, "input", handleInput),
    on(input, "keydown", handleKeydown),
    on(input, "focus", handleFocus)
  );

  // Trigger button
  if (trigger) {
    cleanups.push(
      on(trigger, "click", () => {
        if (disabled) return;
        if (isOpen) {
          updateOpenState(false);
        } else {
          updateOpenState(true);
          input.focus();
        }
      })
    );
  }

  if (clearButton) {
    cleanups.push(
      on(clearButton, "mousedown", (e) => {
        e.preventDefault();
      }),
      on(clearButton, "click", () => {
        clearFromButton();
      })
    );
  }

  // Content pointer events
  cleanups.push(
    on(content, "click", (e) => {
      const item = (e.target as HTMLElement).closest?.('[data-slot="combobox-item"]') as HTMLElement | null;
      if (item && !item.hidden && getOwnedElements(root, list ?? content, '[data-slot="combobox-item"]').includes(item)) {
        selectItem(item);
      }
    }),
    on(content, "pointermove", (e) => {
      const item = (e.target as HTMLElement).closest?.('[data-slot="combobox-item"]') as HTMLElement | null;

      if (keyboardMode) {
        keyboardMode = false;
        if (item && collection.indexOf(item) === collection.highlightedIndex) return;
      }

      if (item && !item.hidden) {
        const index = collection.indexOf(item);
        if (index !== undefined && index !== collection.highlightedIndex) {
          collection.highlight(index);
        }
      } else {
        collection.clearHighlight();
      }
    }),
    on(content, "pointerleave", () => {
      if (!keyboardMode) collection.clearHighlight();
    }),
    // Prevent mousedown on content from stealing focus from input
    on(content, "mousedown", (e) => {
      e.preventDefault();
    })
  );

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => isOpen,
      onDismiss: () => updateOpenState(false),
      closeOnClickOutside: !isMobileTouchEnvironment,
      closeOnEscape: false,
    })
  );

  if (isMobileTouchEnvironment) {
    cleanups.push(
      on(doc, "click", (event) => {
        if (!isOpen) return;
        const target = event.target as Node | null;
        if (containsWithPortals(root, target)) return;
        updateOpenState(false);
      }, { capture: true })
    );
  }

  // Inbound event
  cleanups.push(
    onRoot(root, "combobox:set", (e) => {
      const detail = (e as CustomEvent).detail;
      // Value first (syncs input to label), then inputValue can override
      if (detail?.value !== undefined) {
        updateValue(detail.value);
      }
      if (detail?.open !== undefined) {
        updateOpenState(detail.open);
      }
      if (detail?.inputValue !== undefined) {
        input.value = detail.inputValue;
      }
      if (detail?.itemToStringValue !== undefined) {
        itemToStringValue = detail.itemToStringValue;
        collection.setItemToStringValue(itemToStringValue);
        updateValue(currentValue, true);
      }
    })
  );

  const controller: ComboboxController = {
    get value() { return currentValue; },
    get inputValue() { return input.value; },
    get isOpen() { return isOpen; },
    select: (value: string) => { if (!terminalLifecycle.isDestroyed) updateValue(value); },
    clear: () => { if (!terminalLifecycle.isDestroyed) updateValue(null); },
    open: () => { if (!terminalLifecycle.isDestroyed) updateOpenState(true); },
    close: () => { if (!terminalLifecycle.isDestroyed) updateOpenState(false); },
    setItemToStringValue: (nextItemToStringValue: ComboboxItemToStringValue | null) => {
      if (terminalLifecycle.isDestroyed) return;
      itemToStringValue = nextItemToStringValue;
      collection.setItemToStringValue(itemToStringValue);
      updateValue(currentValue, true);
    },
    destroy: () => {
      if (!terminalLifecycle.destroy()) return;
      isOpen = false;
      setAria(input, "expanded", false);
      setDataState("closed");
      positionSync.stop();
      presence.cleanup();
      portal.cleanup();
      content.hidden = true;
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      formField?.destroy();
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(root, ROOT_BINDING_KEY, controller);
  if (defaultOpen) updateOpenState(true);

  return controller;
}

export function create(scope: ParentNode = document): ComboboxController[] {
  return discoverComboboxes(scope, createCombobox);
}
