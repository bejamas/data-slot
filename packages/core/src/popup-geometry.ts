import { on } from "./events.ts";

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
