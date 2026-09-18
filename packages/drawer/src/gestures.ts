import { createSwipeGesture } from '@data-slot/core';

/** Direction in which a swipe dismisses the drawer. */
export type DrawerSwipeDirection = 'down' | 'up' | 'left' | 'right';

/**
 * A single visible open size: a viewport fraction from `0` to `1` (inclusive),
 * a pixel number greater than `1`, or a non-negative `px`/`rem` string.
 * Numeric strings are normalized to numbers. The visible size is capped at the
 * popup's CSS size; pass `null` to the options/controller to use its full size.
 */
export type DrawerSnapPoint = number | string;

export function parseSnapPoint(value: unknown): DrawerSnapPoint | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (/^\d*\.?\d+(px|rem)$/.test(text)) return text;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function snapPixels(point: DrawerSnapPoint, viewport: number, rem: number): number {
  if (typeof point === 'number') return point <= 1 ? point * viewport : point;
  return parseFloat(point) * (point.endsWith('rem') ? rem : 1);
}

interface DrawerSwipeOptions {
  popup: HTMLElement;
  direction: DrawerSwipeDirection;
  enabled(): boolean;
  /** Signed distance along the dismissal direction; positive moves toward dismissal. */
  move(distance: number, event: Event): void;
  release(distance: number, velocity: number, event: Event): void;
  reset(event?: Event): void;
}

/** Native scrolling retains ownership until a gesture starts at its scroll boundary. */
function canScroll(target: Element, boundary: HTMLElement, horizontal: boolean, movement: number): boolean {
  for (let node: Element | null = target; node && boundary.contains(node); node = node.parentElement) {
    const el = node as HTMLElement;
    const style = el.ownerDocument.defaultView!.getComputedStyle(el);
    const overflow = horizontal ? style.overflowX : style.overflowY;
    if (!/(auto|scroll)/.test(overflow)) continue;
    const position = horizontal ? el.scrollLeft : el.scrollTop;
    const maximum = horizontal ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
    if (maximum > 1 && (movement > 0 ? position > 0 : position < maximum - 1)) return true;
  }
  return false;
}

/** A single-axis dismissal swipe on the popup, reported as signed distance and velocity. */
export function createDrawerSwipe(options: DrawerSwipeOptions): () => void {
  const { popup, direction } = options;
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'up' || direction === 'left' ? -1 : 1;
  const along = (move: { deltaX: number; deltaY: number }) => horizontal ? move.deltaX : move.deltaY;
  const gesture = createSwipeGesture<HTMLElement>({
    element: popup,
    axes: [horizontal ? 'x' : 'y'],
    start: (_event, target) => {
      if (!options.enabled()) return null;
      if (target.closest('[data-swipe-ignore],input,textarea,select,button,a,[contenteditable="true"]')) return null;
      return target.closest('[data-slot="drawer-popup"]') === popup ? popup : null;
    },
    lock: (_popup, move, pressTarget) => !canScroll(pressTarget, popup, horizontal, along(move)),
    active: options.enabled,
    move: (_popup, move) => options.move(along(move) * sign, move.event),
    release: (_popup, release) => {
      const distance = along(release) * sign;
      options.release(distance, distance / Math.max(1, release.duration), release.event);
      options.reset();
    },
    reset: (_popup, event) => options.reset(event),
  });
  return gesture.destroy;
}
