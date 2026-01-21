import { getParts, getRoots, getPart, getDataBool, getDataString } from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

export interface AccordionOptions {
  /** Allow multiple items open at once */
  multiple?: boolean;
  /** Initially expanded item(s) */
  defaultValue?: string | string[];
  /** Callback when expanded items change */
  onValueChange?: (value: string[]) => void;
  /** Whether items can be fully collapsed (only applies to single mode) */
  collapsible?: boolean;
}

export interface AccordionController {
  /** Expand an item by value */
  expand(value: string): void;
  /** Collapse an item by value */
  collapse(value: string): void;
  /** Toggle an item by value */
  toggle(value: string): void;
  /** Currently expanded values */
  readonly value: string[];
  /** Cleanup all event listeners */
  destroy(): void;
}

/**
 * Create an accordion controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="accordion">
 *   <div data-slot="accordion-item" data-value="one">
 *     <button data-slot="accordion-trigger">Item One</button>
 *     <div data-slot="accordion-content">Content One</div>
 *   </div>
 *   <div data-slot="accordion-item" data-value="two">
 *     <button data-slot="accordion-trigger">Item Two</button>
 *     <div data-slot="accordion-content">Content Two</div>
 *   </div>
 * </div>
 * ```
 */
export function createAccordion(
  root: Element,
  options: AccordionOptions = {}
): AccordionController {
  const items = getParts<HTMLElement>(root, "accordion-item");

  if (items.length === 0) {
    throw new Error("Accordion requires at least one accordion-item");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  const multiple = options.multiple ?? getDataBool(root, "multiple") ?? false;
  const onValueChange = options.onValueChange;
  const collapsible = options.collapsible ?? getDataBool(root, "collapsible") ?? true;

  // Normalize defaultValue to array (JS option > data-default-value > empty)
  const rawDefaultValue = options.defaultValue ?? getDataString(root, "defaultValue");
  const defaultValue = rawDefaultValue
    ? Array.isArray(rawDefaultValue)
      ? rawDefaultValue
      : [rawDefaultValue]
    : [];

  let expandedValues = new Set<string>(defaultValue);
  const cleanups: Array<() => void> = [];

  // Collect all triggers for keyboard navigation
  const triggers: HTMLElement[] = [];

  // Setup each item
  items.forEach((item) => {
    const value = item.dataset["value"];
    if (!value) return;

    const trigger = getPart<HTMLElement>(item, "accordion-trigger");
    const content = getPart<HTMLElement>(item, "accordion-content");

    if (!trigger || !content) return;

    triggers.push(trigger);

    // ARIA setup
    const contentId = ensureId(content, "accordion-content");
    const triggerId = ensureId(trigger, "accordion-trigger");
    trigger.setAttribute("aria-controls", contentId);
    content.setAttribute("aria-labelledby", triggerId);
    content.setAttribute("role", "region");

    // Click handler
    cleanups.push(
      on(trigger, "click", () => {
        const isExpanded = expandedValues.has(value);

        if (isExpanded) {
          // Check if we can collapse
          if (!collapsible && !multiple && expandedValues.size === 1) {
            return; // Can't collapse the only open item
          }
          expandedValues.delete(value);
        } else {
          if (multiple) {
            expandedValues.add(value);
          } else {
            expandedValues = new Set([value]);
          }
        }

        updateAllItems();
        emit(root, "accordion:change", { value: [...expandedValues] });
        onValueChange?.([...expandedValues]);
      })
    );
  });

  // Keyboard navigation between triggers
  cleanups.push(
    on(root as HTMLElement, "keydown", (e) => {
      const target = e.target as HTMLElement;
      const currentIndex = triggers.indexOf(target);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      switch (e.key) {
        case "ArrowDown":
          nextIndex = currentIndex + 1;
          if (nextIndex >= triggers.length) nextIndex = 0;
          break;
        case "ArrowUp":
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) nextIndex = triggers.length - 1;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = triggers.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      triggers[nextIndex]?.focus();
    })
  );

  const updateAllItems = () => {
    items.forEach((item) => {
      const value = item.dataset["value"];
      if (!value) return;

      const trigger = getPart<HTMLElement>(item, "accordion-trigger");
      const content = getPart<HTMLElement>(item, "accordion-content");

      if (!trigger || !content) return;

      const isExpanded = expandedValues.has(value);
      const wasExpanded = trigger.getAttribute("aria-expanded") === "true";
      setAria(trigger, "expanded", isExpanded);
      item.setAttribute("data-state", isExpanded ? "open" : "closed");
      content.setAttribute("data-state", isExpanded ? "open" : "closed");

      // Handle visibility with animation support
      if (isExpanded) {
        // Opening: remove hidden immediately to allow animation
        content.hidden = false;
        // Clear any pending timeout
        if ((content as any)._accordionTimeout) {
          clearTimeout((content as any)._accordionTimeout);
          (content as any)._accordionTimeout = null;
        }
      } else {
        // Closing: delay setting hidden until animation completes
        if (wasExpanded) {
          // Clear any existing timeout
          if ((content as any)._accordionTimeout) {
            clearTimeout((content as any)._accordionTimeout);
          }
          // Try to find wrapper element (parent with grid classes) for transitionend
          const wrapper = content.parentElement;
          const handleTransitionEnd = (e: TransitionEvent) => {
            // Only handle grid-template-rows transitions
            if (e.propertyName === "grid-template-rows") {
              // Check current state - if still closed, hide it
              const currentState = content.getAttribute("data-state");
              if (currentState === "closed") {
                content.hidden = true;
              }
              wrapper?.removeEventListener(
                "transitionend",
                handleTransitionEnd
              );
              if ((content as any)._accordionTimeout) {
                clearTimeout((content as any)._accordionTimeout);
                (content as any)._accordionTimeout = null;
              }
            }
          };

          if (wrapper) {
            wrapper.addEventListener("transitionend", handleTransitionEnd);
            // Fallback timeout in case transitionend doesn't fire (350ms to account for transition)
            (content as any)._accordionTimeout = setTimeout(() => {
              const currentState = content.getAttribute("data-state");
              if (currentState === "closed") {
                content.hidden = true;
              }
              wrapper.removeEventListener("transitionend", handleTransitionEnd);
              (content as any)._accordionTimeout = null;
            }, 350);
          } else {
            // No wrapper found, use timeout fallback
            (content as any)._accordionTimeout = setTimeout(() => {
              content.hidden = true;
              (content as any)._accordionTimeout = null;
            }, 300);
          }
        } else {
          // Already closed, set hidden immediately
          content.hidden = true;
        }
      }
    });
  };

  // Initialize state
  updateAllItems();

  const controller: AccordionController = {
    expand: (value: string) => {
      if (expandedValues.has(value)) return;

      if (multiple) {
        expandedValues.add(value);
      } else {
        expandedValues = new Set([value]);
      }

      updateAllItems();
      emit(root, "accordion:change", { value: [...expandedValues] });
      onValueChange?.([...expandedValues]);
    },
    collapse: (value: string) => {
      if (!expandedValues.has(value)) return;
      if (!collapsible && !multiple && expandedValues.size === 1) return;

      expandedValues.delete(value);
      updateAllItems();
      emit(root, "accordion:change", { value: [...expandedValues] });
      onValueChange?.([...expandedValues]);
    },
    toggle: (value: string) => {
      if (expandedValues.has(value)) {
        controller.collapse(value);
      } else {
        controller.expand(value);
      }
    },
    get value() {
      return [...expandedValues];
    },
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      // Cleanup any pending timeouts
      items.forEach((item) => {
        const content = getPart<HTMLElement>(item, "accordion-content");
        if (content && (content as any)._accordionTimeout) {
          clearTimeout((content as any)._accordionTimeout);
          (content as any)._accordionTimeout = null;
        }
      });
    },
  };

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all accordion components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): AccordionController[] {
  const controllers: AccordionController[] = [];

  for (const root of getRoots(scope, "accordion")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createAccordion(root));
  }

  return controllers;
}
