import {
  getRoots,
  getDataBool,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  setAria,
  on,
  emit,
} from "@data-slot/core";

export interface ToggleOptions {
  /** Initial pressed state */
  defaultPressed?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Callback when pressed state changes */
  onPressedChange?: (pressed: boolean) => void;
}

export interface ToggleController {
  /** Toggle the pressed state (always works, ignores disabled) */
  toggle(): void;
  /** Set pressed to true (always works, ignores disabled) */
  press(): void;
  /** Set pressed to false (always works, ignores disabled) */
  release(): void;
  /** Current pressed state */
  readonly pressed: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

const ROOT_BINDING_KEY = "@data-slot/toggle";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/toggle] createToggle() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

export function createToggle(
  root: HTMLElement,
  options: ToggleOptions = {}
): ToggleController {
  const existingController = reuseRootBinding<ToggleController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  // Options: JS > data-* > defaults
  const defaultPressed =
    options.defaultPressed ?? getDataBool(root, "defaultPressed") ?? false;
  const disabled = options.disabled ?? getDataBool(root, "disabled") ?? false;
  const onPressedChange = options.onPressedChange;

  let currentPressed = defaultPressed;
  const cleanups: Array<() => void> = [];

  // Check if button is disabled (for user input blocking)
  const isDisabled = () =>
    root.hasAttribute("disabled") ||
    root.getAttribute("aria-disabled") === "true";

  // Apply state
  const applyState = (pressed: boolean, init = false) => {
    if (currentPressed === pressed && !init) return;
    currentPressed = pressed;

    setAria(root, "pressed", currentPressed);
    root.dataset.state = currentPressed ? "on" : "off";

    if (!init) {
      emit(root, "toggle:change", { pressed: currentPressed });
      onPressedChange?.(currentPressed);
    }
  };

  // Set initial disabled state (both native and ARIA for buttons)
  if (disabled) {
    if (root.tagName === "BUTTON") {
      root.setAttribute("disabled", "");
    }
    root.setAttribute("aria-disabled", "true");
  }

  // Set button type to prevent form submission
  if (root.tagName === "BUTTON" && !root.hasAttribute("type")) {
    root.setAttribute("type", "button");
  }

  // Initialize
  applyState(currentPressed, true);

  // Click handler (Enter/Space handled natively by button)
  // Blocked when disabled
  cleanups.push(
    on(root, "click", () => {
      if (isDisabled()) return;
      applyState(!currentPressed);
    })
  );

  // Inbound event - blocked when disabled (treated as external input)
  // Preferred shape: { value: boolean }
  // Deprecated shapes: boolean | { pressed: boolean }
  cleanups.push(
    on(root, "toggle:set", (e) => {
      if (isDisabled()) return;
      const detail = (e as CustomEvent).detail;
      let value: boolean | undefined;
      if (typeof detail === "boolean") {
        value = detail; // Deprecated
      } else if (detail?.value !== undefined) {
        value = detail.value; // Preferred
      } else if (detail?.pressed !== undefined) {
        value = detail.pressed; // Deprecated
      }
      if (typeof value === "boolean") applyState(value);
    })
  );

  // Controller methods are NOT blocked by disabled state.
  // When you have the controller, you have explicit programmatic control.
  const controller: ToggleController = {
    toggle: () => applyState(!currentPressed),
    press: () => applyState(true),
    release: () => applyState(false),
    get pressed() {
      return currentPressed;
    },
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
 * Find and bind all toggle instances in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): ToggleController[] {
  const controllers: ToggleController[] = [];
  for (const root of getRoots(scope, "toggle")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createToggle(root as HTMLElement));
  }
  return controllers;
}
