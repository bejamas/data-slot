/**
 * Scroll lock utilities with reference counting.
 * Prevents body scroll when overlays (dialogs, selects, dropdowns) are open.
 * Uses scrollbar-gutter: stable to prevent layout shift.
 */

// Global state for scroll lock with ref counting
let scrollLockCount = 0;
let savedOverflow = "";
let savedScrollbarGutter = "";

/**
 * Lock document scroll. Call when opening an overlay.
 * Uses reference counting - multiple overlays can be open simultaneously.
 */
export function lockScroll(): void {
  if (scrollLockCount === 0) {
    const html = document.documentElement;
    savedOverflow = html.style.overflow;
    savedScrollbarGutter = html.style.scrollbarGutter;
    html.style.overflow = "hidden";
    html.style.scrollbarGutter = "stable";
  }
  scrollLockCount++;
}

/**
 * Unlock document scroll. Call when closing an overlay.
 * Only restores scroll when all overlays are closed (ref count reaches 0).
 */
export function unlockScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    const html = document.documentElement;
    html.style.overflow = savedOverflow;
    html.style.scrollbarGutter = savedScrollbarGutter;
  }
}

/**
 * Get current scroll lock count (for testing).
 */
export function getScrollLockCount(): number {
  return scrollLockCount;
}

/**
 * Reset scroll lock state (for testing).
 */
export function resetScrollLock(): void {
  scrollLockCount = 0;
  const html = document.documentElement;
  html.style.overflow = "";
  html.style.scrollbarGutter = "";
  savedOverflow = "";
  savedScrollbarGutter = "";
}
