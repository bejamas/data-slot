import { getPart, getParts, getRoots, getDataBool, getDataNumber, getDataString, getDataEnum } from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";
import { lockScroll, unlockScroll } from "@data-slot/core";
import {
  computeFloatingPosition,
  ensureItemVisibleInContainer,
  createPositionSync,
  createPortalLifecycle,
  createDismissLayer,
} from "@data-slot/core";

/** Side of the trigger to place the content */
export type Side = "top" | "bottom";
const SIDES = ["top", "bottom"] as const;

/** Alignment of the content relative to the trigger */
export type Align = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;

/** Positioning mode for the content */
export type Position = "item-aligned" | "popper";
const POSITIONS = ["item-aligned", "popper"] as const;

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

/**
 * Create a select controller for a root element.
 *
 * Supports Radix-compatible positioning props for precise placement:
 * - `side`: "top" | "bottom" (default: "bottom")
 * - `align`: "start" | "center" | "end" (default: "start")
 * - `sideOffset`: distance from trigger in px (default: 4)
 * - `alignOffset`: offset from alignment edge in px (default: 0)
 * - `avoidCollisions`: flip/shift to stay in viewport (default: true)
 * - `collisionPadding`: viewport edge padding in px (default: 8)
 *
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
  const trigger = getPart<HTMLElement>(root, "select-trigger");
  const content = getPart<HTMLElement>(root, "select-content");
  const valueSlot = getPart<HTMLElement>(root, "select-value");

  if (!trigger || !content) {
    throw new Error("Select requires trigger and content slots");
  }

  // Resolve options with explicit precedence: JS > data-* (root, then valueSlot) > default
  const defaultValue = options.defaultValue ?? getDataString(root, "defaultValue") ?? null;
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  // Check root first, then valueSlot for placeholder (some implementations put it on the span)
  const placeholder = options.placeholder ?? getDataString(root, "placeholder") ?? (valueSlot ? getDataString(valueSlot, "placeholder") : undefined) ?? "";
  const disabled = options.disabled ?? getDataBool(root, "disabled") ?? false;
  const required = options.required ?? getDataBool(root, "required") ?? false;
  const name = options.name ?? getDataString(root, "name") ?? null;
  const onValueChange = options.onValueChange;
  const onOpenChange = options.onOpenChange;

  // Position mode
  const position =
    options.position ??
    getDataEnum(root, "position", POSITIONS) ??
    "item-aligned";

  // Placement options: content-first, then root (used for popper mode)
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
  const lockScrollOption = options.lockScroll ?? getDataBool(root, "lockScroll") ?? true;

  let isOpen = false;
  let currentValue: string | null = defaultValue;
  let previousActiveElement: HTMLElement | null = null;
  let highlightedIndex = -1;
  let typeaheadBuffer = "";
  let typeaheadTimeout: ReturnType<typeof setTimeout> | null = null;
  let keyboardMode = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  const cleanups: Array<() => void> = [];

  // Cached on open
  let items: HTMLElement[] = [];
  let enabledItems: HTMLElement[] = [];
  let itemToIndex = new Map<HTMLElement, number>();

  // Hidden input for form integration
  let hiddenInput: HTMLInputElement | null = null;

  // Track if this instance locked scroll
  let didLockScroll = false;

  // Portal lifecycle for moving content to body
  const portal = createPortalLifecycle({ content, root });

  const isItemDisabled = (el: HTMLElement) =>
    el.hasAttribute("disabled") || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";

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
  }
  if (required) {
    trigger.setAttribute("aria-required", "true");
  }

  // Create hidden input for form integration
  if (name) {
    hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.name = name;
    hiddenInput.value = currentValue ?? "";
    root.appendChild(hiddenInput);
  }

  // Cache items on open
  const cacheItems = () => {
    items = getParts<HTMLElement>(content, "select-item");

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
    const groups = getParts<HTMLElement>(content, "select-group");
    for (const group of groups) {
      group.setAttribute("role", "group");
      const label = getPart<HTMLElement>(group, "select-label");
      if (label) {
        const labelId = ensureId(label, "select-label");
        group.setAttribute("aria-labelledby", labelId);
      }
    }
  };

  // Compute base position data for item-aligned mode
  const computeItemAlignedPos = (tr: DOMRect, cr: DOMRect) => {
    // Find selected item, or fall back to first enabled item
    const selectedItem = items.find((item) => item.dataset["value"] === currentValue);
    const alignItem = selectedItem ?? enabledItems[0];

    // Calculate x position (align left edges, match trigger width)
    let x = tr.left;

    // Calculate y position so aligned item is at trigger's vertical center.
    // This is the base (unclamped) y when content scrollTop is 0.
    let y: number;
    let itemTopInContent = 0;
    let itemHeight = tr.height;

    if (alignItem) {
      // Normalize to content coordinates, independent of current scrollTop.
      const itemRect = alignItem.getBoundingClientRect();
      itemTopInContent = itemRect.top - cr.top + content.scrollTop;
      itemHeight = itemRect.height || alignItem.offsetHeight || tr.height;

      // Position content so item is at trigger's vertical center.
      y = tr.top + (tr.height / 2) - (itemHeight / 2) - itemTopInContent;
    } else {
      // No items at all - align top of content with trigger
      y = tr.top;
    }

    return { x, y, alignItem, itemTopInContent, itemHeight };
  };

  const updatePosition = () => {
    const win = root.ownerDocument.defaultView ?? window;
    const tr = trigger.getBoundingClientRect();

    // Set min-width to match trigger width
    content.style.minWidth = `${tr.width}px`;

    // Get content rect after setting min-width
    const cr = content.getBoundingClientRect();

    let pos: { x: number; y: number };
    let side: Side = "bottom";

    if (position === "item-aligned") {
      const aligned = computeItemAlignedPos(tr, cr);
      pos = { x: aligned.x, y: aligned.y };
      const triggerCenterY = tr.top + (tr.height / 2);
      const minY = collisionPadding;
      const maxY = window.innerHeight - cr.height - collisionPadding;
      const clampY = (value: number) =>
        avoidCollisions
          ? (maxY < minY ? minY : Math.min(Math.max(value, minY), maxY))
          : value;

      if (avoidCollisions) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Clamp to viewport vertically
        if (pos.y < collisionPadding) {
          pos.y = collisionPadding;
        } else if (pos.y + cr.height > vh - collisionPadding) {
          pos.y = vh - cr.height - collisionPadding;
        }

        // Clamp to viewport horizontally
        if (pos.x < collisionPadding) {
          pos.x = collisionPadding;
        } else if (pos.x + cr.width > vw - collisionPadding) {
          pos.x = vw - cr.width - collisionPadding;
        }
      }

      // For scrollable content, align deep selected items by adjusting internal scroll,
      // so the popup stays near the trigger instead of jumping far away.
      if (aligned.alignItem) {
        const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);

        if (maxScrollTop > 0) {
          const getDesiredScrollTop = (currentY: number) =>
            aligned.itemTopInContent + (aligned.itemHeight / 2) - (triggerCenterY - currentY);

          // Start with popup centered around trigger, then solve scrollTop for alignment.
          pos.y = clampY(triggerCenterY - (cr.height / 2));
          let scrollTop = Math.min(Math.max(getDesiredScrollTop(pos.y), 0), maxScrollTop);
          content.scrollTop = scrollTop;

          // Recompute y after clamped scroll, then finalize scroll against that y.
          pos.y = clampY(
            triggerCenterY - (aligned.itemTopInContent - scrollTop + (aligned.itemHeight / 2))
          );
          scrollTop = Math.min(Math.max(getDesiredScrollTop(pos.y), 0), maxScrollTop);
          content.scrollTop = scrollTop;
        }
      } else {
        content.scrollTop = 0;
      }

      // Determine effective side based on final position
      side = pos.y < tr.top ? "top" : "bottom";
    } else {
      const floating = computeFloatingPosition({
        anchorRect: tr,
        contentRect: cr,
        side: preferredSide,
        align: preferredAlign,
        sideOffset,
        alignOffset,
        avoidCollisions,
        collisionPadding,
        allowedSides: SIDES,
      });
      pos = { x: floating.x, y: floating.y };
      side = floating.side as Side;
    }

    if (lockScrollOption) {
      content.style.position = "fixed";
      content.style.top = `${pos.y}px`;
      content.style.left = `${pos.x}px`;
    } else {
      content.style.position = "absolute";
      content.style.top = `${pos.y + win.scrollY}px`;
      content.style.left = `${pos.x + win.scrollX}px`;
    }
    content.style.margin = "0";
    content.setAttribute("data-side", side);
    content.setAttribute("data-align", position === "item-aligned" ? "center" : preferredAlign);
  };

  const positionSync = createPositionSync({
    observedElements: [trigger, content],
    isActive: () => isOpen,
    ancestorScroll: lockScrollOption,
    onUpdate: updatePosition,
    ignoreScrollTarget: (target) => target instanceof Node && content.contains(target),
  });

  const updateHighlight = (index: number, focus = true, ensureVisible = true) => {
    for (let i = 0; i < enabledItems.length; i++) {
      const el = enabledItems[i]!;
      if (i === index) {
        el.setAttribute("data-highlighted", "");
        if (ensureVisible) {
          ensureItemVisibleInContainer(el, content);
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

  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    trigger.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
  };

  const updateValueDisplay = () => {
    if (!valueSlot) return;

    if (currentValue === null) {
      valueSlot.textContent = placeholder;
      trigger.setAttribute("data-placeholder", "");
    } else {
      // Find the item with this value and get its text
      // Prefer data-label attribute over textContent (useful when item has icons/indicators)
      const selectedItem = items.find((item) => item.dataset["value"] === currentValue);
      const label = selectedItem?.dataset["label"] ?? selectedItem?.textContent?.trim() ?? currentValue;
      valueSlot.textContent = label;
      trigger.removeAttribute("data-placeholder");
    }
  };

  const updateOpenState = (open: boolean, skipFocusRestore = false) => {
    if (isOpen === open) return;
    if (disabled && open) return;

    if (open) {
      previousActiveElement = document.activeElement as HTMLElement;
      isOpen = true;
      setAria(trigger, "expanded", true);
      portal.mount();
      content.hidden = false;
      setDataState("open");

      // Lock scroll
      if (lockScrollOption && !didLockScroll) {
        lockScroll();
        didLockScroll = true;
      }

      cacheItems();
      keyboardMode = false;

      // Highlight selected item if any
      const selectedIndex = enabledItems.findIndex((el) => el.dataset["value"] === currentValue);
      if (selectedIndex >= 0) {
        updateHighlight(selectedIndex, false, false);
      } else {
        clearHighlight();
      }

      positionSync.start();
      updatePosition();
      positionSync.update();

      // Use rAF to refine position after browser has fully rendered content,
      // and to highlight item under cursor if pointer opened the select
      requestAnimationFrame(() => {
        if (!isOpen) return;
        positionSync.update();

        // Highlight item under cursor if pointer opened the select
        if (lastPointerX !== 0 || lastPointerY !== 0) {
          const el = document.elementFromPoint(lastPointerX, lastPointerY);
          const item = el?.closest?.('[data-slot="select-item"]') as HTMLElement | null;
          if (item && !isItemDisabled(item) && content.contains(item)) {
            const index = itemToIndex.get(item);
            if (index !== undefined) {
              updateHighlight(index, false);
            }
          }
        }
      });

      content.focus();
    } else {
      isOpen = false;
      setAria(trigger, "expanded", false);
      portal.restore();
      content.hidden = true;
      setDataState("closed");
      clearHighlight();
      typeaheadBuffer = "";
      keyboardMode = false;

      // Unlock scroll
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }

      positionSync.stop();

      // Skip focus restoration when closing via Tab to allow normal tab navigation
      if (!skipFocusRestore) {
        requestAnimationFrame(() => {
          if (previousActiveElement && document.contains(previousActiveElement)) {
            previousActiveElement.focus();
          } else if (trigger && document.contains(trigger)) {
            trigger.focus();
          }
          previousActiveElement = null;
        });
      } else {
        previousActiveElement = null;
      }
    }

    emit(root, "select:open-change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  const updateValue = (value: string | null, init = false) => {
    if (currentValue === value && !init) return;

    const oldValue = currentValue;
    currentValue = value;

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
    updateOpenState(false);
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
        updateOpenState(false, true);
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
    if (typeaheadTimeout) clearTimeout(typeaheadTimeout);
    typeaheadTimeout = setTimeout(() => { typeaheadBuffer = ""; }, 500);

    typeaheadBuffer += char;

    let matchIndex = enabledItems.findIndex((el) =>
      (el.textContent?.trim().toLowerCase() || "").startsWith(typeaheadBuffer)
    );

    if (matchIndex === -1 && typeaheadBuffer.length === 1) {
      const start = highlightedIndex + 1;
      for (let i = 0; i < enabledItems.length; i++) {
        const idx = (start + i) % enabledItems.length;
        if ((enabledItems[idx]!.textContent?.trim().toLowerCase() || "").startsWith(char)) {
          matchIndex = idx;
          break;
        }
      }
    }

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
        updateOpenState(true);
        break;
    }
  };

  // Initialize
  setAria(trigger, "expanded", false);
  content.hidden = true;
  setDataState("closed");

  // Initial value display
  cacheItems();
  updateValue(currentValue, true);

  // Trigger events
  cleanups.push(
    on(trigger, "pointerdown", (e) => {
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
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
      if (item) selectItem(item);
    }),
    on(content, "pointermove", (e) => {
      const item = (e.target as HTMLElement).closest?.('[data-slot="select-item"]') as HTMLElement | null;

      if (keyboardMode) {
        keyboardMode = false;
        if (item && itemToIndex.get(item) === highlightedIndex) return;
      }

      if (item && !isItemDisabled(item)) {
        const index = itemToIndex.get(item);
        if (index !== undefined && index !== highlightedIndex) {
          updateHighlight(index, false);
        }
      } else {
        // Clear highlight when moving to label, separator, or disabled item
        clearHighlight();
      }
    }),
    on(content, "pointerleave", () => {
      if (!keyboardMode) clearHighlight();
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
    on(root, "select:set", (e) => {
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
    select: (value: string) => updateValue(value),
    open: () => updateOpenState(true),
    close: () => updateOpenState(false),
    destroy: () => {
      if (typeaheadTimeout) clearTimeout(typeaheadTimeout);
      positionSync.stop();
      portal.cleanup();
      // Unlock scroll if still locked
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }
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
 * Find and bind all select components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): SelectController[] {
  const controllers: SelectController[] = [];
  for (const root of getRoots(scope, "select")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createSelect(root));
  }
  return controllers;
}
