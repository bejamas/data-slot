/**
 * Scroll lock utilities with reference counting.
 * Prevents body scroll when overlays (dialogs, selects, dropdowns) are open.
 * Uses scrollbar-gutter: stable to prevent layout shift.
 */

import { getSharedState } from "./shared-state.ts";

// Ref-counted lock state per document, shared by all copies of core so one copy
// never saves another copy's "hidden" as the original or unlocks too early.
// Shape: { count, overflow, scrollbarGutter }.
interface ScrollLockState {
  count: number;
  overflow: string;
  scrollbarGutter: string;
}

const SCROLL_LOCK = Symbol.for("data-slot.scroll-lock.v1");

const getScrollLockState = (doc: Document): ScrollLockState => {
  const states = getSharedState(SCROLL_LOCK, () => new WeakMap<Document, ScrollLockState>());
  let state = states.get(doc);
  if (!state) {
    state = { count: 0, overflow: "", scrollbarGutter: "" };
    states.set(doc, state);
  }
  return state;
};

/**
 * Lock document scroll. Call when opening an overlay.
 * Uses reference counting - multiple overlays can be open simultaneously.
 */
export function lockScroll(): void {
  const state = getScrollLockState(document);
  if (state.count === 0) {
    const html = document.documentElement;
    state.overflow = html.style.overflow;
    state.scrollbarGutter = html.style.scrollbarGutter;
    html.style.overflow = "hidden";
    html.style.scrollbarGutter = "stable";
  }
  state.count++;
}

/**
 * Unlock document scroll. Call when closing an overlay.
 * Only restores scroll when all overlays are closed (ref count reaches 0).
 */
export function unlockScroll(): void {
  const state = getScrollLockState(document);
  state.count = Math.max(0, state.count - 1);
  if (state.count === 0) {
    const html = document.documentElement;
    html.style.overflow = state.overflow;
    html.style.scrollbarGutter = state.scrollbarGutter;
  }
}

/**
 * Get current scroll lock count (for testing).
 */
export function getScrollLockCount(): number {
  return getScrollLockState(document).count;
}

/**
 * Reset scroll lock state (for testing).
 */
export function resetScrollLock(): void {
  const state = getScrollLockState(document);
  state.count = 0;
  const html = document.documentElement;
  html.style.overflow = "";
  html.style.scrollbarGutter = "";
  state.overflow = "";
  state.scrollbarGutter = "";
}
