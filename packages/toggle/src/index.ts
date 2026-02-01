import { getRoots, getDataBool, setAria, on, emit } from "@data-slot/core";

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

export function createToggle(
  root: HTMLElement,
  options: ToggleOptions = {}
): ToggleController {
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
  cleanups.push(
    on(root, "toggle:set", (e) => {
      if (isDisabled()) return;
      const detail = (e as CustomEvent).detail;
      const pressed = typeof detail === "boolean" ? detail : detail?.pressed;
      if (typeof pressed === "boolean") applyState(pressed);
    })
  );

  // Controller methods are NOT blocked by disabled state.
  // When you have the controller, you have explicit programmatic control.
  return {
    toggle: () => applyState(!currentPressed),
    press: () => applyState(true),
    release: () => applyState(false),
    get pressed() {
      return currentPressed;
    },
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      // Remove from bound set so create() can re-discover after destroy
      bound.delete(root);
    },
  };
}

// WeakSet to track bound elements (used by create() for auto-discovery)
const bound = new WeakSet<Element>();

/**
 * Find and bind all toggle instances in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): ToggleController[] {
  const controllers: ToggleController[] = [];
  for (const root of getRoots(scope, "toggle")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createToggle(root as HTMLElement));
  }
  return controllers;
}
