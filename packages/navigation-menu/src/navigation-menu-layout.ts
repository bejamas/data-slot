import {
  computeFloatingPosition,
  createPositionSync,
  getDataEnum,
  getDataNumber,
} from "@data-slot/core";
import {
  type NavigationMenuPopupStack,
  type ViewportLayoutMode,
} from "./navigation-menu-popup-stack";

export type Align = "start" | "center" | "end";
export type Side = "top" | "right" | "bottom" | "left";
export type PositionMethod = "absolute" | "fixed";

const ALIGNS = ["start", "center", "end"] as const;
const SIDES = ["top", "right", "bottom", "left"] as const;
const INITIAL_OPEN_INSTANT_SETTLE_FRAMES = 4;

interface Point {
  x: number;
  y: number;
}
interface Size {
  width: number;
  height: number;
}
interface PlacementConfig {
  side: Side;
  align: Align;
  sideOffset: number;
  alignOffset: number;
}
interface Panel {
  item: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
}
interface ContentPositionState {
  applied: boolean;
  left: string;
  position: string;
  top: string;
}
interface ContentPlacement {
  originalParent: ParentNode | null;
  originalNextSibling: ChildNode | null;
  mountedInViewport: boolean;
}

export interface LayoutSnapshot {
  rootRect: DOMRect;
  triggerRect: DOMRect;
  viewportRect: DOMRect;
  offset: Point;
  contentSize: Size;
  viewportMarginTop: number;
}

export interface NavigationMenuLayoutOptions {
  root: Element;
  viewport: HTMLElement | null;
  triggers: HTMLElement[];
  popup: NavigationMenuPopupStack;
  placement: {
    side?: Side;
    align?: Align;
    sideOffset?: number;
    alignOffset?: number;
    positionMethod?: PositionMethod;
  };
  readSelection(): { open: boolean; panel: Panel | null };
  onLayout(snapshot: LayoutSnapshot): void;
}

export interface NavigationMenuLayout {
  mount(content: HTMLElement): void;
  setAbsolute(content: HTMLElement, absolute: boolean): void;
  restore(content: HTMLElement): void;
  sync(
    panel?: Panel | null,
    options?: { defer?: boolean; mode?: ViewportLayoutMode },
  ): void;
  observe(panel: Panel | null): void;
  start(): void;
  stop(): void;
  beginInitialOpen(): void;
  clearInstant(): void;
  commitInstant(options: {
    open: boolean;
    initial: boolean;
    switching: boolean;
  }): void;
  reset(): void;
  dispose(): void;
  destroy(): void;
}

const getAlignedPointOnRect = (rect: DOMRect, align: Align): Point => {
  if (align === "start") return { x: rect.left, y: rect.top };
  if (align === "end") return { x: rect.right, y: rect.bottom };
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const getTransformOriginAnchor = (
  side: Side,
  align: Align,
  triggerRect: DOMRect,
): Point => {
  const aligned = getAlignedPointOnRect(triggerRect, align);
  if (side === "top") return { x: aligned.x, y: triggerRect.top };
  if (side === "bottom") return { x: aligned.x, y: triggerRect.bottom };
  if (side === "left") return { x: triggerRect.left, y: aligned.y };
  return { x: triggerRect.right, y: aligned.y };
};

/** Owns viewport measurement, placement, mounted content, and position syncing. */
export function createNavigationMenuLayout(
  options: NavigationMenuLayoutOptions,
): NavigationMenuLayout {
  const {
    root,
    viewport,
    triggers,
    popup,
    placement,
    readSelection,
    onLayout,
  } = options;
  const rootSide =
    placement.side ?? getDataEnum(root, "side", SIDES) ?? "bottom";
  const rootAlign =
    placement.align ?? getDataEnum(root, "align", ALIGNS) ?? "start";
  const rootSideOffset =
    placement.sideOffset ?? getDataNumber(root, "sideOffset") ?? 0;
  const rootAlignOffset =
    placement.alignOffset ?? getDataNumber(root, "alignOffset") ?? 0;
  const positionMethod =
    placement.positionMethod ??
    getDataEnum(root, "positionMethod", ["absolute", "fixed"] as const) ??
    "absolute";
  const contentPosition = new Map<HTMLElement, ContentPositionState>();
  const contentPlacement = new Map<HTMLElement, ContentPlacement>();
  let offset = { x: 0, y: 0 };
  let initialInstant = false;
  let initialInstantFrames = 0;
  let trackingInstant = false;
  let instantRaf: number | null = null;
  let measureRaf: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  let destroyed = false;

  const resolvePlacement = (panel: Panel): PlacementConfig => ({
    side:
      placement.side ??
      getDataEnum(panel.content, "side", SIDES) ??
      getDataEnum(panel.item, "side", SIDES) ??
      rootSide,
    align:
      placement.align ??
      getDataEnum(panel.content, "align", ALIGNS) ??
      getDataEnum(panel.item, "align", ALIGNS) ??
      rootAlign,
    sideOffset:
      placement.sideOffset ??
      getDataNumber(panel.content, "sideOffset") ??
      getDataNumber(panel.item, "sideOffset") ??
      rootSideOffset,
    alignOffset:
      placement.alignOffset ??
      getDataNumber(panel.content, "alignOffset") ??
      getDataNumber(panel.item, "alignOffset") ??
      rootAlignOffset,
  });
  const clearMeasure = () => {
    if (measureRaf !== null) cancelAnimationFrame(measureRaf);
    measureRaf = null;
  };
  const clearInstantRaf = () => {
    if (instantRaf !== null) cancelAnimationFrame(instantRaf);
    instantRaf = null;
  };
  const syncInstant = () => {
    const instant = initialInstant || trackingInstant;
    for (const element of [viewport, popup.popup, popup.positioner]) {
      if (!element) continue;
      if (instant) element.setAttribute("data-instant", "");
      else element.removeAttribute("data-instant");
    }
  };
  const scheduleInstantClear = () => {
    clearInstantRaf();
    instantRaf = requestAnimationFrame(() => {
      instantRaf = null;
      if (initialInstant && initialInstantFrames > 0) {
        initialInstantFrames -= 1;
        scheduleInstantClear();
        return;
      }
      initialInstant = false;
      trackingInstant = false;
      syncInstant();
    });
  };
  const setAbsolute = (content: HTMLElement, absolute: boolean) => {
    const state = contentPosition.get(content) ?? {
      applied: false,
      left: "",
      position: "",
      top: "",
    };
    if (absolute) {
      if (!state.applied)
        Object.assign(state, {
          position: content.style.position,
          top: content.style.top,
          left: content.style.left,
        });
      state.applied = true;
      contentPosition.set(content, state);
      Object.assign(content.style, {
        position: "absolute",
        top: "0px",
        left: "0px",
      });
      return;
    }
    if (!state.applied) return;
    for (const key of ["position", "top", "left"] as const)
      state[key]
        ? content.style.setProperty(key, state[key])
        : content.style.removeProperty(key);
    state.applied = false;
  };
  const mount = (content: HTMLElement) => {
    if (!viewport) return;
    const state = contentPlacement.get(content) ?? {
      originalParent: null,
      originalNextSibling: null,
      mountedInViewport: false,
    };
    if (!state.mountedInViewport) {
      state.originalParent = content.parentNode;
      state.originalNextSibling = content.nextSibling;
      state.mountedInViewport = true;
      contentPlacement.set(content, state);
    }
    if (content.parentNode !== viewport) viewport.appendChild(content);
  };
  const restore = (content: HTMLElement) => {
    const state = contentPlacement.get(content);
    if (!state?.mountedInViewport) return;
    if (state.originalParent?.isConnected) {
      if (state.originalNextSibling?.parentNode === state.originalParent)
        state.originalParent.insertBefore(content, state.originalNextSibling);
      else state.originalParent.appendChild(content);
    } else content.remove();
    state.mountedInViewport = false;
    state.originalParent = null;
    state.originalNextSibling = null;
  };
  const updatePositioner = () => {
    const positioner = popup.positioner;
    if (!positioner) return;
    const win = root.ownerDocument.defaultView ?? window;
    const rootRect = (root as HTMLElement).getBoundingClientRect();
    const fixed = positionMethod === "fixed";
    Object.assign(positioner.style, {
      position: positionMethod,
      top: `${rootRect.top + offset.y + (fixed ? 0 : win.scrollY)}px`,
      left: `${rootRect.left + offset.x + (fixed ? 0 : win.scrollX)}px`,
      margin: "0",
      willChange: "top,left",
      pointerEvents: "none",
    });
  };
  const syncSizing = (
    positioner: HTMLElement,
    triggerRect: DOMRect,
    side: Side,
    sideOffset: number,
    size: Size,
  ) => {
    const win = root.ownerDocument.defaultView ?? window;
    const vv = win.visualViewport;
    const x = vv?.offsetLeft ?? 0,
      y = vv?.offsetTop ?? 0;
    const width = vv?.width ?? win.innerWidth,
      height = vv?.height ?? win.innerHeight;
    const availableWidth =
      side === "left"
        ? Math.max(0, triggerRect.left - x - sideOffset)
        : side === "right"
          ? Math.max(0, x + width - triggerRect.right - sideOffset)
          : Math.max(0, width);
    const availableHeight =
      side === "top"
        ? Math.max(0, triggerRect.top - y - sideOffset)
        : side === "bottom"
          ? Math.max(0, y + height - triggerRect.bottom - sideOffset)
          : Math.max(0, height);
    popup.setPositionerSize(positioner, size);
    positioner.style.setProperty("--available-width", `${availableWidth}px`);
    positioner.style.setProperty("--available-height", `${availableHeight}px`);
  };
  const apply = (panel: Panel, mode: ViewportLayoutMode) => {
    if (!viewport || !popup.ensure() || popup.closing) return;
    if (
      viewport.getAttribute("data-state") !== "open" ||
      panel.content.getAttribute("data-state") !== "active"
    )
      return;
    const currentPopup = popup.popup,
      positioner = popup.positioner;
    if (!currentPopup || !positioner) return;
    setAbsolute(panel.content, false);
    const first = panel.content.firstElementChild as HTMLElement | null;
    const last = panel.content.lastElementChild as HTMLElement | null;
    const firstMargin = first
      ? parseFloat(getComputedStyle(first).marginTop) || 0
      : 0;
    const lastMargin = last
      ? parseFloat(getComputedStyle(last).marginBottom) || 0
      : 0;
    const rect = panel.content.getBoundingClientRect();
    const fallback = {
      width: Math.max(
        rect.width,
        panel.content.scrollWidth,
        panel.content.offsetWidth,
        panel.content.clientWidth,
      ),
      height:
        Math.max(
          rect.height,
          panel.content.scrollHeight,
          panel.content.offsetHeight,
          panel.content.clientHeight,
        ) +
        firstMargin +
        lastMargin,
    };
    const size = popup.measure(mode, fallback);
    if (size.width <= 0 || size.height <= 0) return;
    const resolved = resolvePlacement(panel);
    const rootRect = (root as HTMLElement).getBoundingClientRect();
    const triggerRect = panel.trigger.getBoundingClientRect();
    const floating = {
      top: rect.top,
      left: rect.left,
      width: size.width,
      height: size.height,
      right: rect.left + size.width,
      bottom: rect.top + size.height,
    };
    const pos = computeFloatingPosition({
      anchorRect: triggerRect,
      contentRect: floating,
      side: resolved.side,
      align: resolved.align,
      sideOffset: resolved.sideOffset,
      alignOffset: resolved.alignOffset,
      avoidCollisions: false,
      collisionPadding: 0,
      allowedSides: SIDES,
    });
    offset = { x: pos.x - rootRect.left, y: pos.y - rootRect.top };
    const side = pos.side as Side;
    const align = pos.align as Align;
    const anchor = getTransformOriginAnchor(side, align, triggerRect);
    const viewportOrigin = `${anchor.x - (rootRect.left + offset.x)}px ${anchor.y - (rootRect.top + offset.y)}px`;
    const positionerOrigin = `${anchor.x - rootRect.left}px ${anchor.y - rootRect.top}px`;
    currentPopup.style.willChange = "width,height";
    currentPopup.style.pointerEvents = "auto";
    popup.setRuntimePosition(
      side === "top" ? "top" : side === "left" ? "left" : null,
    );
    currentPopup.style.setProperty("--transform-origin", viewportOrigin);
    Object.assign(viewport.style, {
      top: "0px",
      left: "0px",
      willChange: "transform,width,height",
    });
    viewport.style.setProperty("--transform-origin", viewportOrigin);
    panel.content.style.setProperty("--transform-origin", viewportOrigin);
    for (const element of [currentPopup, viewport, panel.content, positioner]) {
      element.setAttribute("data-side", side);
      element.setAttribute("data-align", align);
    }
    positioner.style.setProperty("--transform-origin", positionerOrigin);
    syncSizing(positioner, triggerRect, side, resolved.sideOffset, size);
    updatePositioner();
    popup.setViewportSize(size.width, size.height);
    popup.commitSize(mode, size);
    onLayout({
      rootRect,
      triggerRect,
      viewportRect: viewport.getBoundingClientRect(),
      offset: { ...offset },
      contentSize: size,
      viewportMarginTop: parseFloat(getComputedStyle(viewport).marginTop) || 0,
    });
  };
  const sync = (
    panel = readSelection().panel,
    config: { defer?: boolean; mode?: ViewportLayoutMode } = {},
  ) => {
    if (!panel) return;
    const run = () => apply(panel, config.mode ?? "measure-target");
    if (config.defer === false) run();
    else
      requestAnimationFrame(() => {
        if (!destroyed) run();
      });
  };
  const schedule = () => {
    clearMeasure();
    measureRaf = requestAnimationFrame(() => {
      measureRaf = null;
      const selection = readSelection();
      if (!selection.panel || !popup.ensure() || popup.closing) return;
      if (initialInstant) beginInitialOpen();
      sync(selection.panel, {
        defer: false,
        mode:
          popup.popup?.hasAttribute("data-starting-style") ||
          popup.isSizeTransitioning()
            ? "sync-current"
            : "measure-target",
      });
    });
  };
  const observe = (panel: Panel | null) => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    mutationObserver?.disconnect();
    mutationObserver = null;
    clearMeasure();
    if (!viewport || !panel) return;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(panel.content);
    }
    if (typeof MutationObserver === "function") {
      mutationObserver = new MutationObserver(schedule);
      mutationObserver.observe(panel.content, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  };
  const positionSync = createPositionSync({
    observedElements: [root, ...triggers],
    isActive: () => readSelection().open,
    ancestorScroll: true,
    syncOnScroll: true,
    ancestorResize: true,
    elementResize: true,
    layoutShift: true,
    onUpdate: () => {
      trackingInstant = true;
      syncInstant();
      sync(undefined, { defer: false, mode: "sync-current" });
      scheduleInstantClear();
    },
  });
  const beginInitialOpen = () => {
    initialInstant = true;
    initialInstantFrames = Math.max(
      initialInstantFrames,
      INITIAL_OPEN_INSTANT_SETTLE_FRAMES,
    );
    syncInstant();
    scheduleInstantClear();
  };
  const clearInstant = () => {
    clearInstantRaf();
    initialInstant = false;
    initialInstantFrames = 0;
    trackingInstant = false;
    syncInstant();
  };
  const commitInstant = ({
    open,
    initial,
    switching,
  }: {
    open: boolean;
    initial: boolean;
    switching: boolean;
  }) => {
    if (!open || switching) {
      clearInstantRaf();
      trackingInstant = false;
    }
    initialInstant = initial;
    initialInstantFrames = initial
      ? Math.max(initialInstantFrames, INITIAL_OPEN_INSTANT_SETTLE_FRAMES)
      : 0;
    syncInstant();
  };
  const reset = () => {
    clearMeasure();
    clearInstant();
    offset = { x: 0, y: 0 };
  };
  const dispose = () => {
    positionSync.stop();
    observe(null);
    reset();
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    dispose();
    for (const content of contentPlacement.keys()) {
      restore(content);
      setAbsolute(content, false);
      content.hidden = true;
      content.style.pointerEvents = "none";
    }
    contentPlacement.clear();
    contentPosition.clear();
  };
  return {
    mount,
    setAbsolute,
    restore,
    sync,
    observe,
    start: () => positionSync.start(),
    stop: () => positionSync.stop(),
    beginInitialOpen,
    clearInstant,
    commitInstant,
    reset,
    dispose,
    destroy,
  };
}
