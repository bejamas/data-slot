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
  onReset,
}: {
  root: Element;
  name: string | null;
  defaultValue: string | null;
  control?: HTMLInputElement | null;
  onReset: (value: string | null) => void;
}): FormFieldAdapter {
  let currentValue = defaultValue;
  let destroyed = false;
  const authoredName = control?.getAttribute("name") ?? null;
  const authoredForm = control?.getAttribute("form") ?? null;
  let proxy: HTMLInputElement | null = null;

  if (name) {
    control?.removeAttribute("name");
    proxy = root.ownerDocument.createElement("input");
    proxy.type = "hidden";
    proxy.name = name;
    proxy.value = currentValue ?? "";
    proxy.defaultValue = defaultValue ?? "";
    if (authoredForm !== null) proxy.setAttribute("form", authoredForm);
    proxy.setAttribute("data-form-field-generated", "");
    root.appendChild(proxy);
  }

  const form =
    proxy?.form ??
    control?.form ??
    (root.closest("form") instanceof HTMLFormElement ? root.closest("form") : null);
  const handleReset = (event: Event) => {
    // Native controls reset after dispatch. Deferring also observes a later
    // listener that cancels the reset.
    queueMicrotask(() => {
      if (destroyed || event.defaultPrevented) return;
      currentValue = defaultValue;
      if (proxy) proxy.value = defaultValue ?? "";
      onReset(defaultValue);
    });
  };
  form?.addEventListener("reset", handleReset);

  return {
    setValue(value) {
      currentValue = value;
      if (proxy) proxy.value = value ?? "";
    },
    destroy() {
      destroyed = true;
      form?.removeEventListener("reset", handleReset);
      proxy?.remove();
      if (control) {
        if (authoredName === null) control.removeAttribute("name");
        else control.setAttribute("name", authoredName);
      }
    },
  };
}
