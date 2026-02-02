import {
  getParts,
  getRoots,
  getDataString,
  getDataBool,
  getDataEnum,
} from "@data-slot/core";
import { setAria, ensureId, on, emit } from "@data-slot/core";

const ORIENTATIONS = ["horizontal", "vertical"] as const;

export interface ToggleGroupOptions {
  /** Initial selected value(s) - string for single, string[] for multiple */
  defaultValue?: string | string[];
  /** Allow multiple selections (default: false) */
  multiple?: boolean;
  /** Orientation for keyboard navigation */
  orientation?: "horizontal" | "vertical";
  /** Wrap keyboard focus at ends (default: true) */
  loop?: boolean;
  /** Disabled state for entire group */
  disabled?: boolean;
  /** Callback when value changes */
  onValueChange?: (value: string[]) => void;
}

export interface ToggleGroupController {
  /** Set value(s) programmatically */
  setValue(value: string | string[]): void;
  /** Toggle a specific item */
  toggle(value: string): void;
  /** Current selected value(s) */
  readonly value: string[];
  /** Cleanup all event listeners */
  destroy(): void;
}

interface ToggleItem {
  el: HTMLElement;
  value: string;
  disabled: boolean;
}

/**
 * Create a toggle-group controller for a root element
 *
 * ## Events
 * - **Outbound** `toggle-group:change` (on root): Fires when selection changes.
 *   `event.detail: { value: string[] }`
 * - **Inbound** `toggle-group:set` (on root): Set selection programmatically.
 *   `event.detail: { value: string | string[] } | string | string[]`
 *
 * @example
 * ```js
 * // Listen for changes
 * root.addEventListener("toggle-group:change", (e) => console.log(e.detail.value));
 * // Set selection from outside
 * root.dispatchEvent(new CustomEvent("toggle-group:set", { detail: { value: "bold" } }));
 * root.dispatchEvent(new CustomEvent("toggle-group:set", { detail: ["bold", "italic"] }));
 * ```
 *
 * Expected markup:
 * ```html
 * <div data-slot="toggle-group" data-default-value="center">
 *   <button data-slot="toggle-group-item" data-value="left">Left</button>
 *   <button data-slot="toggle-group-item" data-value="center">Center</button>
 *   <button data-slot="toggle-group-item" data-value="right">Right</button>
 * </div>
 * ```
 */
export function createToggleGroup(
  root: Element,
  options: ToggleGroupOptions = {}
): ToggleGroupController {
  const items = getParts<HTMLElement>(root, "toggle-group-item");

  if (items.length === 0) {
    throw new Error("ToggleGroup requires at least one toggle-group-item");
  }

  // Resolve options: JS > data-* > defaults
  const multiple =
    options.multiple ?? getDataBool(root, "multiple") ?? false;
  const orientation =
    options.orientation ??
    getDataEnum(root, "orientation", ORIENTATIONS) ??
    "horizontal";
  const loop = options.loop ?? getDataBool(root, "loop") ?? true;
  const groupDisabled =
    options.disabled ?? getDataBool(root, "disabled") ?? false;
  const onValueChange = options.onValueChange;

  // Parse default value
  const parseDefaultValue = (): string[] => {
    if (options.defaultValue !== undefined) {
      if (Array.isArray(options.defaultValue)) {
        return options.defaultValue;
      }
      return options.defaultValue.split(/\s+/).filter(Boolean);
    }
    const dataValue = getDataString(root, "defaultValue");
    if (dataValue) {
      return dataValue.split(/\s+/).filter(Boolean);
    }
    return [];
  };

  const defaultValues = parseDefaultValue();

  // Build item list
  const toggleItems: ToggleItem[] = [];
  const itemByValue = new Map<string, ToggleItem>();
  const itemByEl = new Map<HTMLElement, ToggleItem>();

  // Track items without data-value to make them non-interactive
  const invalidItems: HTMLElement[] = [];

  for (const el of items) {
    const value = (el.dataset["value"] || "").trim();
    if (!value) {
      invalidItems.push(el);
      continue;
    }

    const disabled =
      el.hasAttribute("disabled") ||
      el.hasAttribute("data-disabled") ||
      el.getAttribute("aria-disabled") === "true";

    const item: ToggleItem = { el, value, disabled };
    toggleItems.push(item);
    itemByValue.set(value, item);
    itemByEl.set(el, item);
  }

  // Make items without data-value non-interactive
  for (const el of invalidItems) {
    el.tabIndex = -1;
    el.setAttribute("aria-disabled", "true");
  }

  // Throw if no valid items
  if (toggleItems.length === 0) {
    throw new Error(
      "ToggleGroup requires at least one toggle-group-item with a data-value attribute"
    );
  }

  // State: set of selected values
  let currentValue: Set<string> = new Set();

  // Initialize with valid default values (values that exist in items)
  for (const v of defaultValues) {
    if (itemByValue.has(v)) {
      currentValue.add(v);
      if (!multiple) break; // Single mode: only first valid value
    }
  }

  const cleanups: Array<() => void> = [];

  // Check if group is disabled (for user input blocking)
  const isGroupDisabled = () =>
    root.hasAttribute("disabled") ||
    root.hasAttribute("data-disabled") ||
    root.getAttribute("aria-disabled") === "true";

  // Check if an individual item is disabled (live check for dynamic changes)
  const isItemDisabled = (item: ToggleItem) =>
    item.el.hasAttribute("disabled") ||
    item.el.hasAttribute("data-disabled") ||
    item.el.getAttribute("aria-disabled") === "true";

  // Get currently enabled items (computed on-demand to handle dynamic changes)
  const getEnabled = () => toggleItems.filter((i) => !isItemDisabled(i));

  // Setup ARIA for root
  root.setAttribute("role", "group");
  if (groupDisabled) {
    root.setAttribute("aria-disabled", "true");
  }
  if (orientation === "vertical") {
    setAria(root as HTMLElement, "orientation", "vertical");
  }
  if (multiple) {
    (root as HTMLElement).dataset["multiple"] = "";
  }

  // Setup ARIA for items
  for (const item of toggleItems) {
    const { el, disabled } = item;

    ensureId(el, "toggle-group-item");

    // Set type="button" on button elements
    if (el.tagName === "BUTTON" && !el.hasAttribute("type")) {
      (el as HTMLButtonElement).type = "button";
    }

    // Set disabled state
    if (disabled) {
      el.setAttribute("aria-disabled", "true");
      if (el.tagName === "BUTTON") {
        (el as HTMLButtonElement).disabled = true;
      }
    }
  }

  // Apply state to DOM
  const applyState = (newValue: Set<string>, init = false) => {
    const changed =
      !init &&
      (newValue.size !== currentValue.size ||
        [...newValue].some((v) => !currentValue.has(v)));

    currentValue = newValue;

    // Update all items
    for (const item of toggleItems) {
      const isPressed = currentValue.has(item.value);
      setAria(item.el, "pressed", isPressed);
      item.el.dataset["state"] = isPressed ? "on" : "off";
    }

    // Update roving tabindex
    updateRovingTabindex();

    // Update root data-value attribute (space-separated)
    const valueArr = [...currentValue];
    root.setAttribute("data-value", valueArr.join(" "));

    // Emit events
    if (changed) {
      emit(root, "toggle-group:change", { value: valueArr });
      onValueChange?.(valueArr);
    }
  };

  // Update roving tabindex: first enabled item that's pressed, or first enabled
  const updateRovingTabindex = () => {
    const enabled = getEnabled();

    // Find first pressed enabled item, or first enabled item
    let focusTarget: ToggleItem | undefined;

    for (const item of enabled) {
      if (currentValue.has(item.value)) {
        focusTarget = item;
        break;
      }
    }

    if (!focusTarget && enabled.length > 0) {
      focusTarget = enabled[0];
    }

    for (const item of toggleItems) {
      item.el.tabIndex = item === focusTarget ? 0 : -1;
    }
  };

  // Initialize state
  applyState(currentValue, true);

  // Toggle a single value
  const toggleValue = (value: string) => {
    const newValue = new Set(currentValue);

    if (multiple) {
      if (newValue.has(value)) {
        newValue.delete(value);
      } else {
        newValue.add(value);
      }
    } else {
      // Single mode: toggle off if already selected, otherwise select only this
      if (newValue.has(value)) {
        newValue.clear();
      } else {
        newValue.clear();
        newValue.add(value);
      }
    }

    applyState(newValue);
  };

  // Set value(s) directly
  const setValueDirect = (value: string | string[]) => {
    const values = Array.isArray(value)
      ? value
      : value.split(/\s+/).filter(Boolean);

    const newValue = new Set<string>();
    for (const v of values) {
      if (itemByValue.has(v)) {
        newValue.add(v);
        if (!multiple) break;
      }
    }

    applyState(newValue);
  };

  // Delegated click handler on root
  cleanups.push(
    on(root, "click", (e) => {
      if (isGroupDisabled()) return;

      const target = (e.target as HTMLElement).closest?.(
        '[data-slot="toggle-group-item"]'
      ) as HTMLElement | null;
      if (!target) return;

      const item = itemByEl.get(target);
      if (!item || isItemDisabled(item)) return;

      toggleValue(item.value);
    })
  );

  // Keyboard navigation
  const isHorizontal = orientation === "horizontal";
  const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
  const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";

  cleanups.push(
    on(root, "keydown", (e) => {
      if (isGroupDisabled()) return;

      const target = (e.target as HTMLElement).closest?.(
        '[data-slot="toggle-group-item"]'
      ) as HTMLElement | null;
      if (!target) return;

      const item = itemByEl.get(target);
      if (!item) return;

      // Enter/Space handled by native button click
      if (e.key === "Enter" || e.key === " ") {
        // Native button handles this, but we still need to block if disabled
        if (isItemDisabled(item)) {
          e.preventDefault();
        }
        return;
      }

      // Get enabled items on-demand (handles dynamic disabled state changes)
      const enabled = getEnabled();

      // Early return if no enabled items
      if (enabled.length === 0) return;

      // Get current index in enabled array
      let idx = enabled.findIndex((i) => i.el === target);
      if (idx === -1) {
        // Target is disabled; find closest enabled
        idx = 0;
      }

      let nextIdx = idx;

      switch (e.key) {
        case prevKey:
          nextIdx = idx - 1;
          if (nextIdx < 0) {
            nextIdx = loop ? enabled.length - 1 : 0;
          }
          break;
        case nextKey:
          nextIdx = idx + 1;
          if (nextIdx >= enabled.length) {
            nextIdx = loop ? 0 : enabled.length - 1;
          }
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
        // Update tabindex before focus
        for (const it of toggleItems) {
          it.el.tabIndex = it === next ? 0 : -1;
        }
        next.el.focus();
      }
    })
  );

  // Inbound event - blocked when group disabled
  // Preferred shape: { value: string | string[] }
  // Deprecated shapes: string | string[]
  cleanups.push(
    on(root, "toggle-group:set", (e) => {
      if (isGroupDisabled()) return;

      const evt = e as CustomEvent;
      const detail = evt.detail as unknown;

      let value: string | string[] | undefined;
      if (typeof detail === "string") {
        value = detail; // Deprecated
      } else if (Array.isArray(detail)) {
        value = detail; // Deprecated
      } else if (detail && typeof detail === "object" && "value" in detail) {
        value = (detail as { value: string | string[] }).value; // Preferred
      }

      if (value !== undefined) setValueDirect(value);
    })
  );

  // Controller methods are NOT blocked by disabled state
  return {
    setValue: (value: string | string[]) => setValueDirect(value),
    toggle: (value: string) => toggleValue(value),
    get value() {
      return [...currentValue];
    },
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      bound.delete(root);
    },
  };
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all toggle-group instances in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): ToggleGroupController[] {
  const controllers: ToggleGroupController[] = [];

  for (const root of getRoots(scope, "toggle-group")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createToggleGroup(root));
  }

  return controllers;
}
