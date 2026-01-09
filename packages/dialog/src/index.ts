import { getPart, getRoots } from "@data-slot/core";
import { setAria, ensureId, linkLabelledBy } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

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
}

// Focusable element selector
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Create a dialog controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="dialog">
 *   <button data-slot="dialog-trigger">Open</button>
 *   <div data-slot="dialog-overlay"></div>
 *   <div data-slot="dialog-content">
 *     <h2 data-slot="dialog-title">Title</h2>
 *     <p data-slot="dialog-description">Description</p>
 *     <button data-slot="dialog-close">Close</button>
 *   </div>
 * </div>
 * ```
 *
 * Note: Overlay is required. For modal behavior with inert backgrounds,
 * mount dialogs as direct children of document.body (portal pattern).
 */
export function createDialog(
  root: Element,
  options: DialogOptions = {}
): DialogController {
  const {
    defaultOpen = false,
    onOpenChange,
    closeOnClickOutside = true,
    closeOnEscape = true,
    lockScroll = true,
    alertDialog = false,
  } = options;

  const trigger = getPart<HTMLElement>(root, "dialog-trigger");
  const overlay = getPart<HTMLElement>(root, "dialog-overlay");
  const content = getPart<HTMLElement>(root, "dialog-content");
  const closeBtn = getPart<HTMLElement>(root, "dialog-close");
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
  let savedOverflow = "";
  let savedPaddingRight = "";
  const cleanups: Array<() => void> = [];

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

  const updateState = (open: boolean, force = false) => {
    if (isOpen === open && !force) return;

    if (open) {
      // Store current focus
      previousActiveElement = document.activeElement as HTMLElement;

      // Lock scroll
      if (lockScroll) {
        const scrollbarWidth =
          window.innerWidth - document.documentElement.clientWidth;
        savedOverflow = document.body.style.overflow;
        savedPaddingRight = document.body.style.paddingRight;
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.style.overflow = "hidden";
      }
    } else {
      // Unlock scroll
      if (lockScroll) {
        document.body.style.overflow = savedOverflow;
        document.body.style.paddingRight = savedPaddingRight;
      }

      // Clean up tabindex we may have added
      cleanupContentFocusable();

      // Restore focus
      const elementToFocus = previousActiveElement;
      previousActiveElement = null;
      requestAnimationFrame(() => {
        if (
          elementToFocus &&
          document.contains(elementToFocus) &&
          typeof elementToFocus.focus === "function"
        ) {
          elementToFocus.focus();
        }
      });
    }

    isOpen = open;
    content.hidden = !isOpen;
    overlay.hidden = !isOpen;
    if (trigger) {
      setAria(trigger, "expanded", isOpen);
    }
    root.setAttribute("data-state", isOpen ? "open" : "closed");

    emit(root, "dialog:change", { open: isOpen });
    onOpenChange?.(isOpen);

    if (open) {
      requestAnimationFrame(focusFirst);
    }
  };

  // Initialize state
  if (defaultOpen) {
    content.hidden = false;
    overlay.hidden = false;
    root.setAttribute("data-state", "open");
    updateState(true, true);
  } else {
    content.hidden = true;
    overlay.hidden = true;
    root.setAttribute("data-state", "closed");
  }

  // Trigger click - toggle behavior
  if (trigger) {
    cleanups.push(on(trigger, "click", () => updateState(!isOpen)));
  }

  // Close button click
  if (closeBtn) {
    cleanups.push(on(closeBtn, "click", () => updateState(false)));
  }

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

  // Keydown handler for Escape and Tab
  cleanups.push(
    on(document, "keydown", (e) => {
      if (!isOpen) return;

      // Escape key
      if (e.key === "Escape" && closeOnEscape) {
        e.preventDefault();
        updateState(false);
        return;
      }

      // Tab key - focus trap
      if (e.key === "Tab") {
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
      }
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
      if (isOpen) {
        updateState(false, true);
      }
      cleanupContentFocusable();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };

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
