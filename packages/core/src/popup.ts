import { on } from "./events.ts";
import { containsWithPortals, portalToBody, restorePortal } from "./parts.ts";
import type { PortalState } from "./parts.ts";

export type PopupSide = "top" | "right" | "bottom" | "left";
export type PopupAlign = "start" | "center" | "end";

export interface PopupPlacementOptions {
  side: PopupSide;
  align: PopupAlign;
  sideOffset: number;
  alignOffset: number;
  avoidCollisions: boolean;
  collisionPadding: number;
  allowedSides?: readonly PopupSide[];
}

interface RectLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface ComputeFloatingPositionInput extends PopupPlacementOptions {
  anchorRect: RectLike;
  contentRect: RectLike;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface FloatingPosition {
  x: number;
  y: number;
  side: PopupSide;
  align: PopupAlign;
}

const ALL_SIDES: readonly PopupSide[] = ["top", "right", "bottom", "left"];

interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const resolveViewportBounds = (input: ComputeFloatingPositionInput): ViewportBounds => {
  const visualViewport = window.visualViewport;
  const width = input.viewportWidth ?? visualViewport?.width;
  const height = input.viewportHeight ?? visualViewport?.height;

  if (width == null || height == null) {
    throw new Error(
      "computeFloatingPosition requires window.visualViewport when viewport dimensions are not provided"
    );
  }

  return {
    x: visualViewport?.offsetLeft ?? 0,
    y: visualViewport?.offsetTop ?? 0,
    width,
    height,
  };
};

const computeBasePosition = (
  side: PopupSide,
  align: PopupAlign,
  anchorRect: RectLike,
  contentRect: RectLike,
  sideOffset: number,
  alignOffset: number
): { x: number; y: number } => {
  let x = 0;
  let y = 0;

  if (side === "top") y = anchorRect.top - contentRect.height - sideOffset;
  else if (side === "bottom") y = anchorRect.bottom + sideOffset;
  else if (side === "left") x = anchorRect.left - contentRect.width - sideOffset;
  else x = anchorRect.right + sideOffset;

  if (side === "top" || side === "bottom") {
    if (align === "start") x = anchorRect.left + alignOffset;
    else if (align === "center") {
      x = anchorRect.left + anchorRect.width / 2 - contentRect.width / 2 + alignOffset;
    } else {
      x = anchorRect.right - contentRect.width - alignOffset;
    }
  } else {
    if (align === "start") y = anchorRect.top + alignOffset;
    else if (align === "center") {
      y = anchorRect.top + anchorRect.height / 2 - contentRect.height / 2 + alignOffset;
    } else {
      y = anchorRect.bottom - contentRect.height - alignOffset;
    }
  }

  return { x, y };
};

const getMainAxisOverflow = (
  side: PopupSide,
  pos: { x: number; y: number },
  contentRect: RectLike,
  viewport: ViewportBounds,
  collisionPadding: number
): number => {
  const minX = viewport.x + collisionPadding;
  const maxX = viewport.x + viewport.width - collisionPadding;
  const minY = viewport.y + collisionPadding;
  const maxY = viewport.y + viewport.height - collisionPadding;

  if (side === "top") return Math.max(0, minY - pos.y);
  if (side === "bottom") return Math.max(0, pos.y + contentRect.height - maxY);
  if (side === "left") return Math.max(0, minX - pos.x);
  return Math.max(0, pos.x + contentRect.width - maxX);
};

const clampCoord = (value: number, min: number, max: number): number => {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
};

export function computeFloatingPosition(input: ComputeFloatingPositionInput): FloatingPosition {
  const viewport = resolveViewportBounds(input);
  const allowedSides = input.allowedSides?.length
    ? [...new Set(input.allowedSides)]
    : [...ALL_SIDES];
  const preferredSide = allowedSides.includes(input.side) ? input.side : allowedSides[0]!;
  let side = preferredSide;

  let pos = computeBasePosition(
    side,
    input.align,
    input.anchorRect,
    input.contentRect,
    input.sideOffset,
    input.alignOffset
  );

  if (input.avoidCollisions) {
    const candidateSides = [preferredSide, ...allowedSides.filter((value) => value !== preferredSide)];
    let bestSide = side;
    let bestPos = pos;
    let bestOverflow = Number.POSITIVE_INFINITY;

    for (const candidate of candidateSides) {
      const candidatePos = computeBasePosition(
        candidate,
        input.align,
        input.anchorRect,
        input.contentRect,
        input.sideOffset,
        input.alignOffset
      );

      const overflow = getMainAxisOverflow(
        candidate,
        candidatePos,
        input.contentRect,
        viewport,
        input.collisionPadding
      );

      if (overflow <= 0) {
        bestSide = candidate;
        bestPos = candidatePos;
        bestOverflow = overflow;
        break;
      }

      if (overflow < bestOverflow) {
        bestSide = candidate;
        bestPos = candidatePos;
        bestOverflow = overflow;
      }
    }

    side = bestSide;
    pos = bestPos;

    const minX = viewport.x + input.collisionPadding;
    const maxX = viewport.x + viewport.width - input.contentRect.width - input.collisionPadding;
    const minY = viewport.y + input.collisionPadding;
    const maxY = viewport.y + viewport.height - input.contentRect.height - input.collisionPadding;
    pos.x = clampCoord(pos.x, minX, maxX);
    pos.y = clampCoord(pos.y, minY, maxY);
  }

  return { x: pos.x, y: pos.y, side, align: input.align };
}

export interface PositionSyncOptions {
  onUpdate: () => void;
  isActive?: () => boolean;
  observedElements?: readonly Element[];
  ignoreScrollTarget?: (target: EventTarget | null) => boolean;
  ancestorScroll?: boolean;
  ancestorResize?: boolean;
  elementResize?: boolean;
  layoutShift?: boolean;
  animationFrame?: boolean;
  win?: Window;
}

export interface PositionSyncController {
  start(): void;
  stop(): void;
  update(): void;
}

interface RectSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

const rectToSnapshot = (rect: Pick<DOMRectReadOnly, "x" | "y" | "width" | "height">): RectSnapshot => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
});

const rectsAreEqual = (a: RectSnapshot, b: RectSnapshot): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const isOverflowElement = (el: Element): boolean => {
  const style = getComputedStyle(el);
  const overflow = `${style.overflow}${style.overflowX}${style.overflowY}`;
  return /(auto|scroll|overlay)/.test(overflow);
};

const collectOverflowAncestors = (el: Element, win: Window): EventTarget[] => {
  const targets = new Set<EventTarget>([el]);
  let current: Node | null = el.parentNode;

  while (current) {
    if (current instanceof Element) {
      if (isOverflowElement(current)) targets.add(current);
      current = current.parentNode;
      continue;
    }

    if (current instanceof Document) {
      if (current.scrollingElement) targets.add(current.scrollingElement);
      targets.add(current);
      if (current.defaultView) {
        targets.add(current.defaultView);
        if (current.defaultView.visualViewport) {
          targets.add(current.defaultView.visualViewport);
        }
      }
      break;
    }

    current = null;
  }

  targets.add(win);
  if (win.visualViewport) targets.add(win.visualViewport);

  return [...targets];
};

const observeElementMove = (element: Element, onMove: () => void, win: Window): (() => void) => {
  let io: IntersectionObserver | null = null;
  let timeoutId: number | null = null;

  const cleanup = () => {
    if (timeoutId !== null) {
      win.clearTimeout(timeoutId);
      timeoutId = null;
    }
    io?.disconnect();
    io = null;
  };

  const refresh = (skip = false, threshold = 1) => {
    cleanup();

    const initialRect = element.getBoundingClientRect();
    if (!skip) {
      onMove();
    }

    if (!initialRect.width || !initialRect.height) {
      return;
    }

    const docEl = element.ownerDocument.documentElement;
    const insetTop = Math.floor(initialRect.top);
    const insetRight = Math.floor(docEl.clientWidth - (initialRect.left + initialRect.width));
    const insetBottom = Math.floor(docEl.clientHeight - (initialRect.top + initialRect.height));
    const insetLeft = Math.floor(initialRect.left);
    const rootMargin = `${-insetTop}px ${-insetRight}px ${-insetBottom}px ${-insetLeft}px`;
    const clampedThreshold = Math.max(0, Math.min(1, threshold)) || 1;

    let isFirstUpdate = true;
    io = new IntersectionObserver(
      (entries) => {
        const ratio = entries[0]?.intersectionRatio ?? 1;

        if (ratio !== clampedThreshold) {
          if (!isFirstUpdate) {
            refresh();
            return;
          }

          if (!ratio) {
            timeoutId = win.setTimeout(() => {
              refresh(false, 1e-7);
            }, 1000);
          } else {
            refresh(false, ratio);
          }
        }

        if (
          ratio === 1 &&
          !rectsAreEqual(rectToSnapshot(initialRect), rectToSnapshot(element.getBoundingClientRect()))
        ) {
          refresh();
          return;
        }

        isFirstUpdate = false;
      },
      {
        rootMargin,
        threshold: clampedThreshold,
      }
    );

    io.observe(element);
  };

  refresh(true);
  return cleanup;
};

export function createPositionSync(options: PositionSyncOptions): PositionSyncController {
  const win = options.win ?? window;
  const isActive = options.isActive ?? (() => true);
  const observedElements = options.observedElements ?? [];
  const ancestorScroll = options.ancestorScroll ?? true;
  const ancestorResize = options.ancestorResize ?? true;
  const elementResize = options.elementResize ?? typeof ResizeObserver !== "undefined";
  const layoutShift = options.layoutShift ?? false;
  const animationFrame = options.animationFrame ?? false;

  let rafId: number | null = null;
  let frameId: number | null = null;
  let started = false;
  let resizeObserver: ResizeObserver | null = null;
  let moveCleanup: (() => void) | null = null;
  let listenerCleanups: Array<() => void> = [];

  const schedule = () => {
    if (rafId !== null) return;
    rafId = win.requestAnimationFrame(() => {
      rafId = null;
      if (isActive()) options.onUpdate();
    });
  };

  const onResize = () => schedule();
  const onScroll = (e: Event) => {
    if (options.ignoreScrollTarget?.(e.target)) return;
    schedule();
  };

  const getScrollTargets = (): EventTarget[] => {
    const targets = new Set<EventTarget>();
    const elements = observedElements.length ? observedElements : [];

    if (elements.length === 0) {
      targets.add(win);
      if (win.visualViewport) targets.add(win.visualViewport);
      return [...targets];
    }

    for (const el of elements) {
      for (const target of collectOverflowAncestors(el, win)) {
        targets.add(target);
      }
    }

    return [...targets];
  };

  const getResizeTargets = (scrollTargets: readonly EventTarget[]): EventTarget[] => {
    const targets = new Set<EventTarget>([win]);
    if (win.visualViewport) targets.add(win.visualViewport);

    for (const target of scrollTargets) {
      if (target === win || target === win.visualViewport) {
        targets.add(target);
      }
    }

    return [...targets];
  };

  const start = () => {
    if (started) return;
    started = true;

    const scrollTargets = getScrollTargets();
    const resizeTargets = getResizeTargets(scrollTargets);

    if (ancestorScroll) {
      for (const target of scrollTargets) {
        target.addEventListener("scroll", onScroll as EventListener, { passive: true });
        listenerCleanups.push(() =>
          target.removeEventListener("scroll", onScroll as EventListener)
        );
      }
    }

    if (ancestorResize) {
      for (const target of resizeTargets) {
        target.addEventListener("resize", onResize as EventListener);
        listenerCleanups.push(() =>
          target.removeEventListener("resize", onResize as EventListener)
        );
      }
    }

    if (elementResize && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(onResize);
      for (const el of observedElements) {
        resizeObserver.observe(el);
      }
    }

    const referenceElement = observedElements[0] ?? null;

    if (layoutShift && referenceElement && typeof IntersectionObserver !== "undefined") {
      moveCleanup = observeElementMove(referenceElement, schedule, win);
    }

    if (animationFrame && referenceElement) {
      let prevRect = rectToSnapshot(referenceElement.getBoundingClientRect());
      const loop = () => {
        if (!started) return;
        const nextRect = rectToSnapshot(referenceElement.getBoundingClientRect());
        if (!rectsAreEqual(prevRect, nextRect)) {
          schedule();
        }
        prevRect = nextRect;
        frameId = win.requestAnimationFrame(loop);
      };
      frameId = win.requestAnimationFrame(loop);
    }
  };

  const stop = () => {
    if (!started) return;
    started = false;

    if (rafId !== null) {
      win.cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (frameId !== null) {
      win.cancelAnimationFrame(frameId);
      frameId = null;
    }

    listenerCleanups.forEach((cleanup) => cleanup());
    listenerCleanups = [];

    resizeObserver?.disconnect();
    resizeObserver = null;
    moveCleanup?.();
    moveCleanup = null;
  };

  return {
    start,
    stop,
    update: schedule,
  };
}

export interface DismissLayerOptions {
  root: Element;
  isOpen: () => boolean;
  onDismiss: () => void;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  preventEscapeDefault?: boolean;
  isInside?: (target: Node | null) => boolean;
}

export function createDismissLayer(options: DismissLayerOptions): () => void {
  const doc = options.root.ownerDocument ?? document;
  const isInside = options.isInside ?? ((target: Node | null) => containsWithPortals(options.root, target));
  const closeOnClickOutside = options.closeOnClickOutside ?? true;
  const closeOnEscape = options.closeOnEscape ?? true;
  const preventEscapeDefault = options.preventEscapeDefault ?? true;
  const cleanups: Array<() => void> = [];

  if (closeOnClickOutside) {
    cleanups.push(
      on(doc, "pointerdown", (e) => {
        if (!options.isOpen()) return;
        const target = e.target as Node | null;
        if (!isInside(target)) {
          options.onDismiss();
        }
      })
    );
  }

  if (closeOnEscape) {
    cleanups.push(
      on(doc, "keydown", (e) => {
        if (!options.isOpen()) return;
        if (e.key !== "Escape") return;
        if (preventEscapeDefault) e.preventDefault();
        options.onDismiss();
      })
    );
  }

  return () => {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
  };
}

export interface PortalLifecycleOptions {
  content: Element;
  root: Element;
  enabled?: boolean;
  state?: PortalState;
}

export interface PortalLifecycleController {
  readonly state: PortalState;
  mount(): void;
  restore(): void;
  cleanup(): void;
}

export function createPortalLifecycle(options: PortalLifecycleOptions): PortalLifecycleController {
  const enabled = options.enabled ?? true;
  const state: PortalState = options.state ?? {
    originalParent: null,
    originalNextSibling: null,
    portaled: false,
  };

  return {
    state,
    mount: () => {
      if (!enabled) return;
      portalToBody(options.content, options.root, state);
    },
    restore: () => {
      if (!enabled) return;
      restorePortal(options.content, state);
    },
    cleanup: () => {
      if (!enabled) return;
      restorePortal(options.content, state);
    },
  };
}
