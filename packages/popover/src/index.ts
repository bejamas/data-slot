import {
  getPart,
  getRoots,
  getDataBool,
  getDataEnum,
  getDataNumber,
  createDismissLayer,
  computeFloatingPosition,
  focusElement,
  createPositionSync,
  createPortalLifecycle,
  createPresenceLifecycle,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

export type PopoverSide = "top" | "right" | "bottom" | "left";
const SIDES = ["top", "right", "bottom", "left"] as const;
export type PopoverAlign = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;

/**
 * @deprecated Use `PopoverSide` and `side` option instead.
 * Kept for backward compatibility and planned for removal in the next major.
 */
export type PopoverPosition = PopoverSide;

// Focusable element selector
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface PopoverOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /**
   * @deprecated Use `side` instead.
   * TODO(next-major): remove `position` option support and migrate callers to `side`.
   */
  position?: PopoverPosition;
  /** The preferred side of the trigger to render against. @default "bottom" */
  side?: PopoverSide;
  /** The preferred alignment against the trigger. @default "center" */
  align?: PopoverAlign;
  /** The distance in pixels from the trigger. @default 4 */
  sideOffset?: number;
  /** Offset in pixels from the alignment edge. @default 0 */
  alignOffset?: number;
  /** When true, flips/shifts content to avoid viewport collisions. @default true */
  avoidCollisions?: boolean;
  /** Viewport padding used when avoiding collisions. @default 8 */
  collisionPadding?: number;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Portal content to body while open. @default true */
  portal?: boolean;
  /** Close when clicking outside */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape */
  closeOnEscape?: boolean;
}

export interface PopoverController {
  /** Open the popover */
  open(): void;
  /** Close the popover */
  close(): void;
  /** Toggle the popover */
  toggle(): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

/**
 * Create a popover controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="popover">
 *   <button data-slot="popover-trigger">Open</button>
 *   <div data-slot="popover-content">
 *     Popover content
 *     <button data-slot="popover-close">Close</button>
 *   </div>
 * </div>
 * ```
 */
export function createPopover(
  root: Element,
  options: PopoverOptions = {}
): PopoverController {
  const trigger = getPart<HTMLElement>(root, "popover-trigger");
  const content = getPart<HTMLElement>(root, "popover-content");
  const closeBtn = getPart<HTMLElement>(root, "popover-close");

  if (!trigger || !content) {
    throw new Error("Popover requires trigger and content slots");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  // Behavior options from root
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const onOpenChange = options.onOpenChange;
  const closeOnClickOutside = options.closeOnClickOutside ?? getDataBool(root, "closeOnClickOutside") ?? true;
  const closeOnEscape = options.closeOnEscape ?? getDataBool(root, "closeOnEscape") ?? true;
  const portalOption =
    options.portal ??
    getDataBool(content, "portal") ??
    getDataBool(root, "portal") ??
    true;

  // TODO(next-major): remove deprecated `position` option + `data-position` fallback.
  // Canonical placement API is `side`/`align`.
  const deprecatedPosition =
    options.position ??
    getDataEnum(content, "position", SIDES) ??
    getDataEnum(root, "position", SIDES);

  // Placement options: content-first, then root
  const preferredSide =
    options.side ??
    getDataEnum(content, "side", SIDES) ??
    getDataEnum(root, "side", SIDES) ??
    deprecatedPosition ??
    "bottom";
  const preferredAlign =
    options.align ??
    getDataEnum(content, "align", ALIGNS) ??
    getDataEnum(root, "align", ALIGNS) ??
    "center";
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

  let isOpen = defaultOpen;
  const cleanups: Array<() => void> = [];
  const portal = createPortalLifecycle({
    content,
    root,
    enabled: portalOption,
    wrapperSlot: "popover-positioner",
  });
  let isDestroyed = false;

  // Focus management state
  let previousActiveElement: HTMLElement | null = null;
  let addedTabIndex = false;

  const cleanupContentFocusable = () => {
    if (addedTabIndex) {
      content.removeAttribute("tabindex");
      addedTabIndex = false;
    }
  };

  const focusFirst = () => {
    // Priority: [autofocus] > first focusable > content itself
    const autofocusEl = content.querySelector<HTMLElement>("[autofocus]");
    if (autofocusEl) return autofocusEl.focus();

    const first = content.querySelector<HTMLElement>(FOCUSABLE);
    if (first) return first.focus();

    // No focusable elements — make content itself focusable temporarily
    if (!content.getAttribute("tabindex")) {
      content.setAttribute("tabindex", "-1");
      addedTabIndex = true;
    }
    content.focus();
  };

  // ARIA setup
  const contentId = ensureId(content, "popover-content");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", contentId);
  content.setAttribute("data-side", preferredSide);
  content.setAttribute("data-align", preferredAlign);
  // TODO(next-major): stop writing legacy `data-position`; keep only `data-side`.
  content.setAttribute("data-position", preferredSide);

  const updatePosition = () => {
    const positioner = portal.container as HTMLElement;
    const win = root.ownerDocument.defaultView ?? window;
    const tr = trigger.getBoundingClientRect();
    const cr = content.getBoundingClientRect();
    const pos = computeFloatingPosition({
      anchorRect: tr,
      contentRect: cr,
      side: preferredSide,
      align: preferredAlign,
      sideOffset,
      alignOffset,
      avoidCollisions,
      collisionPadding,
    });

    positioner.style.position = "absolute";
    positioner.style.top = "0px";
    positioner.style.left = "0px";
    positioner.style.transform = `translate3d(${pos.x + win.scrollX}px, ${pos.y + win.scrollY}px, 0)`;
    positioner.style.willChange = "transform";
    positioner.style.margin = "0";
    content.setAttribute("data-side", pos.side);
    content.setAttribute("data-align", pos.align);
    if (positioner !== content) {
      positioner.setAttribute("data-side", pos.side);
      positioner.setAttribute("data-align", pos.align);
    }
    // TODO(next-major): stop mirroring computed side to legacy `data-position`.
    content.setAttribute("data-position", pos.side);
  };

  const setDataState = (state: "open" | "closed") => {
    const positioner = portal.container as HTMLElement;
    root.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
    if (positioner !== content) {
      positioner.setAttribute("data-state", state);
    }
    if (state === "open") {
      root.setAttribute("data-open", "");
      content.setAttribute("data-open", "");
      if (positioner !== content) {
        positioner.setAttribute("data-open", "");
      }
      root.removeAttribute("data-closed");
      content.removeAttribute("data-closed");
      if (positioner !== content) {
        positioner.removeAttribute("data-closed");
      }
    } else {
      root.setAttribute("data-closed", "");
      content.setAttribute("data-closed", "");
      if (positioner !== content) {
        positioner.setAttribute("data-closed", "");
      }
      root.removeAttribute("data-open");
      content.removeAttribute("data-open");
      if (positioner !== content) {
        positioner.removeAttribute("data-open");
      }
    }
  };

  const restoreFocus = () => {
    requestAnimationFrame(() => {
      if (previousActiveElement && previousActiveElement.isConnected) {
        focusElement(previousActiveElement);
      } else {
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
      cleanupContentFocusable();
      restoreFocus();
    },
  });

  const positionSync = createPositionSync({
    observedElements: [trigger, content],
    isActive: () => isOpen,
    ancestorScroll: false,
    onUpdate: updatePosition,
  });

  const updateState = (open: boolean) => {
    if (isOpen === open) return;

    // Save focus target before opening
    if (open) {
      previousActiveElement = document.activeElement as HTMLElement | null;
    }

    isOpen = open;
    setAria(trigger, "expanded", isOpen);

    if (open) {
      portal.mount();
      content.hidden = false;
      setDataState("open");
      presence.enter();
      updatePosition();
      positionSync.start();
      positionSync.update();
      requestAnimationFrame(focusFirst);
    } else {
      setDataState("closed");
      presence.exit();
      positionSync.stop();
    }

    emit(root, "popover:change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  // Initialize state
  setAria(trigger, "expanded", isOpen);
  setDataState(isOpen ? "open" : "closed");
  content.hidden = !isOpen;

  // Focus first element if defaultOpen
  if (defaultOpen) {
    portal.mount();
    presence.enter();
    content.hidden = false;
    updatePosition();
    positionSync.start();
    positionSync.update();
    requestAnimationFrame(focusFirst);
  }

  // Trigger click
  cleanups.push(on(trigger, "click", () => updateState(!isOpen)));

  // Close button click
  if (closeBtn) {
    cleanups.push(on(closeBtn, "click", () => updateState(false)));
  }

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => isOpen,
      onDismiss: () => updateState(false),
      closeOnClickOutside,
      closeOnEscape,
    })
  );

  // Inbound event
  cleanups.push(
    on(root, "popover:set", (e) => {
      const detail = (e as CustomEvent).detail;
      // Preferred: { open: boolean }
      // Deprecated: { value: boolean }
      // TODO(next-major): remove `{ value }` compatibility; keep `{ open }` only.
      let open: boolean | undefined;
      if (detail?.open !== undefined) {
        open = detail.open;
      } else if (detail?.value !== undefined) {
        open = detail.value;
      }
      if (typeof open === "boolean") updateState(open);
    })
  );

  const controller: PopoverController = {
    open: () => updateState(true),
    close: () => updateState(false),
    toggle: () => updateState(!isOpen),
    get isOpen() {
      return isOpen;
    },
    destroy: () => {
      isDestroyed = true;
      positionSync.stop();
      presence.cleanup();
      portal.cleanup();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      cleanupContentFocusable();
    },
  };

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all popover components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): PopoverController[] {
  const controllers: PopoverController[] = [];

  for (const root of getRoots(scope, "popover")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createPopover(root));
  }

  return controllers;
}
