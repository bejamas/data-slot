import { on } from "./events.ts";

/** Preserve a control's native submission eligibility when its value uses a proxy. */
export function observeFormFieldSubmission(
  root: Element,
  control: HTMLInputElement,
  proxy: HTMLInputElement | HTMLSelectElement,
  disabled: boolean,
) {
  // The marker identifies this proxy's position without confusing it with other
  // controls that submit the same name and value. It never reaches submitted data.
  const marker = root.ownerDocument.createElement("input");
  marker.type = "hidden";
  marker.name = `data-slot-form-field-${crypto.getRandomValues(new Uint32Array(4)).join("-")}`;
  const formAttribute = proxy.getAttribute("form");
  if (formAttribute !== null) marker.setAttribute("form", formAttribute);
  proxy.after(marker);

  const observed = new Map<Node, () => void>();
  const handled = new WeakSet<Event>();
  const handleFormData = (event: Event) => {
    if (event.target !== proxy.form || handled.has(event)) return;
    handled.add(event);
    observe();

    const data = (event as FormDataEvent).formData;
    const entries: Array<[string, FormDataEntryValue]> = Array.from(data.entries());
    const markerIndex = entries.findIndex(([name]) => name === marker.name);
    // Both inputs inherit any disabled fieldset surrounding the composite root.
    if (markerIndex < 0) return;

    const wasIncluded = !proxy.disabled;
    const excluded = disabled || control.matches(":disabled");
    proxy.disabled = excluded;

    // A MutationObserver would run too late for `input.disabled = true;
    // new FormData(form)`. Reconcile in the native formdata event instead.
    const start = markerIndex - (wasIncluded ? 1 : 0);
    entries.splice(start, wasIncluded ? 2 : 1, ...(
      excluded ? [] : [[proxy.name, proxy.value] as [string, FormDataEntryValue]]
    ));
    for (const name of new Set(data.keys())) data.delete(name);
    for (const [name, value] of entries) data.append(name, value);
  };

  const observe = () => {
    for (const node of [root.ownerDocument, root.getRootNode(), proxy.form]) {
      if (!node || observed.has(node)) continue;
      observed.set(node, on(node, "formdata", handleFormData, { capture: true }));
    }
  };
  observe();

  return {
    observe,
    destroy() {
      for (const cleanup of observed.values()) cleanup();
      observed.clear();
      marker.remove();
    },
  };
}
