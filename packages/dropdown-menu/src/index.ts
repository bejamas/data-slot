import { getPart, getParts, getRoots, getDataBool, getDataNumber, getDataEnum } from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

/** Side of the trigger to place the content */
export type Side = "top" | "right" | "bottom" | "left";
const SIDES = ["top", "right", "bottom", "left"] as const;

/** Alignment of the content relative to the trigger */
export type Align = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;

export interface DropdownMenuOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Callback when an item is selected */
  onSelect?: (value: string) => void;
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
}

export interface DropdownMenuController {
  /** Open the dropdown menu */
  open(): void;
  /** Close the dropdown menu */
  close(): void;
  /** Toggle the dropdown menu */
  toggle(): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

// Opposite sides for flipping
const OPP: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

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
 * - **Outbound** `dropdown-menu:change` (on root): Fires when menu opens/closes.
 *   `event.detail: { open: boolean }`
 * - **Outbound** `dropdown-menu:select` (on root): Fires when an item is selected.
 *   `event.detail: { value: string }`
 */
export function createDropdownMenu(
  root: Element,
  options: DropdownMenuOptions = {}
): DropdownMenuController {
  const trigger = getPart<HTMLElement>(root, "dropdown-menu-trigger");
  const content = getPart<HTMLElement>(root, "dropdown-menu-content");

  if (!trigger || !content) {
    throw new Error("DropdownMenu requires trigger and content slots");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  // Behavior options from root
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const onOpenChange = options.onOpenChange;
  const onSelect = options.onSelect;
  const closeOnClickOutside = options.closeOnClickOutside ?? getDataBool(root, "closeOnClickOutside") ?? true;
  const closeOnEscape = options.closeOnEscape ?? getDataBool(root, "closeOnEscape") ?? true;
  const closeOnSelect = options.closeOnSelect ?? getDataBool(root, "closeOnSelect") ?? true;

  // Placement options: content-first, then root
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

  let isOpen = false;
  let previousActiveElement: HTMLElement | null = null;
  let highlightedIndex = -1;
  let typeaheadBuffer = "";
  let typeaheadTimeout: ReturnType<typeof setTimeout> | null = null;
  let keyboardMode = false; // Ignore pointer after keyboard nav
  const cleanups: Array<() => void> = [];

  // Cached on open - avoids repeated DOM queries
  let items: HTMLElement[] = [];
  let enabledItems: HTMLElement[] = [];
  let itemToIndex = new Map<HTMLElement, number>();

  // For position syncing while open
  let positionRafId: number | null = null;
  const positionCleanups: Array<() => void> = [];

  const isDisabled = (el: HTMLElement) =>
    el.hasAttribute("disabled") || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";

  // ARIA setup (minimal - just essential attributes)
  const triggerId = ensureId(trigger, "dropdown-menu-trigger");
  const contentId = ensureId(content, "dropdown-menu-content");
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-controls", contentId);
  content.setAttribute("role", "menu");
  content.setAttribute("aria-labelledby", triggerId);
  content.tabIndex = -1;

  // Cache items on open (also sets ARIA/tabIndex - handles dynamic content)
  const cacheItems = () => {
    items = getParts<HTMLElement>(content, "dropdown-menu-item");

    for (const item of items) {
      item.setAttribute("role", "menuitem");
      if (item.hasAttribute("data-disabled") || item.hasAttribute("disabled")) {
        item.setAttribute("aria-disabled", "true");
      } else {
        item.removeAttribute("aria-disabled");
      }
      item.tabIndex = -1;
    }

    enabledItems = items.filter((el) => !isDisabled(el));
    itemToIndex = new Map(enabledItems.map((el, i) => [el, i]));
  };

  // Compute position for side/align
  const computePos = (side: Side, align: Align, tr: DOMRect, cr: DOMRect) => {
    let x = 0, y = 0;
    if (side === "top") y = tr.top - cr.height - sideOffset;
    else if (side === "bottom") y = tr.bottom + sideOffset;
    else if (side === "left") x = tr.left - cr.width - sideOffset;
    else x = tr.right + sideOffset;

    if (side === "top" || side === "bottom") {
      if (align === "start") x = tr.left + alignOffset;
      else if (align === "center") x = tr.left + tr.width / 2 - cr.width / 2 + alignOffset;
      else x = tr.right - cr.width - alignOffset;
    } else {
      if (align === "start") y = tr.top + alignOffset;
      else if (align === "center") y = tr.top + tr.height / 2 - cr.height / 2 + alignOffset;
      else y = tr.bottom - cr.height - alignOffset;
    }
    return { x, y };
  };

  const updatePosition = () => {
    const tr = trigger.getBoundingClientRect();
    const cr = content.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    let side = preferredSide;
    let pos = computePos(side, preferredAlign, tr, cr);

    if (avoidCollisions) {
      // Check overflow on main axis
      const overflow = (s: Side, p: { x: number; y: number }) =>
        s === "top" ? p.y < collisionPadding :
        s === "bottom" ? p.y + cr.height > vh - collisionPadding :
        s === "left" ? p.x < collisionPadding :
        p.x + cr.width > vw - collisionPadding;

      if (overflow(side, pos)) {
        const opp = OPP[side];
        const oppPos = computePos(opp, preferredAlign, tr, cr);
        if (!overflow(opp, oppPos)) {
          side = opp;
          pos = oppPos;
        }
      }

      // Clamp to viewport
      if (pos.x < collisionPadding) pos.x = collisionPadding;
      else if (pos.x + cr.width > vw - collisionPadding) pos.x = vw - cr.width - collisionPadding;
      if (pos.y < collisionPadding) pos.y = collisionPadding;
      else if (pos.y + cr.height > vh - collisionPadding) pos.y = vh - cr.height - collisionPadding;
    }

    content.style.position = "fixed";
    content.style.top = `${pos.y}px`;
    content.style.left = `${pos.x}px`;
    content.style.margin = "0";
    content.setAttribute("data-side", side);
    content.setAttribute("data-align", preferredAlign);
  };

  const schedulePosition = () => {
    if (positionRafId !== null) return;
    positionRafId = requestAnimationFrame(() => {
      positionRafId = null;
      if (isOpen) updatePosition();
    });
  };

  const cleanupPosition = () => {
    if (positionRafId !== null) {
      cancelAnimationFrame(positionRafId);
      positionRafId = null;
    }
    positionCleanups.forEach((fn) => fn());
    positionCleanups.length = 0;
  };

  const setupPosition = () => {
    if (positionCleanups.length > 0) return;
    const onResize = () => schedulePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    positionCleanups.push(
      () => window.removeEventListener("resize", onResize),
      () => window.removeEventListener("scroll", onResize, true)
    );
    const ro = new ResizeObserver(onResize);
    ro.observe(trigger);
    ro.observe(content);
    positionCleanups.push(() => ro.disconnect());
  };

  const updateHighlight = (index: number, focus = true) => {
    for (let i = 0; i < enabledItems.length; i++) {
      const el = enabledItems[i]!;
      if (i === index) {
        el.setAttribute("data-highlighted", "");
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
    content.setAttribute("data-state", state);
  };

  const updateState = (open: boolean) => {
    if (isOpen === open) return;

    if (open) {
      previousActiveElement = document.activeElement as HTMLElement;
      isOpen = true;
      setAria(trigger, "expanded", true);
      content.hidden = false;
      setDataState("open");

      cacheItems();
      keyboardMode = false;
      clearHighlight(); // Ensure no stale data-highlighted
      setupPosition();
      updatePosition();

      content.focus();
    } else {
      isOpen = false;
      setAria(trigger, "expanded", false);
      content.hidden = true;
      setDataState("closed");
      clearHighlight();
      typeaheadBuffer = "";
      keyboardMode = false;

      cleanupPosition();

      requestAnimationFrame(() => {
        if (previousActiveElement && document.contains(previousActiveElement)) {
          previousActiveElement.focus();
        } else if (trigger && document.contains(trigger)) {
          trigger.focus();
        }
        previousActiveElement = null;
      });
    }

    emit(root, "dropdown-menu:change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  const selectItem = (item: HTMLElement) => {
    if (isDisabled(item)) return;
    const value = item.dataset["value"] || item.textContent?.trim() || "";
    emit(root, "dropdown-menu:select", { value });
    onSelect?.(value);
    if (closeOnSelect) updateState(false);
  };

  const handleKeydown = (e: KeyboardEvent) => {
    const len = enabledItems.length;
    if (len === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        keyboardMode = true;
        updateHighlight(highlightedIndex === -1 ? 0 : (highlightedIndex + 1) % len);
        break;
      case "ArrowUp":
        e.preventDefault();
        keyboardMode = true;
        updateHighlight(highlightedIndex === -1 ? len - 1 : (highlightedIndex - 1 + len) % len);
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
        updateState(false);
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

  // Initialize
  setAria(trigger, "expanded", false);
  content.hidden = true;
  setDataState("closed");

  // Trigger events
  cleanups.push(
    on(trigger, "click", () => updateState(!isOpen)),
    on(trigger, "keydown", (e) => {
      if ((e.key === "Enter" || e.key === " " || e.key === "ArrowDown") && !isOpen) {
        e.preventDefault();
        updateState(true);
      }
    })
  );

  // Content events
  cleanups.push(
    on(content, "keydown", handleKeydown),
    on(content, "click", (e) => {
      const item = (e.target as HTMLElement).closest?.('[data-slot="dropdown-menu-item"]') as HTMLElement | null;
      if (item) selectItem(item);
    }),
    on(content, "pointermove", (e) => {
      const item = (e.target as HTMLElement).closest?.('[data-slot="dropdown-menu-item"]') as HTMLElement | null;

      if (keyboardMode) {
        keyboardMode = false;
        // Only ignore if pointer is still on the item we just focused
        if (item && itemToIndex.get(item) === highlightedIndex) return;
      }

      if (item && !isDisabled(item)) {
        const index = itemToIndex.get(item);
        if (index !== undefined && index !== highlightedIndex) {
          updateHighlight(index, false);
        }
      }
    }),
    on(content, "pointerleave", () => {
      if (!keyboardMode) clearHighlight();
    })
  );

  // Close handlers
  if (closeOnClickOutside) {
    cleanups.push(
      on(document, "pointerdown", (e) => {
        const t = e.target as Node;
        if (isOpen && !root.contains(t) && !content.contains(t)) updateState(false);
      })
    );
  }

  if (closeOnEscape) {
    cleanups.push(
      on(document, "keydown", (e) => {
        if (isOpen && e.key === "Escape") {
          e.preventDefault();
          updateState(false);
        }
      })
    );
  }

  const controller: DropdownMenuController = {
    open: () => updateState(true),
    close: () => updateState(false),
    toggle: () => updateState(!isOpen),
    get isOpen() { return isOpen; },
    destroy: () => {
      if (typeaheadTimeout) clearTimeout(typeaheadTimeout);
      cleanupPosition();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      bound.delete(root);
    },
  };

  if (defaultOpen) updateState(true);

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all dropdown menu components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): DropdownMenuController[] {
  const controllers: DropdownMenuController[] = [];
  for (const root of getRoots(scope, "dropdown-menu")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createDropdownMenu(root));
  }
  return controllers;
}
