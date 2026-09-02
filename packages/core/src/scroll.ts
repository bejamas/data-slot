/**
 * Scroll lock utilities with reference counting.
 * Prevents body scroll when overlays (dialogs, selects, dropdowns) are open.
 * Uses scrollbar-gutter: stable to prevent layout shift.
 */

type ScrollLockState = { count: number; overflow: string; scrollbarGutter: string };
type ScrollLockOwner = Node | Document;
import { getDocument } from "./realm.ts";

// Documents are independent realms: locking an iframe must never mutate its parent.
const scrollLocks = new WeakMap<Document, ScrollLockState>();

/**
 * Lock document scroll. Call when opening an overlay.
 * Uses reference counting - multiple overlays can be open simultaneously.
 */
export function lockScroll(owner?: ScrollLockOwner | null): void {
  const doc = getDocument(owner);
  let state = scrollLocks.get(doc);
  if (!state) {
    state = { count: 0, overflow: "", scrollbarGutter: "" };
    scrollLocks.set(doc, state);
  }
  if (state.count === 0) {
    const html = doc.documentElement;
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
export function unlockScroll(owner?: ScrollLockOwner | null): void {
  const doc = getDocument(owner);
  const state = scrollLocks.get(doc);
  if (!state) return;
  state.count = Math.max(0, state.count - 1);
  if (state.count === 0) {
    const html = doc.documentElement;
    html.style.overflow = state.overflow;
    html.style.scrollbarGutter = state.scrollbarGutter;
  }
}

/**
 * Get current scroll lock count (for testing).
 */
export function getScrollLockCount(owner?: ScrollLockOwner | null): number {
  const doc = getDocument(owner);
  return scrollLocks.get(doc)?.count ?? 0;
}

/**
 * Reset scroll lock state (for testing).
 */
export function resetScrollLock(owner?: ScrollLockOwner | null): void {
  const doc = getDocument(owner);
  scrollLocks.delete(doc);
  const html = doc.documentElement;
  html.style.overflow = "";
  html.style.scrollbarGutter = "";
}
