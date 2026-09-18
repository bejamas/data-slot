import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { clearRootBinding, getRootBinding, setRootBinding } from "@data-slot/core";
import { create, createToast, type ToastController } from "./index";

const ROOT_BINDING_KEY = "@data-slot/toast";

describe("Toast root binding", () => {
  let root: HTMLElement;
  const controllers = new Set<ToastController>();
  const track = (controller: ToastController) => {
    controllers.add(controller);
    return controller;
  };

  beforeEach(() => {
    document.body.innerHTML = '<div data-slot="toast"><ol data-slot="toast-viewport"></ol></div>';
    root = document.querySelector<HTMLElement>('[data-slot="toast"]')!;
  });

  afterEach(() => {
    controllers.forEach((controller) => controller.destroy());
    controllers.clear();
    clearRootBinding(root, ROOT_BINDING_KEY);
    document.body.innerHTML = "";
  });

  it.each([false, true])("reuses direct binds and preserves options with portal=%s", (portal) => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const first = track(createToast(root, { portal, position: "top-left", duration: 0 }));
      const second = track(createToast(root, { portal, position: "bottom-right" }));
      const third = track(createToast(root));

      expect(second === first && third === first).toBe(true);
      expect(root.getAttribute("data-position")).toBe("top-left");
      if (process.env.NODE_ENV !== "production") expect(warn).toHaveBeenCalledTimes(1);
      root.dispatchEvent(new CustomEvent("toast:show", { detail: { title: "One event" } }));
      expect(document.querySelectorAll('[data-slot="toast-item"]')).toHaveLength(1);
      expect(first.count).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("discovery skips manually bound roots and initializes only new roots", () => {
    const manual = track(createToast(root, { duration: 0 }));
    document.body.insertAdjacentHTML("beforeend", '<div data-slot="toast" data-duration="0"><ol data-slot="toast-viewport"></ol></div>');
    const discovered = create();
    discovered.forEach(track);

    expect(discovered).toHaveLength(1);
    expect(create()).toHaveLength(0);
    root.dispatchEvent(new CustomEvent("toast:show", { detail: { title: "One event" } }));
    expect(root.querySelectorAll('[data-slot="toast-item"]')).toHaveLength(1);
    expect(manual.count).toBe(1);
  });

  it("direct creation reuses a controller created by discovery", () => {
    const first = track(create()[0]!);
    const direct = track(createToast(root));
    expect(direct === first).toBe(true);
  });

  it("honors an existing shared registry binding", () => {
    const otherRoot = document.createElement("div");
    otherRoot.innerHTML = '<ol data-slot="toast-viewport"></ol>';
    const existing = track(createToast(otherRoot));
    setRootBinding(root, ROOT_BINDING_KEY, existing);

    expect(createToast(root) === existing).toBe(true);
    expect(create()).toHaveLength(0);
  });

  it("allows discovery to retry after missing markup is repaired", () => {
    root.replaceChildren();
    expect(() => create()).toThrow("Toast requires a toast-viewport slot");
    expect(getRootBinding(root, ROOT_BINDING_KEY)).toBeUndefined();
    root.innerHTML = '<ol data-slot="toast-viewport"></ol>';
    const discovered = create();
    discovered.forEach(track);

    expect(discovered).toHaveLength(1);
    expect(getRootBinding(root, ROOT_BINDING_KEY) === discovered[0]).toBe(true);
  });

  it("supports rebinding after destruction without an old controller clearing the new binding", () => {
    const first = track(createToast(root, { portal: true, position: "top-left" }));
    first.destroy();
    expect(getRootBinding(root, ROOT_BINDING_KEY)).toBeUndefined();
    const rebound = track(createToast(root, { position: "bottom-right" }));
    first.destroy();

    expect(rebound === first).toBe(false);
    expect(root.getAttribute("data-position")).toBe("bottom-right");
    expect(getRootBinding(root, ROOT_BINDING_KEY) === rebound).toBe(true);
    expect(create()).toHaveLength(0);
  });

  it("only clears the registry entry it owns during destruction", () => {
    const first = track(createToast(root));
    const otherRoot = document.createElement("div");
    otherRoot.innerHTML = '<ol data-slot="toast-viewport"></ol>';
    const replacement = track(createToast(otherRoot));
    setRootBinding(root, ROOT_BINDING_KEY, replacement);
    first.destroy();

    expect(getRootBinding(root, ROOT_BINDING_KEY) === replacement).toBe(true);
  });
});
