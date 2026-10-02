import {
  ensureId,
  getPart,
  getParts,
  getRoots,
  getDataNumber,
  getDataEnum,
  getDataBool,
  setAria,
  on,
  emit,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  drainCleanups,
  createSwipeGesture,
} from "@data-slot/core";

const SLIDE_MODES = ["single", "multiple"] as const;
const ORIENTATIONS = ["horizontal", "vertical"] as const;

/** Everything that differs between a horizontal and a vertical carousel, resolved once. */
const AXES = {
  horizontal: {
    scroll: "scrollLeft",
    edge: "left",
    extent: "scrollWidth",
    viewport: "clientWidth",
    prevKey: "ArrowLeft",
    nextKey: "ArrowRight",
    touchAction: "pan-y",
    swipe: "x",
  },
  vertical: {
    scroll: "scrollTop",
    edge: "top",
    extent: "scrollHeight",
    viewport: "clientHeight",
    prevKey: "ArrowUp",
    nextKey: "ArrowDown",
    touchAction: "pan-x",
    swipe: "y",
  },
} as const;
type Axis = (typeof AXES)[keyof typeof AXES];
const MISSING_PARTS_ERROR = "Carousel requires carousel-content and at least one carousel-item";
const ROOT_BINDING_KEY = "@data-slot/carousel";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/carousel] createCarousel() was called on a root that is already bound. Returning the existing controller.";
/** Fallback for browsers without `scrollend`: a scroll is settled after this much quiet. */
const SCROLL_SETTLE_MS = 150;
const DRAG_AXIS_LOCK_THRESHOLD = 12;
/** Keyboard navigation stays out of fields so arrow keys keep editing text. */
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
/** A press on nested controls never starts a drag, so they keep their own clicks. */
const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="textbox"]';
type CarouselSetDetail = { index?: number; action?: "next" | "prev" };

export interface CarouselOptions {
  /** Initial slide index */
  defaultIndex?: number;
  /** Carousel orientation */
  orientation?: "horizontal" | "vertical";
  /** Enable soft-wrap looping for keyboard/button/API navigation */
  loop?: boolean;
  /** Enable pointer drag/swipe navigation */
  drag?: boolean;
  /** Enable mandatory snapping, disable snapping, or omit to honour CSS. */
  snap?: boolean;
  /** Keep every visible slide interactive in multiple mode. */
  slides?: "single" | "multiple";
  /** Callback when active index changes */
  onIndexChange?: (index: number) => void;
}

export interface CarouselController {
  /** Scroll to previous slide */
  prev(): void;
  /** Scroll to next slide */
  next(): void;
  /** Scroll to a specific slide index */
  goTo(index: number): void;
  /** Current active index */
  readonly index: number;
  /** Number of distinct reachable scroll positions */
  readonly count: number;
  /** Whether navigating to previous slide is possible */
  readonly canScrollPrev: boolean;
  /** Whether navigating to next slide is possible */
  readonly canScrollNext: boolean;
  /** Cleanup all event listeners and observers */
  destroy(): void;
}

const normalizeIndex = (index: number, count: number, loop: boolean): number => {
  if (count <= 0) return 0;

  const normalized = Number.isFinite(index) ? Math.trunc(index) : 0;

  if (loop) {
    return ((normalized % count) + count) % count;
  }

  return Math.min(count - 1, Math.max(0, normalized));
};

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null;

const setControlDisabled = (el: HTMLElement, disabled: boolean) => {
  if ("disabled" in el) {
    (el as HTMLButtonElement).disabled = disabled;
  }
  setAria(el, "disabled", disabled);
};

/**
 * Create a carousel controller for a root element.
 *
 * ## Events
 * - **Outbound** `carousel:change` (on root): Fires when active index changes.
 *   `event.detail: { index: number }`
 * - **Inbound** `carousel:set` (on root): Set carousel position programmatically.
 *   `event.detail: { index?: number; action?: "next" | "prev" }`
 *
 * Expected markup:
 * ```html
 * <div data-slot="carousel" data-default-index="0">
 *   <div data-slot="carousel-content">
 *     <div data-slot="carousel-item">Slide 1</div>
 *     <div data-slot="carousel-item">Slide 2</div>
 *   </div>
 *   <button data-slot="carousel-previous">Previous</button>
 *   <button data-slot="carousel-next">Next</button>
 * </div>
 * ```
 */
export function createCarousel(
  root: Element,
  options: CarouselOptions = {},
): CarouselController {
  const existingController = reuseRootBinding<CarouselController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING,
  );
  if (existingController) return existingController;

  const content = getPart<HTMLElement>(root, "carousel-content");
  if (!content) throw new Error(MISSING_PARTS_ERROR);

  const collectItems = () =>
    Array.from(content.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.getAttribute("data-slot") === "carousel-item",
    );

  let items = collectItems();
  if (items.length === 0) throw new Error(MISSING_PARTS_ERROR);

  // Resolve options with explicit precedence: JS > data-* > default
  const orientation =
    options.orientation ??
    getDataEnum(root, "orientation", ORIENTATIONS) ??
    "horizontal";
  const loop = options.loop ?? getDataBool(root, "loop") ?? false;
  const slides = options.slides ?? getDataEnum(root, "slides", SLIDE_MODES) ?? "single";
  const snap = options.snap ?? (root.getAttribute("data-snap") === "none" ? false : undefined);
  const drag = options.drag ?? getDataBool(root, "drag") ?? false;
  const defaultIndex =
    options.defaultIndex ?? getDataNumber(root, "defaultIndex") ?? 0;
  const onIndexChange = options.onIndexChange;

  const axis: Axis = AXES[orientation];
  const previousControls = getParts<HTMLElement>(root, "carousel-previous");
  const nextControls = getParts<HTMLElement>(root, "carousel-next");

  const cleanups: Array<() => void> = [];
  const win = root.ownerDocument?.defaultView ?? window;
  const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const navigationBehavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  let currentIndex = normalizeIndex(defaultIndex, items.length, loop);
  let snapPoints: number[] = [];
  let snapItems: HTMLElement[] = [];
  let settleTimer: number | undefined;
  /** A drag has locked to the carousel axis and is driving the scroll position. */
  let dragging = false;
  /** Keep snapping paused through release so it cannot preempt the smooth scroll. */
  let suspendedSnap: { style: string; enabled: boolean } | undefined;
  const restoreScrollSnap = () => {
    if (!suspendedSnap) return;
    content.style.scrollSnapType = suspendedSnap.style;
    suspendedSnap = undefined;
  };

  const originalSnapType = content.style.scrollSnapType;
  if (snap !== undefined) {
    content.style.scrollSnapType = snap ? `${axis.swipe} mandatory` : "none";
  }
  // Read CSS at interaction time, so responsive snap-none rules also govern dragging.
  const snappingEnabled = (): boolean =>
    suspendedSnap?.enabled ?? snap ?? (win.getComputedStyle(content).scrollSnapType !== "none");
  const suspendScrollSnap = () => {
    suspendedSnap ??= { style: content.style.scrollSnapType, enabled: snappingEnabled() };
    content.style.scrollSnapType = "none";
  };

  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  const getSnapPointForItem = (item: HTMLElement): number =>
    item.getBoundingClientRect()[axis.edge] -
    content.getBoundingClientRect()[axis.edge] +
    content[axis.scroll];

  const getNearestIndex = (position: number): number => {
    let nearest = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < snapPoints.length; i += 1) {
      const point = snapPoints[i];
      if (point === undefined) continue;
      const distance = Math.abs(point - position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = i;
      }
    }

    return nearest;
  };

  const canScrollPrev = () => {
    if (snapPoints.length <= 1) return false;
    return loop || (snappingEnabled() ? currentIndex > 0 : content[axis.scroll] > (snapPoints[0] ?? 0) + 1);
  };

  const canScrollNext = () => {
    if (snapPoints.length <= 1) return false;
    return loop || (snappingEnabled() ? currentIndex < snapPoints.length - 1 : content[axis.scroll] < (snapPoints.at(-1) ?? 0) - 1);
  };

  const updateStaticA11y = () => {
    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carousel");
    root.setAttribute("data-orientation", orientation);

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      item.setAttribute("role", "group");
      item.setAttribute("aria-roledescription", "slide");
      item.setAttribute("aria-label", `${i + 1} of ${items.length}`);
    }
  };

  const updateControls = () => {
    const prevDisabled = !canScrollPrev();
    const nextDisabled = !canScrollNext();

    for (const control of previousControls) {
      setControlDisabled(control, prevDisabled);
    }

    for (const control of nextControls) {
      setControlDisabled(control, nextDisabled);
    }
  };

  const updateSlides = () => {
    const rect = content.getBoundingClientRect();
    const left = rect.left + content.clientLeft;
    const top = rect.top + content.clientTop;
    const right = left + content.clientWidth;
    const bottom = top + content.clientHeight;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      const box = slides === "multiple" ? item.getBoundingClientRect() : null;
      const active = box
        ? box.right > left && box.left < right && box.bottom > top && box.top < bottom
        : item === snapItems[currentIndex];
      if (!active && item.contains(root.ownerDocument.activeElement)) {
        // Keep keyboard navigation inside the carousel when its focused slide leaves the tab order.
        if (!content.hasAttribute("tabindex")) {
          content.setAttribute("tabindex", "-1");
          cleanups.push(() => {
            if (content.getAttribute("tabindex") === "-1") content.removeAttribute("tabindex");
          });
        }
        content.focus({ preventScroll: true });
      }
      item.setAttribute("data-state", active ? "active" : "inactive");
      // Off-screen slides leave the tab order and accessibility tree.
      if (slides === "multiple" && active) item.removeAttribute("aria-hidden");
      else setAria(item, "hidden", !active);
      item.toggleAttribute("inert", !active);
    }
  };

  const updateIndicators = () => {
    for (const container of getParts<HTMLElement>(root, "carousel-indicators")) {
      while (container.children.length > snapPoints.length) container.lastElementChild?.remove();
      while (container.children.length < snapPoints.length) {
        const button = root.ownerDocument.createElement("button");
        button.type = "button";
        button.setAttribute("data-slot", "carousel-indicator");
        container.append(button);
      }
      Array.from(container.children).forEach((child, index) => child.setAttribute("data-index", String(index)));
    }
    for (const indicator of getParts<HTMLElement>(root, "carousel-indicator")) {
      const index = getDataNumber(indicator, "index");
      const valid = index !== undefined && Number.isInteger(index) && index >= 0 && index < snapPoints.length;
      const active = valid && index === currentIndex;
      indicator.hidden = !valid;
      setControlDisabled(indicator, !valid);
      indicator.setAttribute("data-state", active ? "active" : "inactive");
      if (active) indicator.setAttribute("aria-current", "true");
      else indicator.removeAttribute("aria-current");
      indicator.setAttribute("aria-controls", ensureId(content, "carousel-content"));
      if (valid && !indicator.hasAttribute("aria-label") && !indicator.hasAttribute("aria-labelledby")) {
        indicator.setAttribute("aria-label", `Go to slide ${index + 1}`);
      }
      if (indicator.tagName === "BUTTON" && !indicator.hasAttribute("type")) {
        (indicator as HTMLButtonElement).type = "button";
      }
    }
  };

  const updateStates = (emitChange: boolean) => {
    root.setAttribute("data-index", String(currentIndex));
    updateSlides();
    updateControls();
    updateIndicators();

    if (emitChange) {
      emit(root, "carousel:change", { index: currentIndex });
      onIndexChange?.(currentIndex);
    }
  };

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "auto") => {
    const target: ScrollToOptions = { behavior };
    target[axis.edge] = snapPoints[index] ?? 0;
    content.scrollTo(target);
  };

  /** Make `index` the active slide without scrolling; emits when it changed. */
  const applyIndex = (index: number) => {
    const changed = index !== currentIndex;
    currentIndex = index;
    updateStates(changed);
  };

  const measureSnapPoints = () => {
    const maxScroll = Math.max(0, content[axis.extent] - content[axis.viewport]);
    snapPoints = [];
    snapItems = [];
    for (const item of items) {
      const point = Math.min(maxScroll, Math.max(0, getSnapPointForItem(item)));
      // Subpixel layout can produce near-identical offsets at the scroll boundary.
      if (snapPoints.some(existing => Math.abs(existing - point) < 1)) continue;
      snapPoints.push(point);
      snapItems.push(item);
    }
  };

  /** Share positioning policy across layout changes; free scrolling always follows its actual offset. */
  const reconcileLayout = (selectSnappedIndex: (position: number) => number) => {
    const position = content[axis.scroll];
    measureSnapPoints();
    // Every slide was removed: park at 0 without scrolling or emitting a change.
    if (items.length === 0) {
      currentIndex = 0;
      updateStates(false);
      return;
    }

    const snapping = snappingEnabled();
    const nextIndex = snapping ? selectSnappedIndex(position) : getNearestIndex(position);

    if (snapping && !dragging) scrollToIndex(nextIndex);
    applyIndex(nextIndex);
  };

  const rebindResizeObserver = () => {
    if (typeof ResizeObserver === "undefined") return;

    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => reconcileLayout(getNearestIndex));
    resizeObserver.observe(content);
    for (const item of items) {
      resizeObserver.observe(item);
    }
  };

  const refreshItems = () => {
    const activeItem = snapItems[currentIndex] ?? null;
    items = collectItems();
    updateStaticA11y();
    reconcileLayout(() => {
      const preservedIndex = activeItem ? snapItems.indexOf(activeItem) : -1;
      return preservedIndex >= 0
        ? preservedIndex
        : normalizeIndex(currentIndex, snapPoints.length, loop);
    });
    rebindResizeObserver();
  };

  /** Navigate to `index`: scroll there and make it active. */
  const setIndex = (requestedIndex: number, behavior: ScrollBehavior = navigationBehavior) => {
    const nextIndex = normalizeIndex(requestedIndex, snapPoints.length, loop);
    scrollToIndex(nextIndex, behavior);
    applyIndex(nextIndex);
  };

  const prev = () => {
    if (!canScrollPrev()) return;
    const index = snappingEnabled() ? currentIndex - 1
      : snapPoints.findLastIndex(point => point < content[axis.scroll] - 1);
    setIndex(index);
  };

  const next = () => {
    if (!canScrollNext()) return;
    const index = snappingEnabled() ? currentIndex + 1
      : snapPoints.findIndex(point => point > content[axis.scroll] + 1);
    setIndex(index < 0 ? snapPoints.length : index);
  };

  // The index follows the scroll position only once scrolling has settled, so a
  // smooth scroll passes intermediate slides without activating them.
  const syncIndexFromScroll = () => {
    win.clearTimeout(settleTimer);
    settleTimer = undefined;
    if (dragging) return;
    restoreScrollSnap();
    applyIndex(getNearestIndex(content[axis.scroll]));
  };

  const onScroll = () => {
    if (slides === "multiple") updateSlides();
    if (!snappingEnabled()) updateControls();
    if (dragging) return;
    win.clearTimeout(settleTimer);
    settleTimer = win.setTimeout(syncIndexFromScroll, SCROLL_SETTLE_MS);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return;

    switch (event.key) {
      case axis.prevKey:
        prev();
        break;
      case axis.nextKey:
        next();
        break;
      case "Home":
        setIndex(0);
        break;
      case "End":
        setIndex(snapPoints.length - 1);
        break;
      default:
        return;
    }

    event.preventDefault();
  };

  const onSet = (event: Event) => {
    const detail = (event as CustomEvent<CarouselSetDetail>).detail;
    if (!detail || typeof detail !== "object") return;

    if (typeof detail.index === "number") {
      setIndex(detail.index);
      return;
    }

    if (detail.action === "next") {
      next();
    } else if (detail.action === "prev") {
      prev();
    }
  };

  /**
   * Drag the scroll container along the carousel axis with a pointer or touch,
   * then settle on the nearest slide. Native scroll snapping is paused while
   * the drag drives the position and the release scroll settles. Returns the cleanup.
   */
  const bindDrag = (): (() => void) => {
    const authoredTouchAction = content.style.touchAction;
    /** Read at axis lock so a new drag takes over from the current visual position. */
    let origin = 0;
    content.style.touchAction = axis.touchAction;

    const end = () => {
      if (!dragging) return;
      dragging = false;
      root.removeAttribute("data-dragging");
    };
    const settle = () => {
      if (!snappingEnabled()) {
        restoreScrollSnap();
        applyIndex(getNearestIndex(content[axis.scroll]));
        return;
      }
      const index = getNearestIndex(content[axis.scroll]);
      setIndex(index);
      // Instant or zero-distance scrolls may not emit scroll/scrollend.
      if (Math.abs(content[axis.scroll] - (snapPoints[index] ?? 0)) < 1) {
        restoreScrollSnap();
      } else {
        onScroll();
      }
    };

    const gesture = createSwipeGesture<HTMLElement>({
      element: content,
      axes: [axis.swipe],
      lockThreshold: DRAG_AXIS_LOCK_THRESHOLD,
      start: (_event, target) => (target.closest(INTERACTIVE_SELECTOR) ? null : content),
      lock() {
        origin = content[axis.scroll];
        dragging = true;
        root.setAttribute("data-dragging", "true");
        win.clearTimeout(settleTimer);
        suspendScrollSnap();
        // Cancel any native smooth scroll before the pointer takes over.
        content.scrollTo({ [axis.edge]: origin, behavior: "instant" });
        return true;
      },
      move(_content, { deltaX, deltaY }) {
        content[axis.scroll] = origin - (axis.swipe === "x" ? deltaX : deltaY);
      },
      release() {
        end();
        settle();
      },
      reset(_content, event) {
        end();
        // A cancelled gesture settles like a release; destroy() cancels without an event.
        if (event) settle();
      },
    });

    return () => {
      gesture.destroy();
      restoreScrollSnap();
      content.style.touchAction = authoredTouchAction;
    };
  };

  measureSnapPoints();
  currentIndex = normalizeIndex(defaultIndex, snapPoints.length, loop);
  updateStaticA11y();
  scrollToIndex(currentIndex);
  applyIndex(currentIndex);

  cleanups.push(on(content, "scroll", onScroll));
  cleanups.push(on(content, "scrollend", syncIndexFromScroll));
  cleanups.push(on(root, "keydown", onKeyDown));
  cleanups.push(on(root, "carousel:set", onSet));
  cleanups.push(on(root, "click", (event) => {
    const indicator = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-slot="carousel-indicator"]') : null;
    if (!indicator || indicator.closest('[data-slot="carousel"]') !== root) return;
    const index = getDataNumber(indicator, "index");
    if (index === undefined || !Number.isInteger(index) || index < 0 || index >= snapPoints.length) return;
    setIndex(index);
  }));
  if (drag) cleanups.push(bindDrag());

  for (const [controls, navigate] of [[previousControls, prev], [nextControls, next]] as const) {
    for (const control of controls) {
      if (control.tagName === "BUTTON" && !control.hasAttribute("type")) {
        (control as HTMLButtonElement).type = "button";
      }
      cleanups.push(on(control, "click", () => navigate()));
    }
  }

  rebindResizeObserver();

  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(refreshItems);
    mutationObserver.observe(content, { childList: true });
  }

  const controller: CarouselController = {
    prev,
    next,
    goTo(index) {
      setIndex(index);
    },
    get index() {
      return currentIndex;
    },
    get count() {
      return snapPoints.length;
    },
    get canScrollPrev() {
      return canScrollPrev();
    },
    get canScrollNext() {
      return canScrollNext();
    },
    destroy() {
      win.clearTimeout(settleTimer);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      drainCleanups(cleanups);
      if (snap !== undefined) content.style.scrollSnapType = originalSnapType;
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all carousel components in a scope.
 * Returns array of controllers for programmatic access.
 */
export function create(scope: ParentNode = document): CarouselController[] {
  const controllers: CarouselController[] = [];

  for (const root of getRoots(scope, "carousel")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createCarousel(root));
  }

  return controllers;
}
