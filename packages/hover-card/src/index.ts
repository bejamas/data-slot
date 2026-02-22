import {
  getPart,
  getRoots,
  getDataBool,
  getDataEnum,
  getDataNumber,
  createDismissLayer,
  computeFloatingPosition,
  createPositionSync,
  createPortalLifecycle,
  createPresenceLifecycle,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

export type HoverCardSide = "top" | "right" | "bottom" | "left";
const SIDES = ["top", "right", "bottom", "left"] as const;
export type HoverCardAlign = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;

export type HoverCardReason = "pointer" | "focus" | "blur" | "dismiss" | "api";

// Global state for warm-up behavior across hover-card instances
let globalWarmUntil = 0;
const FOCUS_OPEN_INTENT_WINDOW_MS = 750;
const POINTER_HOVER_INTENT_WINDOW_MS = 250;

export interface HoverCardOptions {
  /** Initial open state (uncontrolled mode only) */
  defaultOpen?: boolean;
  /** Controlled open state. Internal interactions do not mutate when set. */
  open?: boolean;
  /** Delay before opening on hover/keyboard focus (ms). @default 700 */
  delay?: number;
  /** Duration to skip delay after closing (ms). Set to 0 to disable warm-up. @default 300 */
  skipDelayDuration?: number;
  /** Delay before closing after leave/blur (ms). @default 300 */
  closeDelay?: number;

  /** The preferred side of the trigger to render against. @default "bottom" */
  side?: HoverCardSide;
  /** The preferred alignment against the trigger. @default "center" */
  align?: HoverCardAlign;
  /** The distance in pixels from the trigger. @default 4 */
  sideOffset?: number;
  /** Offset in pixels from the alignment edge. @default 0 */
  alignOffset?: number;
  /** When true, flips/shifts content to avoid viewport collisions. @default true */
  avoidCollisions?: boolean;
  /** Viewport padding used when avoiding collisions. @default 8 */
  collisionPadding?: number;

  /** Portal content to body while open. @default true */
  portal?: boolean;
  /** Close when clicking outside. @default true */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape. @default true */
  closeOnEscape?: boolean;

  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export interface HoverCardController {
  /** Open the hover-card (request in controlled mode) */
  open(): void;
  /** Close the hover-card (request in controlled mode) */
  close(): void;
  /** Toggle the hover-card (request in controlled mode) */
  toggle(): void;
  /** Force open state update (works in both controlled/uncontrolled modes) */
  setOpen(open: boolean): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

/**
 * Create a hover-card controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="hover-card">
 *   <button data-slot="hover-card-trigger">Hover me</button>
 *   <div data-slot="hover-card-content">Preview content</div>
 * </div>
 * ```
 */
export function createHoverCard(
  root: Element,
  options: HoverCardOptions = {}
): HoverCardController {
  const trigger = getPart<HTMLElement>(root, "hover-card-trigger");
  const content = getPart<HTMLElement>(root, "hover-card-content");
  const authoredPositionerCandidate = getPart<HTMLElement>(root, "hover-card-positioner");
  const authoredPositioner =
    authoredPositionerCandidate && content && authoredPositionerCandidate.contains(content)
      ? authoredPositionerCandidate
      : null;
  const authoredPortalCandidate = getPart<HTMLElement>(root, "hover-card-portal");
  const authoredPortal =
    authoredPortalCandidate && authoredPositioner && authoredPortalCandidate.contains(authoredPositioner)
      ? authoredPortalCandidate
      : null;

  if (!trigger || !content) {
    throw new Error("Hover-card requires trigger and content slots");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  const controlled = options.open !== undefined;
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const delay = options.delay ?? getDataNumber(root, "delay") ?? 700;
  const skipDelayDuration =
    options.skipDelayDuration ?? getDataNumber(root, "skipDelayDuration") ?? 300;
  const closeDelay = options.closeDelay ?? getDataNumber(root, "closeDelay") ?? 300;
  const onOpenChange = options.onOpenChange;
  const closeOnClickOutside =
    options.closeOnClickOutside ?? getDataBool(root, "closeOnClickOutside") ?? true;
  const closeOnEscape = options.closeOnEscape ?? getDataBool(root, "closeOnEscape") ?? true;
  const portalOption =
    options.portal ?? getDataBool(content, "portal") ?? getDataBool(root, "portal") ?? true;

  const preferredSide =
    options.side ??
    getDataEnum(content, "side", SIDES) ??
    getDataEnum(root, "side", SIDES) ??
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

  let isOpen = options.open ?? defaultOpen;
  let isDestroyed = false;
  let pointerOnTrigger = false;
  let pointerOnContent = false;
  let focusWithin = false;
  let openTimeout: ReturnType<typeof setTimeout> | null = null;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastTabKeydownAt = -Infinity;
  let lastPointerMoveAt = -Infinity;

  const cleanups: Array<() => void> = [];
  const portal = createPortalLifecycle({
    content,
    root,
    enabled: portalOption,
    wrapperSlot: authoredPositioner ? undefined : "hover-card-positioner",
    container: authoredPositioner ?? undefined,
    mountTarget: authoredPositioner ? authoredPortal ?? authoredPositioner : undefined,
  });

  // ARIA setup
  const contentId = ensureId(content, "hover-card-content");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", contentId);
  content.setAttribute("data-side", preferredSide);
  content.setAttribute("data-align", preferredAlign);

  const isTriggerDisabled = () =>
    trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true";

  const clearOpenTimeout = () => {
    if (!openTimeout) return;
    clearTimeout(openTimeout);
    openTimeout = null;
  };

  const clearCloseTimeout = () => {
    if (!closeTimeout) return;
    clearTimeout(closeTimeout);
    closeTimeout = null;
  };

  const clearTimers = () => {
    clearOpenTimeout();
    clearCloseTimeout();
  };

  const emitChange = (open: boolean, reason: HoverCardReason) => {
    emit(root, "hover-card:change", { open, reason, trigger, content });
    onOpenChange?.(open);
  };

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
      return;
    }

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
  };

  const presence = createPresenceLifecycle({
    element: content,
    onExitComplete: () => {
      if (isDestroyed) return;
      portal.restore();
      content.hidden = true;
    },
  });

  const positionSync = createPositionSync({
    observedElements: [trigger, content],
    isActive: () => isOpen,
    ancestorScroll: false,
    onUpdate: updatePosition,
  });

  const applyState = (open: boolean, reason: HoverCardReason) => {
    if (isOpen === open) return;

    if (!open && isOpen && skipDelayDuration > 0) {
      globalWarmUntil = Date.now() + skipDelayDuration;
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
    } else {
      setDataState("closed");
      presence.exit();
      positionSync.stop();
    }

    emitChange(isOpen, reason);
  };

  const requestState = (open: boolean, reason: HoverCardReason) => {
    if (isOpen === open) return;
    if (controlled) {
      emitChange(open, reason);
      return;
    }
    applyState(open, reason);
  };

  const forceState = (open: boolean, reason: HoverCardReason) => {
    applyState(open, reason);
  };

  const scheduleOpen = (reason: HoverCardReason) => {
    clearCloseTimeout();
    clearOpenTimeout();

    if (skipDelayDuration > 0 && Date.now() < globalWarmUntil) {
      requestState(true, reason);
      return;
    }

    if (delay <= 0) {
      requestState(true, reason);
      return;
    }

    openTimeout = setTimeout(() => {
      openTimeout = null;
      requestState(true, reason);
    }, delay);
  };

  const scheduleClose = (reason: HoverCardReason) => {
    clearOpenTimeout();
    clearCloseTimeout();

    if (closeDelay <= 0) {
      requestState(false, reason);
      return;
    }

    closeTimeout = setTimeout(() => {
      closeTimeout = null;
      requestState(false, reason);
    }, closeDelay);
  };

  const maybeScheduleClose = (reason: HoverCardReason) => {
    if (pointerOnTrigger || pointerOnContent || focusWithin) return;
    scheduleClose(reason);
  };

  // Initial state
  setAria(trigger, "expanded", isOpen);
  setDataState(isOpen ? "open" : "closed");
  content.hidden = !isOpen;

  if (isOpen) {
    portal.mount();
    presence.enter();
    content.hidden = false;
    updatePosition();
    positionSync.start();
    positionSync.update();
  }

  // Pointer interaction on trigger
  cleanups.push(
    on(root.ownerDocument, "keydown", (e) => {
      if ((e as KeyboardEvent).key === "Tab") {
        lastTabKeydownAt = Date.now();
      }
    }, { capture: true }),
    on(root.ownerDocument, "pointerdown", () => {
      lastTabKeydownAt = -Infinity;
      lastPointerMoveAt = -Infinity;
    }, { capture: true }),
    on(root.ownerDocument, "pointermove", (e) => {
      if ((e as PointerEvent).pointerType === "touch") return;
      lastPointerMoveAt = Date.now();
    }, { capture: true }),
    on(trigger, "pointerenter", (e) => {
      if (e.pointerType === "touch") return;
      pointerOnTrigger = true;
      if (isTriggerDisabled()) return;
      if (Date.now() - lastPointerMoveAt > POINTER_HOVER_INTENT_WINDOW_MS) return;
      scheduleOpen("pointer");
    }),
    on(trigger, "pointermove", (e) => {
      if (e.pointerType === "touch") return;
      // Enter may occur before the move event while crossing boundaries.
      if (!pointerOnTrigger || isTriggerDisabled()) return;
      if (isOpen || openTimeout) return;
      scheduleOpen("pointer");
    }),
    on(trigger, "pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      pointerOnTrigger = false;
      const related = e.relatedTarget as Node | null;
      if (related && content.contains(related)) return;
      maybeScheduleClose("pointer");
    })
  );

  // Pointer interaction on content (hoverable content)
  cleanups.push(
    on(content, "pointerenter", (e) => {
      if (e.pointerType === "touch") return;
      pointerOnContent = true;
      clearCloseTimeout();
    }),
    on(content, "pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      pointerOnContent = false;
      const related = e.relatedTarget as Node | null;
      if (related && trigger.contains(related)) return;
      maybeScheduleClose("pointer");
    })
  );

  // Focus interaction
  cleanups.push(
    on(trigger, "focusin", () => {
      if (isTriggerDisabled()) return;
      // Ignore pure programmatic focus (e.g. dialog initial autofocus).
      if (Date.now() - lastTabKeydownAt > FOCUS_OPEN_INTENT_WINDOW_MS) return;
      focusWithin = true;
      scheduleOpen("focus");
    }),
    on(trigger, "focusout", (e) => {
      const related = e.relatedTarget as Node | null;
      if (related && (trigger.contains(related) || content.contains(related))) return;
      focusWithin = false;
      maybeScheduleClose("blur");
    }),
    on(content, "focusin", () => {
      focusWithin = true;
      clearCloseTimeout();
    }),
    on(content, "focusout", (e) => {
      const related = e.relatedTarget as Node | null;
      if (related && (trigger.contains(related) || content.contains(related))) return;
      focusWithin = false;
      maybeScheduleClose("blur");
    })
  );

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => isOpen,
      onDismiss: () => requestState(false, "dismiss"),
      closeOnClickOutside,
      closeOnEscape,
    })
  );

  // Inbound event
  cleanups.push(
    on(root, "hover-card:set", (e) => {
      const detail = (e as CustomEvent).detail;
      // Preferred: { open: boolean }
      // Deprecated: { value: boolean }
      let open: boolean | undefined;
      if (detail?.open !== undefined) {
        open = detail.open;
      } else if (detail?.value !== undefined) {
        open = detail.value;
      }
      if (typeof open !== "boolean") return;
      forceState(open, "api");
    })
  );

  const controller: HoverCardController = {
    open: () => {
      if (isTriggerDisabled()) return;
      clearTimers();
      requestState(true, "api");
    },
    close: () => {
      clearTimers();
      requestState(false, "api");
    },
    toggle: () => {
      clearTimers();
      if (!isOpen && isTriggerDisabled()) return;
      requestState(!isOpen, "api");
    },
    setOpen: (open) => {
      clearTimers();
      forceState(open, "api");
    },
    get isOpen() {
      return isOpen;
    },
    destroy: () => {
      isDestroyed = true;
      clearTimers();
      positionSync.stop();
      presence.cleanup();
      portal.cleanup();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all hover-card components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): HoverCardController[] {
  const controllers: HoverCardController[] = [];

  for (const root of getRoots(scope, "hover-card")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createHoverCard(root));
  }

  return controllers;
}
