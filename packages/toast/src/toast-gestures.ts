import { on } from "@data-slot/core";
import type { ToastEntry } from "./toast-entry";
import type { ToastPosition } from "./types";

const DEFAULT_GAP = 8;
const DEFAULT_SWIPE_THRESHOLD = 40;
const SWIPE_RESISTANCE = 0.2;
const SWIPE_AXIS_LOCK_THRESHOLD = 12;
interface SwipeState {
  entry: ToastEntry;
  pointerId: number;
  startX: number;
  currentX: number;
  startY: number;
  currentY: number;
  axis: "x" | "y" | null;
}

const getInlineSwipeDirection = (position: ToastPosition): number => {
  if (position.endsWith("left")) return -1;
  if (position.endsWith("right")) return 1;
  return 0;
};

const adjustSwipeDelta = (delta: number, outwardDirection: number): number => {
  if (outwardDirection === 0) return 0;
  return delta * outwardDirection < 0 ? delta * SWIPE_RESISTANCE : delta;
};

const resolveSwipeAxis = (
  deltaX: number,
  deltaY: number,
  inlineDirection: number,
): "x" | "y" | null => {
  if (inlineDirection === 0) {
    return Math.abs(deltaY) >= SWIPE_AXIS_LOCK_THRESHOLD ? "y" : null;
  }

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (Math.max(absX, absY) < SWIPE_AXIS_LOCK_THRESHOLD) {
    return null;
  }

  return absX > absY ? "x" : "y";
};

interface ToastGestureOptions {
  viewport: HTMLElement;
  position: ToastPosition;
  getEntry(target: EventTarget | null): ToastEntry | undefined;
  dismiss(entry: ToastEntry): void;
}

/** Owns the active pointer gesture and all gesture listeners. */
export function createToastGestures({ viewport, position, getEntry, dismiss }: ToastGestureOptions) {
  const doc = viewport.ownerDocument;
  const stackDirection = position.startsWith("top") ? 1 : -1;
  const inlineSwipeDirection = getInlineSwipeDirection(position);
  let swipeState: SwipeState | null = null;
  const clearSwipeStyles = (entry: ToastEntry) => {
    entry.element.setAttribute("data-swiping", "false");
    entry.element.setAttribute("data-swipe-out", "false");
    entry.element.style.removeProperty("--toast-swipe-amount-x");
    entry.element.style.removeProperty("--toast-swipe-amount-y");
    entry.element.style.removeProperty("--toast-swipe-end-x");
    entry.element.style.removeProperty("--toast-swipe-end-y");
  };

  const startSwipeOut = (entry: ToastEntry, endX: number, endY: number) => {
    entry.element.setAttribute("data-swiping", "false");
    entry.element.setAttribute("data-swipe-out", "true");
    entry.element.style.setProperty("--toast-swipe-end-x", `${endX}px`);
    entry.element.style.setProperty("--toast-swipe-end-y", `${endY}px`);
  };

  const beginSwipe = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('[data-slot="toast-action"]') || target.closest('[data-slot="toast-close"]')) {
      return;
    }

    const entry = getEntry(target);
    if (!entry?.active || !entry.toast.dismissible) return;
    cancel();

    swipeState = {
      entry,
      pointerId: event.pointerId,
      startX: event.clientX,
      currentX: event.clientX,
      startY: event.clientY,
      currentY: event.clientY,
      axis: null,
    };

    entry.element.setAttribute("data-swiping", "true");
    entry.element.style.setProperty("--toast-swipe-amount-x", "0px");
    entry.element.style.setProperty("--toast-swipe-amount-y", "0px");
    if ("setPointerCapture" in entry.element) {
      try {
        entry.element.setPointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported for this event target.
      }
    }
  };

  const updateSwipe = (event: PointerEvent) => {
    if (!swipeState || event.pointerId !== swipeState.pointerId) return;
    const entry = swipeState.entry;
    if (!entry.active) {
      swipeState = null;
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    swipeState.currentX = event.clientX;
    swipeState.currentY = event.clientY;
    const rawDeltaX = swipeState.currentX - swipeState.startX;
    const rawDeltaY = swipeState.currentY - swipeState.startY;
    const axis =
      swipeState.axis ?? resolveSwipeAxis(rawDeltaX, rawDeltaY, inlineSwipeDirection);
    swipeState.axis = axis;

    const adjustedDeltaX =
      axis === "x" ? adjustSwipeDelta(rawDeltaX, inlineSwipeDirection) : 0;
    const adjustedDeltaY =
      axis === "y" ? adjustSwipeDelta(rawDeltaY, -stackDirection) : 0;
    entry.element.style.setProperty("--toast-swipe-amount-x", `${adjustedDeltaX}px`);
    entry.element.style.setProperty("--toast-swipe-amount-y", `${adjustedDeltaY}px`);
    entry.element.setAttribute("data-swiping", "true");
  };

  const endSwipe = (event: PointerEvent | null, cancelled = false) => {
    if (!swipeState) return;
    if (event && event.pointerId !== swipeState.pointerId) return;

    const current = swipeState;
    swipeState = null;
    const entry = current.entry;
    if (!entry.active) return;

    if ("releasePointerCapture" in entry.element) {
      try {
        entry.element.releasePointerCapture(current.pointerId);
      } catch {
        // Ignore if pointer capture was not active.
      }
    }

    const rawDeltaX = current.currentX - current.startX;
    const rawDeltaY = current.currentY - current.startY;
    const axis =
      current.axis ?? resolveSwipeAxis(rawDeltaX, rawDeltaY, inlineSwipeDirection);
    const horizontalProgress =
      inlineSwipeDirection === 0
        ? Number.NEGATIVE_INFINITY
        : (rawDeltaX * inlineSwipeDirection) / DEFAULT_SWIPE_THRESHOLD;
    const verticalProgress =
      (rawDeltaY * -stackDirection) / DEFAULT_SWIPE_THRESHOLD;
    const dismissAxis =
      !cancelled && axis === "x" && horizontalProgress >= 1
        ? "x"
        : !cancelled && axis === "y" && verticalProgress >= 1
          ? "y"
          : null;

    if (dismissAxis) {
      const endX =
        dismissAxis === "x"
          ? inlineSwipeDirection *
            Math.max(
              Math.abs(rawDeltaX),
              entry.element.offsetWidth + DEFAULT_GAP * 2,
            )
          : 0;
      const endY =
        dismissAxis === "y"
          ? -stackDirection *
            Math.max(
              Math.abs(rawDeltaY),
              entry.element.offsetHeight + DEFAULT_GAP * 2,
            )
          : 0;

      startSwipeOut(entry, endX, endY);
      dismiss(entry);
      return;
    }

    clearSwipeStyles(entry);
  };

  const cancel = (entry?: ToastEntry) => {
    if (entry && swipeState?.entry !== entry) return;
    endSwipe(null, true);
  };
  const cleanups = [
    on(viewport, "pointerdown", beginSwipe),
    on(doc, "pointermove", updateSwipe),
    on(doc, "pointerup", endSwipe),
    on(doc, "pointercancel", (event) => endSwipe(event, true)),
  ];
  return {
    cancel,
    destroy() {
      cancel();
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
