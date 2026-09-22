import { afterEach, describe, expect, it } from "bun:test";
import { createFormFieldAdapter, type FormFieldAdapter } from "./form-field";

const adapters: FormFieldAdapter[] = [];
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const adapter of adapters) adapter.destroy();
  adapters.length = 0;
  document.body.innerHTML = "";
});

function setup({ detached = false, name = "fruit" as string | null, control = false } = {}) {
  const container = document.createElement("div");
  container.innerHTML = "<form></form><div></div>";
  const form = container.querySelector("form")!;
  const root = container.querySelector("div")!;
  const input = control ? document.createElement("input") : null;
  if (input) root.appendChild(input);
  if (!detached) {
    document.body.appendChild(form);
    form.appendChild(root);
  }
  const resets: Array<string | null> = [];
  const adapter = createFormFieldAdapter({
    root,
    name,
    defaultValue: "banana",
    control: input,
    onReset: (value) => resets.push(value),
  });
  adapters.push(adapter);
  adapter.setValue("apple");
  return { form, root, input, adapter, resets };
}

// Happy DOM neither excludes disabled inputs nor dispatches `formdata`.
// Supply the native event boundary here; fieldset inheritance is browser-tested.
function collectFormData(form: HTMLFormElement) {
  const formData = new FormData();
  for (const input of form.querySelectorAll("input")) {
    if (input.name && !input.disabled) formData.append(input.name, input.value);
  }
  const event = new Event("formdata", { bubbles: true });
  Object.defineProperty(event, "formData", { value: formData });
  form.dispatchEvent(event);
  return formData;
}

describe("core/form-field", () => {
  it("waits until after microtasks and native control resetting", async () => {
    const { form, root, resets } = setup();
    form.reset();
    await Promise.resolve();
    expect(resets).toEqual([]);
    await nextTask();
    expect(resets).toEqual(["banana"]);
    expect(root.querySelector("input")?.value).toBe("banana");
  });

  it("observes later cancellation even when propagation stops at the form", async () => {
    const { form, resets } = setup();
    form.addEventListener("reset", (event) => {
      event.stopPropagation();
      event.preventDefault();
    });
    form.reset();
    await nextTask();
    expect(resets).toEqual([]);
  });

  it("receives uncanceled resets whose propagation stops at the form", async () => {
    const { form, resets } = setup();
    form.addEventListener("reset", (event) => event.stopPropagation());
    form.reset();
    await nextTask();
    expect(resets).toEqual(["banana"]);
  });

  it("preserves a completed reset when the next reset is canceled", async () => {
    const { form, root, resets } = setup();
    form.reset();
    form.addEventListener("reset", (event) => event.preventDefault(), { once: true });
    form.reset();
    await nextTask();
    expect(resets).toEqual(["banana"]);
    expect(root.querySelector("input")?.value).toBe("banana");
  });

  it("preserves a newer selection when a subsequent reset is canceled", async () => {
    const { form, adapter, root, resets } = setup();
    form.reset();
    adapter.setValue("cherry");
    form.addEventListener("reset", (event) => event.preventDefault(), { once: true });
    form.reset();
    await nextTask();
    expect(resets).toEqual([]);
    expect(root.querySelector("input")?.value).toBe("cherry");
  });

  it("applies a later uncanceled reset after a newer selection", async () => {
    const { form, adapter, root, resets } = setup();
    form.reset();
    adapter.setValue("cherry");
    form.reset();
    await nextTask();
    expect(resets).toEqual(["banana"]);
    expect(root.querySelector("input")?.value).toBe("banana");
  });

  it("cleans up pending and future resets on destroy", async () => {
    const { form, adapter, resets } = setup();
    form.reset();
    form.reset();
    adapter.destroy();
    await nextTask();
    form.reset();
    await nextTask();
    expect(resets).toEqual([]);
  });

  it("preserves a value selected after the reset call", async () => {
    const { form, adapter, root, resets } = setup();
    form.reset();
    adapter.setValue("cherry");
    await nextTask();
    expect(resets).toEqual([]);
    expect(root.querySelector("input")?.value).toBe("cherry");
  });

  for (const name of ["fruit", null]) {
    it(`resets a ${name ? "named" : "unnamed"} form detached after initialization`, async () => {
      const { form, root, resets } = setup({ name });
      form.remove();
      form.reset();
      await nextTask();
      expect(resets).toEqual(["banana"]);
      if (name) expect(root.querySelector("input")?.value).toBe("banana");
    });

    it(`resets a ${name ? "named" : "unnamed"} root mounted after initialization`, async () => {
      const { form, root, resets } = setup({ detached: true, name });
      document.body.appendChild(form);
      form.appendChild(root);
      form.reset();
      await nextTask();
      expect(resets).toEqual(["banana"]);
    });

    it(`follows a ${name ? "named" : "unnamed"} root moved between forms`, async () => {
      const { form, root, resets } = setup({ name });
      const nextForm = document.createElement("form");
      document.body.appendChild(nextForm);
      nextForm.appendChild(root);
      form.reset();
      await nextTask();
      expect(resets).toEqual([]);
      nextForm.reset();
      await nextTask();
      expect(resets).toEqual(["banana"]);
    });
  }

  it("resets an initially detached form once before and after mounting", async () => {
    const container = document.createElement("div");
    container.innerHTML = "<form><div></div></form>";
    const form = container.querySelector("form")!;
    const root = form.querySelector("div")!;
    // Happy DOM returns detached nodes themselves instead of their tree root.
    Object.defineProperty(root, "getRootNode", { value: () => container });
    let resetCount = 0;
    const adapter = createFormFieldAdapter({
      root, name: "fruit", defaultValue: "banana", onReset: () => resetCount++,
    });
    adapters.push(adapter);
    form.reset();
    await nextTask();
    expect(resetCount).toBe(1);
    document.body.appendChild(form);
    form.reset();
    await nextTask();
    expect(resetCount).toBe(2);
  });

  it("preserves a disabled authored input's submission and destroy semantics", () => {
    document.body.innerHTML = '<form><div><input name="fruit" disabled></div></form>';
    const form = document.querySelector("form")!;
    const root = form.querySelector("div")!;
    const control = root.querySelector("input")!;
    const adapter = createFormFieldAdapter({
      root, control, name: "fruit", defaultValue: "apple", onReset: () => {},
    });
    adapters.push(adapter);
    const proxy = root.querySelector<HTMLInputElement>("[data-form-field-generated]")!;
    expect(proxy.disabled).toBe(true);
    // Browser coverage verifies FormData omission; Happy DOM includes disabled controls.
    adapter.destroy();
    expect(control.name).toBe("fruit");
    expect(control.disabled).toBe(true);
  });

  it("uses the control's disabled state at submission, including same-task changes", () => {
    const { form, input } = setup({ control: true });
    expect(Array.from(collectFormData(form))).toEqual([["fruit", "apple"]]);
    input!.disabled = true;
    expect(Array.from(collectFormData(form))).toEqual([]);
    input!.disabled = false;
    expect(Array.from(collectFormData(form))).toEqual([["fruit", "apple"]]);
  });

  it("submits an initially disabled authored input after it is reenabled", () => {
    document.body.innerHTML = '<form><div><input name="fruit" disabled></div></form>';
    const form = document.querySelector("form")!;
    const root = form.querySelector("div")!;
    const control = root.querySelector("input")!;
    const adapter = createFormFieldAdapter({
      root, control, name: "fruit", defaultValue: "apple", onReset: () => {},
    });
    adapters.push(adapter);
    control.disabled = false;
    expect(Array.from(collectFormData(form))).toEqual([["fruit", "apple"]]);
  });

  it("preserves duplicate names, identical values, and entry order", () => {
    const { form, root, input } = setup({ control: true });
    root.insertAdjacentHTML("beforebegin", '<input name="fruit" value="apple"><input name="other" value="before">');
    form.insertAdjacentHTML("beforeend", '<input name="other" value="after"><input name="fruit" value="apple">');
    const surrounding: Array<[string, string]> = [["fruit", "apple"], ["other", "before"], ["other", "after"], ["fruit", "apple"]];
    input!.disabled = true;
    expect(Array.from(collectFormData(form))).toEqual(surrounding);
    input!.disabled = false;
    expect(Array.from(collectFormData(form))).toEqual([
      ...surrounding.slice(0, 2), ["fruit", "apple"], ...surrounding.slice(2),
    ]);
  });

  it("keeps an explicitly disabled composite excluded even if the input is enabled", () => {
    document.body.innerHTML = '<form><div><input name="fruit"></div></form>';
    const form = document.querySelector("form")!;
    const root = form.querySelector("div")!;
    const control = root.querySelector("input")!;
    const adapter = createFormFieldAdapter({
      root, control, name: "fruit", defaultValue: "apple", disabled: true, onReset: () => {},
    });
    adapters.push(adapter);
    expect(Array.from(collectFormData(form))).toEqual([]);
  });

  it("removes submission bookkeeping and restores the native field on destroy", () => {
    const { form, root, input, adapter } = setup({ control: true });
    adapter.destroy();
    expect(root.querySelectorAll("input").length).toBe(1);
    input!.name = "fruit";
    input!.value = "Authored text";
    expect(Array.from(collectFormData(form))).toEqual([["fruit", "Authored text"]]);
  });

  it("keeps an unnamed composite associated while its input is portaled", async () => {
    const { form, input, resets } = setup({ name: null, control: true });
    document.body.appendChild(input!);
    form.reset();
    await nextTask();
    expect(resets).toEqual(["banana"]);
  });
});
