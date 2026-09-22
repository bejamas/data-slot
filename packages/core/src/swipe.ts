import { on } from "./events.ts";

export type SwipeAxis = "x" | "y";

export interface SwipeMove {
  axis: SwipeAxis;
  deltaX: number;
  deltaY: number;
  /** The pointer or touch event that produced this update. */
  event: Event;
}

export interface SwipeRelease extends SwipeMove {
  /** Milliseconds between the initial press and the release. */
  duration: number;
}

export interface SwipeGestureOptions<T> {
  /** Receives the initial press; movement is tracked on its document. */
  element: HTMLElement;
  /** Axes the gesture may lock to. A drag dominated by another axis is left to the page. */
  axes: readonly SwipeAxis[];
  /** Movement in pixels before the axis locks and callbacks begin (default 8). */
  lockThreshold?: number;
  /** Resolve what a press on `target` would swipe, or return `null` to ignore the press. */
  start(event: PointerEvent, target: Element): T | null;
  /** Element that captures the pointer once the axis locks (default `element`). */
  capture?(target: T): HTMLElement;
  /** Called once when the axis locks; return `false` to hand the drag back, e.g. to native scrolling. */
  lock?(target: T, move: SwipeMove, pressTarget: Element): boolean;
  /** Whether the target still accepts the gesture; `false` cancels it. */
  active?(target: T): boolean;
  move(target: T, move: SwipeMove): void;
  /** The pointer lifted after the axis locked. Terminal: `reset` is not called afterwards. */
  release(target: T, release: SwipeRelease): void;
  /** The gesture ended without a release: pointer cancelled, target inactive, or `cancel()` called. */
  reset(target: T, event?: Event): void;
}

export interface SwipeGestureController<T> {
  /** Cancel the gesture in flight, or only when it is on `target`. */
  cancel(target?: T): void;
  destroy(): void;
}

interface TrackedSwipe<T> {
  target: T;
  pressTarget: Element;
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  timeStamp: number;
  axis: SwipeAxis | null;
  captured: HTMLElement | null;
}

const CLICK_SUPPRESSION_MS = 400;

/**
 * Track one swipe at a time from a press on `element`. Nothing is reported
 * until movement passes the lock threshold on an allowed axis, so taps and
 * cross-axis scrolls never start a swipe. Touch input is read from touch
 * events so browsers that cancel touch pointers mid-scroll cannot drop it.
 */
export function createSwipeGesture<T>(options: SwipeGestureOptions<T>): SwipeGestureController<T> {
  const { element, axes } = options;
  const doc = element.ownerDocument;
  const lockThreshold = options.lockThreshold ?? 8;
  let tracked: TrackedSwipe<T> | null = null;
  let suppressClick = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;

  /** Stop tracking and release capture; returns what was tracked. */
  const finish = (): TrackedSwipe<T> | null => {
    const current = tracked;
    tracked = null;
    if (current?.captured) {
      try { current.captured.releasePointerCapture?.(current.pointerId); } catch { /* capture may already be released */ }
    }
    return current;
  };

  const cancel = (event?: Event) => {
    const current = finish();
    if (current?.axis) options.reset(current.target, event);
  };

  const isActive = (current: TrackedSwipe<T>) => !options.active || options.active(current.target);

  const press = (event: PointerEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const pressTarget = event.target;
    if (!(pressTarget instanceof Element)) return;
    const target = options.start(event, pressTarget);
    if (target === null) return;
    cancel(event);
    tracked = {
      target, pressTarget, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY,
      timeStamp: event.timeStamp, axis: null, captured: null,
    };
  };

  const drag = (event: PointerEvent, originalEvent: Event = event) => {
    if (!tracked || tracked.pointerId !== event.pointerId) return;
    if (!isActive(tracked)) { cancel(originalEvent); return; }
    tracked.lastX = event.clientX;
    tracked.lastY = event.clientY;
    const deltaX = event.clientX - tracked.startX;
    const deltaY = event.clientY - tracked.startY;
    if (!tracked.axis) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (Math.max(absX, absY) < lockThreshold) return;
      const axis: SwipeAxis = absX === absY ? axes[0] ?? "y" : absX > absY ? "x" : "y";
      const move: SwipeMove = { axis, deltaX, deltaY, event: originalEvent };
      if (!axes.includes(axis) || (options.lock && !options.lock(tracked.target, move, tracked.pressTarget))) {
        // Nothing has been drawn yet, so the page keeps this drag.
        tracked = null;
        return;
      }
      tracked.axis = axis;
      tracked.captured = options.capture?.(tracked.target) ?? element;
      try { tracked.captured.setPointerCapture?.(event.pointerId); } catch { /* optional in older DOMs */ }
    }
    if (originalEvent.cancelable) originalEvent.preventDefault();
    options.move(tracked.target, { axis: tracked.axis, deltaX, deltaY, event: originalEvent });
  };

  const lift = (event: PointerEvent, originalEvent: Event = event) => {
    if (!tracked || tracked.pointerId !== event.pointerId) return;
    if (!isActive(tracked)) { cancel(originalEvent); return; }
    const current = finish()!;
    if (!current.axis) return;
    // The release click has no new press. Swallow it so it cannot activate what is under the pointer.
    suppressClick = true;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { suppressClick = false; }, CLICK_SUPPRESSION_MS);
    options.release(current.target, {
      axis: current.axis,
      deltaX: current.lastX - current.startX,
      deltaY: current.lastY - current.startY,
      event: originalEvent,
      duration: event.timeStamp - current.timeStamp,
    });
  };

  const clearSuppression = () => { suppressClick = false; clearTimeout(clickTimer); };
  const touchEvent = (event: TouchEvent, touch: Touch) => ({
    target: event.target, pointerId: touch.identifier, clientX: touch.clientX, clientY: touch.clientY,
    button: 0, timeStamp: event.timeStamp, defaultPrevented: event.defaultPrevented,
    cancelable: event.cancelable, preventDefault: () => event.preventDefault(),
  }) as PointerEvent;
  const trackedTouch = (touches: TouchList) =>
    Array.from(touches).find((touch) => touch.identifier === tracked?.pointerId);

  const cleanups = [
    on(doc, "pointerdown", clearSuppression, { capture: true }),
    on(doc, "touchstart", clearSuppression, { capture: true, passive: true }),
    on(element, "pointerdown", (event) => { if (event.pointerType !== "touch") press(event); }),
    on(doc, "pointermove", (event) => { if (event.pointerType !== "touch") drag(event); }, { passive: false }),
    on(doc, "pointerup", (event) => { if (event.pointerType !== "touch") lift(event); }),
    on(doc, "pointercancel", (event) => {
      if (event.pointerType !== "touch" && tracked?.pointerId === event.pointerId) cancel(event);
    }),
    on(element, "touchstart", (event) => {
      if (event.touches.length !== 1) { cancel(event); return; }
      press(touchEvent(event, event.touches[0]!));
    }, { passive: true }),
    on(doc, "touchmove", (event) => {
      const touch = trackedTouch(event.touches);
      if (touch) drag(touchEvent(event, touch), event);
    }, { passive: false }),
    on(doc, "touchend", (event) => {
      const touch = trackedTouch(event.changedTouches);
      if (touch) lift(touchEvent(event, touch), event);
    }),
    on(doc, "touchcancel", (event) => cancel(event)),
    on(doc, "click", (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true }),
  ];

  return {
    cancel(target) {
      if (tracked && (target === undefined || tracked.target === target)) cancel();
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      clearTimeout(clickTimer);
      cancel();
    },
  };
}
