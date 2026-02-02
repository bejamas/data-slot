import { getPart, getRoots, getDataNumber, getDataEnum } from "@data-slot/core";
import { ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

// Global state for "warm-up" behavior across tooltip instances
let globalWarmUntil = 0;

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
  /** Side of tooltip relative to trigger. Default: 'top'. Set at bind time only. */
  side?: TooltipSide;
  /** Alignment along the side. Default: 'center'. Set at bind time only. */
  align?: TooltipAlign;
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
 * Data attributes (checked on content first, then root):
 * - `data-side`: 'top' | 'right' | 'bottom' | 'left' (bind-time only)
 * - `data-align`: 'start' | 'center' | 'end' (bind-time only)
 * - `data-delay`: number (ms)
 * - `data-skip-delay-duration`: number (ms)
 *
 * Note: side and align are resolved once at bind time. To change placement,
 * destroy and recreate the tooltip with new options.
 *
 * This tooltip uses simple CSS positioning (not collision-aware).
 * Opens on hover (non-touch) and focus. Touch devices: focus-only.
 * Content is hoverable: moving pointer from trigger to content keeps it open.
 * Tooltip stays open while trigger has focus, even if pointer leaves.
 */
export function createTooltip(
  root: Element,
  options: TooltipOptions = {}
): TooltipController {
  const trigger = getPart<HTMLElement>(root, "tooltip-trigger");
  const content = getPart<HTMLElement>(root, "tooltip-content");

  if (!trigger || !content) {
    throw new Error("Tooltip requires trigger and content slots");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  const delay =
    options.delay ??
    getDataNumber(root, "delay") ??
    300;
  const skipDelayDuration =
    options.skipDelayDuration ??
    getDataNumber(root, "skipDelayDuration") ??
    300;
  const onOpenChange = options.onOpenChange;

  // Placement options: content-first, then root (bind-time only)
  const side =
    options.side ??
    getDataEnum(content, "side", SIDES) ??
    getDataEnum(root, "side", SIDES) ??
    "top";
  const align =
    options.align ??
    getDataEnum(content, "align", ALIGNS) ??
    getDataEnum(root, "align", ALIGNS) ??
    "center";

  let isOpen = false;
  let hasFocus = false;
  let showTimeout: ReturnType<typeof setTimeout> | null = null;
  let escapeCleanup: (() => void) | null = null;
  const cleanups: Array<() => void> = [];

  // ARIA setup - ensure content has stable id
  const contentId = ensureId(content, "tooltip-content");
  content.setAttribute("role", "tooltip");
  content.setAttribute("data-side", side);
  content.setAttribute("data-align", align);

  // Helper: check if trigger is disabled
  const isTriggerDisabled = (): boolean =>
    trigger.hasAttribute("disabled") ||
    trigger.getAttribute("aria-disabled") === "true";

  // Escape listener management - attach only when open
  const attachEscapeListener = () => {
    if (escapeCleanup) return;
    escapeCleanup = on(document, "keydown", (e) => {
      if (e.key === "Escape" && isOpen) {
        hideImmediately("escape");
      }
    });
  };

  const detachEscapeListener = () => {
    escapeCleanup?.();
    escapeCleanup = null;
  };

  const updateState = (open: boolean, reason: TooltipReason) => {
    if (isOpen === open) return;

    isOpen = open;
    const state = isOpen ? "open" : "closed";
    root.setAttribute("data-state", state);
    content.setAttribute("data-state", state);

    // ARIA: explicit values for consistency across AT implementations
    if (isOpen) {
      trigger.setAttribute("aria-describedby", contentId);
      content.setAttribute("aria-hidden", "false");
      attachEscapeListener();
    } else {
      trigger.removeAttribute("aria-describedby");
      content.setAttribute("aria-hidden", "true");
      detachEscapeListener();
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
    // Note: warm-up only skips delay, not CSS transitions
    if (Date.now() < globalWarmUntil) {
      updateState(true, reason);
      return;
    }

    showTimeout = setTimeout(() => {
      updateState(true, reason);
      showTimeout = null;
    }, delay);
  };

  const hideImmediately = (reason: TooltipReason) => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }

    // Set warm window only when tooltip was actually open
    if (isOpen && skipDelayDuration > 0) {
      globalWarmUntil = Date.now() + skipDelayDuration;
    }

    updateState(false, reason);
  };

  // Initialize state (CSS handles visibility via data-state)
  content.setAttribute("aria-hidden", "true");
  root.setAttribute("data-state", "closed");
  content.setAttribute("data-state", "closed");

  // Pointer events on trigger
  cleanups.push(
    on(trigger, "pointerenter", (e) => {
      // Touch: focus-only, don't open on hover
      if (e.pointerType === "touch") return;
      if (isTriggerDisabled()) return;
      showWithDelay("pointer");
    }),
    on(trigger, "pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      // Keep open while trigger has focus
      if (hasFocus) return;
      // Check if pointer moved to content (hoverable content)
      const related = e.relatedTarget as Node | null;
      if (related && content.contains(related)) return;
      hideImmediately("pointer");
    }),
    // Focus events
    on(trigger, "focus", () => {
      hasFocus = true;
      if (isTriggerDisabled()) return;
      showWithDelay("focus");
    }),
    on(trigger, "blur", () => {
      hasFocus = false;
      hideImmediately("blur");
    })
  );

  // Pointer events on content (hoverable content support)
  cleanups.push(
    on(content, "pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      // Keep open while trigger has focus
      if (hasFocus) return;
      // Check if pointer moved back to trigger
      const related = e.relatedTarget as Node | null;
      if (related && trigger.contains(related)) return;
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
      if (showTimeout) clearTimeout(showTimeout);
      detachEscapeListener();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all tooltip components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): TooltipController[] {
  const controllers: TooltipController[] = [];

  for (const root of getRoots(scope, "tooltip")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createTooltip(root));
  }

  return controllers;
}
