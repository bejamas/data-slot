import {
  getPart,
  getRoots,
  getDataBool,
  getDataNumber,
  getDataEnum,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  createDismissLayer,
  computeFloatingPosition,
  computeFloatingTransformOrigin,
  measurePopupContentRect,
  createPositionSync,
  createPortalLifecycle,
  createPresenceLifecycle,
} from "@data-slot/core";
import { ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

const ROOT_BINDING_KEY = "@data-slot/tooltip";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/tooltip] createTooltip() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

// Global state for "warm-up" behavior across tooltip instances
let globalWarmUntil = 0;
const registeredWarmHandoffTriggers = new Set<HTMLElement>();
const warmHandoffListeners = new Set<(sourceTrigger: HTMLElement, reason: TooltipReason) => void>();

const isWarmHandoffTarget = (target: Node | null, sourceTrigger: HTMLElement): boolean => {
  if (!target) return false;
  for (const trigger of registeredWarmHandoffTriggers) {
    if (trigger === sourceTrigger) continue;
    if (trigger.contains(target)) return true;
  }
  return false;
};

const notifyWarmHandoff = (sourceTrigger: HTMLElement, reason: TooltipReason): void => {
  for (const listener of warmHandoffListeners) {
    listener(sourceTrigger, reason);
  }
};

// Types aligned with Radix/Base UI naming
export type TooltipSide = "top" | "right" | "bottom" | "left";
export type TooltipAlign = "start" | "center" | "end";
export type TooltipReason = "pointer" | "focus" | "blur" | "escape" | "api";

const SIDES = ["top", "right", "bottom", "left"] as const;
const ALIGNS = ["start", "center", "end"] as const;

export interface TooltipOptions {
  /** Delay before showing tooltip (ms). Default: 300 */
  delay?: number;
  /** Duration to skip delay after closing (ms). Set to 0 to disable warm-up. Default: 300 */
  skipDelayDuration?: number;
  /** Preferred side of tooltip relative to trigger. Default: 'top'. */
  side?: TooltipSide;
  /** Preferred alignment along the side. Default: 'center'. */
  align?: TooltipAlign;
  /** Distance from trigger in pixels. Default: 4 */
  sideOffset?: number;
  /** Alignment-axis offset in pixels. Default: 0 */
  alignOffset?: number;
  /** Enable collision handling. Default: true */
  avoidCollisions?: boolean;
  /** Viewport edge padding used by collision handling. Default: 8 */
  collisionPadding?: number;
  /** Portal content to body while open. Default: true */
  portal?: boolean;
  /** Callback when visibility changes */
  onOpenChange?: (open: boolean) => void;
}

export interface TooltipController {
  /** Show the tooltip immediately. Respects disabled state. */
  show(): void;
  /** Hide the tooltip */
  hide(): void;
  /** Current visibility state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

/**
 * Create a tooltip controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="tooltip">
 *   <button data-slot="tooltip-trigger">Hover me</button>
 *   <div data-slot="tooltip-content" data-side="top" data-align="center">
 *     Tooltip text
 *   </div>
 * </div>
 * ```
 *
 * Placement data attributes are resolved as: content -> authored positioner -> root.
 * - `data-side`: 'top' | 'right' | 'bottom' | 'left' (bind-time preferred side)
 * - `data-align`: 'start' | 'center' | 'end' (bind-time preferred align)
 * - `data-side-offset`: number (px)
 * - `data-align-offset`: number (px)
 * - `data-avoid-collisions`: boolean
 * - `data-collision-padding`: number (px)
 * - `data-delay`: number (ms)
 * - `data-skip-delay-duration`: number (ms)
 *
 * Opens on hover (non-touch) and focus. Touch devices: focus-only.
 * Content is hoverable: moving pointer from trigger to content keeps it open.
 * Tooltip stays open while trigger has focus, even if pointer leaves.
 */
export function createTooltip(
  root: Element,
  options: TooltipOptions = {}
): TooltipController {
  const existingController = reuseRootBinding<TooltipController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  const trigger = getPart<HTMLElement>(root, "tooltip-trigger");
  const content = getPart<HTMLElement>(root, "tooltip-content");
  const authoredPositionerCandidate = getPart<HTMLElement>(root, "tooltip-positioner");
  const authoredPositioner =
    authoredPositionerCandidate && content && authoredPositionerCandidate.contains(content)
      ? authoredPositionerCandidate
      : null;
  const authoredPortalCandidate = getPart<HTMLElement>(root, "tooltip-portal");
  const authoredPortal =
    authoredPortalCandidate && authoredPositioner && authoredPortalCandidate.contains(authoredPositioner)
      ? authoredPortalCandidate
      : null;

  if (!trigger || !content) {
    throw new Error("Tooltip requires trigger and content slots");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  const delay = options.delay ?? getDataNumber(root, "delay") ?? 300;
  const skipDelayDuration =
    options.skipDelayDuration ?? getDataNumber(root, "skipDelayDuration") ?? 300;
  const onOpenChange = options.onOpenChange;
  const portalOption =
    options.portal ?? getDataBool(content, "portal") ?? getDataBool(root, "portal") ?? true;

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

  // Placement options (resolved at bind time)
  const preferredSide =
    options.side ??
    getPlacementEnum("side", SIDES) ??
    "top";
  const preferredAlign =
    options.align ??
    getPlacementEnum("align", ALIGNS) ??
    "center";
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

  let isOpen = false;
  let isInstantTransition = false;
  let hasFocus = false;
  let isDestroyed = false;
  let showTimeout: ReturnType<typeof setTimeout> | null = null;
  const cleanups: Array<() => void> = [];

  const portal = createPortalLifecycle({
    content,
    root,
    enabled: portalOption,
    wrapperSlot: authoredPositioner ? undefined : "tooltip-positioner",
    container: authoredPositioner ?? undefined,
    mountTarget: authoredPositioner ? authoredPortal ?? authoredPositioner : undefined,
  });

  // ARIA setup - ensure content has stable id
  const contentId = ensureId(content, "tooltip-content");
  content.setAttribute("role", "tooltip");
  content.setAttribute("data-side", preferredSide);
  content.setAttribute("data-align", preferredAlign);

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
      if (isInstantTransition) {
        root.setAttribute("data-instant", "");
        content.setAttribute("data-instant", "");
        if (positioner !== content) {
          positioner.setAttribute("data-instant", "");
        }
      } else {
        root.removeAttribute("data-instant");
        content.removeAttribute("data-instant");
        if (positioner !== content) {
          positioner.removeAttribute("data-instant");
        }
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
    if (isInstantTransition) {
      root.setAttribute("data-instant", "");
      content.setAttribute("data-instant", "");
      if (positioner !== content) {
        positioner.setAttribute("data-instant", "");
      }
    } else {
      root.removeAttribute("data-instant");
      content.removeAttribute("data-instant");
      if (positioner !== content) {
        positioner.removeAttribute("data-instant");
      }
    }
    root.removeAttribute("data-open");
    content.removeAttribute("data-open");
    if (positioner !== content) {
      positioner.removeAttribute("data-open");
    }
  };

  const updatePosition = () => {
    const positioner = portal.container as HTMLElement;
    const win = root.ownerDocument.defaultView ?? window;
    const tr = trigger.getBoundingClientRect();
    const cr = measurePopupContentRect(content);
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
    const transformOrigin = computeFloatingTransformOrigin({
      side: pos.side,
      align: pos.align,
      anchorRect: tr,
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

    content.setAttribute("data-side", pos.side);
    content.setAttribute("data-align", pos.align);
    if (positioner !== content) {
      positioner.setAttribute("data-side", pos.side);
      positioner.setAttribute("data-align", pos.align);
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

  // Helper: check if trigger is disabled
  const isTriggerDisabled = (): boolean =>
    trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true";

  const updateState = (open: boolean, reason: TooltipReason, instant = false) => {
    if (isOpen === open) return;

    if (!open && isOpen && skipDelayDuration > 0) {
      globalWarmUntil = Date.now() + skipDelayDuration;
    }

    isInstantTransition = instant;
    isOpen = open;

    if (isOpen) {
      trigger.setAttribute("aria-describedby", contentId);
      content.setAttribute("aria-hidden", "false");
      portal.mount();
      content.hidden = false;
      setDataState("open");
      presence.enter();
      updatePosition();
      positionSync.start();
      positionSync.update();
    } else {
      setDataState("closed");
      trigger.removeAttribute("aria-describedby");
      content.setAttribute("aria-hidden", "true");
      presence.exit();
      positionSync.stop();
    }

    emit(root, "tooltip:change", { open: isOpen, trigger, content, reason });
    onOpenChange?.(isOpen);
  };

  const showWithDelay = (reason: TooltipReason) => {
    // Always reset timer on re-enter for predictable behavior
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }

    // Skip delay if we're within the "warm" window (recently closed a tooltip)
    if (Date.now() < globalWarmUntil) {
      updateState(true, reason, true);
      return;
    }

    showTimeout = setTimeout(() => {
      updateState(true, reason);
      showTimeout = null;
    }, delay);
  };

  const hideImmediately = (reason: TooltipReason, instant = false) => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }

    updateState(false, reason, instant);
  };

  const closeForWarmHandoff = (sourceTrigger: HTMLElement, reason: TooltipReason) => {
    if (sourceTrigger === trigger || !isOpen) return;
    hasFocus = false;
    hideImmediately(reason, true);
  };

  registeredWarmHandoffTriggers.add(trigger);
  warmHandoffListeners.add(closeForWarmHandoff);
  cleanups.push(() => {
    warmHandoffListeners.delete(closeForWarmHandoff);
    registeredWarmHandoffTriggers.delete(trigger);
  });

  // Initialize state
  content.hidden = true;
  content.setAttribute("aria-hidden", "true");
  setDataState("closed");

  // Pointer events on trigger
  cleanups.push(
    on(trigger, "pointerenter", (e) => {
      // Touch: focus-only, don't open on hover
      if (e.pointerType === "touch") return;
      if (isTriggerDisabled()) return;
      notifyWarmHandoff(trigger, "pointer");
      showWithDelay("pointer");
    }),
    on(trigger, "pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      // Keep open while trigger has focus
      if (hasFocus) return;
      // Keep open while pointer moves from trigger to content
      const related = e.relatedTarget as Node | null;
      if (related && content.contains(related)) return;
      if (isWarmHandoffTarget(related, trigger)) {
        hideImmediately("pointer", true);
        return;
      }
      hideImmediately("pointer");
    }),
    on(trigger, "click", () => {
      if (isTriggerDisabled()) return;

      // If a delayed open is pending and user clicks first, cancel opening.
      if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
        return;
      }

      // Clicking an already-open tooltip trigger dismisses it.
      if (isOpen) {
        hideImmediately("pointer", true);
      }
    }),
    // Focus events
    on(trigger, "focus", () => {
      hasFocus = true;
      if (isTriggerDisabled()) return;
      notifyWarmHandoff(trigger, "focus");
      showWithDelay("focus");
    }),
    on(trigger, "blur", (e) => {
      hasFocus = false;
      const related = (e as FocusEvent).relatedTarget as Node | null;
      if (isWarmHandoffTarget(related, trigger)) {
        hideImmediately("blur", true);
        return;
      }
      hideImmediately("blur");
    })
  );

  // Pointer events on content (hoverable content support)
  cleanups.push(
    on(content, "pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      // Keep open while trigger has focus
      if (hasFocus) return;
      // Keep open while pointer moves back to trigger
      const related = e.relatedTarget as Node | null;
      if (related && trigger.contains(related)) return;
      if (isWarmHandoffTarget(related, trigger)) {
        hideImmediately("pointer", true);
        return;
      }
      hideImmediately("pointer");
    })
  );

  // Inbound event
  cleanups.push(
    on(root, "tooltip:set", (e) => {
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

      if (open) {
        if (isTriggerDisabled()) return; // Opening respects disabled
        if (showTimeout) {
          clearTimeout(showTimeout);
          showTimeout = null;
        }
        updateState(true, "api");
      } else {
        hideImmediately("api"); // Closing always allowed
      }
    })
  );

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => isOpen,
      onDismiss: () => hideImmediately("escape"),
      closeOnClickOutside: false,
      closeOnEscape: true,
      preventEscapeDefault: false,
    })
  );

  const controller: TooltipController = {
    show: () => {
      // Respect disabled state even for programmatic calls
      if (isTriggerDisabled()) return;
      if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
      }
      updateState(true, "api");
    },
    hide: () => hideImmediately("api"),
    get isOpen() {
      return isOpen;
    },
    destroy: () => {
      isDestroyed = true;
      if (showTimeout) clearTimeout(showTimeout);
      positionSync.stop();
      presence.cleanup();
      portal.cleanup();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all tooltip components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): TooltipController[] {
  const controllers: TooltipController[] = [];

  for (const root of getRoots(scope, "tooltip")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createTooltip(root));
  }

  return controllers;
}
