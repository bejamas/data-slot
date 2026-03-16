import { on } from "./events.ts";
import { containsWithPortals, portalToBody, restorePortal } from "./parts.ts";
import type { PortalState } from "./parts.ts";

export type PopupDirection = "ltr" | "rtl";
export type PopupSide = "top" | "right" | "bottom" | "left" | "inline-start" | "inline-end";
export type PopupAlign = "start" | "center" | "end";

type PhysicalPopupSide = "top" | "right" | "bottom" | "left";

export interface PopupPlacementOptions {
  side: PopupSide;
  align: PopupAlign;
  sideOffset: number;
  alignOffset: number;
  avoidCollisions: boolean;
  collisionPadding: number;
  direction?: PopupDirection;
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

export interface FloatingTransformOriginAnchor {
  x: number;
  y: number;
}

export interface ComputeFloatingTransformOriginInput {
  side: PopupSide;
  align: PopupAlign;
  anchorRect: RectLike;
  popupX: number;
  popupY: number;
  direction?: PopupDirection;
}

const resolvePhysicalSide = (
  side: PopupSide,
  direction: PopupDirection
): PhysicalPopupSide => {
  if (side === "inline-start") {
    return direction === "rtl" ? "right" : "left";
  }
  if (side === "inline-end") {
    return direction === "rtl" ? "left" : "right";
  }
  return side;
};

const getDefaultAllowedSides = (preferredSide: PopupSide): readonly PopupSide[] => {
  switch (preferredSide) {
    case "top":
      return ["top", "right", "bottom", "left"];
    case "bottom":
      return ["bottom", "top", "right", "left"];
    case "left":
      return ["left", "top", "right", "bottom"];
    case "right":
      return ["right", "top", "bottom", "left"];
    case "inline-start":
      return ["inline-start", "inline-end", "top", "bottom"];
    case "inline-end":
      return ["inline-end", "inline-start", "top", "bottom"];
  }
};

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
  side: PhysicalPopupSide,
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

const getAlignedPointOnRect = (
  rect: RectLike,
  align: PopupAlign
): FloatingTransformOriginAnchor => {
  if (align === "start") return { x: rect.left, y: rect.top };
  if (align === "end") return { x: rect.right, y: rect.bottom };
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

export const getFloatingTransformOriginAnchor = (
  side: PopupSide,
  align: PopupAlign,
  anchorRect: RectLike,
  direction: PopupDirection = "ltr"
): FloatingTransformOriginAnchor => {
  const physicalSide = resolvePhysicalSide(side, direction);
  const aligned = getAlignedPointOnRect(anchorRect, align);
  if (physicalSide === "top") return { x: aligned.x, y: anchorRect.top };
  if (physicalSide === "bottom") return { x: aligned.x, y: anchorRect.bottom };
  if (physicalSide === "left") return { x: anchorRect.left, y: aligned.y };
  return { x: anchorRect.right, y: aligned.y };
};

export const computeFloatingTransformOrigin = (
  input: ComputeFloatingTransformOriginInput
): string => {
  const anchor = getFloatingTransformOriginAnchor(
    input.side,
    input.align,
    input.anchorRect,
    input.direction
  );
  return `${anchor.x - input.popupX}px ${anchor.y - input.popupY}px`;
};

/**
 * Measure popup content size in a transform-stable way.
 *
 * `getBoundingClientRect()` reflects active CSS transforms (for example scale/zoom),
 * which can shift placement during open/close animations. `offsetWidth/offsetHeight`
 * stay in layout coordinates, so we prefer them when available.
 */
export function measurePopupContentRect(
  element: HTMLElement
): Pick<DOMRectReadOnly, "top" | "right" | "bottom" | "left" | "width" | "height"> {
  const visualRect = element.getBoundingClientRect();
  const width = element.offsetWidth > 0 ? element.offsetWidth : visualRect.width;
  const height = element.offsetHeight > 0 ? element.offsetHeight : visualRect.height;

  return {
    top: visualRect.top,
    left: visualRect.left,
    right: visualRect.left + width,
    bottom: visualRect.top + height,
    width,
    height,
  };
}

export const focusElement = (el: HTMLElement | null | undefined): void => {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
};

export interface ModalStackItemOptions {
  content: HTMLElement;
  overlay?: HTMLElement | null;
  onTabKeydown?: (event: KeyboardEvent) => void;
  cssVarPrefix: string;
}

export interface ModalStackItemController {
  open(): void;
  close(): void;
  destroy(): void;
}

interface ModalStackEntry extends ModalStackItemOptions {}

interface ModalStackStore {
  entries: ModalStackEntry[];
  cleanup: () => void;
}

const modalStackStores = new WeakMap<Document, ModalStackStore>();

const applyStackMetadata = (
  entry: ModalStackEntry,
  index: number
): void => {
  const stackIndex = String(index);

  if (entry.overlay) {
    entry.overlay.setAttribute("data-stack-index", stackIndex);
    entry.overlay.style.setProperty(`--${entry.cssVarPrefix}-stack-index`, stackIndex);
    entry.overlay.style.setProperty(
      `--${entry.cssVarPrefix}-overlay-stack-index`,
      stackIndex
    );
  }

  entry.content.setAttribute("data-stack-index", stackIndex);
  entry.content.style.setProperty(`--${entry.cssVarPrefix}-stack-index`, stackIndex);
  entry.content.style.setProperty(
    `--${entry.cssVarPrefix}-content-stack-index`,
    stackIndex
  );
};

const clearStackMetadata = (entry: ModalStackEntry): void => {
  if (entry.overlay) {
    entry.overlay.removeAttribute("data-stack-index");
    entry.overlay.style.removeProperty(`--${entry.cssVarPrefix}-stack-index`);
    entry.overlay.style.removeProperty(`--${entry.cssVarPrefix}-overlay-stack-index`);
  }

  entry.content.removeAttribute("data-stack-index");
  entry.content.style.removeProperty(`--${entry.cssVarPrefix}-stack-index`);
  entry.content.style.removeProperty(`--${entry.cssVarPrefix}-content-stack-index`);
};

const reindexModalStack = (store: ModalStackStore): void => {
  store.entries.forEach((entry, index) => applyStackMetadata(entry, index));
};

const createModalStackStore = (doc: Document): ModalStackStore => {
  const store: ModalStackStore = {
    entries: [],
    cleanup: () => {},
  };

  const keydownCleanup = on(doc, "keydown", (event) => {
    if (event.key !== "Tab") return;

    const topmost = store.entries[store.entries.length - 1];
    if (!topmost) return;

    topmost.onTabKeydown?.(event);
  });

  store.cleanup = () => {
    keydownCleanup();
    store.entries.length = 0;
  };

  return store;
};

const getModalStackStore = (doc: Document): ModalStackStore => {
  const existing = modalStackStores.get(doc);
  if (existing) return existing;

  const created = createModalStackStore(doc);
  modalStackStores.set(doc, created);
  return created;
};

export function createModalStackItem(
  options: ModalStackItemOptions
): ModalStackItemController {
  const doc = options.content.ownerDocument ?? document;
  const entry: ModalStackEntry = {
    content: options.content,
    overlay: options.overlay ?? null,
    onTabKeydown: options.onTabKeydown,
    cssVarPrefix: options.cssVarPrefix,
  };
  let destroyed = false;
  let activeStore: ModalStackStore | null = null;

  const getEntryStore = (): ModalStackStore | null => {
    if (activeStore?.entries.includes(entry)) return activeStore;

    const currentStore = modalStackStores.get(doc) ?? null;
    if (currentStore?.entries.includes(entry)) {
      activeStore = currentStore;
      return currentStore;
    }

    activeStore = null;
    return null;
  };

  const close = () => {
    const store = getEntryStore();
    if (!store) return;

    const index = store.entries.indexOf(entry);
    if (index === -1) {
      if (activeStore === store) activeStore = null;
      return;
    }

    store.entries.splice(index, 1);
    clearStackMetadata(entry);
    reindexModalStack(store);
    if (activeStore === store) {
      activeStore = null;
    }

    if (store.entries.length === 0) {
      store.cleanup();
      modalStackStores.delete(doc);
    }
  };

  return {
    open: () => {
      if (destroyed) return;
      const store = getEntryStore() ?? getModalStackStore(doc);
      if (store.entries.includes(entry)) return;
      store.entries.push(entry);
      activeStore = store;
      reindexModalStack(store);
    },
    close,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      close();
    },
  };
}

const getMainAxisOverflow = (
  side: PhysicalPopupSide,
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

const rectOverlapsViewportAxis = (
  start: number,
  end: number,
  min: number,
  max: number
): boolean => end > min && start < max;

const isVerticalSide = (side: PhysicalPopupSide): boolean => side === "top" || side === "bottom";

export function computeFloatingPosition(input: ComputeFloatingPositionInput): FloatingPosition {
  const viewport = resolveViewportBounds(input);
  const direction = input.direction ?? "ltr";
  const allowedSides = input.allowedSides?.length
    ? [...new Set(input.allowedSides)]
    : [...getDefaultAllowedSides(input.side)];
  const preferredSide = allowedSides.includes(input.side) ? input.side : allowedSides[0]!;
  let side = preferredSide;
  let physicalSide = resolvePhysicalSide(preferredSide, direction);

  let pos = computeBasePosition(
    physicalSide,
    input.align,
    input.anchorRect,
    input.contentRect,
    input.sideOffset,
    input.alignOffset
  );

  if (input.avoidCollisions) {
    const minX = viewport.x + input.collisionPadding;
    const minY = viewport.y + input.collisionPadding;
    const anchorOverlapsX = rectOverlapsViewportAxis(
      input.anchorRect.left,
      input.anchorRect.right,
      viewport.x,
      viewport.x + viewport.width
    );
    const anchorOverlapsY = rectOverlapsViewportAxis(
      input.anchorRect.top,
      input.anchorRect.bottom,
      viewport.y,
      viewport.y + viewport.height
    );
    const preferredMainAxisVisible = isVerticalSide(physicalSide) ? anchorOverlapsY : anchorOverlapsX;

    if (preferredMainAxisVisible) {
      const candidateSides = [preferredSide, ...allowedSides.filter((value) => value !== preferredSide)];
      let bestSide = side;
      let bestPos = pos;
      let bestOverflow = Number.POSITIVE_INFINITY;
      let bestPhysicalSide = physicalSide;

      for (const candidate of candidateSides) {
        const candidatePhysicalSide = resolvePhysicalSide(candidate, direction);
        const candidatePos = computeBasePosition(
          candidatePhysicalSide,
          input.align,
          input.anchorRect,
          input.contentRect,
          input.sideOffset,
          input.alignOffset
        );

        const overflow = getMainAxisOverflow(
          candidatePhysicalSide,
          candidatePos,
          input.contentRect,
          viewport,
          input.collisionPadding
        );

        if (overflow <= 0) {
          bestSide = candidate;
          bestPos = candidatePos;
          bestOverflow = overflow;
          bestPhysicalSide = candidatePhysicalSide;
          break;
        }

        if (overflow < bestOverflow) {
          bestSide = candidate;
          bestPos = candidatePos;
          bestOverflow = overflow;
          bestPhysicalSide = candidatePhysicalSide;
        }
      }

      side = bestSide;
      physicalSide = bestPhysicalSide;
      pos = bestPos;
    }

    const maxClampedX = viewport.x + viewport.width - input.contentRect.width - input.collisionPadding;
    const maxClampedY = viewport.y + viewport.height - input.contentRect.height - input.collisionPadding;
    if (anchorOverlapsX) {
      pos.x = clampCoord(pos.x, minX, maxClampedX);
    }
    if (anchorOverlapsY) {
      pos.y = clampCoord(pos.y, minY, maxClampedY);
    }
  }

  return { x: pos.x, y: pos.y, side, align: input.align };
}

export function ensureItemVisibleInContainer(
  item: HTMLElement,
  container: HTMLElement,
  padding = 4
): void {
  if (container.clientHeight <= 0) return;

  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  if (maxScrollTop <= 0) return;

  const itemRect = item.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const itemTop = itemRect.top - containerRect.top + container.scrollTop;
  const itemBottom = itemTop + itemRect.height;
  const visibleTop = container.scrollTop + padding;
  const visibleBottom = container.scrollTop + container.clientHeight - padding;

  let nextScrollTop = container.scrollTop;
  if (itemTop < visibleTop) {
    nextScrollTop = itemTop - padding;
  } else if (itemBottom > visibleBottom) {
    nextScrollTop = itemBottom - container.clientHeight + padding;
  }

  nextScrollTop = Math.min(Math.max(nextScrollTop, 0), maxScrollTop);
  if (nextScrollTop !== container.scrollTop) {
    container.scrollTop = nextScrollTop;
  }
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

interface DismissLayerEntry {
  isOpen: () => boolean;
  onDismiss: () => void;
  isInside: (target: Node | null) => boolean;
  closeOnClickOutside: boolean;
  closeOnEscape: boolean;
  preventEscapeDefault: boolean;
  wasOpen: boolean;
  openOrder: number;
}

interface DismissLayerStore {
  layers: DismissLayerEntry[];
  openSequence: number;
  pendingTouchOutside: boolean;
  pendingIframeBlur: ReturnType<Window["setTimeout"]> | null;
  cleanup: () => void;
}

const dismissLayerStores = new WeakMap<Document, DismissLayerStore>();

const syncLayerOpenState = (store: DismissLayerStore, layer: DismissLayerEntry): boolean => {
  const open = layer.isOpen();
  if (open && !layer.wasOpen) {
    store.openSequence += 1;
    layer.openOrder = store.openSequence;
  }
  layer.wasOpen = open;
  return open;
};

const getTopmostOpenLayer = (
  store: DismissLayerStore,
  predicate?: (layer: DismissLayerEntry) => boolean
): DismissLayerEntry | null => {
  let topmost: DismissLayerEntry | null = null;
  for (const layer of store.layers) {
    const open = syncLayerOpenState(store, layer);
    if (!open) continue;
    if (predicate && !predicate(layer)) continue;
    if (!topmost || layer.openOrder > topmost.openOrder) {
      topmost = layer;
    }
  }
  return topmost;
};

const createDismissLayerStore = (doc: Document): DismissLayerStore => {
  const win = doc.defaultView ?? window;
  const store: DismissLayerStore = {
    layers: [],
    openSequence: 0,
    pendingTouchOutside: false,
    pendingIframeBlur: null,
    cleanup: () => {},
  };

  const clearPendingIframeBlur = () => {
    if (store.pendingIframeBlur == null) return;
    win.clearTimeout(store.pendingIframeBlur);
    store.pendingIframeBlur = null;
  };

  const pointerCleanup = on(doc, "pointerdown", (event) => {
    const target = event.target as Node | null;
    const topmost = getTopmostOpenLayer(store);
    if (!topmost || !topmost.closeOnClickOutside || topmost.isInside(target)) {
      store.pendingTouchOutside = false;
      return;
    }
    if ((event as PointerEvent).pointerType === "touch") {
      // On touch devices, pointerdown may indicate scroll start.
      // Defer outside dismissal until click activation.
      store.pendingTouchOutside = true;
      return;
    }
    store.pendingTouchOutside = false;
    topmost.onDismiss();
  });

  const clickCleanup = on(doc, "click", (event) => {
    if (!store.pendingTouchOutside) return;
    store.pendingTouchOutside = false;

    const target = event.target as Node | null;
    const topmost = getTopmostOpenLayer(store);
    if (!topmost || !topmost.closeOnClickOutside) return;
    if (topmost.isInside(target)) return;
    topmost.onDismiss();
  });

  const pointerCancelCleanup = on(doc, "pointercancel", () => {
    store.pendingTouchOutside = false;
  });

  const blurCleanup = on(win, "blur", () => {
    const topmost = getTopmostOpenLayer(store, (layer) => layer.closeOnClickOutside);
    if (!topmost) return;

    store.pendingTouchOutside = false;
    clearPendingIframeBlur();
    store.pendingIframeBlur = win.setTimeout(() => {
      store.pendingIframeBlur = null;

      const refreshedTopmost = getTopmostOpenLayer(store, (layer) => layer.closeOnClickOutside);
      if (!refreshedTopmost) return;

      const iframeCtor = win.HTMLIFrameElement;
      const activeElement = doc.activeElement;
      if (!iframeCtor || !(activeElement instanceof iframeCtor)) return;
      if (refreshedTopmost.isInside(activeElement)) return;

      refreshedTopmost.onDismiss();
    }, 0);
  });

  const keydownCleanup = on(doc, "keydown", (event) => {
    if (event.key !== "Escape") return;
    // If a focused control already handled Escape (e.g. select/combobox),
    // do not cascade to outer layers.
    if (event.defaultPrevented) return;

    const target = event.target as Node | null;
    const topmostFromTarget = getTopmostOpenLayer(
      store,
      (layer) => layer.closeOnEscape && layer.isInside(target)
    );
    const topmost = topmostFromTarget ?? getTopmostOpenLayer(store, (layer) => layer.closeOnEscape);
    if (!topmost) return;

    if (topmost.preventEscapeDefault) {
      event.preventDefault();
    }
    topmost.onDismiss();
  });

  store.cleanup = () => {
    pointerCleanup();
    clickCleanup();
    pointerCancelCleanup();
    blurCleanup();
    keydownCleanup();
    clearPendingIframeBlur();
    store.pendingTouchOutside = false;
    store.layers.length = 0;
  };

  return store;
};

const getDismissLayerStore = (doc: Document): DismissLayerStore => {
  const existing = dismissLayerStores.get(doc);
  if (existing) return existing;
  const created = createDismissLayerStore(doc);
  dismissLayerStores.set(doc, created);
  return created;
};

export function createDismissLayer(options: DismissLayerOptions): () => void {
  const doc = options.root.ownerDocument ?? document;
  const store = getDismissLayerStore(doc);
  const entry: DismissLayerEntry = {
    isOpen: options.isOpen,
    onDismiss: options.onDismiss,
    isInside: options.isInside ?? ((target: Node | null) => containsWithPortals(options.root, target)),
    closeOnClickOutside: options.closeOnClickOutside ?? true,
    closeOnEscape: options.closeOnEscape ?? true,
    preventEscapeDefault: options.preventEscapeDefault ?? true,
    wasOpen: false,
    openOrder: 0,
  };

  if (syncLayerOpenState(store, entry)) {
    // Layer starts open (e.g. defaultOpen).
    entry.wasOpen = true;
  }

  store.layers.push(entry);

  return () => {
    const idx = store.layers.indexOf(entry);
    if (idx !== -1) {
      store.layers.splice(idx, 1);
    }
    if (store.layers.length === 0) {
      store.cleanup();
      dismissLayerStores.delete(doc);
    }
  };
}

export interface PortalLifecycleOptions {
  content: Element;
  root: Element;
  enabled?: boolean;
  state?: PortalState;
  wrapperSlot?: string;
  /**
   * Optional authored element used for positioning/state attributes.
   * When provided, `container` is always this element.
   */
  container?: Element;
  /**
   * Optional authored element to portal to `document.body`.
   * Defaults to `container` (if provided), otherwise `content`.
   */
  mountTarget?: Element;
}

export interface PortalLifecycleController {
  readonly state: PortalState;
  readonly container: Element;
  mount(): void;
  restore(): void;
  cleanup(): void;
}

export function createPortalLifecycle(options: PortalLifecycleOptions): PortalLifecycleController {
  const enabled = options.enabled ?? true;
  const wrapperSlot = options.wrapperSlot;
  const authoredContainer = options.container;
  const mountTarget = options.mountTarget ?? authoredContainer ?? options.content;
  const state: PortalState = options.state ?? {
    originalParent: null,
    originalNextSibling: null,
    portaled: false,
  };
  const doc = options.root.ownerDocument ?? document;
  let wrapper: HTMLElement | null = null;

  const ensureWrapper = () => {
    if (wrapper) return wrapper;
    const nextWrapper = doc.createElement("div");
    if (wrapperSlot) {
      nextWrapper.setAttribute("data-slot", wrapperSlot);
      nextWrapper.style.isolation = "isolate";
      nextWrapper.style.zIndex = "50";
    }
    wrapper = nextWrapper;
    return nextWrapper;
  };

  const mountWithWrapper = () => {
    if (state.portaled) return;
    const parent = options.content.parentNode;
    if (!parent) return;
    const nextWrapper = ensureWrapper();
    parent.insertBefore(nextWrapper, options.content);
    nextWrapper.appendChild(options.content);
    portalToBody(nextWrapper, options.root, state);
  };

  const mountCustomTarget = () => {
    if (state.portaled) return;
    if (!(mountTarget as Node).isConnected) return;
    portalToBody(mountTarget, options.root, state);
  };

  const restoreWithWrapper = () => {
    if (!state.portaled) return;
    const currentWrapper = wrapper;
    if (!currentWrapper) return;
    restorePortal(currentWrapper, state);
    const parent = currentWrapper.parentNode;
    if (parent && parent.isConnected) {
      parent.insertBefore(options.content, currentWrapper);
      currentWrapper.remove();
    } else {
      options.content.remove();
    }
  };

  const restoreCustomTarget = () => {
    if (!state.portaled) return;
    restorePortal(mountTarget, state);
  };

  return {
    state,
    get container() {
      if (authoredContainer) {
        return authoredContainer;
      }
      if (enabled && wrapperSlot && state.portaled && wrapper) {
        return wrapper;
      }
      return options.content;
    },
    mount: () => {
      if (!enabled) return;
      if (authoredContainer || options.mountTarget) {
        mountCustomTarget();
        return;
      }
      if (wrapperSlot) {
        mountWithWrapper();
      } else {
        portalToBody(options.content, options.root, state);
      }
    },
    restore: () => {
      if (!enabled) return;
      if (authoredContainer || options.mountTarget) {
        restoreCustomTarget();
        return;
      }
      if (wrapperSlot) {
        restoreWithWrapper();
      } else {
        restorePortal(options.content, state);
      }
    },
    cleanup: () => {
      if (!enabled) return;
      if (authoredContainer || options.mountTarget) {
        restoreCustomTarget();
        return;
      }
      if (wrapperSlot) {
        restoreWithWrapper();
      } else {
        restorePortal(options.content, state);
      }
    },
  };
}

export interface PresenceLifecycleOptions {
  element: HTMLElement;
  onExitComplete: () => void;
  win?: Window;
}

export interface PresenceLifecycleController {
  readonly isExiting: boolean;
  enter(): void;
  exit(): void;
  cleanup(): void;
}

const parseTimingToMs = (value: string): number => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return 0;
  if (trimmed.endsWith("ms")) {
    const parsed = Number(trimmed.slice(0, -2).trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (trimmed.endsWith("s")) {
    const parsed = Number(trimmed.slice(0, -1).trim());
    return Number.isFinite(parsed) ? parsed * 1000 : 0;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMaxTimingMs = (durationsRaw: string, delaysRaw: string): number => {
  const durations = durationsRaw.split(",");
  const delays = delaysRaw.split(",");
  const len = Math.max(durations.length, delays.length);
  let max = 0;

  for (let i = 0; i < len; i++) {
    const duration = parseTimingToMs(durations[i] ?? durations[durations.length - 1] ?? "0");
    const delay = parseTimingToMs(delays[i] ?? delays[delays.length - 1] ?? "0");
    max = Math.max(max, duration + delay);
  }

  return max;
};

const getMaxExitDurationMs = (element: HTMLElement): number => {
  const style = getComputedStyle(element);
  const transitionMs = getMaxTimingMs(style.transitionDuration, style.transitionDelay);
  const animationMs = getMaxTimingMs(style.animationDuration, style.animationDelay);
  return Math.max(transitionMs, animationMs);
};

export function createPresenceLifecycle(options: PresenceLifecycleOptions): PresenceLifecycleController {
  const win = options.win ?? window;
  let exiting = false;
  let enterRafId: number | null = null;
  let enterRafId2: number | null = null;
  let exitRafId: number | null = null;
  let exitTimeoutId: number | null = null;
  let exitCleanups: Array<() => void> = [];

  const clearExitTracking = () => {
    if (exitRafId !== null) {
      win.cancelAnimationFrame(exitRafId);
      exitRafId = null;
    }
    if (exitTimeoutId !== null) {
      win.clearTimeout(exitTimeoutId);
      exitTimeoutId = null;
    }
    exitCleanups.forEach((cleanup) => cleanup());
    exitCleanups = [];
  };

  const cancelExit = () => {
    clearExitTracking();
    exiting = false;
    options.element.removeAttribute("data-ending-style");
  };

  const clearEnterMarker = () => {
    if (enterRafId !== null) {
      win.cancelAnimationFrame(enterRafId);
      enterRafId = null;
    }
    if (enterRafId2 !== null) {
      win.cancelAnimationFrame(enterRafId2);
      enterRafId2 = null;
    }
    options.element.removeAttribute("data-starting-style");
  };

  const finishExit = () => {
    if (!exiting) return;
    clearExitTracking();
    exiting = false;
    options.element.removeAttribute("data-ending-style");
    options.onExitComplete();
  };

  return {
    get isExiting() {
      return exiting;
    },
    enter: () => {
      cancelExit();
      clearEnterMarker();
      options.element.setAttribute("data-starting-style", "");
      enterRafId = win.requestAnimationFrame(() => {
        enterRafId = null;
        enterRafId2 = win.requestAnimationFrame(() => {
          enterRafId2 = null;
          options.element.removeAttribute("data-starting-style");
        });
      });
    },
    exit: () => {
      cancelExit();
      clearEnterMarker();
      exiting = true;
      options.element.setAttribute("data-ending-style", "");

      const maxDuration = getMaxExitDurationMs(options.element);
      if (maxDuration > 0) {
        const onEnd = (event: Event) => {
          if (event.target !== options.element) return;
          finishExit();
        };
        options.element.addEventListener("transitionend", onEnd);
        options.element.addEventListener("animationend", onEnd);
        exitCleanups.push(() => options.element.removeEventListener("transitionend", onEnd));
        exitCleanups.push(() => options.element.removeEventListener("animationend", onEnd));
        exitTimeoutId = win.setTimeout(() => {
          exitTimeoutId = null;
          finishExit();
        }, Math.ceil(maxDuration) + 50);
      } else {
        exitRafId = win.requestAnimationFrame(() => {
          exitRafId = null;
          finishExit();
        });
      }
    },
    cleanup: () => {
      cancelExit();
      clearEnterMarker();
    },
  };
}
