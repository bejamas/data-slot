import { on } from "./events.ts";
import { containsWithPortals, portalToBody, restorePortal } from "./parts.ts";
import type { PortalState } from "./parts.ts";

export * from "./popup-geometry";

export interface PositionSyncOptions {
  onUpdate: () => void;
  isActive?: () => boolean;
  observedElements?: readonly Element[];
  ignoreScrollTarget?: (target: EventTarget | null) => boolean;
  ancestorScroll?: boolean;
  syncOnScroll?: boolean;
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
  const syncOnScroll = options.syncOnScroll ?? false;
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
  const cancelScheduled = () => {
    if (rafId !== null) {
      win.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const onResize = () => schedule();
  const onScroll = (e: Event) => {
    if (options.ignoreScrollTarget?.(e.target)) return;
    if (syncOnScroll) {
      cancelScheduled();
      if (isActive()) options.onUpdate();
      return;
    }
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
      cancelScheduled();
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
