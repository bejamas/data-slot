import {
  getPart,
  getParts,
  getRoots,
  getDataBool,
  getDataNumber,
  getDataString,
  getDataEnum,
  setAria,
  ensureId,
  on,
  emit,
  computeFloatingPosition,
  createPositionSync,
  createPortalLifecycle,
  createDismissLayer,
} from "@data-slot/core";

/** Side of the input to place the content */
export type Side = "top" | "bottom";
const SIDES = ["top", "bottom"] as const;

/** Alignment of the content relative to the input */
export type Align = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;

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
  /** Auto-highlight first visible item when filtering @default true */
  autoHighlight?: boolean;
  /** Custom filter function. Return true to show item. */
  filter?: (inputValue: string, itemValue: string, itemLabel: string) => boolean;

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
  /** Cleanup all event listeners */
  destroy(): void;
}

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
 *   `event.detail: { value?: string | null, open?: boolean, inputValue?: string }`
 */
export function createCombobox(
  root: Element,
  options: ComboboxOptions = {}
): ComboboxController {
  const input = getPart<HTMLInputElement>(root, "combobox-input");
  const content = getPart<HTMLElement>(root, "combobox-content");
  const list = getPart<HTMLElement>(root, "combobox-list") ?? getPart<HTMLElement>(content ?? root, "combobox-list");
  const trigger = getPart<HTMLElement>(root, "combobox-trigger");
  const emptySlot = getPart<HTMLElement>(list ?? content ?? root, "combobox-empty");

  if (!input || !content) {
    throw new Error("Combobox requires combobox-input and combobox-content slots");
  }

  // Resolve options: JS > data-* > defaults
  const defaultValue = options.defaultValue ?? getDataString(root, "defaultValue") ?? null;
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const placeholder = options.placeholder ?? getDataString(root, "placeholder") ?? "";
  const disabled = options.disabled ?? getDataBool(root, "disabled") ?? false;
  const required = options.required ?? getDataBool(root, "required") ?? false;
  const name = options.name ?? getDataString(root, "name") ?? null;
  const openOnFocus = options.openOnFocus ?? getDataBool(root, "openOnFocus") ?? true;
  const autoHighlight = options.autoHighlight ?? getDataBool(root, "autoHighlight") ?? true;
  const customFilter = options.filter ?? null;
  const onValueChange = options.onValueChange;
  const onOpenChange = options.onOpenChange;
  const onInputValueChange = options.onInputValueChange;

  // Positioning options
  const preferredSide =
    options.side ??
    getDataEnum(content, "side", SIDES) ??
    getDataEnum(root, "side", SIDES) ??
    "bottom";
  const preferredAlign =
    options.align ??
    getDataEnum(content, "align", ALIGNS) ??
    getDataEnum(root, "align", ALIGNS) ??
    "start";
  const sideOffset =
    options.sideOffset ??
    getDataNumber(content, "sideOffset") ??
    getDataNumber(root, "sideOffset") ??
    4;
  const alignOffset =
    options.alignOffset ??
    getDataNumber(content, "alignOffset") ??
    getDataNumber(root, "alignOffset") ??
    0;
  const avoidCollisions =
    options.avoidCollisions ??
    getDataBool(content, "avoidCollisions") ??
    getDataBool(root, "avoidCollisions") ??
    true;
  const collisionPadding =
    options.collisionPadding ??
    getDataNumber(content, "collisionPadding") ??
    getDataNumber(root, "collisionPadding") ??
    8;

  // State
  let isOpen = false;
  let currentValue: string | null = defaultValue;
  let highlightedIndex = -1;
  let keyboardMode = false;
  const cleanups: Array<() => void> = [];

  // Cached on open
  let allItems: HTMLElement[] = [];
  let visibleItems: HTMLElement[] = [];
  let enabledVisibleItems: HTMLElement[] = [];
  let itemToEnabledIndex = new Map<HTMLElement, number>();

  // Hidden input for form integration
  let hiddenInput: HTMLInputElement | null = null;

  // Portal lifecycle
  const portal = createPortalLifecycle({ content, root });

  const isItemDisabled = (el: HTMLElement) =>
    el.hasAttribute("disabled") || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";

  const getItemLabel = (el: HTMLElement) => {
    if (el.dataset["label"]) return el.dataset["label"];
    // Try direct text nodes first (excludes child element text like check marks)
    let directText = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        directText += node.textContent;
      }
    }
    const trimmed = directText.trim();
    if (trimmed) return trimmed;
    // Fall back to full textContent for wrapped labels like <span>Apple</span>
    return el.textContent?.trim() ?? "";
  };

  const getItemValue = (el: HTMLElement): string | undefined =>
    el.hasAttribute("data-value") ? el.getAttribute("data-value")! : undefined;

  // Get the label for a given value by searching all items
  const getLabelForValue = (value: string | null): string => {
    if (value === null) return "";
    const container = list ?? content;
    const items = getParts<HTMLElement>(container, "combobox-item");
    const item = items.find((el) => getItemValue(el) === value);
    return item ? getItemLabel(item) : "";
  };

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
    trigger.tabIndex = -1;
    trigger.setAttribute("aria-label", "Toggle");
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

  // Form integration: strip name from visible input, create hidden input
  if (name) {
    if (input.name) input.removeAttribute("name");
    hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.name = name;
    hiddenInput.value = currentValue ?? "";
    root.appendChild(hiddenInput);
  }

  // Default filter: case-insensitive substring
  const defaultFilter = (inputVal: string, _itemValue: string, itemLabel: string) =>
    itemLabel.toLowerCase().includes(inputVal.toLowerCase());

  const filterFn = customFilter ?? defaultFilter;

  // Cache items from content
  const cacheItems = () => {
    const container = list ?? content;
    allItems = getParts<HTMLElement>(container, "combobox-item");

    for (const item of allItems) {
      item.setAttribute("role", "option");
      ensureId(item, "combobox-item");
      if (isItemDisabled(item)) {
        item.setAttribute("aria-disabled", "true");
      } else {
        item.removeAttribute("aria-disabled");
      }

      // Mark selected
      const itemValue = getItemValue(item);
      if (itemValue === currentValue) {
        setAria(item, "selected", true);
        item.setAttribute("data-selected", "");
      } else {
        setAria(item, "selected", false);
        item.removeAttribute("data-selected");
      }
    }

    // Set groups' ARIA
    const groups = getParts<HTMLElement>(container, "combobox-group");
    for (const group of groups) {
      group.setAttribute("role", "group");
      const label = getPart<HTMLElement>(group, "combobox-label");
      if (label) {
        const labelId = ensureId(label, "combobox-label");
        group.setAttribute("aria-labelledby", labelId);
      }
    }

    rebuildVisibleItems();
  };

  // Rebuild visible/enabled item caches after filtering
  const rebuildVisibleItems = () => {
    visibleItems = allItems.filter((el) => !el.hidden);
    enabledVisibleItems = visibleItems.filter((el) => !isItemDisabled(el));
    itemToEnabledIndex = new Map(enabledVisibleItems.map((el, i) => [el, i]));
  };

  // Check if a separator has a visible non-separator sibling in a direction
  const hasVisibleSibling = (el: HTMLElement, dir: "previous" | "next"): boolean => {
    let sib = dir === "previous" ? el.previousElementSibling : el.nextElementSibling;
    while (sib) {
      if (sib instanceof HTMLElement && !sib.hidden && sib.dataset["slot"] !== "combobox-separator") {
        return true;
      }
      sib = dir === "previous" ? sib.previousElementSibling : sib.nextElementSibling;
    }
    return false;
  };

  // Filtering
  const applyFilter = (inputVal: string) => {
    const container = list ?? content;
    const trimmed = inputVal.trim();
    let visibleCount = 0;

    for (const item of allItems) {
      const itemValue = getItemValue(item) ?? "";
      const itemLabel = getItemLabel(item);
      const matches = trimmed === "" || filterFn(trimmed, itemValue, itemLabel);
      item.hidden = !matches;
      if (matches) visibleCount++;
    }

    // Hide groups where all items are hidden
    const groups = getParts<HTMLElement>(container, "combobox-group");
    for (const group of groups) {
      const groupItems = getParts<HTMLElement>(group, "combobox-item");
      const hasVisible = groupItems.some((el) => !el.hidden);
      group.hidden = !hasVisible;
    }

    // Hide separators that are first/last visible child
    const separators = getParts<HTMLElement>(container, "combobox-separator");
    for (const sep of separators) {
      sep.hidden = !hasVisibleSibling(sep, "previous") || !hasVisibleSibling(sep, "next");
    }

    // Show/hide empty message
    if (emptySlot) {
      emptySlot.hidden = visibleCount > 0;
    }

    // Set data-empty on content
    if (visibleCount === 0) {
      content.setAttribute("data-empty", "");
    } else {
      content.removeAttribute("data-empty");
    }

    rebuildVisibleItems();
  };

  // Positioning
  const updatePosition = () => {
    // Anchor to root element (contains both input and trigger)
    const anchorRect = (root as HTMLElement).getBoundingClientRect();
    content.style.minWidth = `${anchorRect.width}px`;
    const cr = content.getBoundingClientRect();
    const pos = computeFloatingPosition({
      anchorRect,
      contentRect: cr,
      side: preferredSide,
      align: preferredAlign,
      sideOffset,
      alignOffset,
      avoidCollisions,
      collisionPadding,
      allowedSides: SIDES,
    });

    content.style.position = "fixed";
    content.style.top = `${pos.y}px`;
    content.style.left = `${pos.x}px`;
    content.style.margin = "0";
    content.setAttribute("data-side", pos.side);
    content.setAttribute("data-align", pos.align);
  };

  const positionSync = createPositionSync({
    observedElements: [root as HTMLElement, content],
    isActive: () => isOpen,
    onUpdate: updatePosition,
    ignoreScrollTarget: (target) => target instanceof Node && content.contains(target),
  });

  // Highlighting
  const updateHighlight = (index: number) => {
    for (let i = 0; i < enabledVisibleItems.length; i++) {
      const el = enabledVisibleItems[i]!;
      if (i === index) {
        el.setAttribute("data-highlighted", "");
        input.setAttribute("aria-activedescendant", el.id);
      } else {
        el.removeAttribute("data-highlighted");
      }
    }
    highlightedIndex = index;
  };

  const clearHighlight = () => {
    for (const el of allItems) el.removeAttribute("data-highlighted");
    highlightedIndex = -1;
    input.removeAttribute("aria-activedescendant");
  };

  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
    if (trigger) trigger.setAttribute("data-state", state);
  };

  const updateOpenState = (open: boolean, skipFocusRestore = false) => {
    if (isOpen === open) return;
    if (disabled && open) return;

    if (open) {
      isOpen = true;
      setAria(input, "expanded", true);
      portal.mount();
      content.hidden = false;
      setDataState("open");

      cacheItems();
      keyboardMode = false;

      // Apply current filter
      applyFilter(input.value);

      // Highlight selected item if visible, else auto-highlight first
      const selectedIndex = enabledVisibleItems.findIndex((el) => getItemValue(el) === currentValue);
      if (selectedIndex >= 0) {
        updateHighlight(selectedIndex);
      } else if (autoHighlight && enabledVisibleItems.length > 0) {
        updateHighlight(0);
      } else {
        clearHighlight();
      }

      positionSync.start();
      updatePosition();
      positionSync.update();

      requestAnimationFrame(() => {
        if (!isOpen) return;
        positionSync.update();
      });
    } else {
      isOpen = false;
      setAria(input, "expanded", false);
      portal.restore();
      content.hidden = true;
      setDataState("closed");
      clearHighlight();
      keyboardMode = false;

      positionSync.stop();

      // Restore input text to committed value's label
      const committedLabel = getLabelForValue(currentValue);
      input.value = committedLabel;

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

    // Update hidden input
    if (hiddenInput) {
      hiddenInput.value = value ?? "";
    }

    // Update root data-value
    if (value !== null) {
      root.setAttribute("data-value", value);
    } else {
      root.removeAttribute("data-value");
    }

    // Update selected state on all items (may not be cached yet on init)
    const container = list ?? content;
    const items = allItems.length > 0 ? allItems : getParts<HTMLElement>(container, "combobox-item");
    for (const item of items) {
      const itemValue = getItemValue(item);
      if (itemValue === value) {
        setAria(item, "selected", true);
        item.setAttribute("data-selected", "");
      } else {
        setAria(item, "selected", false);
        item.removeAttribute("data-selected");
      }
    }

    // Sync input text to value's label
    input.value = getLabelForValue(value);

    if (!init && oldValue !== value) {
      emit(root, "combobox:change", { value });
      onValueChange?.(value);
    }
  };

  const selectItem = (item: HTMLElement) => {
    if (isItemDisabled(item)) return;
    const value = getItemValue(item);
    if (value === undefined) return;

    updateValue(value);
    updateOpenState(false);
  };

  // Keyboard navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (!isOpen) {
          updateOpenState(true);
          return;
        }
        keyboardMode = true;
        const len = enabledVisibleItems.length;
        if (len === 0) return;
        updateHighlight(highlightedIndex === -1 ? 0 : (highlightedIndex + 1) % len);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!isOpen) {
          updateOpenState(true);
          return;
        }
        keyboardMode = true;
        const len = enabledVisibleItems.length;
        if (len === 0) return;
        updateHighlight(highlightedIndex === -1 ? len - 1 : (highlightedIndex - 1 + len) % len);
        break;
      }
      case "Home":
        if (!isOpen) return;
        e.preventDefault();
        keyboardMode = true;
        if (enabledVisibleItems.length > 0) updateHighlight(0);
        break;
      case "End":
        if (!isOpen) return;
        e.preventDefault();
        keyboardMode = true;
        if (enabledVisibleItems.length > 0) updateHighlight(enabledVisibleItems.length - 1);
        break;
      case "Enter":
        if (!isOpen) return;
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < enabledVisibleItems.length) {
          selectItem(enabledVisibleItems[highlightedIndex]!);
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

    // Emit user-initiated input change
    emit(root, "combobox:input-change", { inputValue: val });
    onInputValueChange?.(val);

    // Open if not already open
    if (!isOpen) {
      updateOpenState(true);
    } else {
      // Re-filter
      applyFilter(val);

      // Auto-highlight first visible item
      if (autoHighlight && enabledVisibleItems.length > 0) {
        updateHighlight(0);
      } else {
        clearHighlight();
      }

      // Update position after filter changes content size
      positionSync.update();
    }
  };

  // Focus handling
  const handleFocus = () => {
    if (disabled) return;
    // Select all text for easy re-type
    input.select();
    if (openOnFocus && !isOpen) {
      updateOpenState(true);
    }
  };

  // Initialize
  setAria(input, "expanded", false);
  content.hidden = true;
  setDataState("closed");

  // Set initial value and input text
  updateValue(currentValue, true);

  // Event listeners
  cleanups.push(
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

  // Content pointer events
  cleanups.push(
    on(content, "click", (e) => {
      const item = (e.target as HTMLElement).closest?.('[data-slot="combobox-item"]') as HTMLElement | null;
      if (item && !item.hidden) selectItem(item);
    }),
    on(content, "pointermove", (e) => {
      const item = (e.target as HTMLElement).closest?.('[data-slot="combobox-item"]') as HTMLElement | null;

      if (keyboardMode) {
        keyboardMode = false;
        if (item && itemToEnabledIndex.get(item) === highlightedIndex) return;
      }

      if (item && !isItemDisabled(item) && !item.hidden) {
        const index = itemToEnabledIndex.get(item);
        if (index !== undefined && index !== highlightedIndex) {
          updateHighlight(index);
        }
      } else {
        clearHighlight();
      }
    }),
    on(content, "pointerleave", () => {
      if (!keyboardMode) clearHighlight();
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
      closeOnClickOutside: true,
      closeOnEscape: false,
    })
  );

  // Inbound event
  cleanups.push(
    on(root, "combobox:set", (e) => {
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
    })
  );

  const controller: ComboboxController = {
    get value() { return currentValue; },
    get inputValue() { return input.value; },
    get isOpen() { return isOpen; },
    select: (value: string) => updateValue(value),
    clear: () => updateValue(null),
    open: () => updateOpenState(true),
    close: () => updateOpenState(false),
    destroy: () => {
      positionSync.stop();
      portal.cleanup();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      if (hiddenInput && hiddenInput.parentNode) {
        hiddenInput.parentNode.removeChild(hiddenInput);
      }
      bound.delete(root);
    },
  };

  if (defaultOpen) updateOpenState(true);

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all combobox components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): ComboboxController[] {
  const controllers: ComboboxController[] = [];
  for (const root of getRoots(scope, "combobox")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createCombobox(root));
  }
  return controllers;
}
