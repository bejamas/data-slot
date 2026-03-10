import {
  getPart,
  getRoots,
  getDataBool,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
} from "@data-slot/core";
import { setAria, ensureId, linkLabelledBy } from "@data-slot/core";
import { on, emit } from "@data-slot/core";
import { lockScroll, unlockScroll } from "@data-slot/core";
import {
  createPortalLifecycle,
  createDismissLayer,
  createPresenceLifecycle,
  focusElement,
} from "@data-slot/core";

export interface DialogOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Close when clicking overlay */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape */
  closeOnEscape?: boolean;
  /** Lock body scroll when open */
  lockScroll?: boolean;
  /** Use alertdialog role for blocking confirmations */
  alertDialog?: boolean;
}

export interface DialogController {
  /** Open the dialog */
  open(): void;
  /** Close the dialog */
  close(): void;
  /** Toggle the dialog */
  toggle(): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
  /** Internal: handle keydown for focus trap (used by global handler) */
  _handleKeydown?(e: KeyboardEvent): void;
  /** Internal: content element for focus trap */
  _content?: HTMLElement;
  /** Internal: overlay element for stack metadata */
  _overlay?: HTMLElement;
}

const ROOT_BINDING_KEY = "@data-slot/dialog";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/dialog] createDialog() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

// Focusable element selector
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Dialog stack for focus-trap routing
const dialogStack: DialogController[] = [];

// Single global keydown handler
let globalKeydownCleanup: (() => void) | null = null;

// Reindex dialog stack metadata (no hardcoded z-index; styling stays in user CSS)
function reindexStack() {
  dialogStack.forEach((d, idx) => {
    const stackIndex = String(idx);
    if (d._overlay) {
      d._overlay.setAttribute("data-stack-index", stackIndex);
      d._overlay.style.setProperty("--dialog-stack-index", stackIndex);
      d._overlay.style.setProperty("--dialog-overlay-stack-index", stackIndex);
    }
    if (d._content) {
      d._content.setAttribute("data-stack-index", stackIndex);
      d._content.style.setProperty("--dialog-stack-index", stackIndex);
      d._content.style.setProperty("--dialog-content-stack-index", stackIndex);
    }
  });
}

function setupGlobalKeydownHandler() {
  if (globalKeydownCleanup) return;

  const handler = (e: KeyboardEvent) => {
    if (dialogStack.length === 0) return;

    const topmost = dialogStack[dialogStack.length - 1];
    if (!topmost || !topmost.isOpen) return;

    // Tab key - focus trap handled by each dialog
    if (e.key === "Tab" && topmost._handleKeydown) {
      topmost._handleKeydown(e);
    }
  };

  const cleanup = on(document, "keydown", handler);
  globalKeydownCleanup = () => {
    cleanup();
    globalKeydownCleanup = null;
  };
}

function teardownGlobalKeydownHandler() {
  if (dialogStack.length === 0 && globalKeydownCleanup) {
    globalKeydownCleanup();
  }
}

/**
 * Create a dialog controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="dialog">
 *   <button data-slot="dialog-trigger">Open</button>
 *   <div data-slot="dialog-portal">
 *     <div data-slot="dialog-overlay"></div>
 *     <div data-slot="dialog-content">
 *       <h2 data-slot="dialog-title">Title</h2>
 *       <p data-slot="dialog-description">Description</p>
 *       <button data-slot="dialog-close">Close</button>
 *     </div>
 *   </div>
 * </div>
 * ```
 *
 * Note: Overlay is required. The optional dialog-portal slot will be
 * automatically moved to document.body to escape stacking context issues.
 */
export function createDialog(
  root: Element,
  options: DialogOptions = {}
): DialogController {
  const existingController = reuseRootBinding<DialogController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  // Resolve options with explicit precedence: JS > data-* > default
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const onOpenChange = options.onOpenChange;
  const closeOnClickOutside = options.closeOnClickOutside ?? getDataBool(root, "closeOnClickOutside") ?? true;
  const closeOnEscape = options.closeOnEscape ?? getDataBool(root, "closeOnEscape") ?? true;
  const lockScrollOption = options.lockScroll ?? getDataBool(root, "lockScroll") ?? true;
  const alertDialog = options.alertDialog ?? getDataBool(root, "alertDialog") ?? false;

  const trigger = getPart<HTMLElement>(root, "dialog-trigger");
  const portal = getPart<HTMLElement>(root, "dialog-portal");
  const overlay = getPart<HTMLElement>(root, "dialog-overlay");
  const content = getPart<HTMLElement>(root, "dialog-content");
  const title = getPart<HTMLElement>(root, "dialog-title");
  const description = getPart<HTMLElement>(root, "dialog-description");

  if (!content) {
    throw new Error("Dialog requires dialog-content slot");
  }
  if (!overlay) {
    throw new Error("Dialog requires dialog-overlay slot");
  }

  let isOpen = false;
  let isDestroyed = false;
  let previousActiveElement: HTMLElement | null = null;
  const cleanups: Array<() => void> = [];

  const portalLifecycle = portal
    ? createPortalLifecycle({ content: portal, root })
    : null;

  // Track if this dialog locked scroll (prevent underflow)
  let didLockScroll = false;

  // ARIA setup
  ensureId(content, "dialog-content");
  content.setAttribute("role", alertDialog ? "alertdialog" : "dialog");
  setAria(content, "modal", true);
  linkLabelledBy(content, title, description);

  // Overlay is purely presentational
  overlay.setAttribute("role", "presentation");
  overlay.setAttribute("aria-hidden", "true");
  overlay.tabIndex = -1;

  if (trigger) {
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", content.id);
    setAria(trigger, "expanded", false);
  }

  // Track if we added tabindex (so we can clean it up)
  let addedTabIndex = false;

  const ensureContentFocusable = () => {
    if (!content.hasAttribute("tabindex")) {
      content.tabIndex = -1;
      addedTabIndex = true;
    }
  };

  const cleanupContentFocusable = () => {
    if (addedTabIndex) {
      content.removeAttribute("tabindex");
      addedTabIndex = false;
    }
  };

  const focusFirst = () => {
    const autofocusEl = content.querySelector<HTMLElement>("[autofocus]");
    if (autofocusEl) return autofocusEl.focus();

    const first = content.querySelector<HTMLElement>(FOCUSABLE);
    if (first) return first.focus();

    ensureContentFocusable();
    content.focus();
  };

  const mountPortal = () => {
    portalLifecycle?.mount();
  };

  const restoreFocus = () => {
    requestAnimationFrame(() => {
      if (
        previousActiveElement &&
        document.contains(previousActiveElement) &&
        typeof previousActiveElement.focus === "function"
      ) {
        focusElement(previousActiveElement);
      } else if (trigger && document.contains(trigger)) {
        focusElement(trigger);
      }
      previousActiveElement = null;
    });
  };

  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    if (portal) portal.setAttribute("data-state", state);
    overlay.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
    if (state === "open") {
      root.setAttribute("data-open", "");
      portal?.setAttribute("data-open", "");
      overlay.setAttribute("data-open", "");
      content.setAttribute("data-open", "");
      root.removeAttribute("data-closed");
      portal?.removeAttribute("data-closed");
      overlay.removeAttribute("data-closed");
      content.removeAttribute("data-closed");
      return;
    }

    root.setAttribute("data-closed", "");
    portal?.setAttribute("data-closed", "");
    overlay.setAttribute("data-closed", "");
    content.setAttribute("data-closed", "");
    root.removeAttribute("data-open");
    portal?.removeAttribute("data-open");
    overlay.removeAttribute("data-open");
    content.removeAttribute("data-open");
  };

  // Clear stack metadata on close
  const clearStackMetadata = () => {
    overlay.removeAttribute("data-stack-index");
    content.removeAttribute("data-stack-index");
    overlay.style.removeProperty("--dialog-stack-index");
    overlay.style.removeProperty("--dialog-overlay-stack-index");
    content.style.removeProperty("--dialog-stack-index");
    content.style.removeProperty("--dialog-content-stack-index");
  };

  const removeFromStack = () => {
    const idx = dialogStack.indexOf(controller);
    if (idx !== -1) dialogStack.splice(idx, 1);
    clearStackMetadata();
    reindexStack();
    teardownGlobalKeydownHandler();
  };

  let currentExitEpoch = 0;
  let pendingExitCount = 0;
  let overlayExitEpoch = 0;
  let contentExitEpoch = 0;

  const finishClosePart = (element: HTMLElement, epoch: number) => {
    if (isDestroyed || isOpen || epoch !== currentExitEpoch) return;

    element.hidden = true;
    pendingExitCount = Math.max(0, pendingExitCount - 1);

    if (pendingExitCount === 0) {
      cleanupContentFocusable();
      restoreFocus();
    }
  };

  const overlayPresence = createPresenceLifecycle({
    element: overlay,
    onExitComplete: () => finishClosePart(overlay, overlayExitEpoch),
  });

  const contentPresence = createPresenceLifecycle({
    element: content,
    onExitComplete: () => finishClosePart(content, contentExitEpoch),
  });

  const updateState = (open: boolean, force = false) => {
    if (isOpen === open && !force) return;

    if (open) {
      currentExitEpoch += 1;
      pendingExitCount = 0;

      // Move portal to body on first open
      mountPortal();

      // Store current focus
      previousActiveElement = document.activeElement as HTMLElement;

      // Add to dialog stack
      dialogStack.push(controller);

      // Setup global keydown handler if needed
      setupGlobalKeydownHandler();

      // Reindex all dialogs
      reindexStack();

      // Lock scroll
      if (lockScrollOption && !didLockScroll) {
        lockScroll();
        didLockScroll = true;
      }
    } else {
      currentExitEpoch += 1;
      pendingExitCount = 2;
      overlayExitEpoch = currentExitEpoch;
      contentExitEpoch = currentExitEpoch;

      removeFromStack();

      // Unlock scroll (only if we locked it)
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }
    }

    isOpen = open;
    if (trigger) {
      setAria(trigger, "expanded", isOpen);
    }

    if (open) {
      overlay.hidden = false;
      content.hidden = false;
      setDataState("open");
      overlayPresence.enter();
      contentPresence.enter();
    } else {
      setDataState("closed");
      overlayPresence.exit();
      contentPresence.exit();
    }

    emit(root, "dialog:change", { open: isOpen });
    onOpenChange?.(isOpen);

    if (open) {
      requestAnimationFrame(focusFirst);
    }
  };

  // Focus trap handler (called by global keydown handler)
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const focusables = content.querySelectorAll<HTMLElement>(FOCUSABLE);

    // If no focusables, prevent Tab from escaping
    if (focusables.length === 0) {
      e.preventDefault();
      ensureContentFocusable();
      content.focus();
      return;
    }

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;

    // If focus is outside the dialog, bring it back
    if (!content.contains(active)) {
      e.preventDefault();
      first.focus();
      return;
    }

    // Handle single focusable element
    if (first === last) {
      e.preventDefault();
      return;
    }

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (active === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // Initialize visual state (before controller is defined)
  content.hidden = true;
  overlay.hidden = true;
  setDataState("closed");

  // Trigger click - toggle behavior
  if (trigger) {
    cleanups.push(on(trigger, "click", () => updateState(!isOpen)));
  }

  // Delegated close button click - handles all [data-slot="dialog-close"] descendants
  cleanups.push(
    on(content, "click", (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      const closeEl = target.closest?.('[data-slot="dialog-close"]');
      if (closeEl && content.contains(closeEl)) {
        updateState(false);
      }
    })
  );

  // Click on overlay to close
  if (closeOnClickOutside) {
    cleanups.push(
      on(overlay, "click", (e) => {
        if ((e as MouseEvent).button !== 0) return;
        if (e.target === overlay && isOpen) {
          updateState(false);
        }
      })
    );
  }

  // Escape dismissal is routed via global dismiss-layer stack so nested
  // popups/selects/comboboxes close before the dialog.
  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => isOpen,
      onDismiss: () => updateState(false),
      closeOnClickOutside: false,
      closeOnEscape,
    })
  );

  const controller: DialogController = {
    open: () => updateState(true),
    close: () => updateState(false),
    toggle: () => updateState(!isOpen),
    get isOpen() {
      return isOpen;
    },
    destroy: () => {
      isDestroyed = true;
      removeFromStack();
      currentExitEpoch += 1;
      pendingExitCount = 0;
      overlayPresence.cleanup();
      contentPresence.cleanup();
      isOpen = false;
      setDataState("closed");
      overlay.hidden = true;
      content.hidden = true;
      if (trigger) {
        setAria(trigger, "expanded", false);
      }
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }
      cleanupContentFocusable();
      if (previousActiveElement !== null) {
        restoreFocus();
      }
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;

      portalLifecycle?.cleanup();
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
    // Internal properties for global handler
    _handleKeydown: handleKeydown,
    _content: content,
    _overlay: overlay,
  };

  // Inbound event
  cleanups.push(
    on(root, "dialog:set", (e) => {
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

  setRootBinding(root, ROOT_BINDING_KEY, controller);

  if (defaultOpen) updateState(true);

  return controller;
}

/**
 * Find and bind all dialog components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): DialogController[] {
  const controllers: DialogController[] = [];

  for (const root of getRoots(scope, "dialog")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createDialog(root));
  }

  return controllers;
}
