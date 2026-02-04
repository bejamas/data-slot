/**
 * Scroll lock utilities with reference counting.
 * Prevents body scroll when overlays (dialogs, selects, dropdowns) are open.
 * Handles scrollbar width compensation to prevent layout shift.
 */

// Global state for scroll lock with ref counting
let scrollLockCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";

/**
 * Lock document scroll. Call when opening an overlay.
 * Uses reference counting - multiple overlays can be open simultaneously.
 */
export function lockScroll(): void {
  if (scrollLockCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPaddingRight = document.body.style.paddingRight;
    // Add scrollbar width to existing computed padding to avoid layout shift
    const computedPadding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.paddingRight = `${computedPadding + scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
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
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.paddingRight = savedBodyPaddingRight;
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
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
  savedBodyOverflow = "";
  savedBodyPaddingRight = "";
}
