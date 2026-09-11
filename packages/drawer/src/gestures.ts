import { on } from '@data-slot/core';

export type DrawerSwipeDirection = 'down' | 'up' | 'left' | 'right';
export type DrawerSnapPoint = number | string;

export function parseSnapPoint(value: unknown): DrawerSnapPoint | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== 'string') return null;
  if (/^\d*\.?\d+(px|rem)$/.test(value) && parseFloat(value) >= 0) return value;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function snapPixels(point: DrawerSnapPoint, viewport: number, rem: number): number {
  if (typeof point === 'number') return point <= 1 ? point * viewport : point;
  return parseFloat(point) * (point.endsWith('rem') ? rem : 1);
}

interface GestureOptions {
  element: HTMLElement;
  popup: HTMLElement;
  direction: DrawerSwipeDirection;
  opening?: boolean;
  enabled(): boolean;
  size(): number;
  offset(): number;
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

export function createSwipeGesture(options: GestureOptions): () => void {
  const { element, popup, direction } = options;
  const doc = element.ownerDocument;
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'up' || direction === 'left' ? -1 : 1;
  let gesture: { id: number; x: number; y: number; time: number; target: Element; started: boolean; distance: number } | null = null;
  let suppressClick = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  const reset = (event?: Event) => {
    if (gesture?.started) {
      try { element.releasePointerCapture?.(gesture.id); } catch { /* capture may already be released */ }
    }
    gesture = null;
    options.reset(event);
  };
  const start = (event: PointerEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.isPrimary === false || !options.enabled()) return;
      const target = event.target as Element;
      if (target.closest('[data-swipe-ignore],input,textarea,select,button,a,[contenteditable="true"]')) return;
      if (!options.opening && target.closest('[data-slot="drawer-popup"]') !== popup) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, target, started: false, distance: 0 };
  };
  const move = (event: PointerEvent, originalEvent: Event = event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (!options.enabled()) { reset(); return; }
      const axis = horizontal ? event.clientX - gesture.x : event.clientY - gesture.y;
      const cross = horizontal ? event.clientY - gesture.y : event.clientX - gesture.x;
      const distance = axis * sign;
      if (!gesture.started) {
        if (Math.abs(axis) < 8 && Math.abs(cross) < 8) return;
        if (Math.abs(cross) > Math.abs(axis) || (!options.opening && canScroll(gesture.target, popup, horizontal, axis)) || (options.opening && distance >= 0)) {
          gesture = null;
          return;
        }
        gesture.started = true;
        try { element.setPointerCapture?.(event.pointerId); } catch { /* optional in older DOMs */ }
      }
      if (event.cancelable) event.preventDefault();
      gesture.distance = distance;
      options.move(distance, originalEvent);
  };
  const end = (event: PointerEvent, originalEvent: Event = event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (gesture.started) {
        const distance = gesture.distance;
        const velocity = distance / Math.max(1, event.timeStamp - gesture.time);
        suppressClick = true;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { suppressClick = false; }, 400);
        options.release(distance, velocity, originalEvent);
      }
      reset();
  };
  const touchEvent = (event: TouchEvent, touch: Touch) => ({
    target: event.target, pointerId: touch.identifier, clientX: touch.clientX, clientY: touch.clientY,
    button: 0, isPrimary: true, timeStamp: event.timeStamp, defaultPrevented: event.defaultPrevented,
    cancelable: event.cancelable, preventDefault: () => event.preventDefault(),
  }) as PointerEvent;
  const cleanups = [
    // The release click has no new down event. A fresh interaction must remain usable.
    on(doc, 'pointerdown', () => { suppressClick = false; clearTimeout(clickTimer); }, { capture: true }),
    on(doc, 'touchstart', () => { suppressClick = false; clearTimeout(clickTimer); }, { capture: true, passive: true }),
    on(element, 'pointerdown', (event) => { if (event.pointerType !== 'touch') start(event); }),
    on(doc, 'pointermove', (event) => { if (event.pointerType !== 'touch') move(event); }, { passive: false }),
    on(doc, 'pointerup', (event) => { if (event.pointerType !== 'touch') end(event); }),
    on(element, 'touchstart', (event) => {
      if (event.touches.length !== 1) { reset(); return; }
      start(touchEvent(event, event.touches[0]!));
    }, { passive: true }),
    on(doc, 'touchmove', (event) => {
      const touch = Array.from(event.touches).find((touch) => touch.identifier === gesture?.id);
      if (touch) move(touchEvent(event, touch), event);
    }, { passive: false }),
    on(doc, 'touchend', (event) => {
      const touch = Array.from(event.changedTouches).find((touch) => touch.identifier === gesture?.id);
      if (touch) end(touchEvent(event, touch), event);
    }),
    on(doc, 'touchcancel', reset),
    on(doc, 'pointercancel', (event) => { if (event.pointerType !== 'touch' && gesture?.id === event.pointerId) reset(event); }),
    on(doc, 'click', (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true }),
  ];
  return () => { cleanups.forEach((cleanup) => cleanup()); clearTimeout(clickTimer); reset(); };
}
