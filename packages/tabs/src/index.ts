import { getPart, getParts, getRoots } from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

export interface TabsOptions {
  /** Initial selected tab value */
  defaultValue?: string;
  /** Callback when selected tab changes */
  onValueChange?: (value: string) => void;
  /** Tab orientation for keyboard navigation */
  orientation?: "horizontal" | "vertical";
}

export interface TabsController {
  /** Select a tab by value */
  select(value: string): void;
  /** Currently selected value */
  readonly value: string;
  /** Cleanup all event listeners */
  destroy(): void;
}

/**
 * Create a tabs controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="tabs" data-default-value="two">
 *   <div data-slot="tabs-list">
 *     <button data-slot="tabs-trigger" data-value="one">Tab One</button>
 *     <button data-slot="tabs-trigger" data-value="two">Tab Two</button>
 *   </div>
 *   <div data-slot="tabs-content" data-value="one">Content One</div>
 *   <div data-slot="tabs-content" data-value="two">Content Two</div>
 * </div>
 * ```
 */
export function createTabs(
  root: Element,
  options: TabsOptions = {}
): TabsController {
  const { onValueChange, orientation = "horizontal" } = options;

  const list = getPart<HTMLElement>(root, "tabs-list");
  const triggers = getParts<HTMLElement>(root, "tabs-trigger");
  const panels = getParts<HTMLElement>(root, "tabs-content");
  const indicator = getPart<HTMLElement>(root, "tabs-indicator");

  if (!list || triggers.length === 0) {
    throw new Error("Tabs requires tabs-list and at least one tabs-trigger");
  }

  // Get default value: JS option > data-default-value attribute > first trigger
  const rootEl = root as HTMLElement;
  const defaultValue =
    options.defaultValue ??
    rootEl.dataset["defaultValue"] ??
    triggers[0]?.dataset["value"] ??
    "";
  let currentValue = defaultValue;

  const cleanups: Array<() => void> = [];

  // Setup ARIA for list
  list.setAttribute("role", "tablist");
  setAria(list, "orientation", orientation);

  // Setup ARIA for triggers and panels
  triggers.forEach((trigger) => {
    const value = trigger.dataset["value"];
    if (!value) return;

    trigger.setAttribute("role", "tab");
    const triggerId = ensureId(trigger, "tab");

    // Find matching panel
    const panel = panels.find((p) => p.dataset["value"] === value);
    if (panel) {
      panel.setAttribute("role", "tabpanel");
      const panelId = ensureId(panel, "tabpanel");
      trigger.setAttribute("aria-controls", panelId);
      panel.setAttribute("aria-labelledby", triggerId);
    }
  });

  const updateState = (value: string) => {
    if (currentValue === value) return;

    currentValue = value;

    triggers.forEach((trigger) => {
      const isSelected = trigger.dataset["value"] === value;
      setAria(trigger, "selected", isSelected);
      trigger.tabIndex = isSelected ? 0 : -1;
      trigger.setAttribute("data-state", isSelected ? "active" : "inactive");
    });

    panels.forEach((panel) => {
      const isSelected = panel.dataset["value"] === value;
      panel.hidden = !isSelected;
      panel.setAttribute("data-state", isSelected ? "active" : "inactive");
    });

    root.setAttribute("data-value", value);
    updateIndicator();
    emit(root, "tabs:change", { value });
    onValueChange?.(value);
  };

  // Initialize state
  triggers.forEach((trigger) => {
    const isSelected = trigger.dataset["value"] === currentValue;
    setAria(trigger, "selected", isSelected);
    trigger.tabIndex = isSelected ? 0 : -1;
    trigger.setAttribute("data-state", isSelected ? "active" : "inactive");
  });

  panels.forEach((panel) => {
    const isSelected = panel.dataset["value"] === currentValue;
    panel.hidden = !isSelected;
    panel.setAttribute("data-state", isSelected ? "active" : "inactive");
  });

  root.setAttribute("data-value", currentValue);

  // Update indicator position (CSS variables for smooth animation)
  const updateIndicator = () => {
    if (!indicator) return;
    const activeTrigger = triggers.find(
      (t) => t.dataset["value"] === currentValue
    );
    if (!activeTrigger) return;

    const listRect = list.getBoundingClientRect();
    const triggerRect = activeTrigger.getBoundingClientRect();

    // Set CSS variables on the indicator element
    indicator.style.setProperty(
      "--active-tab-left",
      `${triggerRect.left - listRect.left}px`
    );
    indicator.style.setProperty("--active-tab-width", `${triggerRect.width}px`);
    indicator.style.setProperty(
      "--active-tab-top",
      `${triggerRect.top - listRect.top}px`
    );
    indicator.style.setProperty(
      "--active-tab-height",
      `${triggerRect.height}px`
    );
  };

  // Initial indicator position
  updateIndicator();

  // Click handlers for triggers
  triggers.forEach((trigger) => {
    cleanups.push(
      on(trigger, "click", () => {
        const value = trigger.dataset["value"];
        if (value) updateState(value);
      })
    );
  });

  // Keyboard navigation
  cleanups.push(
    on(list, "keydown", (e) => {
      const target = e.target as HTMLElement;
      if (!triggers.includes(target)) return;

      const currentIndex = triggers.indexOf(target);
      let nextIndex = currentIndex;

      const isHorizontal = orientation === "horizontal";
      const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
      const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";

      switch (e.key) {
        case prevKey:
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) nextIndex = triggers.length - 1;
          break;
        case nextKey:
          nextIndex = currentIndex + 1;
          if (nextIndex >= triggers.length) nextIndex = 0;
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
      const nextTrigger = triggers[nextIndex];
      if (nextTrigger) {
        nextTrigger.focus();
        const value = nextTrigger.dataset["value"];
        if (value) updateState(value);
      }
    })
  );

  const controller: TabsController = {
    select: (value: string) => updateState(value),
    get value() {
      return currentValue;
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
 * Find and bind all tabs components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): TabsController[] {
  const controllers: TabsController[] = [];

  for (const root of getRoots(scope, "tabs")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createTabs(root));
  }

  return controllers;
}
