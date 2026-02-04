import { getPart, getRoots, getDataBool } from "@data-slot/core";
import { setAria, ensureId, linkLabelledBy } from "@data-slot/core";
import { on, emit } from "@data-slot/core";
import { lockScroll, unlockScroll } from "@data-slot/core";

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
  /** Internal: options for global handler */
  _closeOnEscape?: boolean;
  /** Internal: content element for focus trap */
  _content?: HTMLElement;
  /** Internal: overlay element for z-index */
  _overlay?: HTMLElement;
}

// Focusable element selector
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Dialog stack for managing Escape key
const dialogStack: DialogController[] = [];

// Single global keydown handler
let globalKeydownCleanup: (() => void) | null = null;

// Reindex z-index for all dialogs in stack
function reindexStack() {
  const zBase = 1000;
  dialogStack.forEach((d, idx) => {
    const z = zBase + idx * 10;
    if (d._overlay) d._overlay.style.zIndex = String(z);
    if (d._content) d._content.style.zIndex = String(z + 1);
  });
}

function setupGlobalKeydownHandler() {
  if (globalKeydownCleanup) return;

  const handler = (e: KeyboardEvent) => {
    if (dialogStack.length === 0) return;

    const topmost = dialogStack[dialogStack.length - 1];
    if (!topmost || !topmost.isOpen) return;

    // Escape key - only topmost dialog responds
    if (e.key === "Escape" && topmost._closeOnEscape) {
      e.preventDefault();
      topmost.close();
      return;
    }

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
  let previousActiveElement: HTMLElement | null = null;
  const cleanups: Array<() => void> = [];

  // Portal: track original position (move to body on first open)
  let portalOriginalParent: ParentNode | null = null;
  let portalOriginalNextSibling: ChildNode | null = null;
  let portalMoved = false;

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

  // Move portal to body (called on first open)
  const movePortalToBody = () => {
    if (portal && !portalMoved) {
      portalOriginalParent = portal.parentNode;
      portalOriginalNextSibling = portal.nextSibling;
      document.body.appendChild(portal);
      portalMoved = true;
    }
  };

  // Helper to set data-state on all relevant elements
  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    if (portal) portal.setAttribute("data-state", state);
    overlay.setAttribute("data-state", state);
    content.setAttribute("data-state", state);
  };

  // Clear z-index on close
  const clearZIndex = () => {
    overlay.style.zIndex = "";
    content.style.zIndex = "";
  };

  const updateState = (open: boolean, force = false) => {
    if (isOpen === open && !force) return;

    if (open) {
      // Move portal to body on first open
      movePortalToBody();

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
      // Remove from dialog stack
      const idx = dialogStack.indexOf(controller);
      if (idx !== -1) dialogStack.splice(idx, 1);

      // Teardown global handler if no dialogs left
      teardownGlobalKeydownHandler();

      // Clear z-index and reindex remaining
      clearZIndex();
      reindexStack();

      // Unlock scroll (only if we locked it)
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }

      // Clean up tabindex we may have added
      cleanupContentFocusable();

      // Restore focus with fallback to trigger
      const elementToFocus = previousActiveElement;
      previousActiveElement = null;
      requestAnimationFrame(() => {
        if (
          elementToFocus &&
          document.contains(elementToFocus) &&
          typeof elementToFocus.focus === "function"
        ) {
          elementToFocus.focus();
        } else if (trigger && document.contains(trigger)) {
          trigger.focus();
        }
        // If neither available, let focus remain where it is
      });
    }

    isOpen = open;
    content.hidden = !isOpen;
    overlay.hidden = !isOpen;
    if (trigger) {
      setAria(trigger, "expanded", isOpen);
    }
    setDataState(isOpen ? "open" : "closed");

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
  if (defaultOpen) {
    movePortalToBody();
    content.hidden = false;
    overlay.hidden = false;
    setDataState("open");
    isOpen = true;
    if (trigger) {
      setAria(trigger, "expanded", true);
    }
  } else {
    content.hidden = true;
    overlay.hidden = true;
    setDataState("closed");
  }

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
      on(overlay, "pointerdown", (e) => {
        if (e.target === overlay && isOpen) {
          updateState(false);
        }
      })
    );
  }

  const controller: DialogController = {
    open: () => updateState(true),
    close: () => updateState(false),
    toggle: () => updateState(!isOpen),
    get isOpen() {
      return isOpen;
    },
    destroy: () => {
      if (isOpen) {
        // handles stack removal + reindex + teardown + scroll unlock + focus restore
        updateState(false, true);
      } else {
        // Safety: ensure removed from stack even if already closed
        const idx = dialogStack.indexOf(controller);
        if (idx !== -1) {
          dialogStack.splice(idx, 1);
          reindexStack();
          teardownGlobalKeydownHandler();
        }
      }

      cleanupContentFocusable();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;

      // Robust portal cleanup
      if (portal && portalMoved) {
        if (
          portalOriginalParent &&
          document.contains(portalOriginalParent as Node)
        ) {
          portalOriginalParent.insertBefore(portal, portalOriginalNextSibling);
        } else {
          portal.remove();
        }
        portalMoved = false;
      }
    },
    // Internal properties for global handler
    _handleKeydown: handleKeydown,
    _closeOnEscape: closeOnEscape,
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

  // Handle defaultOpen: push to stack and setup global state after controller is defined
  if (defaultOpen) {
    previousActiveElement = document.activeElement as HTMLElement;
    dialogStack.push(controller);
    setupGlobalKeydownHandler();
    reindexStack();

    if (lockScrollOption && !didLockScroll) {
      lockScroll();
      didLockScroll = true;
    }

    emit(root, "dialog:change", { open: true });
    onOpenChange?.(true);
    requestAnimationFrame(focusFirst);
  }

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all dialog components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): DialogController[] {
  const controllers: DialogController[] = [];

  for (const root of getRoots(scope, "dialog")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createDialog(root));
  }

  return controllers;
}
