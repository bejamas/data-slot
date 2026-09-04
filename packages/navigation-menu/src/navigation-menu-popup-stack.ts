import {
  createPortalLifecycle,
  createPresenceLifecycle,
} from "@data-slot/core";

type Size = { width: number; height: number };
export type ViewportLayoutMode =
  "initial-open" | "measure-target" | "sync-current";

export interface NavigationMenuPopupStackOptions {
  root: Element;
  viewport: HTMLElement | null;
  isDestroyed(): boolean;
  beforeRestore(): void;
}

interface PopupPositionState {
  applied: boolean;
  bottom: string;
  left: string;
  position: string;
  right: string;
  top: string;
}

interface Stack {
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

const cssDimensions = (element: Element): Size => {
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

/** Owns the transient popup/positioner/portal stack and its size transition state. */
export interface NavigationMenuPopupStack {
  readonly popup: HTMLElement | null;
  readonly positioner: HTMLElement | null;
  readonly closing: boolean;
  ensure(): boolean;
  prepareOpen(): void;
  reveal(initial: boolean): void;
  close(baseline: Size): void;
  baseline(): Size;
  isSizeTransitioning(): boolean;
  measure(mode: ViewportLayoutMode, fallback: Size): Size;
  commitSize(mode: ViewportLayoutMode, nextSize: Size): void;
  setViewportSize(width: number, height: number): void;
  setPositionerSize(positioner: HTMLElement, size: Size | "max-content"): void;
  setRuntimePosition(preset: "top" | "left" | null): void;
  destroy(): void;
}

export function createNavigationMenuPopupStack(
  options: NavigationMenuPopupStackOptions,
): NavigationMenuPopupStack {
  const popupPositionState = new WeakMap<HTMLElement, PopupPositionState>();
  let popupStack: Stack | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let size = {
    committed: { width: 0, height: 0 },
    live: { width: 0, height: 0 },
  };
  const getPopup = () => popupStack?.popup ?? findParts().popup;
  const getPositioner = () => popupStack?.positioner ?? findParts().positioner;

  const ensure = (): boolean => {
    const { viewport, root } = options;
    if (!viewport) return false;
    if (popupStack) return true;
    const found = findParts();
    let popup = found.popup;
    let positioner = found.positioner;
    let portal = found.portal;
    let generatedPopup = false,
      generatedPositioner = false,
      generatedPortal = false;
    if (!popup || !popup.contains(viewport)) {
      popup = wrap(viewport, "navigation-menu-popup");
      generatedPopup = true;
    }
    if (!positioner || !positioner.contains(popup)) {
      positioner = wrap(popup, "navigation-menu-positioner");
      generatedPositioner = true;
    }
    if (!portal || !portal.contains(positioner)) {
      portal = wrap(positioner, "navigation-menu-portal");
      generatedPortal = true;
    }
    const popupPortal = createPortalLifecycle({
      content: popup,
      root,
      enabled: true,
      container: positioner,
      mountTarget: portal,
    });
    let stack: Stack;
    const viewportPresence = createPresenceLifecycle({
      element: viewport,
      onExitComplete: () => {
        stack.viewportExitComplete = true;
        maybeTeardown(stack);
      },
    });
    const popupPresence = createPresenceLifecycle({
      element: popup,
      onExitComplete: () => {
        stack.popupExitComplete = true;
        maybeTeardown(stack);
      },
    });
    stack = {
      popup,
      positioner,
      portal,
      popupPortal,
      popupPresence,
      viewportPresence,
      generatedPopup,
      generatedPositioner,
      generatedPortal,
      isClosing: false,
      popupExitComplete: false,
      viewportExitComplete: false,
    };
    popupStack = stack;
    observe(popup);
    return true;
  };

  const prepareOpen = () => {
    if (!ensure()) return;
    const stack = popupStack!;
    stack.popupPortal.mount();
    stack.isClosing = false;
    stack.popupExitComplete = false;
    stack.viewportExitComplete = false;
  };

  const reveal = (initial: boolean) => {
    const stack = popupStack;
    const viewport = options.viewport;
    if (!stack || !viewport) return;
    stack.popup.hidden = false;
    stack.popup.style.pointerEvents = "auto";
    viewport.hidden = false;
    if (initial) {
      stack.popupPresence.enter();
      stack.viewportPresence.enter();
    }
  };

  const close = (baseline: Size) => {
    const stack = popupStack;
    if (!stack) return;
    if (baseline.width > 0 && baseline.height > 0) {
      setPopupSize(stack.popup, baseline);
      setPositionerSize(stack.positioner, baseline);
      setViewportSize(baseline.width, baseline.height);
    }
    stack.isClosing = true;
    stack.popupExitComplete = false;
    stack.viewportExitComplete = false;
    stack.popupPresence.exit();
    stack.viewportPresence.exit();
  };

  const baseline = (): Size => {
    const popup = getPopup();
    if (!popup) return { ...size.committed };
    const measured = cssDimensions(popup);
    const baseline = {
      width:
        popup.offsetWidth ||
        measured.width ||
        size.live.width ||
        size.committed.width,
      height:
        popup.offsetHeight ||
        measured.height ||
        size.live.height ||
        size.committed.height,
    };
    rememberLive(baseline);
    return baseline;
  };

  const isSizeTransitioning = () => {
    const committed = size.committed;
    if (committed.width <= 0 || committed.height <= 0) return false;
    const rendered = baseline();
    return (
      Math.abs(rendered.width - committed.width) > 1 ||
      Math.abs(rendered.height - committed.height) > 1
    );
  };

  const measure = (mode: ViewportLayoutMode, fallback: Size): Size => {
    if (!ensure()) return fallback;
    const stack = popupStack!;
    const before = { ...size.committed };
    const measured =
      mode === "sync-current" ? baseline() : measureTarget(stack);
    const measuredSize = {
      width:
        mode === "sync-current"
          ? before.width || measured.width || fallback.width
          : measured.width || fallback.width,
      height:
        mode === "sync-current"
          ? before.height || measured.height || fallback.height
          : measured.height || fallback.height,
    };
    rememberLive(
      measured.width > 0 && measured.height > 0 ? measured : measuredSize,
    );
    if (mode !== "sync-current") rememberCommitted(measuredSize);
    return measuredSize;
  };

  const commitSize = (mode: ViewportLayoutMode, nextSize: Size) => {
    const popup = getPopup();
    if (!popup) return;
    if (mode !== "sync-current") {
      setPopupSize(popup, nextSize);
      return;
    }
    if (
      !popup.style.getPropertyValue("--popup-width").trim() ||
      !popup.style.getPropertyValue("--popup-height").trim()
    ) {
      setPopupSize(popup, {
        width: size.committed.width || nextSize.width,
        height: size.committed.height || nextSize.height,
      });
    }
  };

  const setViewportSize = (width: number, height: number) => {
    const viewport = options.viewport;
    if (!viewport) return;
    viewport.style.setProperty("--viewport-width", `${width}px`);
    viewport.style.setProperty("--viewport-height", `${height}px`);
  };
  const setPositionerSize = (
    positioner: HTMLElement,
    size: Size | "max-content",
  ) => {
    positioner.style.setProperty(
      "--positioner-width",
      size === "max-content" ? "max-content" : `${size.width}px`,
    );
    positioner.style.setProperty(
      "--positioner-height",
      size === "max-content" ? "max-content" : `${size.height}px`,
    );
  };
  const setRuntimePosition = (preset: "top" | "left" | null) => {
    const popup = getPopup();
    if (!popup) return;
    if (preset === null) {
      restorePosition(popup);
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
    if (!state.applied)
      Object.assign(state, {
        position: popup.style.position,
        top: popup.style.top,
        right: popup.style.right,
        bottom: popup.style.bottom,
        left: popup.style.left,
      });
    state.applied = true;
    popupPositionState.set(popup, state);
    popup.style.position = "absolute";
    if (preset === "top")
      Object.assign(popup.style, {
        top: "",
        right: "",
        bottom: "0px",
        left: "0px",
      });
    else
      Object.assign(popup.style, {
        top: "0px",
        right: "0px",
        bottom: "",
        left: "",
      });
  };

  const destroy = () => {
    teardown(true);
  };

  const maybeTeardown = (stack: Stack) => {
    if (
      options.isDestroyed() ||
      popupStack !== stack ||
      !stack.isClosing ||
      !stack.popupExitComplete ||
      !stack.viewportExitComplete
    )
      return;
    teardown(false);
  };
  const teardown = (force: boolean) => {
    const stack = popupStack;
    const viewport = options.viewport;
    if (!stack || !viewport || (!force && options.isDestroyed())) return;
    resizeObserver?.disconnect();
    resizeObserver = null;
    options.beforeRestore();
    resetStyles(stack);
    size = {
      committed: { width: 0, height: 0 },
      live: { width: 0, height: 0 },
    };
    viewport.hidden = true;
    viewport.style.pointerEvents = "none";
    stack.popup.hidden = true;
    stack.popup.style.pointerEvents = "none";
    stack.popupPortal.restore();
    if (stack.generatedPopup) unwrap(stack.popup);
    if (stack.generatedPositioner) unwrap(stack.positioner);
    if (stack.generatedPortal) unwrap(stack.portal);
    stack.popupPresence.cleanup();
    stack.viewportPresence.cleanup();
    popupStack = null;
  };
  const findParts = () => {
    const viewport = options.viewport,
      root = options.root;
    if (!viewport)
      return {
        popup: null as HTMLElement | null,
        positioner: null as HTMLElement | null,
        portal: null as HTMLElement | null,
      };
    let popup: HTMLElement | null = null,
      positioner: HTMLElement | null = null,
      portal: HTMLElement | null = null;
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
  const wrap = (child: HTMLElement, slot: string) => {
    const wrapper = (options.root.ownerDocument ?? document).createElement(
      "div",
    );
    wrapper.setAttribute("data-slot", slot);
    if (slot === "navigation-menu-positioner") {
      wrapper.style.isolation = "isolate";
      wrapper.style.zIndex = "50";
    }
    const parent = child.parentNode;
    if (!parent)
      throw new Error(
        "NavigationMenu expected popup stack child to have a parent node",
      );
    parent.insertBefore(wrapper, child);
    wrapper.appendChild(child);
    return wrapper;
  };
  const unwrap = (wrapper: HTMLElement) => {
    const parent = wrapper.parentNode;
    if (!parent) return;
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  };
  const observe = (popup: HTMLElement) => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (typeof ResizeObserver !== "function") return;
    resizeObserver = new ResizeObserver((entries) => {
      const e = entries[0];
      const box = Array.isArray(e?.borderBoxSize)
        ? e.borderBoxSize[0]
        : undefined;
      rememberLive({
        width: Math.ceil(box?.inlineSize ?? popup.offsetWidth),
        height: Math.ceil(box?.blockSize ?? popup.offsetHeight),
      });
    });
    resizeObserver.observe(popup);
  };
  const rememberCommitted = (nextSize: Size) => {
    if (nextSize.width > 0) size.committed.width = nextSize.width;
    if (nextSize.height > 0) size.committed.height = nextSize.height;
  };
  const rememberLive = (nextSize: Size) => {
    if (nextSize.width > 0) size.live.width = nextSize.width;
    if (nextSize.height > 0) size.live.height = nextSize.height;
  };
  const setPopupSize = (popup: HTMLElement, size: Size) => {
    popup.style.setProperty("--popup-width", `${size.width}px`);
    popup.style.setProperty("--popup-height", `${size.height}px`);
  };
  const measureTarget = (stack: Stack) => {
    const restore = (element: HTMLElement, styles: Record<string, string>) => {
      const previous = new Map<string, string>();
      for (const [key, value] of Object.entries(styles)) {
        previous.set(key, element.style.getPropertyValue(key));
        element.style.setProperty(key, value);
      }
      return () => {
        for (const [key, value] of previous)
          value
            ? element.style.setProperty(key, value)
            : element.style.removeProperty(key);
      };
    };
    const restorePopup = restore(stack.popup, {
      "--popup-width": "auto",
      "--popup-height": "auto",
      position: "static",
      transform: "none",
      scale: "1",
      top: "",
      right: "",
      bottom: "",
      left: "",
    });
    const restorePositioner = restore(stack.positioner, {
      "--positioner-width": "max-content",
      "--positioner-height": "max-content",
      "--available-width": "max-content",
      "--available-height": "max-content",
    });
    const measured = cssDimensions(stack.popup);
    restorePositioner();
    restorePopup();
    return measured;
  };
  const restorePosition = (popup: HTMLElement) => {
    const state = popupPositionState.get(popup);
    if (!state?.applied) return;
    for (const key of ["position", "top", "right", "bottom", "left"] as const)
      state[key]
        ? popup.style.setProperty(key, state[key])
        : popup.style.removeProperty(key);
    state.applied = false;
  };
  const resetStyles = (stack: Stack) => {
    const p = stack.positioner;
    Object.assign(p.style, {
      position: "",
      top: "",
      left: "",
      margin: "",
      willChange: "",
      pointerEvents: "",
      transform: "",
    });
    for (const key of [
      "--transform-origin",
      "--positioner-width",
      "--positioner-height",
      "--available-width",
      "--available-height",
    ])
      p.style.removeProperty(key);
    const popup = stack.popup;
    Object.assign(popup.style, { willChange: "", pointerEvents: "" });
    restorePosition(popup);
    popup.style.removeProperty("scale");
    popup.style.removeProperty("--transform-origin");
    popup.style.removeProperty("--popup-width");
    popup.style.removeProperty("--popup-height");
    const v = options.viewport;
    if (v) {
      Object.assign(v.style, { top: "", left: "", willChange: "" });
      for (const key of [
        "--transform-origin",
        "--viewport-width",
        "--viewport-height",
      ])
        v.style.removeProperty(key);
    }
  };

  return {
    get popup() {
      return getPopup();
    },
    get positioner() {
      return getPositioner();
    },
    get closing() {
      return !!popupStack?.isClosing;
    },
    ensure,
    prepareOpen,
    reveal,
    close,
    baseline,
    isSizeTransitioning,
    measure,
    commitSize,
    setViewportSize,
    setPositionerSize,
    setRuntimePosition,
    destroy,
  };
}
