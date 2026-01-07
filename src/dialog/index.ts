import { getPart, getRoots } from "../core/parts.ts";
import { setAria, ensureId, linkLabelledBy } from "../core/aria.ts";
import { on, emit } from "../core/events.ts";

export interface DialogOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Close when clicking outside content */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape */
  closeOnEscape?: boolean;
  /** Lock body scroll when open */
  lockScroll?: boolean;
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
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Create a dialog controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="dialog">
 *   <button data-slot="dialog-trigger">Open</button>
 *   <div data-slot="dialog-content" role="dialog">
 *     <h2 data-slot="dialog-title">Title</h2>
 *     <p data-slot="dialog-description">Description</p>
 *     <button data-slot="dialog-close">Close</button>
 *   </div>
 * </div>
 * ```
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
  } = options;

  const trigger = getPart<HTMLElement>(root, "dialog-trigger");
  const content = getPart<HTMLElement>(root, "dialog-content");
  const closeBtn = getPart<HTMLElement>(root, "dialog-close");
  const title = getPart<HTMLElement>(root, "dialog-title");
  const description = getPart<HTMLElement>(root, "dialog-description");

  if (!content) {
    throw new Error("Dialog requires dialog-content slot");
  }

  let isOpen = defaultOpen;
  let previousActiveElement: HTMLElement | null = null;
  let scrollLockCleanup: (() => void) | null = null;
  const cleanups: Array<() => void> = [];

  // ARIA setup
  ensureId(content, "dialog-content");
  content.setAttribute("role", "dialog");
  setAria(content, "modal", true);
  linkLabelledBy(content, title, description);

  if (trigger) {
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", content.id);
  }

  const lockBodyScroll = () => {
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const originalPaddingRight = document.body.style.paddingRight;
    const originalOverflow = document.body.style.overflow;

    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.paddingRight = originalPaddingRight;
      document.body.style.overflow = originalOverflow;
    };
  };

  const focusFirst = () => {
    const focusable = content.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const first = focusable[0];
    if (first) {
      first.focus();
    } else {
      // Make content focusable and focus it
      content.tabIndex = -1;
      content.focus();
    }
  };

  const updateState = (open: boolean) => {
    if (isOpen === open) return;

    if (open) {
      // Store current focus
      previousActiveElement = document.activeElement as HTMLElement;

      // Lock scroll
      if (lockScroll) {
        scrollLockCleanup = lockBodyScroll();
      }
    } else {
      // Unlock scroll
      if (scrollLockCleanup) {
        scrollLockCleanup();
        scrollLockCleanup = null;
      }

      // Restore focus
      if (previousActiveElement) {
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    }

    isOpen = open;
    content.hidden = !isOpen;
    if (trigger) {
      setAria(trigger, "expanded", isOpen);
    }
    root.setAttribute("data-state", isOpen ? "open" : "closed");

    emit(root, "dialog:change", { open: isOpen });
    onOpenChange?.(isOpen);

    if (open) {
      // Focus first element after state update
      requestAnimationFrame(focusFirst);
    }
  };

  // Initialize state
  content.hidden = !isOpen;
  if (trigger) {
    setAria(trigger, "expanded", isOpen);
  }
  root.setAttribute("data-state", isOpen ? "open" : "closed");

  // Trigger click
  if (trigger) {
    cleanups.push(on(trigger, "click", () => updateState(true)));
  }

  // Close button click
  if (closeBtn) {
    cleanups.push(on(closeBtn, "click", () => updateState(false)));
  }

  // Click outside (on the backdrop/overlay)
  if (closeOnClickOutside) {
    cleanups.push(
      on(document, "pointerdown", (e) => {
        if (!isOpen) return;
        const target = e.target as Node;

        // Close if clicking outside content but inside root (backdrop click)
        // or clicking completely outside root
        if (!content.contains(target)) {
          updateState(false);
        }
      })
    );
  }

  // Escape key
  if (closeOnEscape) {
    cleanups.push(
      on(document, "keydown", (e) => {
        if (!isOpen) return;
        if (e.key === "Escape") {
          e.preventDefault();
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
      if (scrollLockCleanup) {
        scrollLockCleanup();
        scrollLockCleanup = null;
      }
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
