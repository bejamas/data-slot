import { getPart, getRoots } from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

export interface DisclosureOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export interface DisclosureController {
  /** Open the disclosure */
  open(): void;
  /** Close the disclosure */
  close(): void;
  /** Toggle the disclosure */
  toggle(): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

/**
 * Create a disclosure controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="disclosure">
 *   <button data-slot="disclosure-trigger">Toggle</button>
 *   <div data-slot="disclosure-content">Content here</div>
 * </div>
 * ```
 */
export function createDisclosure(
  root: Element,
  options: DisclosureOptions = {}
): DisclosureController {
  const { defaultOpen = false, onOpenChange } = options;

  const trigger = getPart<HTMLElement>(root, "disclosure-trigger");
  const content = getPart<HTMLElement>(root, "disclosure-content");

  if (!trigger || !content) {
    throw new Error("Disclosure requires trigger and content slots");
  }

  let isOpen = defaultOpen;
  const cleanups: Array<() => void> = [];

  // Setup ARIA
  const contentId = ensureId(content, "disclosure-content");
  trigger.setAttribute("aria-controls", contentId);

  const updateState = (open: boolean) => {
    if (isOpen === open) return;

    isOpen = open;
    setAria(trigger, "expanded", isOpen);
    content.hidden = !isOpen;
    root.setAttribute("data-state", isOpen ? "open" : "closed");

    emit(root, "disclosure:change", { open: isOpen });
    onOpenChange?.(isOpen);
  };

  // Initialize state
  setAria(trigger, "expanded", isOpen);
  content.hidden = !isOpen;
  root.setAttribute("data-state", isOpen ? "open" : "closed");

  // Event handlers
  cleanups.push(on(trigger, "click", () => updateState(!isOpen)));

  const controller: DisclosureController = {
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
 * Find and bind all disclosure components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): DisclosureController[] {
  const controllers: DisclosureController[] = [];

  for (const root of getRoots(scope, "disclosure")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createDisclosure(root));
  }

  return controllers;
}

