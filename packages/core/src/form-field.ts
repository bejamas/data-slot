import { on } from "./events.ts";
import { observeFormFieldSubmission } from "./form-field-submission.ts";

/** Observes native form resets that target the composite control's form. */
export interface FormResetObserver {
  /**
   * Re-checks the root's tree and starts observing it when new. Call after
   * the root may have moved into a shadow tree, since `reset` is not composed.
   */
  observe(): void;
  destroy(): void;
}

/**
 * Listens for `reset` on the root's document, tree root, and owning form in the capture
 * phase, so resets whose propagation stops at the form are still seen, and
 * applies them on the next task, after all listeners (including late
 * `preventDefault()` calls) and native control resetting have finished.
 * Ownership is resolved at dispatch time via `getForm`, so a root initialized
 * detached or moved between forms follows its current form. The direct form
 * listener also survives detaching a previously observed form.
 */
export function observeFormReset({
  root,
  getForm,
  onReset,
  onResetDispatched,
}: {
  root: Element;
  getForm: () => HTMLFormElement | null;
  /** Runs on the next task after an uncanceled reset of the current form. */
  onReset: (event: Event) => void;
  /** Runs synchronously when a reset of the current form is first observed. */
  onResetDispatched?: (event: Event) => void;
}): FormResetObserver {
  const observed = new Map<Node, () => void>();
  const pending = new Map<Event, ReturnType<typeof setTimeout>>();

  const handleReset = (event: Event) => {
    if (event.target !== getForm() || pending.has(event)) return;
    observe();
    onResetDispatched?.(event);
    // Browser-dispatched events can run microtasks between listeners. Wait for
    // the next task so all cancellation and native control resetting finish.
    const timeout = setTimeout(() => {
      pending.delete(event);
      if (event.defaultPrevented || event.target !== getForm()) return;
      onReset(event);
    }, 0);
    // Keep earlier resets: a later dispatch may still be canceled.
    pending.set(event, timeout);
  };

  const observe = () => {
    for (const node of [root.ownerDocument, root.getRootNode(), getForm()]) {
      if (!node || observed.has(node)) continue;
      observed.set(node, on(node, "reset", handleReset, { capture: true }));
    }
  };
  observe();

  return {
    observe,
    destroy() {
      for (const timeout of pending.values()) clearTimeout(timeout);
      pending.clear();
      for (const cleanup of observed.values()) cleanup();
      observed.clear();
    },
  };
}

/** Native-form boundary for composite controls. */
export interface FormFieldAdapter {
  setValue(value: string | null): void;
  destroy(): void;
}

/** Keeps a composite control synchronized with a native form. */
export function createFormFieldAdapter({
  root,
  name,
  defaultValue,
  control,
  disabled = false,
  onReset,
}: {
  root: Element;
  name: string | null;
  defaultValue: string | null;
  control?: HTMLInputElement | null;
  /** Excludes the generated input from submission, like a disabled native control. */
  disabled?: boolean;
  onReset: (value: string | null) => void;
}): FormFieldAdapter {
  const authoredName = control?.getAttribute("name") ?? null;
  const authoredForm = control?.getAttribute("form") ?? null;
  let proxy: HTMLInputElement | null = null;

  if (name) {
    control?.removeAttribute("name");
    proxy = root.ownerDocument.createElement("input");
    proxy.type = "hidden";
    proxy.name = name;
    proxy.value = defaultValue ?? "";
    proxy.defaultValue = defaultValue ?? "";
    proxy.disabled = disabled || (control?.disabled ?? false);
    if (authoredForm !== null) proxy.setAttribute("form", authoredForm);
    proxy.setAttribute("data-form-field-generated", "");
    root.appendChild(proxy);
  }

  const submission = control && proxy
    ? observeFormFieldSubmission(root, control, proxy, disabled)
    : null;

  // A native control with an unresolved explicit `form` attribute deliberately
  // has no owner.
  const getForm = () => {
    if (proxy) return proxy.form;
    if (control?.hasAttribute("form")) return control.form;
    if (control?.form) return control.form;
    return root.closest("form");
  };

  // A value chosen after the reset event was dispatched wins over the reset.
  let lastValue = defaultValue;
  let valueVersion = 0;
  const resetVersions = new WeakMap<Event, number>();
  const observer = observeFormReset({
    root,
    getForm,
    onResetDispatched: (event) => {
      resetVersions.set(event, valueVersion);
    },
    onReset: (event) => {
      if (resetVersions.get(event) !== valueVersion) return;
      if (proxy) proxy.value = defaultValue ?? "";
      lastValue = defaultValue;
      onReset(defaultValue);
    },
  });

  return {
    setValue(value) {
      if (value !== lastValue) {
        lastValue = value;
        valueVersion++;
      }
      if (proxy) proxy.value = value ?? "";
      submission?.observe();
      observer.observe();
    },
    destroy() {
      observer.destroy();
      submission?.destroy();
      proxy?.remove();
      // Only restore what was stripped above.
      if (control && name) {
        if (authoredName === null) control.removeAttribute("name");
        else control.setAttribute("name", authoredName);
      }
    },
  };
}
