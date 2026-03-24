import {
  getRoots,
  getParts,
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

export interface RadioGroupOptions {
  /** Initial selected value */
  defaultValue?: string;
  /** Form field name used by generated radio inputs */
  name?: string;
  /** Disable user interaction and form submission */
  disabled?: boolean;
  /** Prevent user interaction while keeping programmatic control */
  readOnly?: boolean;
  /** Require a selected value for native form validation */
  required?: boolean;
  /** Callback fired when the selected value changes */
  onValueChange?: (value: string | null) => void;
}

export interface RadioGroupController {
  /** Current selected value */
  readonly value: string | null;
  /** Select a radio value programmatically */
  select(value: string): void;
  /** Clear the selected value programmatically */
  clear(): void;
  /** Cleanup listeners and generated inputs */
  destroy(): void;
}

const ROOT_BINDING_KEY = "@data-slot/radio-group";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/radio-group] createRadioGroup() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

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

interface RadioItem {
  el: HTMLElement;
  value: string;
  authoredDisabled: boolean;
  indicators: HTMLElement[];
  hiddenInput: HTMLInputElement;
}

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
 * Create a radio-group controller for a root element.
 *
 * Expected markup:
 * ```html
 * <div data-slot="radio-group" data-default-value="starter" data-name="plan">
 *   <label>
 *     <span data-slot="radio-group-item" data-value="starter">
 *       <span data-slot="radio-group-indicator"></span>
 *     </span>
 *     Starter
 *   </label>
 * </div>
 * ```
 */
export function createRadioGroup(
  root: Element,
  options: RadioGroupOptions = {},
): RadioGroupController {
  const existingController = reuseRootBinding<RadioGroupController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING,
  );
  if (existingController) return existingController;

  const rootElement = root as HTMLElement;
  const itemElements = getParts<HTMLElement>(rootElement, "radio-group-item");

  if (itemElements.length === 0) {
    throw new Error("RadioGroup requires at least one radio-group-item");
  }

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
  const name = options.name ?? getDataString(rootElement, "name");
  const onValueChange = options.onValueChange;

  const invalidItems: HTMLElement[] = [];
  const items: RadioItem[] = [];
  const itemByValue = new Map<string, RadioItem>();
  const cleanups: Array<() => void> = [];

  for (const el of itemElements) {
    const value = (el.dataset["value"] || "").trim();
    if (!value) {
      invalidItems.push(el);
      continue;
    }

    const hiddenInput = (rootElement.ownerDocument ?? document).createElement(
      "input",
    );
    hiddenInput.type = "radio";
    hiddenInput.tabIndex = -1;
    hiddenInput.setAttribute("aria-hidden", "true");
    hiddenInput.setAttribute("data-radio-group-generated", "input");
    hiddenInput.style.cssText = VISUALLY_HIDDEN_STYLES;
    insertAfter(el, hiddenInput);

    const authoredDisabled =
      el.hasAttribute("disabled") ||
      el.hasAttribute("data-disabled") ||
      el.getAttribute("aria-disabled") === "true";

    const item: RadioItem = {
      el,
      value,
      authoredDisabled,
      indicators: getParts<HTMLElement>(el, "radio-group-indicator"),
      hiddenInput,
    };

    items.push(item);
    if (!itemByValue.has(value)) {
      itemByValue.set(value, item);
    }
  }

  for (const el of invalidItems) {
    el.tabIndex = -1;
    el.setAttribute("aria-disabled", "true");
  }

  if (items.length === 0) {
    throw new Error(
      "RadioGroup requires at least one radio-group-item with a data-value attribute",
    );
  }

  const requestedValue = (
    options.defaultValue ??
    getDataString(rootElement, "defaultValue") ??
    ""
  ).trim();
  let currentItem = itemByValue.get(requestedValue) ?? null;

  const isItemDisabled = (item: RadioItem) => disabled || item.authoredDisabled;
  const getEnabledItems = () => items.filter((item) => !isItemDisabled(item));
  const getCurrentValue = () => currentItem?.value ?? null;

  const syncGeneratedInputs = () => {
    const inputRequired = Boolean(required && name);

    for (const item of items) {
      const checked = item === currentItem;
      item.hiddenInput.checked = checked;
      item.hiddenInput.disabled = isItemDisabled(item);
      item.hiddenInput.required = inputRequired;
      item.hiddenInput.value = item.value;

      if (name) {
        item.hiddenInput.name = name;
      } else {
        item.hiddenInput.removeAttribute("name");
      }
    }
  };

  const syncRoot = () => {
    rootElement.setAttribute("role", "radiogroup");
    setAria(rootElement, "disabled", disabled ? true : null);
    setAria(rootElement, "readonly", readOnly ? true : null);
    setAria(rootElement, "required", required ? true : null);

    const currentValue = getCurrentValue();
    if (currentValue) {
      rootElement.setAttribute("data-value", currentValue);
    } else {
      rootElement.removeAttribute("data-value");
    }
  };

  const updateTabOrder = () => {
    const enabledItems = getEnabledItems();
    const checkedEnabled =
      currentItem && enabledItems.includes(currentItem) ? currentItem : null;
    const focusTarget = checkedEnabled ?? enabledItems[0] ?? null;

    for (const item of items) {
      if (isItemDisabled(item)) {
        item.el.tabIndex = -1;
      } else {
        item.el.tabIndex = item === focusTarget ? 0 : -1;
      }
    }
  };

  const syncItems = () => {
    for (const item of items) {
      const checked = item === currentItem;
      const itemDisabled = isItemDisabled(item);

      if (isNativeButton(item.el) && !item.el.hasAttribute("type")) {
        item.el.type = "button";
      }
      if (isNativeButton(item.el)) {
        item.el.disabled = itemDisabled;
      }

      item.el.setAttribute("role", "radio");
      setAria(item.el, "checked", checked);
      setAria(item.el, "disabled", itemDisabled ? true : null);
      setAria(item.el, "readonly", readOnly ? true : null);
      setAria(item.el, "required", required ? true : null);
      setCheckedStateAttrs(item.el, checked);
      setFlagStateAttrs(item.el, itemDisabled, readOnly, required);

      for (const indicator of item.indicators) {
        setCheckedStateAttrs(indicator, checked);
        setFlagStateAttrs(indicator, itemDisabled, readOnly, required);
      }
    }

    updateTabOrder();
  };

  const applyState = (item: RadioItem | null, emitChange = true) => {
    if (currentItem === item) {
      syncGeneratedInputs();
      syncRoot();
      syncItems();
      return;
    }

    currentItem = item;
    syncGeneratedInputs();
    syncRoot();
    syncItems();

    if (!emitChange) return;
    emit(rootElement, "radio-group:change", { value: getCurrentValue() });
    onValueChange?.(getCurrentValue());
  };

  const focusItem = (item: RadioItem | null) => {
    if (!item) return;
    item.el.focus();
  };

  const getNextEnabled = (current: RadioItem, direction: 1 | -1): RadioItem | null => {
    const enabledItems = getEnabledItems();
    if (enabledItems.length === 0) return null;

    const currentIndex = enabledItems.findIndex((item) => item === current);
    if (currentIndex === -1) {
      return enabledItems[0] ?? null;
    }

    const nextIndex =
      (currentIndex + direction + enabledItems.length) % enabledItems.length;
    return enabledItems[nextIndex] ?? null;
  };

  const getBoundaryItem = (direction: "first" | "last"): RadioItem | null => {
    const enabledItems = getEnabledItems();
    if (enabledItems.length === 0) return null;
    return direction === "first"
      ? enabledItems[0] ?? null
      : enabledItems[enabledItems.length - 1] ?? null;
  };

  for (const item of items) {
    const labels = getRootLabels(item.el);
    if (labels.length > 0) {
      const labelIds = labels.map((label) => ensureId(label, "radio-group-label"));
      const labelledBy = mergeIdRefs(item.el.getAttribute("aria-labelledby"), labelIds);
      if (labelledBy) {
        item.el.setAttribute("aria-labelledby", labelledBy);
      }
    }

    cleanups.push(
      on(item.hiddenInput, "focus", () => {
        if (document.activeElement !== item.el) {
          item.el.focus();
        }
      }),
    );

    cleanups.push(
      on(item.hiddenInput, "click", (event) => {
        if (disabled || readOnly || item.authoredDisabled) {
          event.preventDefault();
        }
      }),
    );

    cleanups.push(
      on(item.hiddenInput, "change", () => {
        if (disabled || readOnly || item.authoredDisabled) return;
        applyState(item);
      }),
    );

    cleanups.push(
      on(item.el, "click", (event) => {
        if (event.target === item.hiddenInput) return;
        if (disabled || readOnly || item.authoredDisabled) {
          event.preventDefault();
          return;
        }
        if (currentItem === item) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        focusItem(item);
        item.hiddenInput.click();
      }),
    );

    cleanups.push(
      on(item.el, "keydown", (event) => {
        if (disabled || readOnly || item.authoredDisabled) return;

        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.repeat) return;

        switch (keyboardEvent.key) {
          case "ArrowRight":
          case "ArrowDown": {
            keyboardEvent.preventDefault();
            const nextItem = getNextEnabled(item, 1);
            focusItem(nextItem);
            if (nextItem) {
              applyState(nextItem);
            }
            return;
          }
          case "ArrowLeft":
          case "ArrowUp": {
            keyboardEvent.preventDefault();
            const previousItem = getNextEnabled(item, -1);
            focusItem(previousItem);
            if (previousItem) {
              applyState(previousItem);
            }
            return;
          }
          case "Home": {
            keyboardEvent.preventDefault();
            const firstItem = getBoundaryItem("first");
            focusItem(firstItem);
            if (firstItem) {
              applyState(firstItem);
            }
            return;
          }
          case "End": {
            keyboardEvent.preventDefault();
            const lastItem = getBoundaryItem("last");
            focusItem(lastItem);
            if (lastItem) {
              applyState(lastItem);
            }
            return;
          }
          case " ":
          case "Spacebar":
          case "Enter":
            keyboardEvent.preventDefault();
            if (currentItem !== item) {
              item.hiddenInput.click();
            }
            return;
          default:
            return;
        }
      }),
    );

    for (const label of labels) {
      if (label.contains(item.el)) continue;
      cleanups.push(
        on(label, "click", (event) => {
          event.preventDefault();
          if (disabled || readOnly || item.authoredDisabled) return;
          focusItem(item);
          if (currentItem === item) return;
          item.hiddenInput.click();
        }),
      );
    }
  }

  for (const item of items) {
    item.hiddenInput.defaultChecked = item === currentItem;
  }

  syncGeneratedInputs();
  syncRoot();
  syncItems();

  const form =
    items.find((item) => item.hiddenInput.form)?.hiddenInput.form ??
    (rootElement.closest("form") instanceof HTMLFormElement
      ? rootElement.closest("form")
      : null);

  if (form) {
    cleanups.push(
      on(form, "reset", () => {
        queueMicrotask(() => {
          const checkedItem =
            items.find((candidate) => candidate.hiddenInput.checked) ?? null;
          applyState(checkedItem, false);
        });
      }),
    );
  }

  cleanups.push(
    on(rootElement, "radio-group:set", (event) => {
      if (disabled || readOnly) return;

      const detail = (event as CustomEvent).detail;
      const value =
        detail?.value === null || typeof detail?.value === "string"
          ? detail.value
          : undefined;

      if (value === undefined) return;
      applyState(value === null ? null : itemByValue.get(value) ?? null);
    }),
  );

  const controller: RadioGroupController = {
    get value() {
      return getCurrentValue();
    },
    select: (value) => {
      const item = itemByValue.get(value);
      if (!item) return;
      applyState(item);
    },
    clear: () => applyState(null),
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      for (const item of items) {
        item.hiddenInput.remove();
      }
      clearRootBinding(rootElement, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(rootElement, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all radio-group instances in a scope.
 */
export function create(scope: ParentNode = document): RadioGroupController[] {
  const controllers: RadioGroupController[] = [];
  for (const root of getRoots(scope, "radio-group")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createRadioGroup(root as HTMLElement));
  }
  return controllers;
}
