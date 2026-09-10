import { on } from "./events.ts";

/** Makes a visually hidden proxy validate and report errors at its visible control. */
export function observeFormFieldValidation(proxy: HTMLInputElement, target?: HTMLElement) {
  proxy.type = "text";
  proxy.required = true;
  proxy.tabIndex = -1;
  proxy.setAttribute("aria-hidden", "true");
  Object.assign(proxy.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: "0",
  });

  const view = proxy.ownerDocument.defaultView;
  let focusFrame: number | undefined;
  const cancelFocus = () => {
    if (focusFrame !== undefined) view?.cancelAnimationFrame(focusFrame);
    focusFrame = undefined;
  };
  const sync = () => {
    cancelFocus();
    if (proxy.willValidate && !proxy.validity.valid) target?.setAttribute("aria-invalid", "true");
    else target?.removeAttribute("aria-invalid");
  };
  const isFirstInvalid = () => {
    if (!proxy.willValidate || proxy.validity.valid) return false;
    if (!proxy.form) return true;
    // Reading validity does not dispatch another round of invalid events.
    return Array.from(proxy.form.elements).find((element) => {
      const field = element as HTMLInputElement;
      return field.willValidate && !field.validity.valid;
    }) === proxy;
  };
  const cleanup = on(proxy, "invalid", (event) => {
    sync();
    const canceled = event.defaultPrevented;
    event.preventDefault();
    if (canceled || !target || !isFirstInvalid()) return;
    target.focus();
    const form = proxy.form;
    // Native interactive validation may focus a later native field after this
    // listener. Only the first invalid field may restore focus afterward.
    focusFrame = view?.requestAnimationFrame(() => {
      focusFrame = undefined;
      if (proxy.form === form && isFirstInvalid()) target.focus();
    });
  });
  sync();

  return {
    sync,
    destroy() {
      cancelFocus();
      cleanup();
      target?.removeAttribute("aria-invalid");
    },
  };
}
