import { afterEach, describe, expect, it } from "bun:test";
import { createToast, type ToastController, type ToastOptions } from "./index";

describe("Toast entry ownership", () => {
  let controller: ToastController;
  const setup = (options: ToastOptions = {}) => {
    document.body.innerHTML = '<div data-slot="toast"><ol data-slot="toast-viewport"></ol></div>';
    const root = document.querySelector<HTMLElement>('[data-slot="toast"]')!;
    controller = createToast(root, { duration: 0, ...options });
    return root;
  };
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  afterEach(() => {
    controller?.destroy();
    document.body.innerHTML = "";
  });

  it.each(["success", "error"] as const)("ignores stale promise %s after ID reuse", async (outcome) => {
    const root = setup();
    const task = Promise.withResolvers<string>();
    const handle = controller.promise(task.promise, { loading: "Loading", success: "Old success", error: "Old error" });
    controller.show({ id: handle.id, title: "Replacement" });

    if (outcome === "success") {
      task.resolve("result");
      expect(await handle.unwrap()).toBe("result");
    } else {
      task.reject(new Error("Request failed"));
      await expect(handle.unwrap()).rejects.toThrow("Request failed");
    }

    expect(root.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Replacement");
    expect(controller.count).toBe(1);
  });

  it("keeps a replacement created by the dismissal callback", async () => {
    const root = setup({ onDismiss: (id) => controller.show({ id, title: "Replacement" }) });
    controller.show({ id: "job", title: "Original" });
    controller.dismiss("job");
    await nextFrame();
    await nextFrame();

    expect(root.querySelectorAll('[data-slot="toast-item"]')).toHaveLength(1);
    expect(root.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Replacement");
    expect(controller.count).toBe(1);
  });

  it("captures the promise entry before onShow can replace it", async () => {
    let replaced = false;
    const root = setup({ onShow: (id) => {
      if (replaced) return;
      replaced = true;
      controller.show({ id, title: "Replacement" });
    } });
    const handle = controller.promise(Promise.resolve("result"), { loading: "Loading", success: "Old success" });
    await handle.unwrap();

    expect(root.querySelectorAll('[data-slot="toast-item"]')).toHaveLength(1);
    expect(root.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Replacement");
  });

  it("disposes a toast created during a replacement callback before committing the replacement", () => {
    let dismissals = 0;
    const root = setup({ onDismiss: (id) => {
      dismissals++;
      controller.show({ id, title: "Callback toast" });
    } });
    controller.show({ id: "job", title: "Original" });
    controller.show({ id: "job", title: "Replacement" });

    expect(dismissals).toBe(1);
    expect(controller.count).toBe(1);
    expect(root.querySelectorAll('[data-slot="toast-item"]')).toHaveLength(1);
    expect(root.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Replacement");
  });

  it("does not mount a replacement after onDismiss destroys the controller", () => {
    const root = setup({ onDismiss: () => controller.destroy() });
    controller.show({ id: "job", title: "Original" });
    controller.show({ id: "job", title: "Replacement" });

    expect(controller.count).toBe(0);
    expect(root.querySelectorAll('[data-slot="toast-item"]')).toHaveLength(0);
  });

  it("does not dismiss a replacement created by an action callback", () => {
    const root = setup();
    controller.show({ id: "job", title: "Original", action: {
      label: "Retry",
      onClick: () => controller.show({ id: "job", title: "Replacement" }),
    } });
    root.querySelector<HTMLElement>('[data-slot="toast-action"]')!.click();

    expect(controller.count).toBe(1);
    expect(root.querySelector('[data-slot="toast-item"]')?.getAttribute("data-state")).toBe("open");
    expect(root.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Replacement");
  });

  it("restarts an updated duration only after all pause reasons clear", async () => {
    const root = setup();
    const viewport = root.querySelector<HTMLElement>('[data-slot="toast-viewport"]')!;
    const id = controller.show({ title: "Timed", duration: 20 });
    viewport.dispatchEvent(new Event("pointerenter"));
    window.dispatchEvent(new Event("blur"));
    controller.update(id, { duration: 50 });
    await wait(65);
    viewport.dispatchEvent(new Event("pointerleave"));
    await wait(65);
    expect(controller.count).toBe(1);

    window.dispatchEvent(new Event("focus"));
    await wait(15);
    expect(controller.count).toBe(1);
    await wait(55);
    expect(controller.count).toBe(0);
  });

  it("cancels old countdown and mount tracking when replacing an entry", async () => {
    const root = setup();
    controller.show({ id: "job", title: "Original", duration: 10 });
    const oldItem = root.querySelector<HTMLElement>('[data-slot="toast-item"]')!;
    controller.show({ id: "job", title: "Replacement" });
    await wait(30);
    await nextFrame();
    await nextFrame();

    expect(oldItem.isConnected).toBe(false);
    expect(oldItem.getAttribute("data-mounted")).toBe("false");
    expect(controller.count).toBe(1);
    expect(root.querySelector('[data-slot="toast-item"]')?.getAttribute("data-mounted")).toBe("true");
  });

  it.each(["replace", "disable", "destroy"] as const)("cancels a captured gesture on %s", (operation) => {
    const root = setup();
    controller.show({ id: "job", title: "Original" });
    const item = root.querySelector<HTMLElement>('[data-slot="toast-item"]')!;
    const released: number[] = [];
    item.setPointerCapture = () => {};
    item.releasePointerCapture = (id) => released.push(id);
    item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, button: 0, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 80, clientY: 0 }));

    if (operation === "replace") controller.show({ id: "job", title: "Replacement" });
    else if (operation === "disable") controller.update("job", { dismissible: false });
    else controller.destroy();
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 80, clientY: 0 }));

    expect(released).toEqual([1]);
    expect(item.getAttribute("data-swiping")).toBe("false");
    expect(controller.count).toBe(operation === "destroy" ? 0 : 1);
  });

  it("keeps a destroyed controller inert when late work arrives", async () => {
    const root = setup();
    const task = Promise.withResolvers<string>();
    const handle = controller.promise(task.promise, { loading: "Loading", success: "Done" });
    controller.destroy();
    controller.show({ title: "Late toast", duration: 10 });
    task.resolve("result");
    expect(await handle.unwrap()).toBe("result");
    const late = controller.promise(Promise.resolve("late result"), { loading: "Late loading" });
    expect(await late.unwrap()).toBe("late result");
    await nextFrame();
    await nextFrame();

    expect(root.querySelectorAll('[data-slot="toast-item"]')).toHaveLength(0);
    expect(controller.count).toBe(0);
  });
});
