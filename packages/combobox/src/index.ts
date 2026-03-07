import {
  getPart,
  getParts,
  getRoots,
  containsWithPortals,
  getDataBool,
  getDataNumber,
  getDataString,
  getDataEnum,
  setAria,
  ensureId,
  on,
  emit,
  computeFloatingPosition,
  computeFloatingTransformOrigin,
  measurePopupContentRect,
  ensureItemVisibleInContainer,
  createPositionSync,
  createPortalLifecycle,
  createPresenceLifecycle,
  createDismissLayer,
} from "@data-slot/core";

/** Side of the input to place the content */
export type Side = "top" | "bottom";
const SIDES = ["top", "bottom"] as const;

/** Alignment of the content relative to the input */
export type Align = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;

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
  const input = getPart<HTMLInputElement>(root, "combobox-input");
  const content = getPart<HTMLElement>(root, "combobox-content");
  const list = getPart<HTMLElement>(root, "combobox-list") ?? getPart<HTMLElement>(content ?? root, "combobox-list");
  const trigger = getPart<HTMLElement>(root, "combobox-trigger");
  const clearButton = getPart<HTMLElement>(root, "combobox-clear");
  const valueSlot = getPart<HTMLElement>(root, "combobox-value");
  const emptySlot = getPart<HTMLElement>(list ?? content ?? root, "combobox-empty");
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
  const defaultValue = options.defaultValue ?? getDataString(root, "defaultValue") ?? null;
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const placeholder = options.placeholder ?? getDataString(root, "placeholder") ?? "";
  const disabled = options.disabled ?? getDataBool(root, "disabled") ?? false;
  const required = options.required ?? getDataBool(root, "required") ?? false;
  const name = options.name ?? getDataString(root, "name") ?? null;
  const openOnFocus = options.openOnFocus ?? getDataBool(root, "openOnFocus") ?? true;
  const autoHighlight = options.autoHighlight ?? getDataBool(root, "autoHighlight") ?? false;
  const customFilter = options.filter ?? null;
  const onValueChange = options.onValueChange;
  const onOpenChange = options.onOpenChange;
  const onInputValueChange = options.onInputValueChange;
  let itemToStringValue = options.itemToStringValue ?? null;

  // Placement precedence: JS option > content > authored positioner > root
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

  // Positioning options
  const preferredSide =
    options.side ??
    getPlacementEnum("side", SIDES) ??
    "bottom";
  const preferredAlign =
    options.align ??
    getPlacementEnum("align", ALIGNS) ??
    "start";
  const sideOffset =
    options.sideOffset ??
    getPlacementNumber("sideOffset") ??
    4;
  const alignOffset =
    options.alignOffset ??
    getPlacementNumber("alignOffset") ??
    0;
  const avoidCollisions =
    options.avoidCollisions ??
    getPlacementBool("avoidCollisions") ??
    true;
  const collisionPadding =
    options.collisionPadding ??
    getPlacementNumber("collisionPadding") ??
    8;

  // State
  let isOpen = false;
  let currentValue: string | null = defaultValue;
  let highlightedIndex = -1;
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

  // Cached on open
  let allItems: HTMLElement[] = [];
  let visibleItems: HTMLElement[] = [];
  let enabledVisibleItems: HTMLElement[] = [];
  let itemToEnabledIndex = new Map<HTMLElement, number>();

  // Hidden input for form integration
  let hiddenInput: HTMLInputElement | null = null;

  // Portal lifecycle
  const portal = createPortalLifecycle({
    content,
    root,
    wrapperSlot: authoredPositioner ? undefined : "combobox-positioner",
    container: authoredPositioner ?? undefined,
    mountTarget: authoredPositioner ? authoredPortal ?? authoredPositioner : undefined,
  });
  let isDestroyed = false;

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

  const getItemByValue = (value: string | null): HTMLElement | null => {
    if (value === null) return null;
    const container = list ?? content;
    const items = getParts<HTMLElement>(container, "combobox-item");
    return items.find((el) => getItemValue(el) === value) ?? null;
  };

  // Get the display text for a given value
  const getLabelForValue = (value: string | null): string => {
    const item = getItemByValue(value);
    if (itemToStringValue) {
      return itemToStringValue(item, value);
    }
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

  // Normalize separators after filtering:
  // - no leading/trailing visible separator
  // - no adjacent visible separators
  // - at most one visible separator between adjacent visible non-separator blocks
  const normalizeVisibleSeparators = (container: HTMLElement) => {
    const separators = getParts<HTMLElement>(container, "combobox-separator");
    for (const sep of separators) {
      sep.hidden = true;
    }

    const children = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );

    for (let i = 0; i < children.length; i++) {
      const current = children[i]!;
      const currentIsSeparator = current.dataset["slot"] === "combobox-separator";
      if (currentIsSeparator || current.hidden) continue;

      let j = i + 1;
      let firstVisibleSeparator: HTMLElement | null = null;
      while (j < children.length) {
        const next = children[j]!;
        if (next.dataset["slot"] === "combobox-separator") {
          firstVisibleSeparator ??= next;
          j += 1;
          continue;
        }

        if (next.hidden) {
          j += 1;
          continue;
        }

        if (firstVisibleSeparator) {
          firstVisibleSeparator.hidden = false;
        }
        break;
      }
    }
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

    normalizeVisibleSeparators(container);

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

  const getHighlightScrollContainer = (item: HTMLElement): HTMLElement => {
    if (list && list.contains(item) && list.scrollHeight > list.clientHeight) {
      return list;
    }
    return content;
  };

  // Highlighting
  const updateHighlight = (index: number) => {
    for (const el of allItems) el.removeAttribute("data-highlighted");

    const highlightedItem = enabledVisibleItems[index];
    if (!highlightedItem) {
      highlightedIndex = -1;
      input.removeAttribute("aria-activedescendant");
      return;
    }

    highlightedItem.setAttribute("data-highlighted", "");
    input.setAttribute("aria-activedescendant", highlightedItem.id);
    ensureItemVisibleInContainer(highlightedItem, getHighlightScrollContainer(highlightedItem));
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
      if (isDestroyed) return;
      portal.restore();
      content.hidden = true;
    },
  });

  const updateOpenState = (open: boolean, skipFocusRestore = false) => {
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

      cacheItems();
      keyboardMode = false;

      // In popup-input mode, input text is transient search and should start empty on open.
      if (isPopupInputMode) {
        input.value = "";
      }

      // Apply current filter
      applyFilter(input.value);

      // Highlight selected item if visible, else auto-highlight first
      const selectedIndex = enabledVisibleItems.findIndex((el) => getItemValue(el) === currentValue);
      if (selectedIndex >= 0) {
        updateHighlight(selectedIndex);
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
      openRenderedSide = null;
      setAria(input, "expanded", false);
      setDataState("closed");
      clearHighlight();
      keyboardMode = false;

      positionSync.stop();
      presence.exit();

      if (isPopupInputMode) {
        input.value = "";
      } else {
        // Restore input text to committed value's label
        const committedLabel = getLabelForValue(currentValue);
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

    const resolvedLabel = getLabelForValue(value);
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
    if (isItemDisabled(item)) return;
    const value = getItemValue(item);
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
    clearHighlight();

    if (isOpen) {
      applyFilter(input.value);
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
          if (autoHighlight && enabledVisibleItems.length > 0) {
            updateHighlight(0);
          }
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
          if (autoHighlight && enabledVisibleItems.length > 0) {
            updateHighlight(enabledVisibleItems.length - 1);
          }
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
    const hasTypedQuery = val.trim() !== "";

    // Emit user-initiated input change
    emit(root, "combobox:input-change", { inputValue: val });
    onInputValueChange?.(val);

    // Open if not already open
    if (!isOpen) {
      updateOpenState(true);
      if (autoHighlight && hasTypedQuery && enabledVisibleItems.length > 0) {
        updateHighlight(0);
      } else if (highlightedIndex !== -1) {
        clearHighlight();
      }
    } else {
      // Re-filter
      applyFilter(val);

      // Auto-highlight only after non-whitespace query input.
      if (autoHighlight && hasTypedQuery && enabledVisibleItems.length > 0) {
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
      if (detail?.itemToStringValue !== undefined) {
        itemToStringValue = detail.itemToStringValue;
        updateValue(currentValue, true);
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
    setItemToStringValue: (nextItemToStringValue: ComboboxItemToStringValue | null) => {
      itemToStringValue = nextItemToStringValue;
      updateValue(currentValue, true);
    },
    destroy: () => {
      isDestroyed = true;
      positionSync.stop();
      presence.cleanup();
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
