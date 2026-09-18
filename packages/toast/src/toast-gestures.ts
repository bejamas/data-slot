import { createSwipeGesture, type SwipeAxis } from "@data-slot/core";
import type { ToastEntry } from "./toast-entry";
import type { ToastPosition } from "./types";

const SWIPE_THRESHOLD = 40;
const SWIPE_LOCK_THRESHOLD = 12;
/** Extra travel past the item's own size so the exit animation clears the viewport. */
const SWIPE_EXIT_MARGIN = 16;
/** Dragging against the outward direction moves the item at this fraction of the pointer. */
const SWIPE_RESISTANCE = 0.2;

const clearSwipeStyles = (entry: ToastEntry) => {
  entry.element.setAttribute("data-swiping", "false");
  entry.element.setAttribute("data-swipe-out", "false");
  for (const name of ["amount-x", "amount-y", "end-x", "end-y"]) {
    entry.element.style.removeProperty(`--toast-swipe-${name}`);
  }
};

interface ToastGestureOptions {
  viewport: HTMLElement;
  position: ToastPosition;
  getEntry(target: EventTarget | null): ToastEntry | undefined;
  dismiss(entry: ToastEntry): void;
}

/**
 * Swipe-to-dismiss for stacked toasts. Items leave sideways for left and right
 * stacks and away from the anchored edge for every stack; center stacks only
 * move vertically.
 */
export function createToastGestures({ viewport, position, getEntry, dismiss }: ToastGestureOptions) {
  // Sign of travel that dismisses, per axis; 0 disables the axis.
  const outward: Record<SwipeAxis, number> = {
    x: position.endsWith("left") ? -1 : position.endsWith("right") ? 1 : 0,
    y: position.startsWith("top") ? -1 : 1,
  };
  const axes: SwipeAxis[] = outward.x === 0 ? ["y"] : ["x", "y"];
  const withResistance = (delta: number, direction: number) =>
    delta * direction < 0 ? delta * SWIPE_RESISTANCE : delta;
  const isSwipeable = (entry: ToastEntry) => entry.active && entry.toast.dismissible;

  return createSwipeGesture<ToastEntry>({
    element: viewport,
    axes,
    lockThreshold: SWIPE_LOCK_THRESHOLD,
    capture: (entry) => entry.element,
    start(_event, target) {
      if (target.closest('[data-slot="toast-action"], [data-slot="toast-close"]')) return null;
      const entry = getEntry(target);
      return entry && isSwipeable(entry) ? entry : null;
    },
    active: isSwipeable,
    move(entry, { axis, deltaX, deltaY }) {
      const x = axis === "x" ? withResistance(deltaX, outward.x) : 0;
      const y = axis === "y" ? withResistance(deltaY, outward.y) : 0;
      entry.element.setAttribute("data-swiping", "true");
      entry.element.style.setProperty("--toast-swipe-amount-x", `${x}px`);
      entry.element.style.setProperty("--toast-swipe-amount-y", `${y}px`);
    },
    release(entry, { axis, deltaX, deltaY }) {
      const delta = axis === "x" ? deltaX : deltaY;
      if (delta * outward[axis] < SWIPE_THRESHOLD) {
        clearSwipeStyles(entry);
        return;
      }
      const size = axis === "x" ? entry.element.offsetWidth : entry.element.offsetHeight;
      const end = outward[axis] * Math.max(Math.abs(delta), size + SWIPE_EXIT_MARGIN);
      entry.element.setAttribute("data-swiping", "false");
      entry.element.setAttribute("data-swipe-out", "true");
      entry.element.style.setProperty("--toast-swipe-end-x", `${axis === "x" ? end : 0}px`);
      entry.element.style.setProperty("--toast-swipe-end-y", `${axis === "y" ? end : 0}px`);
      dismiss(entry);
    },
    reset: clearSwipeStyles,
  });
}
