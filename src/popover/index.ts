import { getPart, getRoots } from "../core/parts.ts";
import { setAria, ensureId } from "../core/aria.ts";
import { on, emit } from "../core/events.ts";

export interface PopoverOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Close when clicking outside */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape */
  closeOnEscape?: boolean;
}

export interface PopoverController {
  /** Open the popover */
  open(): void;
  /** Close the popover */
  close(): void;
  /** Toggle the popover */
  toggle(): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

/**
 * Create a popover controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="popover">
 *   <button data-slot="popover-trigger">Open</button>
 *   <div data-slot="popover-content">
 *     Popover content
 *     <button data-slot="popover-close">Close</button>
 *   </div>
 * </div>
 * ```
 */
export function createPopover(
  root: Element,
  options: PopoverOptions = {}
): PopoverController {
  const {
    defaultOpen = false,
    onOpenChange,
    closeOnClickOutside = true,
    closeOnEscape = true,
  } = options;

  const trigger = getPart<HTMLElement>(root, "popover-trigger");
  const content = getPart<HTMLElement>(root, "popover-content");
  const closeBtn = getPart<HTMLElement>(root, "popover-close");

  if (!trigger || !content) {
    throw new Error("Popover requires trigger and content slots");
  }

  let isOpen = defaultOpen;
  const cleanups: Array<() => void> = [];

  // ARIA setup
  const contentId = ensureId(content, "popover-content");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", contentId);

  const updateState = (open: boolean) => {
    if (isOpen === open) return;

    isOpen = open;
    setAria(trigger, "expanded", isOpen);
    content.hidden = !isOpen;
    root.setAttribute("data-state", isOpen ? "open" : "closed");

    emit(root, "popover:change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  // Initialize state
  setAria(trigger, "expanded", isOpen);
  content.hidden = !isOpen;
  root.setAttribute("data-state", isOpen ? "open" : "closed");

  // Trigger click
  cleanups.push(on(trigger, "click", () => updateState(!isOpen)));

  // Close button click
  if (closeBtn) {
    cleanups.push(on(closeBtn, "click", () => updateState(false)));
  }

  // Click outside
  if (closeOnClickOutside) {
    cleanups.push(
      on(document, "pointerdown", (e) => {
        if (!isOpen) return;
        const target = e.target as Node;
        if (!root.contains(target)) {
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
          trigger.focus();
        }
      })
    );
  }

  const controller: PopoverController = {
    open: () => updateState(true),
    close: () => updateState(false),
    toggle: () => updateState(!isOpen),
    get isOpen() {
      return isOpen;
    },
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all popover components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): PopoverController[] {
  const controllers: PopoverController[] = [];

  for (const root of getRoots(scope, "popover")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createPopover(root));
  }

  return controllers;
}
