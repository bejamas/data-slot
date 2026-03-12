import {
  getPart,
  getParts,
  getRoots,
  getDataString,
  getDataEnum,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

const ORIENTATIONS = ["horizontal", "vertical"] as const;
const ACTIVATION_MODES = ["auto", "manual"] as const;

export interface TabsOptions {
  /** Initial selected tab value */
  defaultValue?: string;
  /** Callback when selected tab changes */
  onValueChange?: (value: string) => void;
  /** Tab orientation for keyboard navigation */
  orientation?: "horizontal" | "vertical";
  /**
   * Activation mode for keyboard navigation
   * - "auto": Arrow keys select tabs immediately (default)
   * - "manual": Arrow keys move focus, Enter/Space activates
   */
  activationMode?: "auto" | "manual";
}

export interface TabsController {
  /** Select a tab by value */
  select(value: string): void;
  /** Currently selected value */
  readonly value: string;
  /** Update indicator position (call after layout changes) */
  updateIndicator(): void;
  /** Cleanup all event listeners */
  destroy(): void;
}

const ROOT_BINDING_KEY = "@data-slot/tabs";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/tabs] createTabs() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

// Focusable selector constant (shared with other components)
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface TabItem {
  el: HTMLElement;
  value: string;
  disabled: boolean;
  panel?: HTMLElement;
}

/**
 * Create a tabs controller for a root element
 *
 * ## Events
 * - **Outbound** `tabs:change` (on root): Fires when selected tab changes.
 *   `event.detail: { value: string }`
 * - **Inbound** `tabs:select` (on root): Select a tab programmatically.
 *   `event.detail: { value: string } | string` (fallback: `event.currentTarget.dataset.value`)
 *
 * @example
 * ```js
 * // Listen for tab changes
 * root.addEventListener("tabs:change", (e) => console.log(e.detail.value));
 * // Select a tab from outside (object or string detail)
 * root.dispatchEvent(new CustomEvent("tabs:select", { detail: { value: "two" } }));
 * root.dispatchEvent(new CustomEvent("tabs:select", { detail: "two" }));
 * ```
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
  const existingController = reuseRootBinding<TabsController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  const list = getPart<HTMLElement>(root, "tabs-list");
  const triggers = getParts<HTMLElement>(root, "tabs-trigger");
  const panels = getParts<HTMLElement>(root, "tabs-content");
  const indicator = getPart<HTMLElement>(root, "tabs-indicator");

  if (!list || triggers.length === 0) {
    throw new Error("Tabs requires tabs-list and at least one tabs-trigger");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  const onValueChange = options.onValueChange;
  const orientation = options.orientation ?? getDataEnum(root, "orientation", ORIENTATIONS) ?? "horizontal";
  const activationMode = options.activationMode ?? getDataEnum(root, "activationMode", ACTIVATION_MODES) ?? "auto";

  // Build panel lookup map once (value -> panel)
  const panelByValue = new Map<string, HTMLElement>();
  for (const p of panels) {
    const v = (p.dataset["value"] || "").trim();
    if (v) panelByValue.set(v, p);
  }

  // Build trigger items once: only those with a value
  const items: TabItem[] = [];
  const itemByValue = new Map<string, TabItem>();
  const itemByEl = new Map<HTMLElement, TabItem>();

  for (const el of triggers) {
    const value = (el.dataset["value"] || "").trim();
    if (!value) continue;

    const disabled =
      el.hasAttribute("disabled") ||
      el.dataset["disabled"] !== undefined ||
      el.getAttribute("aria-disabled") === "true";
    const panel = panelByValue.get(value);
    const item: TabItem = { el, value, disabled, panel };

    items.push(item);
    itemByValue.set(value, item);
    itemByEl.set(el, item);
  }

  // Precompute enabled triggers array and index map to enable O(1) lookup later
  const enabled = items.filter((i) => !i.disabled);
  const enabledIndexByValue = new Map<string, number>();
  enabled.forEach((i, idx) => enabledIndexByValue.set(i.value, idx));
  const firstValue = enabled[0]?.value || "";

  // Get default value: JS option > data-default-value attribute > first enabled
  const requestedValue = (
    options.defaultValue ??
    getDataString(root, "defaultValue") ??
    ""
  ).trim();

  // Validate: ensure requested value exists on an enabled trigger
  const requestedItem = itemByValue.get(requestedValue);
  let currentValue =
    requestedItem && !requestedItem.disabled ? requestedValue : firstValue;

  const cleanups: Array<() => void> = [];
  let indicatorFrame: number | null = null;

  // Setup ARIA for list
  list.setAttribute("role", "tablist");
  if (orientation === "vertical") {
    setAria(list, "orientation", "vertical");
  }

  // Setup ARIA for triggers and panels
  for (const item of items) {
    const { el, disabled, panel } = item;

    el.setAttribute("role", "tab");
    const triggerId = ensureId(el, "tab");

    // Set type="button" on button elements to prevent form submission
    if (el.tagName === "BUTTON" && !el.hasAttribute("type")) {
      (el as HTMLButtonElement).type = "button";
    }

    // Set aria-disabled and native disabled for disabled triggers
    if (disabled) {
      el.setAttribute("aria-disabled", "true");
      if (el.tagName === "BUTTON") {
        (el as HTMLButtonElement).disabled = true;
      }
    }

    // Link trigger and panel
    if (panel) {
      panel.setAttribute("role", "tabpanel");
      panel.tabIndex = -1;
      const panelId = ensureId(panel, "tabpanel");
      el.setAttribute("aria-controls", panelId);
      panel.setAttribute("aria-labelledby", triggerId);
    }
  }

  const getPositionWithinList = (
    trigger: HTMLElement
  ): { left: number; top: number; width: number; height: number } | null => {
    let left = 0;
    let top = 0;
    let current: HTMLElement | null = trigger;

    while (current && current !== list) {
      left += current.offsetLeft;
      top += current.offsetTop;

      const parent = current.offsetParent;
      if (!(parent instanceof HTMLElement)) {
        return null;
      }

      if (parent !== list) {
        left -= parent.scrollLeft;
        top -= parent.scrollTop;
      }

      current = parent;
    }

    if (current !== list) return null;

    return {
      left: left - list.clientLeft,
      top: top - list.clientTop,
      width: trigger.offsetWidth,
      height: trigger.offsetHeight,
    };
  };

  const getRectRelativeToList = (trigger: HTMLElement) => {
    const listRect = list.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    return {
      left: triggerRect.left - listRect.left - list.clientLeft + list.scrollLeft,
      top: triggerRect.top - listRect.top - list.clientTop + list.scrollTop,
      width: triggerRect.width,
      height: triggerRect.height,
    };
  };

  // Update indicator position (CSS variables for smooth animation)
  const updateIndicator = () => {
    if (!indicator) return;
    const item = itemByValue.get(currentValue);
    if (!item) return;

    const position = getPositionWithinList(item.el) ?? getRectRelativeToList(item.el);

    indicator.style.setProperty("--active-tab-left", `${position.left}px`);
    indicator.style.setProperty("--active-tab-width", `${position.width}px`);
    indicator.style.setProperty("--active-tab-top", `${position.top}px`);
    indicator.style.setProperty("--active-tab-height", `${position.height}px`);
  };

  const scheduleIndicatorUpdate = () => {
    if (!indicator || indicatorFrame !== null) return;
    indicatorFrame = requestAnimationFrame(() => {
      indicatorFrame = null;
      updateIndicator();
    });
  };

  // Unified state application
  const getActivationDirection = (
    previousValue: string,
    nextValue: string,
  ): "left" | "right" | "up" | "down" | null => {
    const previousIndex = items.findIndex((item) => item.value === previousValue);
    const nextIndex = items.findIndex((item) => item.value === nextValue);
    if (previousIndex < 0 || nextIndex < 0 || previousIndex === nextIndex) return null;
    if (orientation === "vertical") {
      return nextIndex > previousIndex ? "down" : "up";
    }
    return nextIndex > previousIndex ? "right" : "left";
  };

  const applyState = (value: string, init = false) => {
    value = value.trim();
    if (currentValue === value && !init) return;

    // Validate: value must exist on an enabled trigger
    const targetItem = itemByValue.get(value);
    if (!targetItem || targetItem.disabled) {
      if (init) {
        value = firstValue;
        if (!value) return;
      } else return;
    }

    const previousValue = currentValue;
    const changed = previousValue !== value;
    const activationDirection =
      !init && changed
        ? getActivationDirection(previousValue, value)
        : null;
    currentValue = value;

    for (const item of items) {
      const isSelected = item.value === value;
      setAria(item.el, "selected", isSelected);
      item.el.tabIndex = isSelected && !item.disabled ? 0 : -1;
      item.el.dataset["state"] = isSelected ? "active" : "inactive";
    }

    for (const panel of panels) {
      const v = (panel.dataset["value"] || "").trim();
      if (!v) continue;
      const isSelected = v === value;
      panel.hidden = !isSelected;
      panel.dataset["state"] = isSelected ? "active" : "inactive";
      if (activationDirection) {
        panel.dataset["activationDirection"] = activationDirection;
      } else {
        delete panel.dataset["activationDirection"];
      }
    }

    root.setAttribute("data-value", value);
    scheduleIndicatorUpdate();

    if (changed && !init) {
      emit(root, "tabs:change", { value });
      onValueChange?.(value);
    }
  };

  // Initialize state
  applyState(currentValue, true);

  // Keep indicator in sync with layout changes (only if indicator exists)
  if (indicator) {
    const indicatorTick = () => scheduleIndicatorUpdate();
    cleanups.push(on(window, "resize", indicatorTick));
    cleanups.push(on(list, "scroll", indicatorTick));
    const ro = new ResizeObserver(indicatorTick);
    ro.observe(list);
    cleanups.push(() => ro.disconnect());
    cleanups.push(() => {
      if (indicatorFrame !== null) {
        cancelAnimationFrame(indicatorFrame);
        indicatorFrame = null;
      }
    });
  }

  // Delegated click handler on list
  cleanups.push(
    on(list, "click", (e) => {
      const target = (e.target as HTMLElement).closest?.(
        '[data-slot="tabs-trigger"]'
      ) as HTMLElement | null;
      if (!target) return;
      const item = itemByEl.get(target);
      if (item && !item.disabled) applyState(item.value);
    })
  );

  // Keyboard navigation
  const isHorizontal = orientation === "horizontal";
  const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
  const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";

  cleanups.push(
    on(list, "keydown", (e) => {
      const target = (e.target as HTMLElement).closest?.(
        '[data-slot="tabs-trigger"]'
      ) as HTMLElement | null;
      if (!target) return;

      const item = itemByEl.get(target);
      if (!item) return;

      // Early return if no enabled triggers
      if (enabled.length === 0) return;

      // Handle Enter/Space activation
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!item.disabled) applyState(item.value);
        return;
      }

      // ArrowDown from active tab focuses the panel (horizontal mode only)
      if (
        isHorizontal &&
        e.key === "ArrowDown" &&
        item.value === currentValue
      ) {
        const panel = item.panel;
        if (panel) {
          e.preventDefault();
          const focusable = panel.querySelector<HTMLElement>(FOCUSABLE);
          (focusable || panel).focus();
          return;
        }
      }

      // Get current index in enabled array (O(1) via map)
      let idx = enabledIndexByValue.get(item.value) ?? -1;
      if (idx === -1) {
        // Target is disabled; base nav off currently selected tab
        idx = enabledIndexByValue.get(currentValue) ?? 0;
      }

      let nextIdx = idx;

      switch (e.key) {
        case prevKey:
          nextIdx = idx - 1;
          if (nextIdx < 0) nextIdx = enabled.length - 1;
          break;
        case nextKey:
          nextIdx = idx + 1;
          if (nextIdx >= enabled.length) nextIdx = 0;
          break;
        case "Home":
          nextIdx = 0;
          break;
        case "End":
          nextIdx = enabled.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const next = enabled[nextIdx];
      if (next) {
        next.el.focus();
        if (activationMode === "auto") applyState(next.value);
      }
    })
  );

  // Listen for external set/select commands
  // Preferred: tabs:set with { value: string }
  // Deprecated: tabs:select with string or { value: string }
  const handleSet = (e: Event) => {
    const evt = e as CustomEvent;
    const rootEl = e.currentTarget as HTMLElement | null;
    const detail = evt.detail as unknown;
    const raw =
      typeof detail === "string"
        ? detail // Deprecated (tabs:select style)
        : (detail as { value?: string } | null)?.value ?? rootEl?.dataset?.value;
    const value = raw?.trim();
    if (value) applyState(value);
  };
  cleanups.push(on(root, "tabs:set", handleSet));
  cleanups.push(on(root, "tabs:select", handleSet)); // Deprecated alias

  const controller: TabsController = {
    select: (value: string) => applyState(value),
    get value() {
      return currentValue;
    },
    updateIndicator,
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all tabs components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): TabsController[] {
  const controllers: TabsController[] = [];

  for (const root of getRoots(scope, "tabs")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createTabs(root));
  }

  return controllers;
}
