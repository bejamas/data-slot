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

  let isOpen = defaultOpen;
  const cleanups: Array<() => void> = [];
  let sizeObserver: ResizeObserver | null = null;

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

  const setPanelSizeVars = (height: number, width: number) => {
    content.style.setProperty("--collapsible-panel-height", `${height}px`);
    content.style.setProperty("--collapsible-panel-width", `${width}px`);
  };

  const syncPanelSizeVars = () => {
    setPanelSizeVars(content.scrollHeight, content.scrollWidth);
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
    setPanelSizeVars(0, 0);
  };

  const presence = createPresenceLifecycle({
    element: content,
    onExitComplete: () => {
      applyClosedVisibility();
    },
  });

  const updateState = (open: boolean) => {
    if (isOpen === open) return;

    isOpen = open;
    setAria(trigger, "expanded", isOpen);
    setDataState(isOpen ? "open" : "closed");

    if (isOpen) {
      applyOpenVisibility();
      syncPanelSizeVars();
      presence.enter();
    } else {
      syncPanelSizeVars();
      presence.exit();
    }

    emit(root, "collapsible:change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  // Initialize state
  setAria(trigger, "expanded", isOpen);
  if (isOpen) {
    applyOpenVisibility();
    syncPanelSizeVars();
  } else {
    applyClosedVisibility();
  }
  setDataState(isOpen ? "open" : "closed");

  if (typeof ResizeObserver !== "undefined") {
    sizeObserver = new ResizeObserver(() => {
      if (isOpen) {
        syncPanelSizeVars();
      }
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
