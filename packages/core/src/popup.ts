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

const OPPOSITE_SIDE: Record<PopupSide, PopupSide> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

const ALL_SIDES: readonly PopupSide[] = ["top", "right", "bottom", "left"];

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

const overflowsMainAxis = (
  side: PopupSide,
  pos: { x: number; y: number },
  contentRect: RectLike,
  viewportWidth: number,
  viewportHeight: number,
  collisionPadding: number
): boolean => {
  if (side === "top") return pos.y < collisionPadding;
  if (side === "bottom") return pos.y + contentRect.height > viewportHeight - collisionPadding;
  if (side === "left") return pos.x < collisionPadding;
  return pos.x + contentRect.width > viewportWidth - collisionPadding;
};

export function computeFloatingPosition(input: ComputeFloatingPositionInput): FloatingPosition {
  const viewportWidth = input.viewportWidth ?? window.innerWidth;
  const viewportHeight = input.viewportHeight ?? window.innerHeight;

  const allowedSides = input.allowedSides?.length ? input.allowedSides : ALL_SIDES;
  let side = allowedSides.includes(input.side) ? input.side : allowedSides[0]!;

  let pos = computeBasePosition(
    side,
    input.align,
    input.anchorRect,
    input.contentRect,
    input.sideOffset,
    input.alignOffset
  );

  if (input.avoidCollisions) {
    const opposite = OPPOSITE_SIDE[side];
    if (
      allowedSides.includes(opposite) &&
      overflowsMainAxis(
        side,
        pos,
        input.contentRect,
        viewportWidth,
        viewportHeight,
        input.collisionPadding
      )
    ) {
      const oppositePos = computeBasePosition(
        opposite,
        input.align,
        input.anchorRect,
        input.contentRect,
        input.sideOffset,
        input.alignOffset
      );
      if (
        !overflowsMainAxis(
          opposite,
          oppositePos,
          input.contentRect,
          viewportWidth,
          viewportHeight,
          input.collisionPadding
        )
      ) {
        side = opposite;
        pos = oppositePos;
      }
    }

    if (pos.x < input.collisionPadding) pos.x = input.collisionPadding;
    else if (pos.x + input.contentRect.width > viewportWidth - input.collisionPadding) {
      pos.x = viewportWidth - input.contentRect.width - input.collisionPadding;
    }

    if (pos.y < input.collisionPadding) pos.y = input.collisionPadding;
    else if (pos.y + input.contentRect.height > viewportHeight - input.collisionPadding) {
      pos.y = viewportHeight - input.contentRect.height - input.collisionPadding;
    }
  }

  return { x: pos.x, y: pos.y, side, align: input.align };
}

export interface PositionSyncOptions {
  onUpdate: () => void;
  isActive?: () => boolean;
  observedElements?: readonly Element[];
  ignoreScrollTarget?: (target: EventTarget | null) => boolean;
  win?: Window;
}

export interface PositionSyncController {
  start(): void;
  stop(): void;
  update(): void;
}

export function createPositionSync(options: PositionSyncOptions): PositionSyncController {
  const win = options.win ?? window;
  const isActive = options.isActive ?? (() => true);
  const observedElements = options.observedElements ?? [];

  let rafId: number | null = null;
  let started = false;
  let resizeObserver: ResizeObserver | null = null;

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

  const start = () => {
    if (started) return;
    started = true;

    win.addEventListener("resize", onResize);
    win.addEventListener("scroll", onScroll, true);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(onResize);
      for (const el of observedElements) {
        resizeObserver.observe(el);
      }
    }
  };

  const stop = () => {
    if (!started) return;
    started = false;

    if (rafId !== null) {
      win.cancelAnimationFrame(rafId);
      rafId = null;
    }

    win.removeEventListener("resize", onResize);
    win.removeEventListener("scroll", onScroll, true);
    resizeObserver?.disconnect();
    resizeObserver = null;
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
