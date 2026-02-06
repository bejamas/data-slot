import { getPart, getRoots, getDataBool, getDataEnum } from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

export type PopoverPosition = "top" | "bottom" | "left" | "right";
const POSITIONS = ["top", "bottom", "left", "right"] as const;

export interface PopoverOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Position of popover relative to trigger */
  position?: PopoverPosition;
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
  const trigger = getPart<HTMLElement>(root, "popover-trigger");
  const content = getPart<HTMLElement>(root, "popover-content");
  const closeBtn = getPart<HTMLElement>(root, "popover-close");

  if (!trigger || !content) {
    throw new Error("Popover requires trigger and content slots");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  // Behavior options from root
  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const onOpenChange = options.onOpenChange;
  const closeOnClickOutside = options.closeOnClickOutside ?? getDataBool(root, "closeOnClickOutside") ?? true;
  const closeOnEscape = options.closeOnEscape ?? getDataBool(root, "closeOnEscape") ?? true;

  // Placement options: content-first, then root
  const position =
    options.position ??
    getDataEnum(content, "position", POSITIONS) ??
    getDataEnum(root, "position", POSITIONS) ??
    "bottom";

  let isOpen = defaultOpen;
  const cleanups: Array<() => void> = [];

  // ARIA setup
  const contentId = ensureId(content, "popover-content");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", contentId);
  content.setAttribute("data-position", position);

  const updateState = (open: boolean) => {
    if (isOpen === open) return;

    isOpen = open;
    setAria(trigger, "expanded", isOpen);
    content.hidden = !isOpen;
    root.setAttribute("data-state", isOpen ? "open" : "closed");
    content.setAttribute("data-state", isOpen ? "open" : "closed");

    emit(root, "popover:change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  // Initialize state
  setAria(trigger, "expanded", isOpen);
  content.hidden = !isOpen;
  root.setAttribute("data-state", isOpen ? "open" : "closed");
  content.setAttribute("data-state", isOpen ? "open" : "closed");

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

  // Inbound event
  cleanups.push(
    on(root, "popover:set", (e) => {
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
