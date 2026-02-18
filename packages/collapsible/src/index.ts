import {
  getPart,
  getRoots,
  getDataBool,
  setAria,
  ensureId,
  on,
  emit,
  createPresenceLifecycle,
} from "@data-slot/core";

export interface CollapsibleOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /**
   * Use hidden="until-found" when closed so browser find-in-page can reveal content.
   * @default false
   */
  hiddenUntilFound?: boolean;
  /**
   * Callback when open state changes.
   * Note: Not called on initial render, only on subsequent state changes.
   */
  onOpenChange?: (open: boolean) => void;
}

export interface CollapsibleController {
  /** Open the collapsible */
  open(): void;
  /** Close the collapsible */
  close(): void;
  /** Toggle the collapsible */
  toggle(): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

const parseTimingToMs = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (trimmed.endsWith("ms")) {
    return Number.parseFloat(trimmed.slice(0, -2)) || 0;
  }

  if (trimmed.endsWith("s")) {
    return (Number.parseFloat(trimmed.slice(0, -1)) || 0) * 1000;
  }

  return Number.parseFloat(trimmed) || 0;
};

const getMaxTimingMs = (durationsValue: string, delaysValue: string): number => {
  const durations = durationsValue.split(",");
  const delays = delaysValue.split(",");
  const len = Math.max(durations.length, delays.length);
  let max = 0;

  for (let i = 0; i < len; i += 1) {
    const duration = parseTimingToMs(durations[i] ?? durations[durations.length - 1] ?? "0");
    const delay = parseTimingToMs(delays[i] ?? delays[delays.length - 1] ?? "0");
    max = Math.max(max, duration + delay);
  }

  return max;
};

const getMaxPresenceDurationMs = (element: HTMLElement): number => {
  const style = getComputedStyle(element);
  const transitionMs = getMaxTimingMs(style.transitionDuration, style.transitionDelay);
  const animationMs = getMaxTimingMs(style.animationDuration, style.animationDelay);
  return Math.max(transitionMs, animationMs);
};

/**
 * Create a collapsible controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="collapsible">
 *   <button data-slot="collapsible-trigger">Toggle</button>
 *   <div data-slot="collapsible-content">Content here</div>
 * </div>
 * ```
 */
export function createCollapsible(
  root: Element,
  options: CollapsibleOptions = {}
): CollapsibleController {
  // Resolve options with explicit precedence: JS > data-* > default
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const hiddenUntilFound =
    options.hiddenUntilFound ?? getDataBool(root, "hiddenUntilFound") ?? false;
  const onOpenChange = options.onOpenChange;

  const trigger = getPart<HTMLElement>(root, "collapsible-trigger");
  const content = getPart<HTMLElement>(root, "collapsible-content");

  if (!trigger || !content) {
    throw new Error("Collapsible requires trigger and content slots");
  }

  const win = root.ownerDocument?.defaultView ?? window;
  let isOpen = defaultOpen;
  const cleanups: Array<() => void> = [];
  let sizeObserver: ResizeObserver | null = null;
  let openSettleRafId: number | null = null;
  let openSettleTimeoutId: number | null = null;
  let closeZeroRafId: number | null = null;
  let openSettleCleanups: Array<() => void> = [];

  // Setup ARIA
  const contentId = ensureId(content, "collapsible-content");
  const triggerId = ensureId(trigger, "collapsible-trigger");
  trigger.setAttribute("aria-controls", contentId);
  content.setAttribute("role", "region");
  content.setAttribute("aria-labelledby", triggerId);

  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
  };

  const setPanelSizeVars = (height: string, width: string) => {
    content.style.setProperty("--collapsible-panel-height", height);
    content.style.setProperty("--collapsible-panel-width", width);
  };

  const setPanelSizePx = (height: number, width: number) => {
    setPanelSizeVars(`${height}px`, `${width}px`);
  };

  const setPanelSizeAuto = () => {
    setPanelSizeVars("auto", "auto");
  };

  const setPanelSizeZero = () => {
    setPanelSizePx(0, 0);
  };

  const syncPanelSizePx = () => {
    setPanelSizePx(content.scrollHeight, content.scrollWidth);
  };

  const hasAutoPanelSize = () => {
    const height = content.style.getPropertyValue("--collapsible-panel-height").trim();
    const width = content.style.getPropertyValue("--collapsible-panel-width").trim();
    return height === "auto" && width === "auto";
  };

  const clearOpenSettleTracking = () => {
    if (openSettleRafId !== null) {
      win.cancelAnimationFrame(openSettleRafId);
      openSettleRafId = null;
    }

    if (openSettleTimeoutId !== null) {
      win.clearTimeout(openSettleTimeoutId);
      openSettleTimeoutId = null;
    }

    openSettleCleanups.forEach((cleanup) => cleanup());
    openSettleCleanups = [];
  };

  const clearClosePhaseTracking = () => {
    if (closeZeroRafId !== null) {
      win.cancelAnimationFrame(closeZeroRafId);
      closeZeroRafId = null;
    }
  };

  const clearSizePhaseTracking = () => {
    clearOpenSettleTracking();
    clearClosePhaseTracking();
  };

  const applyOpenVisibility = () => {
    content.removeAttribute("hidden");
  };

  const applyClosedVisibility = () => {
    if (hiddenUntilFound) {
      content.setAttribute("hidden", "until-found");
    } else {
      content.hidden = true;
    }
    setPanelSizeZero();
  };

  const finishOpenSettle = () => {
    clearOpenSettleTracking();
    if (!isOpen || presence.isExiting) return;
    setPanelSizeAuto();
  };

  const scheduleOpenSettle = () => {
    clearOpenSettleTracking();

    const maxDuration = getMaxPresenceDurationMs(content);

    if (maxDuration > 0) {
      const onEnd = (event: Event) => {
        if (event.target !== content) return;
        finishOpenSettle();
      };

      content.addEventListener("transitionend", onEnd);
      content.addEventListener("animationend", onEnd);
      openSettleCleanups.push(() => content.removeEventListener("transitionend", onEnd));
      openSettleCleanups.push(() => content.removeEventListener("animationend", onEnd));

      openSettleTimeoutId = win.setTimeout(() => {
        openSettleTimeoutId = null;
        finishOpenSettle();
      }, Math.ceil(maxDuration) + 50);

      return;
    }

    openSettleRafId = win.requestAnimationFrame(() => {
      openSettleRafId = null;
      finishOpenSettle();
    });
  };

  const scheduleCloseToZero = () => {
    clearClosePhaseTracking();

    closeZeroRafId = win.requestAnimationFrame(() => {
      closeZeroRafId = null;
      if (!isOpen && presence.isExiting) {
        setPanelSizeZero();
      }
    });
  };

  const presence = createPresenceLifecycle({
    element: content,
    onExitComplete: () => {
      clearClosePhaseTracking();
      applyClosedVisibility();
    },
  });

  const updateState = (open: boolean) => {
    if (isOpen === open) return;

    isOpen = open;
    setAria(trigger, "expanded", isOpen);
    setDataState(isOpen ? "open" : "closed");

    if (isOpen) {
      clearClosePhaseTracking();
      applyOpenVisibility();
      syncPanelSizePx();
      presence.enter();
      scheduleOpenSettle();
    } else {
      clearOpenSettleTracking();
      syncPanelSizePx();
      presence.exit();
      scheduleCloseToZero();
    }

    emit(root, "collapsible:change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  // Initialize state
  setAria(trigger, "expanded", isOpen);
  if (isOpen) {
    applyOpenVisibility();
    syncPanelSizePx();
    scheduleOpenSettle();
  } else {
    applyClosedVisibility();
  }
  setDataState(isOpen ? "open" : "closed");

  if (typeof ResizeObserver !== "undefined") {
    sizeObserver = new ResizeObserver(() => {
      if (!isOpen || presence.isExiting) return;
      if (hasAutoPanelSize()) return;
      syncPanelSizePx();
    });
    sizeObserver.observe(content);
  }

  // Event handlers - guard against disabled trigger
  cleanups.push(
    on(trigger, "click", () => {
      if (
        trigger.hasAttribute("disabled") ||
        trigger.getAttribute("aria-disabled") === "true"
      )
        return;
      updateState(!isOpen);
    })
  );

  if (hiddenUntilFound) {
    cleanups.push(
      on(content, "beforematch", () => {
        if (!isOpen) updateState(true);
      })
    );
  }

  // Inbound event - blocked when trigger is disabled (consistent with click behavior)
  cleanups.push(
    on(root, "collapsible:set", (e) => {
      if (
        trigger.hasAttribute("disabled") ||
        trigger.getAttribute("aria-disabled") === "true"
      )
        return;
      const detail = (e as CustomEvent).detail;
      // Preferred: { open: boolean }
      // Deprecated: { value: boolean }
      let open: boolean | undefined;
      if (detail?.open !== undefined) {
        open = detail.open;
      } else if (detail?.value !== undefined) {
        open = detail.value;
      }
      if (typeof open === "boolean") updateState(open);
    })
  );

  const controller: CollapsibleController = {
    open: () => updateState(true),
    close: () => updateState(false),
    toggle: () => updateState(!isOpen),
    get isOpen() {
      return isOpen;
    },
    destroy: () => {
      presence.cleanup();
      clearSizePhaseTracking();
      sizeObserver?.disconnect();
      sizeObserver = null;
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      bound.delete(root);
    },
  };

  return controller;
}

/**
 * Find and bind all collapsible components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): CollapsibleController[] {
  const controllers: CollapsibleController[] = [];

  for (const root of getRoots(scope, "collapsible")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createCollapsible(root));
  }

  return controllers;
}
