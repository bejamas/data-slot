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
} from "@data-slot/core";

const ORIENTATIONS = ["horizontal", "vertical"] as const;
type CarouselSetDetail = { index?: number; action?: "next" | "prev" };

export interface CarouselOptions {
  /** Initial slide index */
  defaultIndex?: number;
  /** Carousel orientation */
  orientation?: "horizontal" | "vertical";
  /** Enable soft-wrap looping for keyboard/button/API navigation */
  loop?: boolean;
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
  const content = getPart<HTMLElement>(root, "carousel-content");
  if (!content) {
    throw new Error("Carousel requires carousel-content and at least one carousel-item");
  }

  const collectItems = () =>
    Array.from(content.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.getAttribute("data-slot") === "carousel-item",
    );

  let items = collectItems();
  if (items.length === 0) {
    throw new Error("Carousel requires carousel-content and at least one carousel-item");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  const orientation =
    options.orientation ??
    getDataEnum(root, "orientation", ORIENTATIONS) ??
    "horizontal";
  const loop = options.loop ?? getDataBool(root, "loop") ?? false;
  const defaultIndex =
    options.defaultIndex ?? getDataNumber(root, "defaultIndex") ?? 0;
  const onIndexChange = options.onIndexChange;

  const isHorizontal = orientation === "horizontal";
  const previousControls = getParts<HTMLElement>(root, "carousel-previous");
  const nextControls = getParts<HTMLElement>(root, "carousel-next");

  const cleanups: Array<() => void> = [];
  const win = root.ownerDocument?.defaultView ?? window;

  let currentIndex = normalizeIndex(defaultIndex, items.length, loop);
  let snapPoints: number[] = [];
  let scrollRafId: number | null = null;

  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  const getAxisPosition = () => (isHorizontal ? content.scrollLeft : content.scrollTop);

  const getSnapPointForItem = (item: HTMLElement): number => {
    const contentRect = content.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    if (isHorizontal) {
      return itemRect.left - contentRect.left + content.scrollLeft;
    }

    return itemRect.top - contentRect.top + content.scrollTop;
  };

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

  const updateStates = (emitChange: boolean) => {
    root.setAttribute("data-index", String(currentIndex));

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      const active = i === currentIndex;
      item.setAttribute("data-state", active ? "active" : "inactive");
      setAria(item, "hidden", !active);
    }

    updateControls();

    if (emitChange) {
      emit(root, "carousel:change", { index: currentIndex });
      onIndexChange?.(currentIndex);
    }
  };

  const scrollToCurrent = () => {
    if (items.length === 0) return;

    const target = snapPoints[currentIndex] ?? 0;
    if (isHorizontal) {
      content.scrollTo({ left: target, behavior: "auto" });
      return;
    }

    content.scrollTo({ top: target, behavior: "auto" });
  };

  const measureSnapPoints = () => {
    snapPoints = items.map((item) => getSnapPointForItem(item));
  };

  const rebindResizeObserver = () => {
    if (typeof ResizeObserver === "undefined") return;

    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => {
      measureSnapPoints();
      scrollToCurrent();
      updateStates(false);
    });

    resizeObserver.observe(content);
    for (const item of items) {
      resizeObserver.observe(item);
    }
  };

  const refreshItems = (emitChange: boolean) => {
    items = collectItems();

    if (items.length === 0) {
      snapPoints = [];
      currentIndex = 0;
      root.setAttribute("data-index", "0");
      updateControls();
      return;
    }

    const nextIndex = normalizeIndex(currentIndex, items.length, loop);
    const changed = nextIndex !== currentIndex;
    currentIndex = nextIndex;

    updateStaticA11y();
    measureSnapPoints();
    scrollToCurrent();
    updateStates(emitChange && changed);
    rebindResizeObserver();
  };

  const setIndex = (
    requestedIndex: number,
    emitChange: boolean,
    scroll: boolean,
  ) => {
    if (items.length === 0) return;

    const nextIndex = normalizeIndex(requestedIndex, items.length, loop);
    const changed = nextIndex !== currentIndex;
    currentIndex = nextIndex;

    if (scroll) {
      scrollToCurrent();
    }

    updateStates(changed && emitChange);
  };

  const prev = () => {
    if (items.length === 0) return;
    if (!loop && currentIndex <= 0) return;
    setIndex(currentIndex - 1, true, true);
  };

  const next = () => {
    if (items.length === 0) return;
    if (!loop && currentIndex >= items.length - 1) return;
    setIndex(currentIndex + 1, true, true);
  };

  const onScroll = () => {
    if (scrollRafId !== null) return;

    scrollRafId = win.requestAnimationFrame(() => {
      scrollRafId = null;
      if (items.length === 0) return;

      const nearest = getNearestIndex(getAxisPosition());
      setIndex(nearest, true, false);
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return;

    switch (event.key) {
      case "ArrowLeft":
        if (!isHorizontal) return;
        event.preventDefault();
        prev();
        return;
      case "ArrowRight":
        if (!isHorizontal) return;
        event.preventDefault();
        next();
        return;
      case "ArrowUp":
        if (isHorizontal) return;
        event.preventDefault();
        prev();
        return;
      case "ArrowDown":
        if (isHorizontal) return;
        event.preventDefault();
        next();
        return;
      case "Home":
        event.preventDefault();
        setIndex(0, true, true);
        return;
      case "End":
        event.preventDefault();
        setIndex(items.length - 1, true, true);
        return;
      default:
        return;
    }
  };

  const onSet = (event: Event) => {
    const detail = (event as CustomEvent<CarouselSetDetail>).detail;
    if (!detail || typeof detail !== "object") return;

    if (typeof detail.index === "number") {
      setIndex(detail.index, true, true);
      return;
    }

    if (detail.action === "next") {
      next();
    } else if (detail.action === "prev") {
      prev();
    }
  };

  measureSnapPoints();
  updateStaticA11y();
  scrollToCurrent();
  updateStates(false);

  cleanups.push(on(content, "scroll", onScroll));
  cleanups.push(on(root, "keydown", onKeyDown, { capture: true }));
  cleanups.push(on(root, "carousel:set", onSet));

  for (const control of previousControls) {
    cleanups.push(on(control, "click", () => prev()));
  }

  for (const control of nextControls) {
    cleanups.push(on(control, "click", () => next()));
  }

  rebindResizeObserver();

  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(() => {
      refreshItems(true);
    });
    mutationObserver.observe(content, { childList: true });
  }

  const controller: CarouselController = {
    prev,
    next,
    goTo(index) {
      setIndex(index, true, true);
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

      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all carousel components in a scope.
 * Returns array of controllers for programmatic access.
 */
export function create(scope: ParentNode = document): CarouselController[] {
  const controllers: CarouselController[] = [];

  for (const root of getRoots(scope, "carousel")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createCarousel(root));
  }

  return controllers;
}
