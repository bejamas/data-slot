/**
 * Owns the native-form boundary for composite controls. The generated hidden
 * input is the single successful control, while the visible control may keep
 * its own presentation state.
 */
export class FormFieldAdapter {
  readonly defaultValue: string;
  private currentValue: string;
  private readonly proxy: HTMLInputElement | null;
  private readonly control: HTMLInputElement | null;
  private readonly authoredName: string | null;
  private destroyed = false;
  private readonly removeResetListener: (() => void) | null;

  constructor({
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
  }) {
    this.defaultValue = defaultValue ?? "";
    this.currentValue = this.defaultValue;
    this.control = control ?? null;
    this.authoredName = this.control?.getAttribute("name") ?? null;

    if (!name) {
      this.proxy = null;
      this.removeResetListener = null;
      return;
    }

    if (this.control) this.control.removeAttribute("name");
    const proxy = root.ownerDocument.createElement("input");
    proxy.type = "hidden";
    proxy.name = name;
    proxy.value = this.currentValue;
    proxy.defaultValue = this.defaultValue;
    proxy.setAttribute("data-form-field-generated", "");
    root.appendChild(proxy);
    this.proxy = proxy;

    const form = proxy.form ?? (root.closest("form") instanceof HTMLFormElement ? root.closest("form") : null);
    if (!form) {
      this.removeResetListener = null;
      return;
    }
    const handleReset = (event: Event) => {
      // The browser resets controls after dispatching reset. A microtask also
      // lets later listeners cancel the event before presentation is synced.
      queueMicrotask(() => {
        if (this.destroyed || event.defaultPrevented) return;
        this.currentValue = this.defaultValue;
        if (this.proxy) this.proxy.value = this.defaultValue;
        onReset(this.defaultValue === "" ? null : this.defaultValue);
      });
    };
    form.addEventListener("reset", handleReset);
    this.removeResetListener = () => form.removeEventListener("reset", handleReset);
  }

  setValue(value: string | null): void {
    this.currentValue = value ?? "";
    if (this.proxy) this.proxy.value = this.currentValue;
  }

  destroy(): void {
    this.destroyed = true;
    this.removeResetListener?.();
    this.proxy?.remove();
    if (this.control) {
      if (this.authoredName === null) this.control.removeAttribute("name");
      else this.control.setAttribute("name", this.authoredName);
    }
  }
}
