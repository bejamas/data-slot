import {
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
} from "@data-slot/core";

const ORIENTATIONS = ["horizontal", "vertical"] as const;

/** Everything that differs between a horizontal and a vertical carousel, resolved once. */
const AXES = {
  horizontal: {
    scroll: "scrollLeft",
    edge: "left",
    prevKey: "ArrowLeft",
    nextKey: "ArrowRight",
    touchAction: "pan-y",
    swipe: "x",
  },
  vertical: {
    scroll: "scrollTop",
    edge: "top",
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
const PROGRAMMATIC_SCROLL_LOCK_MS = 1200;
const DRAG_AXIS_LOCK_THRESHOLD = 12;
const FOCUSABLE_CANDIDATES =
  'a[href],button,input,select,textarea,[contenteditable]:not([contenteditable="false"]),[tabindex]';
const DRAG_BLOCKING_CANDIDATES =
  'a[href],button,input,select,textarea,summary,[contenteditable=""],[contenteditable="true"],[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[role="textbox"]';
type CarouselSetDetail = { index?: number; action?: "next" | "prev" };

interface DragState {
  pointerId: number;
  startX: number;
  currentX: number;
  startY: number;
  currentY: number;
  startPosition: number;
  axis: "x" | "y" | null;
  active: boolean;
}

export interface CarouselOptions {
  /** Initial slide index */
  defaultIndex?: number;
  /** Carousel orientation */
  orientation?: "horizontal" | "vertical";
  /** Enable soft-wrap looping for keyboard/button/API navigation */
  loop?: boolean;
  /** Enable pointer drag/swipe navigation */
  drag?: boolean;
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
  /** Number of slides */
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

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  return !!target.closest(
    'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
  );
};

const setControlDisabled = (el: HTMLElement, disabled: boolean) => {
  if ("disabled" in el) {
    (el as HTMLButtonElement).disabled = disabled;
  }
  setAria(el, "disabled", disabled);
};

const setInert = (el: HTMLElement, inert: boolean) => {
  if ("inert" in el) {
    (el as HTMLElement & { inert?: boolean }).inert = inert;
  }

  if (inert) {
    el.setAttribute("inert", "");
  } else {
    el.removeAttribute("inert");
  }
};

const isDragBlockingTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof (target as Element).closest !== "function") return false;

  return !!(target as Element).closest(DRAG_BLOCKING_CANDIDATES);
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
  const drag = options.drag ?? getDataBool(root, "drag") ?? false;
  const defaultIndex =
    options.defaultIndex ?? getDataNumber(root, "defaultIndex") ?? 0;
  const onIndexChange = options.onIndexChange;

  const axis: Axis = AXES[orientation];
  const previousControls = getParts<HTMLElement>(root, "carousel-previous");
  const nextControls = getParts<HTMLElement>(root, "carousel-next");

  const cleanups: Array<() => void> = [];
  const managedFocusableByItem = new WeakMap<
    HTMLElement,
    Array<{ element: HTMLElement; tabindex: string | null }>
  >();
  const doc = root.ownerDocument ?? document;
  const win = root.ownerDocument?.defaultView ?? window;
  const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const navigationBehavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  let currentIndex = normalizeIndex(defaultIndex, items.length, loop);
  let snapPoints: number[] = [];
  let scrollRafId: number | null = null;
  let pendingProgrammaticIndex: number | null = null;
  let programmaticUnlockTimeoutId: number | null = null;
  let dragState: DragState | null = null;
  let previousTouchAction: string | null = null;
  let previousScrollSnapType: string | null = null;

  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  const clearProgrammaticScrollLock = () => {
    pendingProgrammaticIndex = null;
    if (programmaticUnlockTimeoutId !== null) {
      win.clearTimeout(programmaticUnlockTimeoutId);
      programmaticUnlockTimeoutId = null;
    }
  };

  const lockProgrammaticScroll = (targetIndex: number) => {
    pendingProgrammaticIndex = targetIndex;
    if (programmaticUnlockTimeoutId !== null) {
      win.clearTimeout(programmaticUnlockTimeoutId);
    }
    programmaticUnlockTimeoutId = win.setTimeout(() => {
      pendingProgrammaticIndex = null;
      programmaticUnlockTimeoutId = null;
    }, PROGRAMMATIC_SCROLL_LOCK_MS);
  };

  const getAxisPosition = () => content[axis.scroll];
  const setAxisPosition = (position: number) => {
    content[axis.scroll] = position;
  };

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

  const resolveDragAxis = (deltaX: number, deltaY: number): "x" | "y" | null => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < DRAG_AXIS_LOCK_THRESHOLD) {
      return null;
    }

    if (absX === absY) {
      return axis.swipe;
    }

    return absX > absY ? "x" : "y";
  };

  const disableDragScrollSnap = () => {
    if (previousScrollSnapType !== null) return;

    previousScrollSnapType = content.style.scrollSnapType;
    content.style.scrollSnapType = "none";
  };

  const restoreDragScrollSnap = () => {
    if (previousScrollSnapType === null) return;

    content.style.scrollSnapType = previousScrollSnapType;
    previousScrollSnapType = null;
  };

  const canScrollPrev = () => {
    if (items.length <= 1) return false;
    return loop || currentIndex > 0;
  };

  const canScrollNext = () => {
    if (items.length <= 1) return false;
    return loop || currentIndex < items.length - 1;
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

  const collectFocusableCandidates = (item: HTMLElement) => {
    const focusable = Array.from(item.querySelectorAll<HTMLElement>(FOCUSABLE_CANDIDATES));

    if (item.matches(FOCUSABLE_CANDIDATES)) {
      focusable.unshift(item);
    }

    return focusable;
  };

  const restoreItemFocusability = (item: HTMLElement) => {
    setInert(item, false);

    const managed = managedFocusableByItem.get(item);
    if (!managed) return;

    for (const { element, tabindex } of managed) {
      if (!element.isConnected) continue;

      if (tabindex === null) {
        element.removeAttribute("tabindex");
      } else {
        element.setAttribute("tabindex", tabindex);
      }
    }

    managedFocusableByItem.delete(item);
  };

  const disableItemFocusability = (item: HTMLElement) => {
    const managed =
      managedFocusableByItem.get(item) ??
      collectFocusableCandidates(item).map((element) => ({
        element,
        tabindex: element.getAttribute("tabindex"),
      }));

    managedFocusableByItem.set(item, managed);

    for (const { element } of managed) {
      element.setAttribute("tabindex", "-1");
    }

    setInert(item, true);
  };

  const updateStates = (emitChange: boolean) => {
    root.setAttribute("data-index", String(currentIndex));

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      const active = i === currentIndex;
      item.setAttribute("data-state", active ? "active" : "inactive");
      setAria(item, "hidden", !active);
      if (active) {
        restoreItemFocusability(item);
      } else {
        disableItemFocusability(item);
      }
    }

    updateControls();

    if (emitChange) {
      emit(root, "carousel:change", { index: currentIndex });
      onIndexChange?.(currentIndex);
    }
  };

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "auto") => {
    if (items.length === 0) return;

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
    snapPoints = items.map((item) => getSnapPointForItem(item));
  };

  const rebindResizeObserver = () => {
    if (typeof ResizeObserver === "undefined") return;

    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => {
      measureSnapPoints();
      scrollToIndex(currentIndex);
    });

    resizeObserver.observe(content);
    for (const item of items) {
      resizeObserver.observe(item);
    }
  };

  const refreshItems = () => {
    const activeItem = items[currentIndex] ?? null;
    items = collectItems();
    clearProgrammaticScrollLock();

    if (items.length === 0) {
      snapPoints = [];
      currentIndex = 0;
      root.setAttribute("data-index", "0");
      updateControls();
      return;
    }

    const preservedIndex = activeItem ? items.indexOf(activeItem) : -1;
    const nextIndex =
      preservedIndex >= 0
        ? preservedIndex
        : normalizeIndex(currentIndex, items.length, loop);

    updateStaticA11y();
    measureSnapPoints();
    scrollToIndex(nextIndex);
    applyIndex(nextIndex);
    rebindResizeObserver();
  };

  /** Navigate to `index`: scroll there and make it active. */
  const setIndex = (requestedIndex: number, behavior: ScrollBehavior = navigationBehavior) => {
    if (items.length === 0) return;

    const nextIndex = normalizeIndex(requestedIndex, items.length, loop);
    if (behavior === "smooth" && nextIndex !== currentIndex) {
      lockProgrammaticScroll(nextIndex);
    } else {
      clearProgrammaticScrollLock();
    }
    scrollToIndex(nextIndex, behavior);
    applyIndex(nextIndex);
  };

  const prev = () => {
    if (items.length === 0) return;
    if (!loop && currentIndex <= 0) return;
    setIndex(currentIndex - 1);
  };

  const next = () => {
    if (items.length === 0) return;
    if (!loop && currentIndex >= items.length - 1) return;
    setIndex(currentIndex + 1);
  };

  const onScroll = () => {
    if (dragState?.active) return;
    if (scrollRafId !== null) return;

    scrollRafId = win.requestAnimationFrame(() => {
      scrollRafId = null;
      if (dragState?.active) return;
      if (items.length === 0) return;

      const nearest = getNearestIndex(getAxisPosition());
      if (pendingProgrammaticIndex !== null) {
        if (nearest !== pendingProgrammaticIndex) return;
        clearProgrammaticScrollLock();
      }
      applyIndex(nearest);
    });
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
        setIndex(items.length - 1);
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

  const stopDragging = (
    pointerId: number | null,
    shouldSnap: boolean,
  ) => {
    const current = dragState;
    if (!current) return;
    if (pointerId !== null && current.pointerId !== pointerId) return;

    dragState = null;
    root.removeAttribute("data-dragging");

    if ("releasePointerCapture" in content) {
      try {
        content.releasePointerCapture(current.pointerId);
      } catch {
        // Ignore if pointer capture was not active.
      }
    }

    if (!shouldSnap || items.length === 0) {
      restoreDragScrollSnap();
      return;
    }

    setIndex(getNearestIndex(getAxisPosition()));
    restoreDragScrollSnap();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!drag) return;
    if (dragState?.pointerId === event.pointerId) return;
    if (dragState?.active) return;
    if (event.button !== 0) return;
    if (isDragBlockingTarget(event.target)) return;

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      currentX: event.clientX,
      startY: event.clientY,
      currentY: event.clientY,
      startPosition: getAxisPosition(),
      axis: null,
      active: false,
    };

    if ("setPointerCapture" in content) {
      try {
        content.setPointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported for this target.
      }
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    dragState.currentX = event.clientX;
    dragState.currentY = event.clientY;

    const deltaX = dragState.currentX - dragState.startX;
    const deltaY = dragState.currentY - dragState.startY;
    const dragAxis = dragState.axis ?? resolveDragAxis(deltaX, deltaY);
    dragState.axis = dragAxis;

    if (dragAxis !== axis.swipe) return;

    if (event.cancelable) {
      event.preventDefault();
    }

    if (!dragState.active) {
      dragState.active = true;
      root.setAttribute("data-dragging", "true");
      clearProgrammaticScrollLock();
      disableDragScrollSnap();
    }

    setAxisPosition(dragState.startPosition - (axis.swipe === "x" ? deltaX : deltaY));
  };

  const onPointerUp = (event: PointerEvent) => {
    stopDragging(event.pointerId, true);
  };

  const onPointerCancel = (event: PointerEvent) => {
    stopDragging(event.pointerId, true);
  };

  const onLostPointerCapture = (event: PointerEvent) => {
    stopDragging(event.pointerId, true);
  };

  measureSnapPoints();
  updateStaticA11y();
  scrollToIndex(currentIndex);
  applyIndex(currentIndex);

  if (drag) {
    previousTouchAction = content.style.touchAction;
    content.style.touchAction = axis.touchAction;
  }

  cleanups.push(on(content, "scroll", onScroll));
  cleanups.push(on(root, "keydown", onKeyDown));
  cleanups.push(on(root, "carousel:set", onSet));

  if (drag) {
    cleanups.push(on(content, "pointerdown", onPointerDown));
    cleanups.push(on(doc, "pointermove", onPointerMove));
    cleanups.push(on(doc, "pointerup", onPointerUp));
    cleanups.push(on(doc, "pointercancel", onPointerCancel));
    cleanups.push(on(content, "lostpointercapture", onLostPointerCapture));
  }

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
      return items.length;
    },
    get canScrollPrev() {
      return canScrollPrev();
    },
    get canScrollNext() {
      return canScrollNext();
    },
    destroy() {
      if (scrollRafId !== null) {
        win.cancelAnimationFrame(scrollRafId);
        scrollRafId = null;
      }

      clearProgrammaticScrollLock();
      stopDragging(null, false);

      if (drag) {
        content.style.touchAction = previousTouchAction ?? "";
        previousTouchAction = null;
      }
      restoreDragScrollSnap();
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      drainCleanups(cleanups);
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
