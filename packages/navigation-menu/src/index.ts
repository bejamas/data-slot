import {
  getPart,
  getParts,
  getRoots,
  getDataBool,
  getDataNumber,
  getDataEnum,
  containsWithPortals,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  computeFloatingPosition,
  createPositionSync,
  createPortalLifecycle,
  createPresenceLifecycle,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";
import { createDismissLayer } from "@data-slot/core";

/** Alignment of the viewport relative to the trigger */
export type Align = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;
const SIDES = ["top", "right", "bottom", "left"] as const;
type Side = (typeof SIDES)[number];
export type PositionMethod = "absolute" | "fixed";
const POSITION_METHODS = ["absolute", "fixed"] as const;

interface PlacementConfig {
  side: Side;
  align: Align;
  sideOffset: number;
  alignOffset: number;
}

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface PopupSizeState {
  committed: Size;
  live: Size;
}

type ViewportLayoutMode = "initial-open" | "measure-target" | "sync-current";
const INITIAL_OPEN_INSTANT_SETTLE_FRAMES = 4;

interface ContentPositionState {
  applied: boolean;
  left: string;
  position: string;
  top: string;
}

interface PopupPositionState {
  applied: boolean;
  bottom: string;
  left: string;
  position: string;
  right: string;
  top: string;
}

interface HoverSafeTriangle {
  apex: Point;
  edgeA: Point;
  edgeB: Point;
}

type TopLevelNavigable =
  | {
      kind: "submenu";
      element: HTMLElement;
      item: HTMLElement;
      value: string;
      trigger: HTMLElement;
    }
  | {
      kind: "plain";
      element: HTMLElement;
    };

const getAlignedPointOnRect = (rect: DOMRect, align: Align): Point => {
  if (align === "start") return { x: rect.left, y: rect.top };
  if (align === "end") return { x: rect.right, y: rect.bottom };
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
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

const getCssDimensions = (element: Element): Size => {
  const css = getComputedStyle(element);
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;

  if (element instanceof HTMLElement) {
    const offsetWidth = element.offsetWidth || width;
    const offsetHeight = element.offsetHeight || height;
    if (
      Math.round(width) !== offsetWidth ||
      Math.round(height) !== offsetHeight
    ) {
      width = offsetWidth;
      height = offsetHeight;
    }
  }

  return { width, height };
};

export interface NavigationMenuOptions {
  /** Delay before opening on hover (ms) */
  delayOpen?: number;
  /** Delay before closing on mouse leave (ms) */
  delayClose?: number;
  /** Whether focusing a trigger opens its content (default: false) */
  openOnFocus?: boolean;
  /** Preferred side of viewport relative to trigger */
  side?: Side;
  /** Alignment of viewport relative to trigger */
  align?: Align;
  /** Distance from trigger to viewport (px) */
  sideOffset?: number;
  /** Offset along alignment axis (px) */
  alignOffset?: number;
  /** Positioning strategy for the shared viewport positioner */
  positionMethod?: PositionMethod;
  /** Enable hover safe-triangle behavior (opt-in) */
  safeTriangle?: boolean;
  /** Callback when active item changes */
  onValueChange?: (value: string | null) => void;
  /** Debug hover safe-triangle polygon */
  debugSafeTriangle?: boolean;
}

export interface NavigationMenuController {
  /** Currently active item value */
  readonly value: string | null;
  /** Open a specific item */
  open(value: string): void;
  /** Close the menu */
  close(): void;
  /** Cleanup all event listeners */
  destroy(): void;
}

const ROOT_BINDING_KEY = "@data-slot/navigation-menu";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/navigation-menu] createNavigationMenu() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

/**
 * Create a navigation menu controller for a root element
 *
 * Canonical popup-stack markup:
 * ```html
 * <nav data-slot="navigation-menu">
 *   <ul data-slot="navigation-menu-list">
 *     <li data-slot="navigation-menu-item" data-value="products">
 *       <button data-slot="navigation-menu-trigger">Products</button>
 *       <div data-slot="navigation-menu-content">...</div>
 *     </li>
 *     <!-- Optional hover indicator -->
 *     <div data-slot="navigation-menu-indicator"></div>
 *   </ul>
 *   <div data-slot="navigation-menu-portal">
 *     <div data-slot="navigation-menu-positioner">
 *       <div data-slot="navigation-menu-popup">
 *         <div data-slot="navigation-menu-viewport"></div>
 *       </div>
 *     </div>
 *   </div>
 * </nav>
 * ```
 *
 * Minimal markup that only authors `navigation-menu-viewport` still works; the
 * popup stack is synthesized while open and restored on close.
 */
export function createNavigationMenu(
  root: Element,
  options: NavigationMenuOptions = {},
): NavigationMenuController {
  const existingController = reuseRootBinding<NavigationMenuController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  // Resolve options with explicit precedence: JS > data-* > default
  const delayOpen =
    options.delayOpen ?? getDataNumber(root, "delayOpen") ?? 0;
  const delayClose =
    options.delayClose ?? getDataNumber(root, "delayClose") ?? 0;
  const openOnFocus =
    options.openOnFocus ?? getDataBool(root, "openOnFocus") ?? false;
  const rootSide = options.side ?? getDataEnum(root, "side", SIDES) ?? "bottom";
  const rootAlign =
    options.align ?? getDataEnum(root, "align", ALIGNS) ?? "start";
  const rootSideOffset =
    options.sideOffset ?? getDataNumber(root, "sideOffset") ?? 0;
  const rootAlignOffset =
    options.alignOffset ?? getDataNumber(root, "alignOffset") ?? 0;
  const rootPositionMethod =
    options.positionMethod ??
    getDataEnum(root, "positionMethod", POSITION_METHODS) ??
    "absolute";
  const safeTriangle =
    options.safeTriangle ?? getDataBool(root, "safeTriangle") ?? false;
  const debugSafeTriangle =
    options.debugSafeTriangle ??
    getDataBool(root, "debugSafeTriangle") ??
    false;
  const safeTriangleEnabled = safeTriangle || debugSafeTriangle;
  const onValueChange = options.onValueChange;

  // Sanitize value for use in IDs (spaces/slashes -> dashes)
  const safeId = (s: string) => s.replace(/[^a-z0-9\-_:.]/gi, "-");

  // Safe inert setter (fallback for older browsers)
  const setInert = (el: HTMLElement, inert: boolean) => {
    if ("inert" in el) (el as any).inert = inert;
  };

  const list = getPart<HTMLElement>(root, "navigation-menu-list");
  const items = getParts<HTMLElement>(root, "navigation-menu-item");
  const viewport = getPart<HTMLElement>(root, "navigation-menu-viewport");
  const indicator = getPart<HTMLElement>(root, "navigation-menu-indicator");
  const findSlotAncestor = (
    el: HTMLElement,
    slot: string,
  ): HTMLElement | null => {
    let current: HTMLElement | null = el.parentElement;
    while (current && current !== root) {
      if (current.getAttribute("data-slot") === slot) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  if (!list || items.length === 0) {
    throw new Error(
      "NavigationMenu requires navigation-menu-list and at least one navigation-menu-item",
    );
  }

  let currentValue: string | null = null;
  let pendingValue: string | null = null; // Track value being opened (during delay)
  let previousIndex: number = -1;
  let openTimeout: ReturnType<typeof setTimeout> | null = null;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;
  let hoveredTrigger: HTMLElement | null = null;
  let clickLocked: boolean = false; // When true, menu stays open until click outside or toggle
  let suppressFocusOpenForTrigger: HTMLElement | null = null;
  let pointerActivationTrigger: HTMLElement | null = null;
  let isRootHovered: boolean = false; // Track if pointer is over root
  let isDestroyed = false;
  let activeSafetyTriangle: HoverSafeTriangle | null = null;
  let hoverSafeTriangleOverlay: HTMLElement | null = null;
  let indicatorInstantRaf: number | null = null;
  let viewportTrackingInstantRaf: number | null = null;
  let viewportOffsetLeft = 0;
  let viewportOffsetTop = 0;
  let viewportInitialInstant = false;
  let viewportInitialInstantFramesRemaining = 0;
  let viewportTrackingInstant = false;

  const cleanups: Array<() => void> = [];
  const contentPresence = new Map<
    HTMLElement,
    ReturnType<typeof createPresenceLifecycle>
  >();
  const contentPositionState = new Map<HTMLElement, ContentPositionState>();
  const popupPositionState = new WeakMap<HTMLElement, PopupPositionState>();
  const contentPlacement = new Map<
    HTMLElement,
    {
      originalParent: ParentNode | null;
      originalNextSibling: ChildNode | null;
      mountedInViewport: boolean;
    }
  >();
  // TODO(next-major): drop restore-only compatibility for content-wrapped
  // `navigation-menu-portal` / `navigation-menu-positioner` shells.
  const setOpenClosedAttrs = (el: Element | null, open: boolean) => {
    if (!el) return;
    if (open) {
      el.setAttribute("data-open", "");
      el.removeAttribute("data-closed");
      return;
    }
    el.setAttribute("data-closed", "");
    el.removeAttribute("data-open");
  };
  const setOpenSurfaceState = (el: Element | null, open: boolean) => {
    if (!el) return;
    el.setAttribute("data-state", open ? "open" : "closed");
    setOpenClosedAttrs(el, open);
  };
  const setContentSurfaceState = (content: HTMLElement, active: boolean) => {
    content.setAttribute("data-state", active ? "active" : "inactive");
    setOpenClosedAttrs(content, active);
  };
  const setContentActivationDirection = (
    content: HTMLElement,
    direction: "left" | "right" | null,
  ) => {
    if (direction) {
      content.setAttribute("data-activation-direction", direction);
      return;
    }
    content.removeAttribute("data-activation-direction");
  };
  const findPopupStackParts = () => {
    if (!viewport) {
      return {
        popup: null as HTMLElement | null,
        positioner: null as HTMLElement | null,
        portal: null as HTMLElement | null,
      };
    }

    let popup: HTMLElement | null = null;
    let positioner: HTMLElement | null = null;
    let portal: HTMLElement | null = null;
    let current: HTMLElement | null = viewport.parentElement;
    let stage: "popup" | "positioner" | "portal" = "popup";

    while (current && current !== root) {
      const slot = current.getAttribute("data-slot");
      if (slot === "navigation-menu-portal") {
        portal = current;
        break;
      }

      if (stage === "popup" && slot === "navigation-menu-popup") {
        popup = current;
        stage = "positioner";
        current = current.parentElement;
        continue;
      }

      // TODO(next-major): remove legacy `navigation-menu-viewport-positioner`
      // support and keep only `navigation-menu-positioner`.
      if (
        (stage === "popup" || stage === "positioner") &&
        (slot === "navigation-menu-positioner" ||
          slot === "navigation-menu-viewport-positioner")
      ) {
        positioner = current;
        stage = "portal";
        current = current.parentElement;
        continue;
      }

      current = current.parentElement;
    }

    return { popup, positioner, portal };
  };

  interface PopupStackController {
    popup: HTMLElement;
    positioner: HTMLElement;
    portal: HTMLElement;
    popupPortal: ReturnType<typeof createPortalLifecycle>;
    popupPresence: ReturnType<typeof createPresenceLifecycle>;
    viewportPresence: ReturnType<typeof createPresenceLifecycle>;
    generatedPopup: boolean;
    generatedPositioner: boolean;
    generatedPortal: boolean;
    isClosing: boolean;
    popupExitComplete: boolean;
    viewportExitComplete: boolean;
  }

  let popupStack: PopupStackController | null = null;
  const maybeTeardownPopupStack = (stack: PopupStackController) => {
    if (isDestroyed || popupStack !== stack || !stack.isClosing) return;
    if (!stack.popupExitComplete || !stack.viewportExitComplete) return;
    teardownPopupStack();
  };
  let popupSizeState: PopupSizeState = {
    committed: { width: 0, height: 0 },
    live: { width: 0, height: 0 },
  };
  let popupSizeResizeObserver: ResizeObserver | null = null;
  let activeMutationObserver: MutationObserver | null = null;
  let activeContentMeasureRaf: number | null = null;

  const rememberCommittedPopupSize = (size: Size) => {
    if (size.width > 0) popupSizeState.committed.width = size.width;
    if (size.height > 0) popupSizeState.committed.height = size.height;
  };
  const rememberLivePopupSize = (size: Size) => {
    if (size.width > 0) popupSizeState.live.width = size.width;
    if (size.height > 0) popupSizeState.live.height = size.height;
  };
  const resetPopupSizeMemory = () => {
    popupSizeState = {
      committed: { width: 0, height: 0 },
      live: { width: 0, height: 0 },
    };
  };
  const clearActiveContentMeasureRaf = () => {
    if (activeContentMeasureRaf !== null) {
      cancelAnimationFrame(activeContentMeasureRaf);
      activeContentMeasureRaf = null;
    }
  };
  const setPopupSizeVars = (
    popup: HTMLElement,
    size: Size | "auto",
  ) => {
    if (size === "auto") {
      popup.style.setProperty("--popup-width", "auto");
      popup.style.setProperty("--popup-height", "auto");
      return;
    }
    popup.style.setProperty("--popup-width", `${size.width}px`);
    popup.style.setProperty("--popup-height", `${size.height}px`);
  };
  const setPopupFixedSizeVars = (
    popup: HTMLElement,
    width: number,
    height: number,
  ) => {
    setPopupSizeVars(popup, { width, height });
  };
  const setViewportLegacySizeVars = (width: number, height: number) => {
    if (!viewport) return;
    // TODO(next-major): drop legacy viewport sizing aliases in favor of popup vars.
    viewport.style.setProperty("--viewport-width", `${width}px`);
    viewport.style.setProperty("--viewport-height", `${height}px`);
  };
  const setPositionerSizeVars = (
    positioner: HTMLElement,
    size: Size | "max-content",
  ) => {
    if (size === "max-content") {
      positioner.style.setProperty("--positioner-width", "max-content");
      positioner.style.setProperty("--positioner-height", "max-content");
      return;
    }
    positioner.style.setProperty("--positioner-width", `${size.width}px`);
    positioner.style.setProperty("--positioner-height", `${size.height}px`);
  };
  const applyInlineStyleOverrides = (
    element: HTMLElement,
    styles: Record<string, string>,
  ) => {
    const previous = new Map<string, string>();
    for (const [property, value] of Object.entries(styles)) {
      previous.set(property, element.style.getPropertyValue(property));
      element.style.setProperty(property, value);
    }
    return () => {
      for (const [property, value] of previous) {
        if (value) element.style.setProperty(property, value);
        else element.style.removeProperty(property);
      }
    };
  };
  const measureTargetPopupSize = (
    stack: PopupStackController,
    _side: Side,
  ): Size => {
    const popupOverrides: Record<string, string> = {
      "--popup-width": "auto",
      "--popup-height": "auto",
      position: "static",
      transform: "none",
      scale: "1",
      top: "",
      right: "",
      bottom: "",
      left: "",
    };
    const restorePopup = applyInlineStyleOverrides(stack.popup, popupOverrides);
    const restorePositioner = applyInlineStyleOverrides(stack.positioner, {
      "--positioner-width": "max-content",
      "--positioner-height": "max-content",
      "--available-width": "max-content",
      "--available-height": "max-content",
    });
    const measured = getCssDimensions(stack.popup);
    restorePositioner();
    restorePopup();
    return measured;
  };
  const getPopupTransitionBaseline = (): Size => {
    const popup = getCurrentPopup();
    if (!popup) return { ...popupSizeState.committed };

    const measuredCss = getCssDimensions(popup);
    const baseline = {
      width:
        popup.offsetWidth ||
        measuredCss.width ||
        popupSizeState.live.width ||
        popupSizeState.committed.width,
      height:
        popup.offsetHeight ||
        measuredCss.height ||
        popupSizeState.live.height ||
        popupSizeState.committed.height,
    };
    rememberLivePopupSize(baseline);
    return baseline;
  };
  const isPopupSizeTransitionInFlight = (): boolean => {
    const committed = popupSizeState.committed;
    if (committed.width <= 0 || committed.height <= 0) return false;
    const rendered = getPopupTransitionBaseline();
    return (
      Math.abs(rendered.width - committed.width) > 1 ||
      Math.abs(rendered.height - committed.height) > 1
    );
  };
  const setContentMountedAbsolute = (
    content: HTMLElement,
    absolute: boolean,
  ) => {
    if (absolute) {
      const state = contentPositionState.get(content) ?? {
        applied: false,
        left: "",
        position: "",
        top: "",
      };
      if (!state.applied) {
        state.position = content.style.position;
        state.top = content.style.top;
        state.left = content.style.left;
      }
      state.applied = true;
      contentPositionState.set(content, state);
      content.style.position = "absolute";
      content.style.top = "0px";
      content.style.left = "0px";
      return;
    }
    const state = contentPositionState.get(content);
    if (!state?.applied) return;
    if (state.position) content.style.position = state.position;
    else content.style.removeProperty("position");
    if (state.top) content.style.top = state.top;
    else content.style.removeProperty("top");
    if (state.left) content.style.left = state.left;
    else content.style.removeProperty("left");
    state.applied = false;
  };
  const restorePopupPosition = (popup: HTMLElement) => {
    const state = popupPositionState.get(popup);
    if (!state?.applied) return;
    if (state.position) popup.style.position = state.position;
    else popup.style.removeProperty("position");
    if (state.top) popup.style.top = state.top;
    else popup.style.removeProperty("top");
    if (state.right) popup.style.right = state.right;
    else popup.style.removeProperty("right");
    if (state.bottom) popup.style.bottom = state.bottom;
    else popup.style.removeProperty("bottom");
    if (state.left) popup.style.left = state.left;
    else popup.style.removeProperty("left");
    state.applied = false;
  };
  const setPopupRuntimePosition = (
    popup: HTMLElement,
    preset: "top" | "left" | null,
  ) => {
    if (preset === null) {
      restorePopupPosition(popup);
      return;
    }

    const state = popupPositionState.get(popup) ?? {
      applied: false,
      bottom: "",
      left: "",
      position: "",
      right: "",
      top: "",
    };

    if (!state.applied) {
      state.position = popup.style.position;
      state.top = popup.style.top;
      state.right = popup.style.right;
      state.bottom = popup.style.bottom;
      state.left = popup.style.left;
    }

    state.applied = true;
    popupPositionState.set(popup, state);

    if (preset === "top") {
      popup.style.position = "absolute";
      popup.style.top = "";
      popup.style.right = "";
      popup.style.bottom = "0px";
      popup.style.left = "0px";
      return;
    }

    popup.style.position = "absolute";
    popup.style.top = "0px";
    popup.style.right = "0px";
    popup.style.bottom = "";
    popup.style.left = "";
  };

  const getCurrentPopup = () => popupStack?.popup ?? findPopupStackParts().popup;
  const getCurrentPositioner = () =>
    popupStack?.positioner ?? findPopupStackParts().positioner;
  const observePopupSize = (popup: HTMLElement | null) => {
    popupSizeResizeObserver?.disconnect();
    popupSizeResizeObserver = null;
    if (!popup || typeof ResizeObserver !== "function") return;
    popupSizeResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const inlineSize = Array.isArray(entry?.borderBoxSize)
        ? entry?.borderBoxSize[0]?.inlineSize
        : undefined;
      const blockSize = Array.isArray(entry?.borderBoxSize)
        ? entry?.borderBoxSize[0]?.blockSize
        : undefined;
      rememberLivePopupSize({
        width: Math.ceil(inlineSize ?? popup.offsetWidth),
        height: Math.ceil(blockSize ?? popup.offsetHeight),
      });
    });
    popupSizeResizeObserver.observe(popup);
  };

  const wrapWithGeneratedSlot = (child: HTMLElement, slot: string) => {
    const doc = root.ownerDocument ?? document;
    const wrapper = doc.createElement("div");
    wrapper.setAttribute("data-slot", slot);
    if (slot === "navigation-menu-positioner") {
      wrapper.style.isolation = "isolate";
      wrapper.style.zIndex = "50";
    }
    const parent = child.parentNode;
    if (!parent) {
      throw new Error(
        "NavigationMenu expected popup stack child to have a parent node",
      );
    }
    parent.insertBefore(wrapper, child);
    wrapper.appendChild(child);
    return wrapper;
  };

  const unwrapGeneratedSlot = (wrapper: HTMLElement) => {
    const parent = wrapper.parentNode;
    if (!parent) return;
    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper);
    }
    wrapper.remove();
  };

  const resetPopupStackStyles = () => {
    const positioner = getCurrentPositioner();
    if (positioner) {
      positioner.style.position = "";
      positioner.style.top = "";
      positioner.style.left = "";
      positioner.style.margin = "";
      positioner.style.willChange = "";
      positioner.style.pointerEvents = "";
      positioner.style.transform = "";
      positioner.style.removeProperty("--transform-origin");
      positioner.style.removeProperty("--positioner-width");
      positioner.style.removeProperty("--positioner-height");
      positioner.style.removeProperty("--available-width");
      positioner.style.removeProperty("--available-height");
    }

    const popup = getCurrentPopup();
    if (popup) {
      popup.style.willChange = "";
      popup.style.pointerEvents = "";
      restorePopupPosition(popup);
      popup.style.removeProperty("scale");
      popup.style.removeProperty("--transform-origin");
      popup.style.removeProperty("--popup-width");
      popup.style.removeProperty("--popup-height");
    }
    if (viewport) {
      viewport.style.top = "";
      viewport.style.left = "";
      viewport.style.willChange = "";
      viewport.style.removeProperty("--transform-origin");
      viewport.style.removeProperty("--viewport-width");
      viewport.style.removeProperty("--viewport-height");
    }
  };
  const clearViewportTrackingInstantRaf = () => {
    if (viewportTrackingInstantRaf !== null) {
      cancelAnimationFrame(viewportTrackingInstantRaf);
      viewportTrackingInstantRaf = null;
    }
  };
  const syncPopupStackInstant = () => {
    const isInstant = viewportInitialInstant || viewportTrackingInstant;
    if (viewport) {
      if (isInstant) viewport.setAttribute("data-instant", "");
      else viewport.removeAttribute("data-instant");
    }
    const popup = getCurrentPopup();
    if (popup) {
      if (isInstant) popup.setAttribute("data-instant", "");
      else popup.removeAttribute("data-instant");
    }
    const positioner = getCurrentPositioner();
    if (positioner) {
      if (isInstant) positioner.setAttribute("data-instant", "");
      else positioner.removeAttribute("data-instant");
    }
  };
  const scheduleViewportTrackingInstantClear = () => {
    clearViewportTrackingInstantRaf();
    viewportTrackingInstantRaf = requestAnimationFrame(() => {
      viewportTrackingInstantRaf = null;
      if (viewportInitialInstant && viewportInitialInstantFramesRemaining > 0) {
        viewportInitialInstantFramesRemaining -= 1;
        scheduleViewportTrackingInstantClear();
        return;
      }
      viewportInitialInstantFramesRemaining = 0;
      viewportInitialInstant = false;
      viewportTrackingInstant = false;
      syncPopupStackInstant();
    });
  };
  const removeViewportInstant = () => {
    clearViewportTrackingInstantRaf();
    viewportInitialInstantFramesRemaining = 0;
    viewportInitialInstant = false;
    viewportTrackingInstant = false;
    syncPopupStackInstant();
  };
  const refreshViewportInitialInstant = (
    frames = INITIAL_OPEN_INSTANT_SETTLE_FRAMES,
  ) => {
    viewportInitialInstant = true;
    viewportInitialInstantFramesRemaining = Math.max(
      viewportInitialInstantFramesRemaining,
      frames,
    );
    syncPopupStackInstant();
    scheduleViewportTrackingInstantClear();
  };
  const teardownPopupStack = () => {
    const stack = popupStack;
    if (!stack || !viewport) return;

    clearActiveContentMeasureRaf();
    popupSizeResizeObserver?.disconnect();
    popupSizeResizeObserver = null;
    removeViewportInstant();
    resetPopupStackStyles();
    resetPopupSizeMemory();
    viewportOffsetLeft = 0;
    viewportOffsetTop = 0;
    viewport.hidden = true;
    viewport.style.pointerEvents = "none";
    stack.popup.hidden = true;
    stack.popup.style.pointerEvents = "none";
    stack.popupPortal.restore();

    if (stack.generatedPopup) {
      unwrapGeneratedSlot(stack.popup);
    }
    if (stack.generatedPositioner) {
      unwrapGeneratedSlot(stack.positioner);
    }
    if (stack.generatedPortal) {
      unwrapGeneratedSlot(stack.portal);
    }

    stack.popupPresence.cleanup();
    stack.viewportPresence.cleanup();
    popupStack = null;
  };

  const ensurePopupStack = () => {
    if (!viewport) return null;
    if (popupStack) return popupStack;

    const detected = findPopupStackParts();
    let popup = detected.popup;
    let positioner = detected.positioner;
    let portal = detected.portal;
    let generatedPopup = false;
    let generatedPositioner = false;
    let generatedPortal = false;

    if (!popup || !popup.contains(viewport)) {
      popup = wrapWithGeneratedSlot(viewport, "navigation-menu-popup");
      generatedPopup = true;
    }

    if (!positioner || !positioner.contains(popup)) {
      positioner = wrapWithGeneratedSlot(popup, "navigation-menu-positioner");
      generatedPositioner = true;
    }

    if (!portal || !portal.contains(positioner)) {
      portal = wrapWithGeneratedSlot(positioner, "navigation-menu-portal");
      generatedPortal = true;
    }

    const popupPortal = createPortalLifecycle({
      content: popup,
      root,
      enabled: true,
      container: positioner,
      mountTarget: portal,
    });
    const stack = {
      popup,
      positioner,
      portal,
      popupPortal,
      popupPresence: null as unknown as ReturnType<typeof createPresenceLifecycle>,
      viewportPresence:
        null as unknown as ReturnType<typeof createPresenceLifecycle>,
      generatedPopup,
      generatedPositioner,
      generatedPortal,
      isClosing: false,
      popupExitComplete: false,
      viewportExitComplete: false,
    } satisfies PopupStackController;
    const viewportPresence = createPresenceLifecycle({
      element: viewport,
      onExitComplete: () => {
        stack.viewportExitComplete = true;
        maybeTeardownPopupStack(stack);
      },
    });
    const popupPresence = createPresenceLifecycle({
      element: popup,
      onExitComplete: () => {
        stack.popupExitComplete = true;
        maybeTeardownPopupStack(stack);
      },
    });

    stack.popupPresence = popupPresence;
    stack.viewportPresence = viewportPresence;
    popupStack = stack;
    observePopupSize(popup);

    return popupStack;
  };

  const mountContentInViewport = (content: HTMLElement) => {
    if (!viewport) return;
    const existing = contentPlacement.get(content) ?? {
      originalParent: null,
      originalNextSibling: null,
      mountedInViewport: false,
    };

    if (!existing.mountedInViewport) {
      existing.originalParent = content.parentNode;
      existing.originalNextSibling = content.nextSibling;
      existing.mountedInViewport = true;
      contentPlacement.set(content, existing);
    }

    if (content.parentNode !== viewport) {
      viewport.appendChild(content);
    }
  };

  const restoreContentPlacement = (content: HTMLElement) => {
    const existing = contentPlacement.get(content);
    if (!existing || !existing.mountedInViewport) return;

    const parent = existing.originalParent;
    const sibling = existing.originalNextSibling;
    if (parent && (parent as Node).isConnected) {
      if (sibling && sibling.parentNode === parent) {
        parent.insertBefore(content, sibling);
      } else {
        parent.appendChild(content);
      }
    } else {
      content.remove();
    }

    existing.mountedInViewport = false;
    existing.originalParent = null;
    existing.originalNextSibling = null;
  };

  const updateViewportPositioner = () => {
    if (!viewport) return;
    const positioner = getCurrentPositioner();
    if (!positioner) return;
    const win = root.ownerDocument.defaultView ?? window;
    const rootRect = (root as HTMLElement).getBoundingClientRect();
    const isFixed = rootPositionMethod === "fixed";
    const positionerTop =
      rootRect.top + viewportOffsetTop + (isFixed ? 0 : win.scrollY);
    const positionerLeft =
      rootRect.left + viewportOffsetLeft + (isFixed ? 0 : win.scrollX);

    positioner.style.position = rootPositionMethod;
    positioner.style.top = `${positionerTop}px`;
    positioner.style.left = `${positionerLeft}px`;
    positioner.style.margin = "0";
    positioner.style.willChange = "top,left";
    positioner.style.pointerEvents = "none";
  };

  // ResizeObserver for active panel - handles fonts/images/content changes after open
  let activeRO: ResizeObserver | null = null;
  const scheduleActiveContentLayoutSync = (
    data: {
      item: HTMLElement;
      content: HTMLElement;
      trigger: HTMLElement;
    },
  ) => {
    clearActiveContentMeasureRaf();
    activeContentMeasureRaf = requestAnimationFrame(() => {
      activeContentMeasureRaf = null;
      if (!viewport || currentValue === null) return;
      const activeData = getActiveData();
      if (!activeData || activeData.content !== data.content) return;
      const stack = ensurePopupStack();
      if (!stack || stack.isClosing) return;
      if (viewportInitialInstant) {
        refreshViewportInitialInstant();
      }
      const placement = resolvePlacement(activeData.item, activeData.content);
      if (
        stack.popup.hasAttribute("data-starting-style") ||
        isPopupSizeTransitionInFlight()
      ) {
        updateViewportSize(activeData.content, activeData.trigger, placement, {
          defer: false,
          mode: "sync-current",
        });
        return;
      }
      updateViewportSize(activeData.content, activeData.trigger, placement, {
        defer: false,
        mode: "measure-target",
      });
    });
  };
  const observeActiveContent = (
    data: {
      item: HTMLElement;
      content: HTMLElement;
      trigger: HTMLElement;
    } | null,
  ) => {
    activeRO?.disconnect();
    activeRO = null;
    activeMutationObserver?.disconnect();
    activeMutationObserver = null;
    clearActiveContentMeasureRaf();
    if (!viewport || !data) return;
    activeRO = new ResizeObserver(() => {
      scheduleActiveContentLayoutSync(data);
    });
    activeRO.observe(data.content);
    if (typeof MutationObserver === "function") {
      activeMutationObserver = new MutationObserver(() => {
        scheduleActiveContentLayoutSync(data);
      });
      activeMutationObserver.observe(data.content, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  };
  cleanups.push(() => activeRO?.disconnect());
  cleanups.push(() => activeMutationObserver?.disconnect());
  cleanups.push(clearActiveContentMeasureRaf);
  cleanups.push(() => {
    removeViewportInstant();
    contentPresence.forEach((presence) => presence.cleanup());
    contentPresence.clear();
    contentPlacement.forEach((_state, content) => {
      restoreContentPlacement(content);
      setContentMountedAbsolute(content, false);
      content.hidden = true;
      content.style.pointerEvents = "none";
    });
    contentPositionState.clear();
    contentPlacement.clear();
    popupSizeResizeObserver?.disconnect();
    popupSizeResizeObserver = null;
    teardownPopupStack();
  });

  // Build a map of items with their triggers and content
  const itemMap = new Map<
    string,
    {
      value: string;
      item: HTMLElement;
      trigger: HTMLElement;
      content: HTMLElement;
      index: number;
    }
  >();

  const resolvePlacement = (
    item: HTMLElement,
    content: HTMLElement,
  ): PlacementConfig => {
    return {
      side:
        options.side ??
        getDataEnum(content, "side", SIDES) ??
        getDataEnum(item, "side", SIDES) ??
        rootSide,
      align:
        options.align ??
        getDataEnum(content, "align", ALIGNS) ??
        getDataEnum(item, "align", ALIGNS) ??
        rootAlign,
      sideOffset:
        options.sideOffset ??
        getDataNumber(content, "sideOffset") ??
        getDataNumber(item, "sideOffset") ??
        rootSideOffset,
      alignOffset:
        options.alignOffset ??
        getDataNumber(content, "alignOffset") ??
        getDataNumber(item, "alignOffset") ??
        rootAlignOffset,
    };
  };

  let validIndex = 0;
  items.forEach((item) => {
    const value = item.dataset["value"];
    if (!value) return;

    const trigger = getPart<HTMLElement>(item, "navigation-menu-trigger");
    const content = getPart<HTMLElement>(item, "navigation-menu-content");

    if (trigger && content) {
      itemMap.set(value, {
        value,
        item,
        trigger,
        content,
        index: validIndex++,
      });
      contentPresence.set(
        content,
        createPresenceLifecycle({
          element: content,
          onExitComplete: () => {
            if (isDestroyed) return;
            setContentSurfaceState(content, false);
            setContentActivationDirection(content, null);
            content.removeAttribute("data-motion");
            setContentMountedAbsolute(content, false);
            restoreContentPlacement(content);
            content.hidden = true;
            content.style.pointerEvents = "none";
          },
        }),
      );

      // Setup ARIA - link trigger to content bidirectionally
      const safe = safeId(value);
      const triggerId = ensureId(trigger, `nav-menu-trigger-${safe}`);
      const contentId = ensureId(content, `nav-menu-content-${safe}`);
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-controls", contentId);
      content.setAttribute("aria-labelledby", triggerId);
    }
  });

  // Get all triggers for keyboard navigation
  const triggers = Array.from(itemMap.values()).map((v) => v.trigger);
  const topLevelFocusableSelector =
    'a[href], button:not([disabled]), [role="link"], [role="button"], [tabindex]:not([tabindex="-1"])';

  const getManagedItemByElement = (
    el: Element | null,
  ):
    | {
        value: string;
        item: HTMLElement;
        trigger: HTMLElement;
        content: HTMLElement;
        index: number;
      }
    | null => {
    const item = el?.closest(
      '[data-slot="navigation-menu-item"]',
    ) as HTMLElement | null;
    if (!item) return null;
    const value = item.dataset["value"];
    if (!value) return null;
    const data = itemMap.get(value);
    if (!data || data.item !== item) return null;
    return data;
  };

  // Build ordered top-level keyboard navigables from authored item order.
  const getTopLevelItemTarget = (item: HTMLElement): HTMLElement | null => {
    if (item.matches(topLevelFocusableSelector)) return item;
    const candidates = item.querySelectorAll<HTMLElement>(topLevelFocusableSelector);
    for (const candidate of candidates) {
      if (!item.contains(candidate)) continue;
      if (candidate.closest('[data-slot="navigation-menu-content"]')) continue;
      if (candidate.hidden || candidate.closest("[hidden]")) continue;
      return candidate;
    }
    return null;
  };
  const topLevelNavigables: TopLevelNavigable[] = [];
  const navigableByElement = new Map<HTMLElement, TopLevelNavigable>();
  items.forEach((item) => {
    const managed = getManagedItemByElement(item);
    if (managed) {
      const entry: TopLevelNavigable = {
        kind: "submenu",
        element: managed.trigger,
        item: managed.item,
        value: managed.value,
        trigger: managed.trigger,
      };
      topLevelNavigables.push(entry);
      navigableByElement.set(entry.element, entry);
      navigableByElement.set(entry.item, entry);
      return;
    }

    const plainTarget = getTopLevelItemTarget(item);
    if (!plainTarget) return;
    const entry: TopLevelNavigable = {
      kind: "plain",
      element: plainTarget,
    };
    topLevelNavigables.push(entry);
    navigableByElement.set(entry.element, entry);
  });

  const getNavigableByTarget = (
    target: EventTarget | null,
  ): TopLevelNavigable | null => {
    const el = target instanceof HTMLElement ? target : null;
    if (!el) return null;

    let current: HTMLElement | null = el;
    while (current && current !== list) {
      const entry = navigableByElement.get(current);
      if (entry) return entry;
      current = current.parentElement;
    }
    return null;
  };

  const getPlainNavigableByTarget = (
    target: EventTarget | null,
  ): Extract<TopLevelNavigable, { kind: "plain" }> | null => {
    const navigable = getNavigableByTarget(target);
    return navigable?.kind === "plain" ? navigable : null;
  };

  const getSubmenuNavigableByTarget = (
    target: EventTarget | null,
  ): Extract<TopLevelNavigable, { kind: "submenu" }> | null => {
    const navigable = getNavigableByTarget(target);
    return navigable?.kind === "submenu" ? navigable : null;
  };

  const supportsHoverInteractions = (): boolean => {
    const view = root.ownerDocument.defaultView;
    if (!view?.matchMedia) return true;

    try {
      return view.matchMedia("(any-hover: hover)").matches;
    } catch {
      return true;
    }
  };

  const matchesHover = (element: Element): boolean => {
    try {
      return element.matches(":hover");
    } catch {
      return false;
    }
  };

  const getInitiallyHoveredNavigable = (): TopLevelNavigable | null => {
    for (const navigable of topLevelNavigables) {
      if (navigable.kind === "submenu") {
        if (matchesHover(navigable.item) || matchesHover(navigable.trigger)) {
          return navigable;
        }
        continue;
      }

      if (matchesHover(navigable.element)) return navigable;
    }

    return null;
  };

  interface TopLevelFocusOptions {
    preserveOpenOnPlain?: boolean;
  }

  const focusTopLevelNavigable = (
    navigable: TopLevelNavigable,
    options: TopLevelFocusOptions = {},
  ): boolean => {
    const doc = root.ownerDocument;
    const preserveOpenOnPlain = options.preserveOpenOnPlain ?? false;

    if (navigable.kind === "submenu") {
      navigable.trigger.focus();
      if (doc.activeElement !== navigable.trigger) return false;
      syncIndicator(navigable.trigger);
      return true;
    }

    if (currentValue !== null && !preserveOpenOnPlain) {
      closeMenuAndUnlock();
    }
    navigable.element.focus();
    if (doc.activeElement !== navigable.element) return false;
    if (currentValue !== null && preserveOpenOnPlain) {
      syncIndicator();
    } else {
      updateIndicator(navigable.element);
    }
    return true;
  };

  const focusAdjacentTopLevelFromIndex = (
    currentIndex: number,
    direction: 1 | -1,
    options: TopLevelFocusOptions = {},
  ): boolean => {
    for (
      let nextIndex = currentIndex + direction;
      nextIndex >= 0 && nextIndex < topLevelNavigables.length;
      nextIndex += direction
    ) {
      const nextNavigable = topLevelNavigables[nextIndex];
      if (!nextNavigable) continue;
      if (focusTopLevelNavigable(nextNavigable, options)) return true;
    }
    return false;
  };

  const focusAdjacentTopLevelFromNavigable = (
    navigable: TopLevelNavigable,
    direction: 1 | -1,
    options: TopLevelFocusOptions = {},
  ): boolean => {
    const currentIndex = topLevelNavigables.indexOf(navigable);
    if (currentIndex === -1) return false;
    return focusAdjacentTopLevelFromIndex(currentIndex, direction, options);
  };

  const focusAdjacentTopLevelFromTrigger = (
    trigger: HTMLElement,
    direction: 1 | -1,
    options: TopLevelFocusOptions = {},
  ): boolean => {
    const currentIndex = topLevelNavigables.findIndex(
      (entry) => entry.kind === "submenu" && entry.trigger === trigger,
    );
    if (currentIndex === -1) return false;
    return focusAdjacentTopLevelFromIndex(currentIndex, direction, options);
  };

  const isNonSubmenuListTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Node) || !list.contains(target)) return false;
    const el = target instanceof HTMLElement ? target : target.parentElement;
    if (!el) return false;
    if (el.closest('[data-slot="navigation-menu-indicator"]')) return false;
    if (getManagedItemByElement(el)) return false;
    const item = el.closest(
      '[data-slot="navigation-menu-item"]',
    ) as HTMLElement | null;
    if (item) return true;
    return !!el.closest("a[href], button, [role='link'], [role='button']");
  };

  // Focusable elements selector for content navigation
  const focusableSelector =
    'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // Get focusable elements in a content panel
  const getFocusableElements = (content: HTMLElement): HTMLElement[] => {
    return Array.from(
      content.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((el) => !el.hidden && !el.closest("[hidden]"));
  };

  const isElementActuallyFocusable = (el: HTMLElement): boolean => {
    if (!el.isConnected) return false;
    if (el.hidden || el.closest("[hidden]")) return false;
    if ("disabled" in el && (el as HTMLButtonElement).disabled) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.getAttribute("tabindex") === "-1") return false;
    if (el.matches(focusableSelector)) return true;
    return el.tabIndex >= 0;
  };

  const isWithinThisMenu = (candidate: HTMLElement): boolean => {
    if (root.contains(candidate)) return true;
    if (viewport?.contains(candidate)) return true;

    const popup = getCurrentPopup();
    if (popup?.contains(candidate)) return true;

    const positioner = getCurrentPositioner();
    if (positioner?.contains(candidate)) {
      return true;
    }

    for (const { content } of itemMap.values()) {
      if (content.contains(candidate)) return true;
    }

    return false;
  };

  const focusNextFocusableAfterRoot = (): boolean => {
    const doc = root.ownerDocument;
    const candidates = Array.from(doc.querySelectorAll<HTMLElement>("*"));
    for (const candidate of candidates) {
      if (!isElementActuallyFocusable(candidate)) continue;
      if (isWithinThisMenu(candidate)) continue;
      if (
        ((root as Node).compareDocumentPosition(candidate) &
          Node.DOCUMENT_POSITION_FOLLOWING) ===
        0
      ) {
        continue;
      }

      candidate.focus();
      if (doc.activeElement === candidate) return true;
    }
    return false;
  };

  const focusContentForValue = (value: string): void => {
    requestAnimationFrame(() => {
      if (currentValue !== value) return;
      const data = itemMap.get(value);
      if (!data) return;
      const focusables = getFocusableElements(data.content);
      const first = focusables[0];
      if (first) first.focus();
      else data.content.focus(); // content has tabIndex=-1
    });
  };

  const clearTimers = () => {
    if (openTimeout) {
      clearTimeout(openTimeout);
      openTimeout = null;
    }
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
  };

  const resetPendingInteraction = () => {
    clearTimers();
    pendingValue = null;
  };

  const resetPointerIntent = () => {
    suppressFocusOpenForTrigger = null;
    pointerActivationTrigger = null;
  };

  const clearIndicatorInstantRaf = () => {
    if (indicatorInstantRaf !== null) {
      cancelAnimationFrame(indicatorInstantRaf);
      indicatorInstantRaf = null;
    }
  };

  // Create hover bridge element for covering margin gaps
  let hoverBridge: HTMLElement | null = null;
  const getBridgeHost = (): HTMLElement | null => {
    if (!viewport) return null;
    const positioner = getCurrentPositioner();
    if (positioner) return positioner;
    const popup = getCurrentPopup();
    if (popup) return popup;
    return viewport.parentElement instanceof HTMLElement
      ? viewport.parentElement
      : viewport;
  };

  const getOrCreateHoverBridge = (): HTMLElement => {
    const host = getBridgeHost();
    if (!hoverBridge) {
      hoverBridge = document.createElement("div");
      hoverBridge.setAttribute("data-slot", "navigation-menu-bridge");
      hoverBridge.style.cssText =
        "position: absolute; pointer-events: auto; z-index: 0; display: none;";
      // Shield keeps menu open while crossing root->popup gap.
      cleanups.push(
        on(hoverBridge, "pointerenter", () => {
          clearTimers();
        }),
        on(hoverBridge, "pointerleave", (e) => {
          if (clickLocked || currentValue === null) return;
          const next = (e as PointerEvent).relatedTarget as Node | null;
          if (isNodeInsideActivePopup(next)) return;
          if (next && containsWithPortals(root, next)) return;
          updateState(null);
          updateIndicator(null);
        }),
      );
    }
    if (host && hoverBridge.parentElement !== host) {
      host.insertBefore(hoverBridge, host.firstChild);
    }
    return hoverBridge;
  };

  const hideHoverBridge = () => {
    if (!hoverBridge) return;
    hoverBridge.style.height = "0";
    hoverBridge.style.width = "0";
    hoverBridge.style.top = "0px";
    hoverBridge.style.left = "0px";
    hoverBridge.style.right = "0px";
    hoverBridge.style.bottom = "auto";
    hoverBridge.style.transform = "none";
    hoverBridge.style.clipPath = "none";
    hoverBridge.style.display = "none";
  };

  const getOrCreateHoverSafeTriangleOverlay = (): HTMLElement | null => {
    if (!debugSafeTriangle) return null;
    const host = root.ownerDocument.body;
    if (!host) return null;
    if (!hoverSafeTriangleOverlay) {
      hoverSafeTriangleOverlay = root.ownerDocument.createElement("div");
      hoverSafeTriangleOverlay.setAttribute(
        "data-slot",
        "navigation-menu-safe-triangle",
      );
      hoverSafeTriangleOverlay.style.cssText = [
        "position: fixed",
        "pointer-events: none",
        "display: none",
        "z-index: 2147483647",
        "background: rgba(255, 0, 0, 0.18)",
        "border: 1px solid rgba(255, 0, 0, 0.45)",
      ].join("; ");
    }
    if (hoverSafeTriangleOverlay.parentElement !== host) {
      host.appendChild(hoverSafeTriangleOverlay);
    }
    return hoverSafeTriangleOverlay;
  };

  const hideHoverSafeTriangleOverlay = () => {
    if (!hoverSafeTriangleOverlay) return;
    hoverSafeTriangleOverlay.style.width = "0";
    hoverSafeTriangleOverlay.style.height = "0";
    hoverSafeTriangleOverlay.style.clipPath = "none";
    hoverSafeTriangleOverlay.style.display = "none";
  };

  const clearHoverSafetyState = () => {
    activeSafetyTriangle = null;
    if (!debugSafeTriangle) hideHoverSafeTriangleOverlay();
  };

  const drawHoverSafeTriangle = (triangle: HoverSafeTriangle) => {
    const overlay = getOrCreateHoverSafeTriangleOverlay();
    if (!overlay) return;

    const ax = triangle.apex.x;
    const ay = triangle.apex.y;
    const bx = triangle.edgeA.x;
    const by = triangle.edgeA.y;
    const cx = triangle.edgeB.x;
    const cy = triangle.edgeB.y;
    const minX = Math.min(ax, bx, cx);
    const minY = Math.min(ay, by, cy);
    const maxX = Math.max(ax, bx, cx);
    const maxY = Math.max(ay, by, cy);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const normalize = (x: number, y: number) =>
      `${((x - minX) / width) * 100}% ${((y - minY) / height) * 100}%`;

    overlay.style.display = "block";
    overlay.style.left = `${minX}px`;
    overlay.style.top = `${minY}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    overlay.style.clipPath = `polygon(${normalize(ax, ay)}, ${normalize(bx, by)}, ${normalize(cx, cy)})`;
  };

  const sign = (p1: Point, p2: Point, p3: Point): number =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);

  const isPointInTriangle = (
    point: Point,
    a: Point,
    b: Point,
    c: Point,
  ): boolean => {
    const d1 = sign(point, a, b);
    const d2 = sign(point, b, c);
    const d3 = sign(point, c, a);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  };

  const getFacingEdge = (
    apex: Point,
    rootRect: DOMRect,
    viewportRect: DOMRect,
  ): [Point, Point] => {
    const epsilon = 0.5;
    if (viewportRect.top >= rootRect.bottom - epsilon) {
      return [
        { x: viewportRect.left, y: viewportRect.top },
        { x: viewportRect.right, y: viewportRect.top },
      ];
    }
    if (viewportRect.bottom <= rootRect.top + epsilon) {
      return [
        { x: viewportRect.left, y: viewportRect.bottom },
        { x: viewportRect.right, y: viewportRect.bottom },
      ];
    }
    if (viewportRect.left >= rootRect.right - epsilon) {
      return [
        { x: viewportRect.left, y: viewportRect.top },
        { x: viewportRect.left, y: viewportRect.bottom },
      ];
    }
    if (viewportRect.right <= rootRect.left + epsilon) {
      return [
        { x: viewportRect.right, y: viewportRect.top },
        { x: viewportRect.right, y: viewportRect.bottom },
      ];
    }

    const edges: Array<[Point, Point]> = [
      [
        { x: viewportRect.left, y: viewportRect.top },
        { x: viewportRect.right, y: viewportRect.top },
      ],
      [
        { x: viewportRect.right, y: viewportRect.top },
        { x: viewportRect.right, y: viewportRect.bottom },
      ],
      [
        { x: viewportRect.left, y: viewportRect.bottom },
        { x: viewportRect.right, y: viewportRect.bottom },
      ],
      [
        { x: viewportRect.left, y: viewportRect.top },
        { x: viewportRect.left, y: viewportRect.bottom },
      ],
    ];
    const distanceToEdge = ([p1, p2]: [Point, Point]): number => {
      if (p1.y === p2.y) return Math.abs(apex.y - p1.y);
      return Math.abs(apex.x - p1.x);
    };
    let best = edges[0]!;
    let bestDistance = distanceToEdge(best);
    for (let i = 1; i < edges.length; i++) {
      const edge = edges[i]!;
      const distance = distanceToEdge(edge);
      if (distance < bestDistance) {
        best = edge;
        bestDistance = distance;
      }
    }
    return best;
  };

  const getActiveData = () =>
    currentValue ? (itemMap.get(currentValue) ?? null) : null;
  const SAFETY_EDGE_INSET = 10;

  const buildSafetyTriangle = (
    triggerRect: DOMRect,
    rootRect: DOMRect,
    targetRect: DOMRect,
  ): HoverSafeTriangle | null => {
    if (targetRect.width <= 0 || targetRect.height <= 0) return null;
    const apex: Point = {
      x: triggerRect.left + triggerRect.width / 2,
      y: triggerRect.top + triggerRect.height * 0.62,
    };
    let [edgeA, edgeB] = getFacingEdge(apex, rootRect, targetRect);
    const minBaseSpan = 28;
    if (edgeA.x === edgeB.x) {
      const minY = Math.min(edgeA.y, edgeB.y);
      const maxY = Math.max(edgeA.y, edgeB.y);
      const span = maxY - minY;
      const inset =
        span <= minBaseSpan
          ? 0
          : Math.min(SAFETY_EDGE_INSET, (span - minBaseSpan) / 2);
      edgeA = { x: edgeA.x, y: minY + inset };
      edgeB = { x: edgeB.x, y: maxY - inset };
    } else {
      const minX = Math.min(edgeA.x, edgeB.x);
      const maxX = Math.max(edgeA.x, edgeB.x);
      const span = maxX - minX;
      const inset =
        span <= minBaseSpan
          ? 0
          : Math.min(SAFETY_EDGE_INSET, (span - minBaseSpan) / 2);
      edgeA = { x: minX + inset, y: edgeA.y };
      edgeB = { x: maxX - inset, y: edgeB.y };
    }
    return { apex, edgeA, edgeB };
  };

  const getCurrentSafetyTriangle = (): HoverSafeTriangle | null => {
    if (!safeTriangleEnabled) return null;
    if (!viewport || currentValue === null) return null;
    const activeData = getActiveData();
    if (!activeData) return null;
    const rootRect = (root as HTMLElement).getBoundingClientRect();
    const triggerRect = activeData.trigger.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const contentRect = activeData.content.getBoundingClientRect();
    const targetRect =
      viewportRect.width > 0 && viewportRect.height > 0
        ? viewportRect
        : contentRect;
    const triangle = buildSafetyTriangle(triggerRect, rootRect, targetRect);
    activeSafetyTriangle = triangle;
    return triangle;
  };

  const isPointerInsideSafetyCorridor = (event: PointerEvent): boolean => {
    const triangle = getCurrentSafetyTriangle();
    if (!triangle) return false;
    const point: Point = { x: event.clientX, y: event.clientY };
    return isPointInTriangle(
      point,
      triangle.apex,
      triangle.edgeA,
      triangle.edgeB,
    );
  };

  const toLocalPoint = (point: Point, rootRect: DOMRect): Point => ({
    x: point.x - rootRect.left,
    y: point.y - rootRect.top,
  });

  const buildConvexHull = (points: Point[]): Point[] => {
    if (points.length <= 1) return points.slice();
    const key = (point: Point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
    const unique = new Map<string, Point>();
    for (const point of points) unique.set(key(point), point);
    const sorted = Array.from(unique.values()).sort((a, b) => {
      if (a.x === b.x) return a.y - b.y;
      return a.x - b.x;
    });
    if (sorted.length <= 2) return sorted;
    const cross = (o: Point, a: Point, b: Point): number =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower: Point[] = [];
    for (const point of sorted) {
      while (
        lower.length >= 2 &&
        cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
      ) {
        lower.pop();
      }
      lower.push(point);
    }

    const upper: Point[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const point = sorted[i]!;
      while (
        upper.length >= 2 &&
        cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
      ) {
        upper.pop();
      }
      upper.push(point);
    }

    lower.pop();
    upper.pop();
    return lower.concat(upper);
  };

  const setHoverShieldShape = (points: Point[]) => {
    if (points.length < 3) {
      hideHoverBridge();
      return;
    }
    const bridge = getOrCreateHoverBridge();
    const bridgeHost = bridge.parentElement;
    const renderedPoints =
      bridgeHost && bridgeHost === getCurrentPositioner()
        ? points.map((point) => ({
            x: point.x - viewportOffsetLeft,
            y: point.y - viewportOffsetTop,
          }))
        : points;
    const hull = buildConvexHull(renderedPoints);
    if (hull.length < 3) {
      hideHoverBridge();
      return;
    }
    const minX = Math.min(...hull.map((point) => point.x));
    const minY = Math.min(...hull.map((point) => point.y));
    const maxX = Math.max(...hull.map((point) => point.x));
    const maxY = Math.max(...hull.map((point) => point.y));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const normalize = (point: Point) =>
      `${((point.x - minX) / width) * 100}% ${((point.y - minY) / height) * 100}%`;

    bridge.style.display = "block";
    bridge.style.transform = "none";
    bridge.style.bottom = "auto";
    bridge.style.right = "auto";
    bridge.style.left = `${minX}px`;
    bridge.style.top = `${minY}px`;
    bridge.style.width = `${width}px`;
    bridge.style.height = `${height}px`;
    bridge.style.clipPath = `polygon(${hull.map(normalize).join(", ")})`;
  };

  const updateDebugSafeTrianglePreview = () => {
    if (!debugSafeTriangle) return;
    const triangle = getCurrentSafetyTriangle();
    if (!triangle) {
      hideHoverSafeTriangleOverlay();
      return;
    }
    drawHoverSafeTriangle(triangle);
  };

  const isNodeInsideActivePopup = (node: Node | null): boolean => {
    if (!node) return false;
    const activeData = getActiveData();
    if (activeData?.content.contains(node)) return true;
    if (viewport?.contains(node)) return true;
    if (getCurrentPopup()?.contains(node)) return true;
    if (hoverBridge?.contains(node)) return true;
    const positioner = getCurrentPositioner();
    if (positioner?.contains(node))
      return true;
    return false;
  };

  cleanups.push(clearHoverSafetyState);
  cleanups.push(clearIndicatorInstantRaf);
  cleanups.push(hideHoverBridge);
  cleanups.push(() => {
    hideHoverSafeTriangleOverlay();
    if (hoverSafeTriangleOverlay?.parentElement) {
      hoverSafeTriangleOverlay.parentElement.removeChild(
        hoverSafeTriangleOverlay,
      );
    }
    hoverSafeTriangleOverlay = null;
  });

  const syncPositionerSizingVars = (
    positioner: HTMLElement,
    triggerRect: DOMRect,
    side: Side,
    sideOffset: number,
    width: number,
    height: number,
  ) => {
    const win = root.ownerDocument.defaultView ?? window;
    const visualViewport = win.visualViewport;
    const viewportX = visualViewport?.offsetLeft ?? 0;
    const viewportY = visualViewport?.offsetTop ?? 0;
    const viewportWidth = visualViewport?.width ?? win.innerWidth;
    const viewportHeight = visualViewport?.height ?? win.innerHeight;
    const availableWidth =
      side === "left"
        ? Math.max(0, triggerRect.left - viewportX - sideOffset)
        : side === "right"
          ? Math.max(
              0,
              viewportX + viewportWidth - triggerRect.right - sideOffset,
            )
          : Math.max(0, viewportWidth);
    const availableHeight =
      side === "top"
        ? Math.max(0, triggerRect.top - viewportY - sideOffset)
        : side === "bottom"
        ? Math.max(
            0,
            viewportY + viewportHeight - triggerRect.bottom - sideOffset,
          )
        : Math.max(0, viewportHeight);

    setPositionerSizeVars(positioner, { width, height });
    positioner.style.setProperty("--available-width", `${availableWidth}px`);
    positioner.style.setProperty("--available-height", `${availableHeight}px`);
  };

  const applyViewportLayout = (
    content: HTMLElement,
    trigger: HTMLElement,
    placement: PlacementConfig,
    options: {
      mode?: ViewportLayoutMode;
    } = {},
  ) => {
    const stack = ensurePopupStack();
    if (!viewport || !stack) return;
    const { popup, positioner } = stack;
    const mode = options.mode ?? "measure-target";
    const measuresTarget = mode !== "sync-current";

    if (
      viewport.getAttribute("data-state") !== "open" ||
      content.getAttribute("data-state") !== "active"
    ) {
      return;
    }

    setContentMountedAbsolute(content, false);

    const firstChild = content.firstElementChild as HTMLElement | null;
    const lastChild = content.lastElementChild as HTMLElement | null;
    const firstStyle = firstChild ? getComputedStyle(firstChild) : null;
    const lastStyle = lastChild ? getComputedStyle(lastChild) : null;
    const firstMarginTop = firstStyle
      ? parseFloat(firstStyle.marginTop) || 0
      : 0;
    const lastMarginBottom = lastStyle
      ? parseFloat(lastStyle.marginBottom) || 0
      : 0;
    const measureAxis = (...values: number[]): number => {
      let max = 0;
      for (const value of values) {
        if (Number.isFinite(value)) max = Math.max(max, value);
      }
      return max;
    };
    const contentRect = content.getBoundingClientRect();
    const fallbackSize = {
      width: measureAxis(
        contentRect.width,
        content.scrollWidth,
        content.offsetWidth,
        content.clientWidth,
      ),
      height:
        measureAxis(
          contentRect.height,
          content.scrollHeight,
          content.offsetHeight,
          content.clientHeight,
        ) + firstMarginTop + lastMarginBottom,
    };
    const committedSizeBeforeMeasure = { ...popupSizeState.committed };
    const measuredPopupSize =
      measuresTarget
        ? measureTargetPopupSize(stack, placement.side)
        : getPopupTransitionBaseline();
    const contentSize = {
      width:
        mode === "sync-current"
          ? committedSizeBeforeMeasure.width ||
            measuredPopupSize.width ||
            fallbackSize.width
          : measuredPopupSize.width || fallbackSize.width,
      height:
        mode === "sync-current"
          ? committedSizeBeforeMeasure.height ||
            measuredPopupSize.height ||
            fallbackSize.height
          : measuredPopupSize.height || fallbackSize.height,
    };
    rememberLivePopupSize(
      measuredPopupSize.width > 0 && measuredPopupSize.height > 0
        ? measuredPopupSize
        : contentSize,
    );
    if (measuresTarget) rememberCommittedPopupSize(contentSize);
    const contentWidth = contentSize.width;
    const contentHeight = contentSize.height;
    if (contentWidth <= 0 || contentHeight <= 0) {
      return;
    }
    const floatingRect = {
      top: contentRect.top,
      left: contentRect.left,
      width: contentWidth,
      height: contentHeight,
      right: contentRect.left + contentWidth,
      bottom: contentRect.top + contentHeight,
    };

    // Get viewport margin-top for hover bridge calculation
    const viewportStyle = getComputedStyle(viewport);
    const viewportMarginTop = parseFloat(viewportStyle.marginTop) || 0;

    setViewportLegacySizeVars(contentWidth, contentHeight);

    const rootRect = (root as HTMLElement).getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const pos = computeFloatingPosition({
      anchorRect: triggerRect,
      contentRect: floatingRect,
      side: placement.side,
      align: placement.align,
      sideOffset: placement.sideOffset,
      alignOffset: placement.alignOffset,
      avoidCollisions: false,
      collisionPadding: 0,
      allowedSides: SIDES,
    });
    const left = pos.x - rootRect.left;
    const top = pos.y - rootRect.top;
    viewportOffsetLeft = left;
    viewportOffsetTop = top;
    const originAnchor = getTransformOriginAnchor(
      pos.side,
      pos.align,
      triggerRect,
    );
    const transformOriginX = originAnchor.x - (rootRect.left + left);
    const transformOriginY = originAnchor.y - (rootRect.top + top);
    const positionerOriginX = originAnchor.x - rootRect.left;
    const positionerOriginY = originAnchor.y - rootRect.top;
    const viewportTransformOrigin = `${transformOriginX}px ${transformOriginY}px`;
    const positionerTransformOrigin = `${positionerOriginX}px ${positionerOriginY}px`;

    popup.style.willChange = "width,height";
    popup.style.pointerEvents = "auto";
    if (pos.side === "top") {
      setPopupRuntimePosition(popup, "top");
    } else if (pos.side === "left") {
      setPopupRuntimePosition(popup, "left");
    } else {
      setPopupRuntimePosition(popup, null);
    }
    popup.style.setProperty("--transform-origin", viewportTransformOrigin);
    viewport.style.top = "0px";
    viewport.style.left = "0px";
    viewport.style.willChange = "transform,width,height";
    viewport.style.setProperty("--transform-origin", viewportTransformOrigin);
    content.style.setProperty("--transform-origin", viewportTransformOrigin);
    popup.setAttribute("data-side", pos.side);
    popup.setAttribute("data-align", pos.align);
    viewport.setAttribute("data-side", pos.side);
    viewport.setAttribute("data-align", pos.align);
    content.setAttribute("data-side", pos.side);
    content.setAttribute("data-align", pos.align);
    positioner.setAttribute("data-side", pos.side);
    positioner.setAttribute("data-align", pos.align);
    positioner.style.setProperty(
      "--transform-origin",
      positionerTransformOrigin,
    );
    syncPositionerSizingVars(
      positioner,
      triggerRect,
      pos.side as Side,
      placement.sideOffset,
      contentWidth,
      contentHeight,
    );
    updateViewportPositioner();

    if (mode === "measure-target") {
      setPopupFixedSizeVars(popup, contentWidth, contentHeight);
    } else if (mode === "initial-open") {
      setPopupFixedSizeVars(popup, contentWidth, contentHeight);
    } else {
      const popupWidthVar = popup.style.getPropertyValue("--popup-width").trim();
      const popupHeightVar = popup.style.getPropertyValue("--popup-height").trim();
      if (!popupWidthVar || !popupHeightVar) {
        setPopupFixedSizeVars(
          popup,
          committedSizeBeforeMeasure.width || contentWidth,
          committedSizeBeforeMeasure.height || contentHeight,
        );
      }
    }

    // Build unified hover shield (rectangular gap bridge + triangular safety corridor).
    const viewportRect = viewport.getBoundingClientRect();
    const shieldPoints: Point[] = [];

    const rootBottomGap = Math.max(0, viewportRect.top - rootRect.bottom); // viewport below
    const rootTopGap = Math.max(0, rootRect.top - viewportRect.bottom); // viewport above
    const rootRightGap = Math.max(0, viewportRect.left - rootRect.right); // viewport right
    const rootLeftGap = Math.max(0, rootRect.left - viewportRect.right); // viewport left
    const marginGap = Math.max(0, viewportMarginTop);
    const verticalGap = Math.max(rootBottomGap, rootTopGap, marginGap);
    const horizontalGap = Math.max(rootRightGap, rootLeftGap);
    const triangle = safeTriangleEnabled
      ? buildSafetyTriangle(triggerRect, rootRect, viewportRect)
      : null;
    activeSafetyTriangle = triangle;

    const addRectPoints = (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      if (width <= 0 || height <= 0) return;
      shieldPoints.push(
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      );
    };

    if (verticalGap >= horizontalGap && verticalGap > 0) {
      const gap = Math.max(rootBottomGap, rootTopGap, marginGap);
      let rectX = left;
      const rectY =
        rootTopGap > rootBottomGap && rootTopGap >= marginGap
          ? top + contentHeight
          : top - gap;
      let rectWidth = contentWidth;
      if (triangle) {
        const bridgePad = 8;
        const baseMinX =
          Math.min(triangle.edgeA.x, triangle.edgeB.x) - rootRect.left;
        const baseMaxX =
          Math.max(triangle.edgeA.x, triangle.edgeB.x) - rootRect.left;
        rectX = baseMinX - bridgePad;
        rectWidth = baseMaxX - baseMinX + bridgePad * 2;
      }
      addRectPoints(rectX, rectY, rectWidth, gap);
    } else if (horizontalGap > 0) {
      const gap = Math.max(rootRightGap, rootLeftGap);
      let rectY = top;
      const rectX =
        rootLeftGap > rootRightGap ? left + contentWidth : left - gap;
      let rectHeight = contentHeight;
      if (triangle) {
        const bridgePad = 8;
        const baseMinY =
          Math.min(triangle.edgeA.y, triangle.edgeB.y) - rootRect.top;
        const baseMaxY =
          Math.max(triangle.edgeA.y, triangle.edgeB.y) - rootRect.top;
        rectY = baseMinY - bridgePad;
        rectHeight = baseMaxY - baseMinY + bridgePad * 2;
      }
      addRectPoints(rectX, rectY, gap, rectHeight);
    }

    if (triangle) {
      const apex = toLocalPoint(triangle.apex, rootRect);
      const edgeA = toLocalPoint(triangle.edgeA, rootRect);
      const edgeB = toLocalPoint(triangle.edgeB, rootRect);
      shieldPoints.push(apex, edgeA, edgeB);
    }

    setHoverShieldShape(shieldPoints);
    updateDebugSafeTrianglePreview();
  };

  const updateViewportSize = (
    content: HTMLElement,
    trigger: HTMLElement,
    placement: PlacementConfig,
    options: {
      defer?: boolean;
      mode?: ViewportLayoutMode;
    } = {},
  ) => {
    if (!viewport) return;

    const run = () => {
      applyViewportLayout(content, trigger, placement, options);
    };

    if (options.defer === false) {
      run();
      return;
    }

    // Measure after content is visible.
    requestAnimationFrame(() => {
      if (
        viewport.getAttribute("data-state") !== "open" ||
        content.getAttribute("data-state") !== "active"
      ) {
        return;
      }
      run();
    });
  };

  const syncActiveViewportLayout = (
    data = getActiveData(),
    options: {
      defer?: boolean;
      mode?: ViewportLayoutMode;
    } = {},
  ) => {
    if (!data) return;
    const placement = resolvePlacement(data.item, data.content);
    updateViewportSize(data.content, data.trigger, placement, options);
  };

  const viewportPositionSync = createPositionSync({
    observedElements: [root, ...triggers],
    isActive: () => currentValue !== null,
    ancestorScroll: true,
    syncOnScroll: true,
    ancestorResize: true,
    elementResize: true,
    layoutShift: true,
    onUpdate: () => {
      viewportTrackingInstant = true;
      syncPopupStackInstant();
      syncActiveViewportLayout(undefined, {
        defer: false,
        mode: "sync-current",
      });
      scheduleViewportTrackingInstantClear();
    },
  });

  cleanups.push(() => viewportPositionSync.stop());

  const getMotionDirection = (newIndex: number): "left" | "right" => {
    if (previousIndex === -1) return "right";
    return newIndex > previousIndex ? "right" : "left";
  };

  // Update hover indicator position
  const updateIndicator = (trigger: HTMLElement | null) => {
    if (!indicator) return;

    hoveredTrigger = trigger;

    if (!trigger) {
      // Hide indicator when not hovering any trigger
      clearIndicatorInstantRaf();
      indicator.removeAttribute("data-instant");
      indicator.setAttribute("data-state", "hidden");
      return;
    }

    const wasHidden = indicator.getAttribute("data-state") !== "visible";
    if (wasHidden) {
      clearIndicatorInstantRaf();
      indicator.setAttribute("data-instant", "");
      indicatorInstantRaf = requestAnimationFrame(() => {
        indicatorInstantRaf = requestAnimationFrame(() => {
          indicator.removeAttribute("data-instant");
          indicatorInstantRaf = null;
        });
      });
    }

    const listRect = list.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    indicator.style.setProperty(
      "--indicator-left",
      `${triggerRect.left - listRect.left}px`,
    );
    indicator.style.setProperty("--indicator-width", `${triggerRect.width}px`);
    indicator.style.setProperty(
      "--indicator-top",
      `${triggerRect.top - listRect.top}px`,
    );

    // Get viewport's margin-top to determine if there's visual separation
    const viewportMarginTop = viewport
      ? parseFloat(getComputedStyle(viewport).marginTop) || 0
      : 0;

    // If viewport has no margin, its 1px box-shadow border needs visual clearance
    const borderOverlap = viewportMarginTop < 1 ? 1 : 0;

    indicator.style.setProperty(
      "--indicator-height",
      `${triggerRect.height - borderOverlap}px`,
    );
    indicator.setAttribute("data-state", "visible");
  };

  const getActiveTrigger = (): HTMLElement | null => {
    if (!currentValue) return null;
    const data = itemMap.get(currentValue);
    return data?.trigger ?? null;
  };

  const syncIndicator = (preferred: HTMLElement | null = null) => {
    const activeTrigger = getActiveTrigger();
    if (activeTrigger) {
      updateIndicator(activeTrigger);
      return;
    }
    updateIndicator(preferred);
  };

  const updateState = (value: string | null, immediate = false) => {
    clearHoverSafetyState();
    // Skip if value hasn't changed
    if (value === currentValue) {
      if (value === null) {
        resetPendingInteraction();
      } else {
        clearTimers();
      }
      return;
    }
    // Skip if we're already in the process of opening this specific value
    if (!immediate && value !== null && value === pendingValue) {
      return;
    }

    clearTimers();
    if (value === null) pendingValue = null;
    else pendingValue = value;

    const doUpdate = () => {
      const prevValue = currentValue;
      const newData = value ? itemMap.get(value) : null;
      const popupSizeBaseline = getPopupTransitionBaseline();
      const isOpen = value !== null;
      const isInitialOpen = prevValue === null && isOpen;

      // Only animate direction when switching between different items
      const isSwitching =
        prevValue !== null && value !== null && prevValue !== value;

      // Determine motion direction (only when switching)
      const direction =
        isSwitching && newData ? getMotionDirection(newData.index) : null;

      // If closing while focus is inside the active content panel, restore focus to its trigger.
      const active = document.activeElement as HTMLElement | null;
      if (value === null && active && prevValue) {
        const previousData = itemMap.get(prevValue);
        if (previousData && containsWithPortals(previousData.content, active)) {
          previousData.trigger.focus();
        }
      }

      // Update all items
      itemMap.forEach(({ trigger, content, item }, key) => {
        const isActive = key === value;
        const wasActive = key === prevValue;

        setAria(trigger, "expanded", isActive);
        trigger.setAttribute("data-state", isActive ? "open" : "closed");
        item.setAttribute("data-state", isActive ? "open" : "closed");

        if (!isActive) {
          const presence = contentPresence.get(content);
          setContentSurfaceState(content, false);
          content.setAttribute("aria-hidden", "true");
          setInert(content, true);
          content.style.pointerEvents = "none";

          if (value === null) {
            if (wasActive) {
              setContentActivationDirection(content, null);
              content.removeAttribute("data-motion");
            }
          } else if (wasActive && direction) {
            // Set exit motion on the previous content only while switching panels.
            setContentActivationDirection(content, direction);
            // TODO(next-major): remove legacy `data-motion` switching output.
            const exitDirection =
              direction === "right" ? "to-left" : "to-right";
            content.setAttribute("data-motion", exitDirection);
          } else if (wasActive) {
            setContentActivationDirection(content, null);
            content.removeAttribute("data-motion");
          }

          if (wasActive) {
            setContentMountedAbsolute(content, true);
            presence?.exit();
          } else if (!presence?.isExiting) {
            setContentActivationDirection(content, null);
            content.removeAttribute("data-motion");
            setContentMountedAbsolute(content, false);
            restoreContentPlacement(content);
            content.hidden = true;
          } else {
            // Preserve current exit motion while this panel is finishing an exit animation.
          }
        }
      });

      // Update new active content
      if (newData) {
        const stack = ensurePopupStack();
        stack?.popupPortal.mount();
        if (stack) {
          stack.isClosing = false;
          stack.popupExitComplete = false;
          stack.viewportExitComplete = false;
        }
        if (viewport && isInitialOpen) {
          setOpenSurfaceState(root, true);
          setOpenSurfaceState(stack?.positioner ?? getCurrentPositioner(), true);
          setOpenSurfaceState(stack?.popup ?? getCurrentPopup(), true);
          setOpenSurfaceState(viewport, true);
          viewport.style.pointerEvents = "auto";
          clearViewportTrackingInstantRaf();
          viewportTrackingInstant = false;
          refreshViewportInitialInstant();
        }
        if (stack?.popup) {
          stack.popup.hidden = false;
          stack.popup.style.pointerEvents = "auto";
        }
        if (viewport) {
          viewport.hidden = false;
        }
        if (prevValue === null) {
          stack?.popupPresence.enter();
          stack?.viewportPresence.enter();
        }
        mountContentInViewport(newData.content);
        const presence = contentPresence.get(newData.content);
        presence?.enter();
        viewportPositionSync.start();

        if (direction) {
          setContentActivationDirection(newData.content, direction);
          // TODO(next-major): remove legacy `data-motion` switching output.
          const enterDirection =
            direction === "right" ? "from-right" : "from-left";
          newData.content.setAttribute("data-motion", enterDirection);
        } else {
          setContentActivationDirection(newData.content, null);
          newData.content.removeAttribute("data-motion");
        }
        setContentSurfaceState(newData.content, true);
        setContentMountedAbsolute(newData.content, false);
        newData.content.removeAttribute("aria-hidden");
        setInert(newData.content, false);
        newData.content.hidden = false;
        newData.content.style.pointerEvents = "auto";
        previousIndex = newData.index;

        if (isSwitching) {
          viewportInitialInstantFramesRemaining = 0;
          viewportInitialInstant = false;
          clearViewportTrackingInstantRaf();
          viewportTrackingInstant = false;
          syncPopupStackInstant();
        }

        syncActiveViewportLayout(newData, {
          defer: isInitialOpen || isSwitching ? false : undefined,
          mode: isInitialOpen ? "initial-open" : "measure-target",
        });
        observeActiveContent(newData);
        updateIndicator(newData.trigger); // Indicator follows active trigger
      } else {
        viewportPositionSync.stop();
        hideHoverBridge();
        clearHoverSafetyState();
        if (popupStack) {
          if (popupSizeBaseline.width > 0 && popupSizeBaseline.height > 0) {
            setPopupFixedSizeVars(
              popupStack.popup,
              popupSizeBaseline.width,
              popupSizeBaseline.height,
            );
            setPositionerSizeVars(
              popupStack.positioner,
              {
                width: popupSizeBaseline.width,
                height: popupSizeBaseline.height,
              },
            );
            setViewportLegacySizeVars(
              popupSizeBaseline.width,
              popupSizeBaseline.height,
            );
          }
          popupStack.isClosing = true;
          popupStack.popupExitComplete = false;
          popupStack.viewportExitComplete = false;
          popupStack.popupPresence.exit();
          popupStack.viewportPresence.exit();
        }
        observeActiveContent(null);
      }

      // Update root state
      setOpenSurfaceState(root, isOpen);
      if (direction) {
        // TODO(next-major): remove legacy root `data-motion` output.
        root.setAttribute(
          "data-motion",
          direction === "right" ? "from-right" : "from-left",
        );
      } else {
        root.removeAttribute("data-motion");
      }

      // Update viewport state
      if (viewport) {
        const popup = getCurrentPopup();
        const positioner = getCurrentPositioner();
        setOpenSurfaceState(positioner, isOpen);
        setOpenSurfaceState(popup, isOpen);
        setOpenSurfaceState(viewport, isOpen);
        viewport.style.pointerEvents = isOpen ? "auto" : "none";
        viewportInitialInstant = isInitialOpen;
        viewportInitialInstantFramesRemaining = isInitialOpen
          ? Math.max(
              viewportInitialInstantFramesRemaining,
              INITIAL_OPEN_INSTANT_SETTLE_FRAMES,
            )
          : 0;
        if (!isOpen || isSwitching) {
          clearViewportTrackingInstantRaf();
          viewportTrackingInstant = false;
        }
        syncPopupStackInstant();

        if (direction) {
          // TODO(next-major): remove legacy viewport motion-direction output.
          viewport.style.setProperty(
            "--motion-direction",
            direction === "right" ? "1" : "-1",
          );
        } else {
          viewport.style.removeProperty("--motion-direction");
        }
      }

      currentValue = value;
      pendingValue = null; // Clear pending since we've completed the update
      if (value === null) updateIndicator(null); // Clear indicator on close
      updateDebugSafeTrianglePreview();
      emit(root, "navigation-menu:change", { value });
      onValueChange?.(value);
    };

    if (immediate) {
      doUpdate();
    } else if (value !== null && currentValue === null) {
      // Opening - use delay
      openTimeout = setTimeout(doUpdate, delayOpen);
    } else if (value !== null && currentValue !== null) {
      // Switching between items - instant
      doUpdate();
    } else {
      // Closing - use delay
      closeTimeout = setTimeout(doUpdate, delayClose);
    }
  };

  // Initialize all as closed
  const initialPopupStack = findPopupStackParts();
  setOpenSurfaceState(root, false);
  if (viewport) {
    setOpenSurfaceState(initialPopupStack.positioner, false);
    setOpenSurfaceState(initialPopupStack.popup, false);
    setOpenSurfaceState(viewport, false);
    viewport.hidden = true;
    viewport.style.pointerEvents = "none";
    if (initialPopupStack.popup) {
      initialPopupStack.popup.hidden = true;
      initialPopupStack.popup.style.pointerEvents = "none";
    }
  }
  if (indicator) {
    indicator.setAttribute("data-state", "hidden");
  }

  itemMap.forEach(({ trigger, content, item }) => {
    if (trigger.tagName === "BUTTON" && !trigger.hasAttribute("type"))
      (trigger as HTMLButtonElement).type = "button";
    setAria(trigger, "expanded", false);
    trigger.setAttribute("data-state", "closed");
    // Keep all top-level triggers tabbable for natural Tab/Shift+Tab traversal.
    trigger.tabIndex = 0;
    item.setAttribute("data-state", "closed");
    setContentSurfaceState(content, false);
    content.setAttribute("aria-hidden", "true");
    content.tabIndex = -1; // Make focusable for ArrowDown fallback
    setInert(content, true);
    content.hidden = true;
    setContentMountedAbsolute(content, false);
    content.style.pointerEvents = "none";
  });

  // Pointer handlers for items
  itemMap.forEach(({ item, trigger }, value) => {
    // Pointer enter on trigger - update indicator (skip if click-locked)
    cleanups.push(
      on(trigger, "pointerenter", (e) => {
        if (!clickLocked) {
          if (
            currentValue !== value &&
            isPointerInsideSafetyCorridor(e as PointerEvent)
          ) {
            return;
          }
          updateIndicator(trigger);
        }
      }),
    );

    // Pointer enter on item - update state (content will trigger this too)
    // Skip if click-locked to keep the locked item's content visible
    cleanups.push(
      on(item, "pointerenter", (e) => {
        if (!clickLocked) {
          if (
            currentValue !== value &&
            isPointerInsideSafetyCorridor(e as PointerEvent)
          ) {
            return;
          }
          updateState(value);
        }
      }),
    );

    // Pointer leave on item - cancel pending open and close when leaving active item to outside.
    cleanups.push(
      on(item, "pointerleave", (e) => {
        if (pendingValue === value && currentValue === null) {
          resetPendingInteraction();
        }
        if (currentValue === value && !clickLocked) {
          const next = (e as PointerEvent).relatedTarget as Node | null;
          if (isNodeInsideActivePopup(next)) return;
          if (!next || !containsWithPortals(root, next)) {
            updateState(null);
            updateIndicator(null);
          }
        }
      }),
    );

    // Focus on trigger - skip one focus-open after pointerdown so click owns tap behavior.
    cleanups.push(
      on(trigger, "focus", () => {
        if (suppressFocusOpenForTrigger === trigger) {
          suppressFocusOpenForTrigger = null;
          return;
        }
        if (openOnFocus) updateState(value, true);
        syncIndicator(trigger);
      }),
    );

    // Pointer taps can move focus before click on some touch browsers.
    cleanups.push(
      on(trigger, "pointerdown", () => {
        suppressFocusOpenForTrigger = trigger;
        pointerActivationTrigger = trigger;
      }),
      on(trigger, "keydown", () => {
        // Prevent stale pointer origin from affecting keyboard activation.
        pointerActivationTrigger = null;
      }),
    );

    // Click on trigger - toggles and locks open state
    cleanups.push(
      on(trigger, "click", () => {
        const isPointerActivation = pointerActivationTrigger === trigger;
        pointerActivationTrigger = null;
        suppressFocusOpenForTrigger = null;
        resetPendingInteraction(); // Cancel any pending open/close timers

        // Check against the ACTUAL current value, not what focus might have changed
        if (currentValue === value && clickLocked) {
          // Clicking same trigger when already LOCKED -> close and unlock
          clickLocked = false;
          updateState(null, true);
          updateIndicator(null);
        } else if (currentValue === value && !clickLocked) {
          // Menu open via hover, click to LOCK it open
          clickLocked = true;
          updateIndicator(trigger);
          if (!isPointerActivation) {
            focusContentForValue(value);
          }
        } else {
          // Opening a new/different item -> switch and lock
          clickLocked = true;
          updateState(value, true);
          updateIndicator(trigger);
          if (!isPointerActivation) {
            focusContentForValue(value);
          }
        }
      }),
    );
  });

  // Close open submenu when interacting with non-submenu list targets (plain links/items).
  cleanups.push(
    on(list, "pointerover", (e) => {
      const event = e as PointerEvent;
      if (event.pointerType === "touch") return;
      const submenuNavigable = getSubmenuNavigableByTarget(event.target);
      if (submenuNavigable) {
        isRootHovered = true;
        if (clickLocked) return;
        if (
          currentValue !== submenuNavigable.value &&
          isPointerInsideSafetyCorridor(event)
        ) {
          return;
        }
        updateIndicator(submenuNavigable.trigger);
        updateState(submenuNavigable.value);
        return;
      }

      const plainNavigable = getPlainNavigableByTarget(event.target);
      if (plainNavigable) {
        isRootHovered = true;
        if (currentValue !== null) {
          if (clickLocked) return;
          closeMenuAndUnlock();
        }
        updateIndicator(plainNavigable.element);
        return;
      }

      if (currentValue === null) return;
      if (clickLocked) return;
      if (!isNonSubmenuListTarget(event.target)) return;
      closeMenuAndUnlock();
    }),
    on(list, "click", (e) => {
      if (currentValue === null) return;
      if (!isNonSubmenuListTarget(e.target)) return;
      closeMenuAndUnlock();
    }),
  );

  // Track pointer enter/leave on root for scoping document handlers
  // Cancel hover timers on any pointerdown inside root
  cleanups.push(
    on(list, "focusin", (e) => {
      const plainNavigable = getPlainNavigableByTarget(e.target);
      if (!plainNavigable) return;
      if (currentValue !== null) {
        syncIndicator();
        return;
      }
      updateIndicator(plainNavigable.element);
    }),
    on(root, "pointerenter", () => {
      isRootHovered = true;
    }),
    on(root, "pointerleave", (e) => {
      const next = (e as PointerEvent).relatedTarget as Node | null;
      if (isNodeInsideActivePopup(next)) return;
      isRootHovered = false;
      if (!clickLocked) {
        if (isPointerInsideSafetyCorridor(e as PointerEvent)) {
          clearTimers();
          return;
        }
        updateState(null);
        updateIndicator(null);
      }
    }),
    on(root, "pointerdown", () => {
      clearHoverSafetyState();
      resetPendingInteraction();
    }),
  );

  const syncInitialHoverState = () => {
    if (!supportsHoverInteractions()) return;
    if (currentValue !== null || pendingValue !== null || clickLocked) return;

    const hoveredNavigable = getInitiallyHoveredNavigable();
    isRootHovered =
      hoveredNavigable !== null ||
      (root instanceof HTMLElement && matchesHover(root));

    if (!hoveredNavigable) return;

    if (hoveredNavigable.kind === "submenu") {
      updateState(hoveredNavigable.value, true);
      return;
    }

    updateIndicator(hoveredNavigable.element);
  };

  // Handle viewport hover to keep menu open + recompute size after transitions
  if (viewport) {
    cleanups.push(
      on(viewport, "pointerenter", () => {
        clearHoverSafetyState();
        clearTimers();
      }),
      on(viewport, "transitionend", (e) => {
        if (e.target !== viewport) return; // Ignore bubbling from children
        const data = currentValue ? itemMap.get(currentValue) : null;
        if (data) {
          syncActiveViewportLayout(data, {
            defer: false,
            mode: "sync-current",
          });
        }
      }),
    );
  }

  // Track when pointer enters content areas to prevent closing
  itemMap.forEach(({ content }) => {
    cleanups.push(
      on(content, "pointerenter", () => {
        clearHoverSafetyState();
        clearTimers();
      }),
      on(content, "pointerleave", (e) => {
        if (clickLocked) return;
        const next = (e as PointerEvent).relatedTarget as Node | null;
        if (isNodeInsideActivePopup(next)) return;
        if (!containsWithPortals(root, next)) {
          updateState(null);
          updateIndicator(null);
        }
      }),
    );
  });

  // Keyboard navigation within the list
  cleanups.push(
    on(list, "keydown", (e) => {
      const currentNavigable = getNavigableByTarget(e.target);
      if (!currentNavigable) return;

      const currentNavigableIndex = topLevelNavigables.indexOf(currentNavigable);
      if (currentNavigableIndex === -1) return;

      let nextIndex = currentNavigableIndex;

      switch (e.key) {
        case "Tab": {
          // Keep forward Tab traversal linear while a submenu is open.
          if (e.shiftKey || currentValue === null) return;
          if (
            focusAdjacentTopLevelFromNavigable(currentNavigable, 1, {
              preserveOpenOnPlain: true,
            }) ||
            focusNextFocusableAfterRoot()
          ) {
            e.preventDefault();
          }
          return;
        }
        case "ArrowLeft":
          nextIndex = currentNavigableIndex - 1;
          if (nextIndex < 0) nextIndex = topLevelNavigables.length - 1;
          break;
        case "ArrowRight":
          nextIndex = currentNavigableIndex + 1;
          if (nextIndex >= topLevelNavigables.length) nextIndex = 0;
          break;
        case "ArrowDown": {
          // Open content only when focused item has submenu content.
          if (currentNavigable.kind === "submenu") {
            e.preventDefault();
            const triggerValue = currentNavigable.value;
            clickLocked = true; // Lock so pointerleave doesn't close
            updateState(triggerValue, true);
            focusContentForValue(triggerValue);
          }
          return;
        }
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = topLevelNavigables.length - 1;
          break;
        case "Escape":
          clickLocked = false;
          updateState(null, true);
          updateIndicator(null);
          return;
        default:
          return;
      }

      e.preventDefault();
      const nextNavigable = topLevelNavigables[nextIndex];
      if (!nextNavigable) return;
      focusTopLevelNavigable(nextNavigable, {
        preserveOpenOnPlain: true,
      });
    }),
  );

  // Keyboard navigation within content panels
  itemMap.forEach(({ content, trigger }) => {
    cleanups.push(
      on(content, "keydown", (e) => {
        const target = e.target as HTMLElement;
        const focusables = getFocusableElements(content);
        const currentIndex = focusables.indexOf(target);

        // Only handle if target is a focusable element in this content
        if (currentIndex === -1) return;

        switch (e.key) {
          case "Tab": {
            if (!e.shiftKey && currentIndex === focusables.length - 1) {
              if (
                focusAdjacentTopLevelFromTrigger(trigger, 1, {
                  preserveOpenOnPlain: true,
                }) ||
                focusNextFocusableAfterRoot()
              ) {
                e.preventDefault();
              }
              return;
            }

            if (e.shiftKey && currentIndex === 0) {
              e.preventDefault();
              trigger.focus();
              return;
            }

            return;
          }
          case "ArrowDown":
          case "ArrowRight": {
            e.preventDefault();
            const nextIndex = currentIndex + 1;
            if (nextIndex < focusables.length) {
              focusables[nextIndex]?.focus();
            }
            // At the end, stay on last item (don't wrap)
            break;
          }
          case "ArrowUp":
          case "ArrowLeft": {
            e.preventDefault();
            if (currentIndex === 0) {
              // At first element, return focus to trigger
              trigger.focus();
            } else {
              focusables[currentIndex - 1]?.focus();
            }
            break;
          }
          case "Escape": {
            e.preventDefault();
            clickLocked = false;
            updateState(null, true);
            updateIndicator(null);
            trigger.focus();
            break;
          }
        }
      }),
    );
  });

  // Helper to check if this menu instance is active (focused, hovered, or locked)
  const isMenuActive = () =>
    containsWithPortals(root, document.activeElement) ||
    isRootHovered ||
    clickLocked;

  const closeMenuAndUnlock = () => {
    clearHoverSafetyState();
    resetPendingInteraction();
    resetPointerIntent();
    clickLocked = false;
    updateState(null, true);
    updateIndicator(null);
    updateDebugSafeTrianglePreview();
  };

  // Close when focus leaves root (and unlock clickLocked)
  cleanups.push(
    on(document, "focusin", (e) => {
      const target = e.target as Node;
      if (containsWithPortals(root, target)) return;

      if (currentValue !== null) {
        closeMenuAndUnlock();
        return;
      }

      updateIndicator(null);
    }),
  );

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => currentValue !== null && isMenuActive(),
      onDismiss: closeMenuAndUnlock,
      closeOnClickOutside: true,
      closeOnEscape: true,
      preventEscapeDefault: false,
      isInside: (target) => !!target && containsWithPortals(root, target),
    }),
  );

  // Recompute indicator position on window resize or list scroll
  cleanups.push(
    on(window, "resize", () => {
      if (currentValue || hoveredTrigger) {
        requestAnimationFrame(() => syncIndicator(hoveredTrigger));
      }
    }),
    on(list, "scroll", () => {
      if (currentValue || hoveredTrigger) {
        requestAnimationFrame(() => syncIndicator(hoveredTrigger));
      }
    }),
  );

  // Inbound event
  cleanups.push(
    on(root, "navigation-menu:set", (e) => {
      const detail = (e as CustomEvent).detail as {
        value?: string | null;
      } | null;
      if (detail?.value === undefined) return;

      if (detail.value === null) {
        closeMenuAndUnlock();
      } else if (itemMap.has(detail.value)) {
        clickLocked = true;
        updateState(detail.value, true);
        const data = itemMap.get(detail.value);
        if (data) updateIndicator(data.trigger);
      }
    }),
  );

  const controller: NavigationMenuController = {
    get value() {
      return currentValue;
    },
    open: (value: string) => updateState(value, true),
    close: () => closeMenuAndUnlock(),
    destroy: () => {
      isDestroyed = true;
      resetPendingInteraction();
      resetPointerIntent();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  syncInitialHoverState();
  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all navigation menu components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(
  scope: ParentNode = document,
): NavigationMenuController[] {
  const controllers: NavigationMenuController[] = [];

  for (const root of getRoots(scope, "navigation-menu")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createNavigationMenu(root));
  }

  return controllers;
}
