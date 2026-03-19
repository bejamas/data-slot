import {
  getParts,
  getRoots,
  getDataBool,
  getDataString,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  setAria,
  ensureId,
  on,
  emit,
} from "@data-slot/core";

export interface SwitchOptions {
  /** Initial checked state */
  defaultChecked?: boolean;
  /** Disable user interaction and form submission */
  disabled?: boolean;
  /** Prevent user interaction while keeping the value submittable */
  readOnly?: boolean;
  /** Require a checked value for native form validation */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Submitted value when checked (defaults to native checkbox "on") */
  value?: string;
  /** Submitted value when unchecked */
  uncheckedValue?: string;
  /** Callback when checked state changes */
  onCheckedChange?: (checked: boolean) => void;
}

export interface SwitchController {
  /** Current checked state */
  readonly checked: boolean;
  /** Toggle the checked state */
  toggle(): void;
  /** Set checked state to true */
  check(): void;
  /** Set checked state to false */
  uncheck(): void;
  /** Set the checked state */
  setChecked(checked: boolean): void;
  /** Cleanup listeners and generated inputs */
  destroy(): void;
}

const ROOT_BINDING_KEY = "@data-slot/switch";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/switch] createSwitch() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

const VISUALLY_HIDDEN_STYLES = [
  "position:absolute",
  "width:1px",
  "height:1px",
  "padding:0",
  "margin:-1px",
  "overflow:hidden",
  "clip:rect(0, 0, 0, 0)",
  "white-space:nowrap",
  "border:0",
  "pointer-events:none",
].join(";");

function setPresence(el: Element, name: string, present: boolean): void {
  if (present) {
    el.setAttribute(name, "");
  } else {
    el.removeAttribute(name);
  }
}

function setCheckedStateAttrs(el: Element, checked: boolean): void {
  setPresence(el, "data-checked", checked);
  setPresence(el, "data-unchecked", !checked);
}

function setFlagStateAttrs(
  el: Element,
  disabled: boolean,
  readOnly: boolean,
  required: boolean,
): void {
  setPresence(el, "data-disabled", disabled);
  setPresence(el, "data-readonly", readOnly);
  setPresence(el, "data-required", required);
}

function mergeIdRefs(existing: string | null, ids: string[]): string | null {
  const merged = new Set<string>();
  if (existing) {
    for (const id of existing.split(/\s+/)) {
      if (id) merged.add(id);
    }
  }
  for (const id of ids) {
    if (id) merged.add(id);
  }
  return merged.size > 0 ? [...merged].join(" ") : null;
}

function insertAfter(reference: Element, node: Element): void {
  const parent = reference.parentNode;
  if (!parent) {
    reference.appendChild(node);
    return;
  }
  parent.insertBefore(node, reference.nextSibling);
}

function isNativeButton(el: HTMLElement): el is HTMLButtonElement {
  return el.tagName === "BUTTON";
}

function isNaturallyFocusable(el: HTMLElement): boolean {
  const tagName = el.tagName;
  if (tagName === "BUTTON" || tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") {
    return true;
  }
  if (tagName === "A") {
    return el.hasAttribute("href");
  }
  return false;
}

function getRootLabels(root: HTMLElement): HTMLLabelElement[] {
  const labels: HTMLLabelElement[] = [];
  const wrappingLabel = root.closest("label");
  if (wrappingLabel instanceof HTMLLabelElement) {
    labels.push(wrappingLabel);
  }

  if (!root.id) return labels;

  const doc = root.ownerDocument ?? document;
  const selector = `label[for="${CSS.escape(root.id)}"]`;
  for (const label of doc.querySelectorAll<HTMLLabelElement>(selector)) {
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }

  return labels;
}

/**
 * Create a switch controller for a root element.
 *
 * Expected markup:
 * ```html
 * <label>
 *   <span data-slot="switch" data-name="notifications">
 *     <span data-slot="switch-thumb"></span>
 *   </span>
 *   Notifications
 * </label>
 * ```
 */
export function createSwitch(
  root: Element,
  options: SwitchOptions = {},
): SwitchController {
  const existingController = reuseRootBinding<SwitchController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING,
  );
  if (existingController) return existingController;

  const rootElement = root as HTMLElement;
  const disabled =
    options.disabled ??
    getDataBool(rootElement, "disabled") ??
    (rootElement.hasAttribute("disabled") ||
      rootElement.getAttribute("aria-disabled") === "true");
  const readOnly =
    options.readOnly ??
    getDataBool(rootElement, "readOnly") ??
    (rootElement.getAttribute("aria-readonly") === "true");
  const required =
    options.required ??
    getDataBool(rootElement, "required") ??
    (rootElement.getAttribute("aria-required") === "true");
  const defaultChecked =
    options.defaultChecked ??
    getDataBool(rootElement, "defaultChecked") ??
    (rootElement.getAttribute("aria-checked") === "true");
  const name = options.name ?? getDataString(rootElement, "name");
  const value = options.value ?? getDataString(rootElement, "value");
  const uncheckedValue =
    options.uncheckedValue ?? getDataString(rootElement, "uncheckedValue");
  const onCheckedChange = options.onCheckedChange;

  const cleanups: Array<() => void> = [];
  const doc = root.ownerDocument ?? document;
  const hiddenInput = doc.createElement("input");
  hiddenInput.type = "checkbox";
  hiddenInput.tabIndex = -1;
  hiddenInput.setAttribute("aria-hidden", "true");
  hiddenInput.setAttribute("data-switch-generated", "input");
  hiddenInput.style.cssText = VISUALLY_HIDDEN_STYLES;
  insertAfter(rootElement, hiddenInput);

  let uncheckedInput: HTMLInputElement | null = null;
  let currentChecked = Boolean(defaultChecked);
  hiddenInput.defaultChecked = currentChecked;

  const getThumbs = () => getParts<HTMLElement>(rootElement, "switch-thumb");

  const syncGeneratedInputs = () => {
    hiddenInput.checked = currentChecked;
    hiddenInput.disabled = disabled;
    hiddenInput.required = required;
    if (name) {
      hiddenInput.name = name;
    } else {
      hiddenInput.removeAttribute("name");
    }
    if (value !== undefined) {
      hiddenInput.value = value;
    } else {
      hiddenInput.removeAttribute("value");
    }

    const needsUncheckedInput =
      !disabled &&
      !currentChecked &&
      name !== undefined &&
      uncheckedValue !== undefined;

    if (!needsUncheckedInput) {
      uncheckedInput?.remove();
      uncheckedInput = null;
      return;
    }

    if (!uncheckedInput) {
      uncheckedInput = doc.createElement("input");
      uncheckedInput.type = "hidden";
      uncheckedInput.setAttribute("data-switch-generated", "unchecked");
      insertAfter(hiddenInput, uncheckedInput);
    }

    uncheckedInput.name = name;
    uncheckedInput.value = uncheckedValue;
    uncheckedInput.disabled = disabled;
  };

  const syncRoot = () => {
    if (isNativeButton(rootElement)) {
      if (!rootElement.hasAttribute("type")) {
        rootElement.setAttribute("type", "button");
      }
      rootElement.disabled = disabled;
    } else if (!isNaturallyFocusable(rootElement)) {
      if (disabled) {
        rootElement.tabIndex = -1;
      } else if (!rootElement.hasAttribute("tabindex")) {
        rootElement.tabIndex = 0;
      }
    }

    rootElement.setAttribute("role", "switch");
    setAria(rootElement, "checked", currentChecked);
    setAria(rootElement, "disabled", disabled ? true : null);
    setAria(rootElement, "readonly", readOnly ? true : null);
    setAria(rootElement, "required", required ? true : null);
    setCheckedStateAttrs(rootElement, currentChecked);
    setFlagStateAttrs(rootElement, disabled, readOnly, required);

    for (const thumb of getThumbs()) {
      setCheckedStateAttrs(thumb, currentChecked);
      setFlagStateAttrs(thumb, disabled, readOnly, required);
    }
  };

  const updateState = (checked: boolean, emitChange = true) => {
    if (currentChecked === checked) {
      syncGeneratedInputs();
      syncRoot();
      return;
    }

    currentChecked = checked;
    syncGeneratedInputs();
    syncRoot();

    if (!emitChange) return;
    emit(rootElement, "switch:change", { checked: currentChecked });
    onCheckedChange?.(currentChecked);
  };

  const toggleViaInput = () => {
    if (disabled || readOnly) return;
    hiddenInput.click();
  };

  const labels = getRootLabels(rootElement);
  if (labels.length > 0) {
    const labelIds = labels.map((label) => ensureId(label, "switch-label"));
    const labelledBy = mergeIdRefs(rootElement.getAttribute("aria-labelledby"), labelIds);
    if (labelledBy) {
      rootElement.setAttribute("aria-labelledby", labelledBy);
    }
  }

  syncGeneratedInputs();
  syncRoot();

  const form =
    hiddenInput.form ??
    (rootElement.closest("form") instanceof HTMLFormElement
      ? rootElement.closest("form")
      : null);
  if (form) {
    cleanups.push(
      on(form, "reset", () => {
        queueMicrotask(() => {
          updateState(hiddenInput.checked, false);
        });
      }),
    );
  }

  cleanups.push(
    on(hiddenInput, "click", (event) => {
      if (disabled || readOnly) {
        event.preventDefault();
      }
    }),
  );

  cleanups.push(
    on(hiddenInput, "change", () => {
      updateState(hiddenInput.checked);
    }),
  );

  cleanups.push(
    on(rootElement, "click", (event) => {
      if (event.target === hiddenInput || event.target === uncheckedInput) return;
      if (disabled || readOnly) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      hiddenInput.click();
    }),
  );

  if (!isNativeButton(rootElement)) {
    cleanups.push(
      on(rootElement, "keydown", (event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.repeat) return;
        if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " " && keyboardEvent.key !== "Spacebar") {
          return;
        }

        keyboardEvent.preventDefault();
        toggleViaInput();
      }),
    );
  }

  for (const label of labels) {
    if (label.contains(rootElement)) continue;
    cleanups.push(
      on(label, "click", (event) => {
        event.preventDefault();
        toggleViaInput();
      }),
    );
  }

  cleanups.push(
    on(rootElement, "switch:set", (event) => {
      const detail = (event as CustomEvent).detail;
      const checked =
        typeof detail === "boolean"
          ? detail
          : typeof detail?.checked === "boolean"
            ? detail.checked
            : typeof detail?.value === "boolean"
              ? detail.value
              : undefined;

      if (typeof checked === "boolean") {
        updateState(checked);
      }
    }),
  );

  const controller: SwitchController = {
    get checked() {
      return currentChecked;
    },
    toggle: () => updateState(!currentChecked),
    check: () => updateState(true),
    uncheck: () => updateState(false),
    setChecked: (checked) => updateState(Boolean(checked)),
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      hiddenInput.remove();
      uncheckedInput?.remove();
      clearRootBinding(rootElement, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(rootElement, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all switch instances in a scope.
 */
export function create(scope: ParentNode = document): SwitchController[] {
  const controllers: SwitchController[] = [];
  for (const root of getRoots(scope, "switch")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createSwitch(root as HTMLElement));
  }
  return controllers;
}
