import { beforeEach, describe, expect, it } from "bun:test";
import { create, createToast } from "./index";

describe("Toast", () => {
  const setup = (
    options: Parameters<typeof createToast>[1] = {},
    html?: string,
  ) => {
    document.body.innerHTML =
      html ??
      `
      <div data-slot="toast" id="root">
        <template data-slot="toast-template">
          <li data-slot="toast-item" role="status" aria-atomic="true">
            <span data-slot="toast-title"></span>
            <span data-slot="toast-description"></span>
            <button data-slot="toast-action" type="button"></button>
            <button data-slot="toast-close" type="button" aria-label="Close">×</button>
          </li>
        </template>
        <ol data-slot="toast-viewport"></ol>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const viewport = root.querySelector('[data-slot="toast-viewport"]') as HTMLElement;
    const controller = createToast(root, options);

    return { root, viewport, controller };
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  const waitForRaf = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const waitForClose = async () => {
    await waitForRaf();
    await waitForRaf();
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("creates a fallback template when toast-template is missing", () => {
    const { root, controller } = setup(
      {},
      `
        <div data-slot="toast" id="root">
          <ol data-slot="toast-viewport"></ol>
        </div>
      `,
    );

    controller.show({ title: "Hello" });

    const item = root.querySelector('[data-slot="toast-item"]') as HTMLElement;
    const title = item.querySelector('[data-slot="toast-title"]') as HTMLElement;
    const action = item.querySelector('[data-slot="toast-action"]') as HTMLElement;
    const close = item.querySelector('[data-slot="toast-close"]') as HTMLElement;

    expect(item).toBeTruthy();
    expect(title.textContent).toBe("Hello");
    expect(action).toBeTruthy();
    expect(close).toBeTruthy();

    controller.destroy();
  });

  it("falls back when authored template has no toast-item slot", () => {
    const { root, controller } = setup(
      {},
      `
        <div data-slot="toast" id="root">
          <template data-slot="toast-template">
            <div>Invalid template</div>
          </template>
          <ol data-slot="toast-viewport"></ol>
        </div>
      `,
    );

    controller.show({ title: "Fallback" });

    const item = root.querySelector('[data-slot="toast-item"]') as HTMLElement;
    expect(item).toBeTruthy();
    expect(item.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Fallback");

    controller.destroy();
  });

  it("prefers JS options over data-* attributes", async () => {
    const { root, controller } = setup(
      { limit: 1, duration: 0, position: "bottom-center" },
      `
        <div data-slot="toast" id="root" data-limit="5" data-duration="9999" data-position="top-left">
          <template data-slot="toast-template">
            <li data-slot="toast-item">
              <span data-slot="toast-title"></span>
              <button data-slot="toast-close" type="button">x</button>
            </li>
          </template>
          <ol data-slot="toast-viewport"></ol>
        </div>
      `,
    );

    controller.show({ title: "One" });
    controller.show({ title: "Two" });

    expect(root.getAttribute("data-position")).toBe("bottom-center");
    expect(root.querySelector('[data-slot="toast-viewport"]')?.getAttribute("data-position")).toBe(
      "bottom-center",
    );
    expect(controller.count).toBe(2);
    expect(root.querySelectorAll('[data-slot="toast-item"][data-visible="true"]')).toHaveLength(1);

    await waitForClose();
    controller.destroy();
  });

  it("show clones and populates template parts", () => {
    const { root, controller } = setup({ duration: 0 });

    controller.show({ title: "Saved" });

    const item = root.querySelector('[data-slot="toast-item"]') as HTMLElement;
    const title = item.querySelector('[data-slot="toast-title"]') as HTMLElement;
    const description = item.querySelector('[data-slot="toast-description"]') as HTMLElement;
    const action = item.querySelector('[data-slot="toast-action"]') as HTMLElement;

    expect(title.textContent).toBe("Saved");
    expect(description.hidden).toBe(true);
    expect(action.hidden).toBe(true);

    controller.destroy();
  });

  it("show applies custom close button aria label when provided", () => {
    const { root, controller } = setup({ duration: 0 });

    controller.show({ title: "Custom close", closeButtonAriaLabel: "Yeet the notice" });

    const close = root.querySelector('[data-slot="toast-close"]') as HTMLElement;
    expect(close.getAttribute("aria-label")).toBe("Yeet the notice");

    controller.destroy();
  });

  it("show applies data-testid when provided", () => {
    const { root, controller } = setup({ duration: 0 });

    controller.show({ title: "With test id", testId: "my-test-toast" });

    const item = root.querySelector('[data-slot="toast-item"]') as HTMLElement;
    expect(item.getAttribute("data-testid")).toBe("my-test-toast");

    controller.destroy();
  });

  it("show throws when title is empty", () => {
    const { controller } = setup();

    expect(() => controller.show({ title: "" })).toThrow("Toast show requires a non-empty title");

    controller.destroy();
  });

  it("returns id and sets item runtime attributes", () => {
    const { root, controller } = setup({ duration: 0 });

    const id = controller.show({ title: "Saved", type: "success" });

    const item = root.querySelector('[data-slot="toast-item"]') as HTMLElement;
    expect(id).toBeTruthy();
    expect(item.getAttribute("data-id")).toBe(id);
    expect(item.getAttribute("data-type")).toBe("success");
    expect(item.getAttribute("data-state")).toBe("open");
    expect(item.hasAttribute("data-open")).toBe(true);

    controller.destroy();
  });

  it("update mutates an active toast in place", () => {
    const { root, controller } = setup({ duration: 0 });

    const id = controller.show({ title: "Initial", type: "loading", description: "Pending" });
    const before = root.querySelector(`[data-slot="toast-item"][data-id="${id}"]`) as HTMLElement;

    controller.update(id, {
      title: "Updated",
      description: "Done",
      type: "success",
      action: { label: "Undo", value: "undo" },
      closeButtonAriaLabel: "Dismiss",
      testId: "updated-toast",
    });

    const after = root.querySelector(`[data-slot="toast-item"][data-id="${id}"]`) as HTMLElement;
    expect(after).toBe(before);
    expect(after.getAttribute("data-type")).toBe("success");
    expect(after.getAttribute("data-testid")).toBe("updated-toast");
    expect(after.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Updated");
    expect(after.querySelector('[data-slot="toast-description"]')?.textContent).toBe("Done");
    expect(after.querySelector('[data-slot="toast-action"]')?.textContent).toBe("Undo");
    expect(after.querySelector('[data-slot="toast-close"]')?.getAttribute("aria-label")).toBe("Dismiss");

    controller.destroy();
  });

  it("update clears close button aria-label override and restores template label", () => {
    const { root, controller } = setup(
      { duration: 0 },
      `
        <div data-slot="toast" id="root">
          <template data-slot="toast-template">
            <li data-slot="toast-item" role="status" aria-atomic="true">
              <span data-slot="toast-title"></span>
              <button data-slot="toast-close" type="button" aria-label="Dismiss notification">×</button>
            </li>
          </template>
          <ol data-slot="toast-viewport"></ol>
        </div>
      `,
    );

    const id = controller.show({
      title: "Close label",
      closeButtonAriaLabel: "Custom close label",
    });
    const close = root.querySelector(`[data-id="${id}"] [data-slot="toast-close"]`) as HTMLElement;
    expect(close.getAttribute("aria-label")).toBe("Custom close label");

    controller.update(id, { closeButtonAriaLabel: undefined });
    expect(close.getAttribute("aria-label")).toBe("Dismiss notification");

    controller.destroy();
  });

  it("update can restart auto-dismiss timing", async () => {
    const { controller } = setup({ duration: 0 });

    const id = controller.show({ title: "Persistent", duration: 0 });
    controller.update(id, { duration: 20 });

    await wait(35);
    await waitForClose();
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("auto-dismisses after duration", async () => {
    const { controller } = setup();

    controller.show({ title: "Bye", duration: 20 });

    await wait(35);
    await waitForClose();

    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("does not auto-dismiss when duration is 0", async () => {
    const { controller } = setup();

    controller.show({ title: "Persistent", duration: 0 });

    await wait(60);
    expect(controller.count).toBe(1);

    controller.destroy();
  });

  it("pauses timers on hover and resumes on leave", async () => {
    const { viewport, controller } = setup();

    controller.show({ title: "Hover me", duration: 40 });
    await wait(20);

    viewport.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await wait(40);

    expect(controller.count).toBe(1);
    expect(viewport.hasAttribute("data-expanded")).toBe(true);

    viewport.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    await wait(35);
    await waitForClose();

    expect(viewport.hasAttribute("data-expanded")).toBe(false);
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("pauses timers on focus when pauseOnFocus is true", async () => {
    const { viewport, controller } = setup({ pauseOnFocus: true });

    controller.show({ title: "Focusable", duration: 35 });

    viewport.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await wait(40);

    expect(controller.count).toBe(1);
    expect(viewport.hasAttribute("data-expanded")).toBe(true);

    viewport.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await wait(40);
    await waitForClose();

    expect(controller.count).toBe(0);
    expect(viewport.hasAttribute("data-expanded")).toBe(false);

    controller.destroy();
  });

  it("keeps focus pause active while focus moves within viewport", async () => {
    const { root, viewport, controller } = setup({ pauseOnFocus: true });

    const id = controller.show({
      title: "Focusable controls",
      duration: 35,
      action: { label: "Action", value: "a" },
    });

    const actionButton = root.querySelector(
      `[data-id="${id}"] [data-slot="toast-action"]`,
    ) as HTMLElement;
    const closeButton = root.querySelector(
      `[data-id="${id}"] [data-slot="toast-close"]`,
    ) as HTMLElement;

    actionButton.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await wait(20);

    actionButton.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: closeButton }),
    );
    closeButton.dispatchEvent(new FocusEvent("focusin", { bubbles: true, relatedTarget: actionButton }));
    await wait(30);

    expect(viewport.hasAttribute("data-expanded")).toBe(true);
    expect(controller.count).toBe(1);

    closeButton.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await wait(40);
    await waitForClose();

    expect(viewport.hasAttribute("data-expanded")).toBe(false);
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("hides overflow toasts and reveals next hidden toast when front closes", async () => {
    const { root, controller } = setup({ limit: 1, duration: 0 });

    const first = controller.show({ title: "One" });
    const second = controller.show({ title: "Two" });

    expect(controller.count).toBe(2);

    const firstItem = root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`) as HTMLElement;
    const secondItem = root.querySelector(`[data-slot="toast-item"][data-id="${second}"]`) as HTMLElement;

    expect(firstItem.getAttribute("data-state")).toBe("open");
    expect(firstItem.getAttribute("data-visible")).toBe("false");
    expect(secondItem.getAttribute("data-state")).toBe("open");
    expect(secondItem.getAttribute("data-visible")).toBe("true");

    controller.dismiss(second);
    await waitForClose();

    const promoted = root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`) as HTMLElement;
    expect(promoted.getAttribute("data-state")).toBe("open");
    expect(promoted.getAttribute("data-visible")).toBe("true");
    expect(controller.count).toBe(1);

    await waitForClose();
    controller.destroy();
  });

  it("makes overflow-hidden toasts non-interactive and restores focusability when visible again", async () => {
    const { root, viewport, controller } = setup({ limit: 1, duration: 0, pauseOnFocus: true });

    const first = controller.show({
      title: "One",
      action: { label: "Action" },
    });
    const firstItem = root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`) as HTMLElement;
    const firstAction = root.querySelector(
      `[data-slot="toast-item"][data-id="${first}"] [data-slot="toast-action"]`,
    ) as HTMLElement;

    firstAction.setAttribute("tabindex", "2");
    firstAction.focus();
    const tracksFocus = document.activeElement === firstAction;
    firstAction.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(viewport.hasAttribute("data-expanded")).toBe(true);

    const second = controller.show({ title: "Two" });
    const secondItem = root.querySelector(`[data-slot="toast-item"][data-id="${second}"]`) as HTMLElement;

    expect(firstItem.getAttribute("data-visible")).toBe("false");
    expect(firstItem.getAttribute("aria-hidden")).toBe("true");
    expect(firstItem.hasAttribute("inert")).toBe(true);
    expect(firstAction.getAttribute("tabindex")).toBe("-1");
    expect(secondItem.getAttribute("data-visible")).toBe("true");
    expect(viewport.hasAttribute("data-expanded")).toBe(false);
    if (tracksFocus) {
      expect(document.activeElement).not.toBe(firstAction);
    }

    controller.dismiss(second);
    await waitForClose();

    expect(firstItem.getAttribute("data-visible")).toBe("true");
    expect(firstItem.hasAttribute("aria-hidden")).toBe(false);
    expect(firstItem.hasAttribute("inert")).toBe(false);
    expect(firstAction.getAttribute("tabindex")).toBe("2");

    controller.destroy();
  });

  it("update patches hidden overflow toast before it is revealed", async () => {
    const { root, controller } = setup({ limit: 1, duration: 0 });

    const first = controller.show({ title: "One" });
    const second = controller.show({ title: "Two" });

    controller.update(first, {
      title: "One updated",
      type: "info",
      description: "Promoted from queue",
    });

    controller.dismiss(second);
    await waitForClose();

    const promoted = root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`) as HTMLElement;
    expect(promoted.getAttribute("data-state")).toBe("open");
    expect(promoted.getAttribute("data-visible")).toBe("true");
    expect(promoted.getAttribute("data-type")).toBe("info");
    expect(promoted.querySelector('[data-slot="toast-title"]')?.textContent).toBe("One updated");
    expect(promoted.querySelector('[data-slot="toast-description"]')?.textContent).toBe(
      "Promoted from queue",
    );

    controller.destroy();
  });

  it("expires hidden overflow auto-dismiss toasts while they are not visible", async () => {
    const { root, controller } = setup({ limit: 1, duration: 0 });

    const first = controller.show({ title: "First", duration: 25 });
    const second = controller.show({ title: "Second", duration: 0 });
    const hidden = root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`) as HTMLElement;

    expect(hidden.getAttribute("data-visible")).toBe("false");

    await wait(40);
    controller.dismiss(second);
    await waitForClose();

    expect(root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`)).toBeNull();
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("shows only recent visible toasts up to limit and keeps older ones hidden", async () => {
    const { root, controller } = setup({ limit: 3, duration: 0 });

    const ids = [
      controller.show({ title: "One" }),
      controller.show({ title: "Two" }),
      controller.show({ title: "Three" }),
      controller.show({ title: "Four" }),
      controller.show({ title: "Five" }),
    ];

    expect(controller.count).toBe(5);

    const visibleIds = [
      ...root.querySelectorAll<HTMLElement>('[data-slot="toast-item"][data-state="open"][data-visible="true"]'),
    ].map((item) => item.getAttribute("data-id"));

    expect(visibleIds).toEqual(ids.slice(2, 5));
    expect(root.querySelector(`[data-slot="toast-item"][data-id="${ids[0]}"]`)?.getAttribute("data-visible")).toBe(
      "false",
    );
    expect(root.querySelector(`[data-slot="toast-item"][data-id="${ids[1]}"]`)?.getAttribute("data-visible")).toBe(
      "false",
    );

    await waitForClose();
    await waitForClose();
    expect(root.querySelector(`[data-slot="toast-item"][data-id="${ids[0]}"]`)).toBeTruthy();
    expect(root.querySelector(`[data-slot="toast-item"][data-id="${ids[1]}"]`)).toBeTruthy();

    controller.destroy();
  });

  it("does not emit dismiss events when toast becomes overflow-hidden", () => {
    const dismissCalls: string[] = [];
    const dismissEvents: string[] = [];
    const { root, controller } = setup({
      limit: 3,
      duration: 0,
      onDismiss: (id) => dismissCalls.push(id),
    });

    root.addEventListener("toast:change", (event) => {
      const detail = (event as CustomEvent<{ id: string; action: "show" | "dismiss" }>).detail;
      if (detail.action === "dismiss") {
        dismissEvents.push(detail.id);
      }
    });

    const first = controller.show({ title: "One" });
    controller.show({ title: "Two" });
    controller.show({ title: "Three" });
    controller.show({ title: "Four" });

    expect(root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`)?.getAttribute("data-visible")).toBe(
      "false",
    );
    expect(dismissCalls).toHaveLength(0);
    expect(dismissEvents).toHaveLength(0);

    controller.destroy();
  });

  it("reveals hidden overflow toasts in order when visible toasts are dismissed", async () => {
    const { root, controller } = setup({ limit: 2, duration: 0 });

    const first = controller.show({ title: "One" });
    const second = controller.show({ title: "Two" });
    const third = controller.show({ title: "Three" });
    const fourth = controller.show({ title: "Four" });

    controller.dismiss(fourth);
    await waitForClose();
    const secondItem = root.querySelector(`[data-slot="toast-item"][data-id="${second}"]`) as HTMLElement;
    expect(secondItem.getAttribute("data-state")).toBe("open");
    expect(secondItem.getAttribute("data-visible")).toBe("true");

    controller.dismiss(third);
    await waitForClose();
    const firstItem = root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`) as HTMLElement;
    expect(firstItem.getAttribute("data-state")).toBe("open");
    expect(firstItem.getAttribute("data-visible")).toBe("true");

    await waitForClose();
    controller.destroy();
  });

  it("keeps stable enter/exit directions when hidden overflow toast becomes visible", async () => {
    const { root, controller } = setup({ limit: 1, duration: 0, position: "bottom-right" });

    const first = controller.show({ title: "First" });
    const second = controller.show({ title: "Second" });

    const secondItem = root.querySelector(`[data-slot="toast-item"][data-id="${second}"]`) as HTMLElement;
    expect(secondItem.style.getPropertyValue("--toast-enter-direction")).toBe("-1");
    expect(secondItem.style.getPropertyValue("--toast-exit-direction")).toBe("-1");

    controller.dismiss(second);
    await waitForClose();

    const promoted = root.querySelector(`[data-slot="toast-item"][data-id="${first}"]`) as HTMLElement;
    expect(promoted.style.getPropertyValue("--toast-enter-direction")).toBe("-1");
    expect(promoted.style.getPropertyValue("--toast-exit-direction")).toBe("-1");
    expect(promoted.getAttribute("data-visible")).toBe("true");

    controller.destroy();
  });

  it("promotes next toast to front while dismissed front exits", () => {
    const { root, controller } = setup({ duration: 0 });

    const firstId = controller.show({ title: "First" });
    const secondId = controller.show({ title: "Second" });

    const first = root.querySelector(`[data-id="${firstId}"]`) as HTMLElement;
    const second = root.querySelector(`[data-id="${secondId}"]`) as HTMLElement;

    expect(second.getAttribute("data-front")).toBe("");
    controller.dismiss(secondId);

    expect(first.getAttribute("data-front")).toBe("");
    expect(second.style.pointerEvents).toBe("none");

    controller.destroy();
  });

  it("can dismiss a hidden overflow toast before it becomes visible", async () => {
    const { root, controller } = setup({ limit: 1, duration: 0 });

    const firstId = controller.show({ title: "First" });
    const secondId = controller.show({ title: "Second" });

    controller.dismiss(firstId);
    controller.dismiss(secondId);

    const firstItem = root.querySelector(`[data-slot="toast-item"][data-id="${firstId}"]`);
    const secondItem = root.querySelector(`[data-slot="toast-item"][data-id="${secondId}"]`);
    expect((firstItem as HTMLElement | null)?.getAttribute("data-state")).toBe("closed");
    expect((secondItem as HTMLElement | null)?.getAttribute("data-state")).toBe("closed");
    expect(controller.count).toBe(0);

    await waitForClose();
    expect(root.querySelector(`[data-slot="toast-item"][data-id="${firstId}"]`)).toBeNull();

    controller.destroy();
  });

  it("dismiss on unknown id is a no-op", () => {
    const { controller } = setup({ duration: 0 });

    expect(() => controller.dismiss("missing-id")).not.toThrow();

    controller.destroy();
  });

  it("update on unknown id is a no-op", () => {
    const { controller } = setup({ duration: 0 });

    expect(() => controller.update("missing-id", { title: "Ignored" })).not.toThrow();

    controller.destroy();
  });

  it("dismiss(id) triggers exit and removes item", async () => {
    const { root, controller } = setup({ duration: 0 });

    const id = controller.show({ title: "Dismiss me" });
    controller.dismiss(id);

    const item = root.querySelector(`[data-slot="toast-item"][data-id="${id}"]`) as HTMLElement;
    expect(item.getAttribute("data-state")).toBe("closed");

    await waitForClose();
    expect(root.querySelector(`[data-slot="toast-item"][data-id="${id}"]`)).toBeNull();

    controller.destroy();
  });

  it("dismissAll clears visible toasts", async () => {
    const { controller } = setup({ duration: 0 });

    controller.show({ title: "A" });
    controller.show({ title: "B" });

    controller.dismissAll();
    await waitForClose();

    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("close button dismisses its toast", async () => {
    const { root, controller } = setup({ duration: 0 });

    const id = controller.show({ title: "Close" });
    const close = root.querySelector(`[data-id="${id}"] [data-slot="toast-close"]`) as HTMLElement;
    close.click();

    await waitForClose();
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("action click fires callback + event and dismisses", async () => {
    const { root, controller } = setup({ duration: 0 });

    let callbackCalled = false;
    let actionEvent: unknown = undefined;

    root.addEventListener("toast:action", (event) => {
      actionEvent = (event as CustomEvent<{ id: string; value: string | undefined }>).detail;
    });

    const id = controller.show({
      title: "Action",
      action: {
        label: "Undo",
        value: "undo",
        onClick: () => {
          callbackCalled = true;
        },
      },
      duration: 0,
    });

    const actionButton = root.querySelector(`[data-id="${id}"] [data-slot="toast-action"]`) as HTMLElement;
    actionButton.click();

    expect(callbackCalled).toBe(true);
    const detail = actionEvent as { id: string; value: string | undefined } | undefined;
    expect(detail?.id).toBe(id);
    expect(detail?.value).toBe("undo");

    await waitForClose();
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("action click can prevent default dismissal", () => {
    const { root, controller } = setup({ duration: 0 });

    const id = controller.show({
      title: "Keep me open",
      action: {
        label: "Action",
        onClick: (event) => {
          event.preventDefault();
        },
      },
      duration: 0,
    });

    const actionButton = root.querySelector(`[data-id="${id}"] [data-slot="toast-action"]`) as HTMLElement;
    actionButton.click();

    expect(controller.count).toBe(1);
    const item = root.querySelector(`[data-id="${id}"]`) as HTMLElement;
    expect(item.getAttribute("data-state")).toBe("open");

    controller.destroy();
  });

  it("promise() shows loading then success using the same id", async () => {
    const { root, controller } = setup({ duration: 0 });

    const handled = controller.promise(
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("Loaded"), 15);
      }),
      {
        loading: { title: "Loading...", duration: 0 },
        success: (value) => ({ title: value, duration: 0 }),
      },
    );

    expect(root.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Loading...");
    const loadingToast = root.querySelector('[data-slot="toast-item"]') as HTMLElement;
    const loadingId = loadingToast.getAttribute("data-id");
    expect(loadingId).toBe(handled.id);

    await handled.unwrap();
    await waitForClose();

    const updated = root.querySelector(`[data-slot="toast-item"][data-id="${handled.id}"]`) as HTMLElement;
    expect(updated).toBe(loadingToast);
    expect(updated.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Loaded");
    expect(controller.count).toBe(1);

    controller.destroy();
  });

  it("promise() updates to error state and unwrap rejects", async () => {
    const { root, controller } = setup({ duration: 0 });

    const handled = controller.promise(
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Promise rejected")), 10);
      }),
      {
        loading: { title: "Loading...", duration: 0 },
        error: (error) => ({
          title: error instanceof Error ? error.message : "Error",
          duration: 0,
        }),
      },
    );

    await expect(handled.unwrap()).rejects.toThrow("Promise rejected");
    await waitForClose();

    const updated = root.querySelector(`[data-slot="toast-item"][data-id="${handled.id}"]`) as HTMLElement;
    expect(updated.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Promise rejected");

    controller.destroy();
  });

  it("promise() normalizes sync factory throws into rejection and error update", async () => {
    const { root, controller } = setup({ duration: 0 });

    let handled: ReturnType<typeof controller.promise<never>> | null = null;
    expect(() => {
      handled = controller.promise(
        () => {
          throw new Error("Sync exploded");
        },
        {
          loading: { title: "Loading...", duration: 0 },
          error: (error) => ({
            title: error instanceof Error ? error.message : "Error",
            duration: 0,
          }),
        },
      );
    }).not.toThrow();

    if (!handled) {
      throw new Error("Expected promise handle");
    }

    const loadingToast = root.querySelector(`[data-slot="toast-item"][data-id="${handled.id}"]`) as HTMLElement;
    expect(loadingToast.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Loading...");

    await expect(handled.unwrap()).rejects.toThrow("Sync exploded");
    await waitForClose();

    const updated = root.querySelector(`[data-slot="toast-item"][data-id="${handled.id}"]`) as HTMLElement;
    expect(updated).toBe(loadingToast);
    expect(updated.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Sync exploded");

    controller.destroy();
  });

  it("swipe dismisses toast in bottom stacks", async () => {
    const { root, controller } = setup({ duration: 0, position: "bottom-right" });

    const id = controller.show({ title: "Swipe me" });
    const item = root.querySelector(`[data-slot="toast-item"][data-id="${id}"]`) as HTMLElement;

    item.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientY: 120,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientY: 260 }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientY: 260 }),
    );

    await waitForClose();
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("swipe dismisses toast in top stacks", async () => {
    const { root, controller } = setup({ duration: 0, position: "top-left" });

    const id = controller.show({ title: "Swipe up" });
    const item = root.querySelector(`[data-slot="toast-item"][data-id="${id}"]`) as HTMLElement;

    item.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 2,
        button: 0,
        clientY: 240,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerId: 2, clientY: 40 }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 2, clientY: 40 }),
    );

    await waitForClose();
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("swipe does not dismiss when movement is below threshold", () => {
    const { root, controller } = setup({ duration: 0, position: "bottom-right" });

    const id = controller.show({ title: "Small drag" });
    const item = root.querySelector(`[data-slot="toast-item"][data-id="${id}"]`) as HTMLElement;

    item.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 3,
        button: 0,
        clientY: 150,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerId: 3, clientY: 175 }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 3, clientY: 175 }),
    );

    expect(controller.count).toBe(1);
    expect(item.hasAttribute("data-swiping")).toBe(false);
    expect(item.style.getPropertyValue("--toast-swipe-movement-y")).toBe("");

    controller.destroy();
  });

  it("non-dismissible toast ignores swipe gestures", () => {
    const { root, controller } = setup({ duration: 0, position: "bottom-right" });

    const id = controller.show({ title: "Locked", dismissible: false });
    const item = root.querySelector(`[data-slot="toast-item"][data-id="${id}"]`) as HTMLElement;

    item.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 4,
        button: 0,
        clientY: 120,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerId: 4, clientY: 400 }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 4, clientY: 400 }),
    );

    expect(controller.count).toBe(1);
    expect(item.hasAttribute("data-dismissible")).toBe(true);

    controller.destroy();
  });

  it("supports inbound toast:show, toast:update, toast:dismiss and toast:clear events", async () => {
    const { root, controller } = setup({ duration: 0 });

    root.dispatchEvent(new CustomEvent("toast:show", { detail: { title: "From event", duration: 0 } }));
    expect(controller.count).toBe(1);

    const item = root.querySelector('[data-slot="toast-item"]') as HTMLElement;
    const id = item.getAttribute("data-id")!;

    root.dispatchEvent(
      new CustomEvent("toast:update", {
        detail: {
          id,
          title: "Updated from event",
          description: "Description updated from event",
          type: "success",
        },
      }),
    );
    expect(item.getAttribute("data-type")).toBe("success");
    expect(item.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Updated from event");
    expect(item.querySelector('[data-slot="toast-description"]')?.textContent).toBe(
      "Description updated from event",
    );

    root.dispatchEvent(new CustomEvent("toast:dismiss", { detail: { id } }));
    await waitForClose();
    expect(controller.count).toBe(0);

    root.dispatchEvent(new CustomEvent("toast:show", { detail: { title: "A", duration: 0 } }));
    root.dispatchEvent(new CustomEvent("toast:show", { detail: { title: "B", duration: 0 } }));
    expect(controller.count).toBe(2);

    root.dispatchEvent(new CustomEvent("toast:clear"));
    await waitForClose();
    expect(controller.count).toBe(0);

    controller.destroy();
  });

  it("normalizes invalid inbound type to default", () => {
    const { root, controller } = setup({ duration: 0 });

    root.dispatchEvent(
      new CustomEvent("toast:show", {
        detail: {
          title: "Unexpected",
          type: "unexpected",
          duration: 0,
        },
      }),
    );

    const item = root.querySelector('[data-slot="toast-item"]') as HTMLElement;
    expect(item.getAttribute("data-type")).toBe("default");

    controller.destroy();
  });

  it("emits toast:change on show and dismiss", async () => {
    const { root, controller } = setup({ duration: 0 });

    const changes: Array<{ id: string; action: "show" | "dismiss" }> = [];
    root.addEventListener("toast:change", (event) => {
      changes.push((event as CustomEvent<{ id: string; action: "show" | "dismiss" }>).detail);
    });

    const id = controller.show({ title: "Observe" });
    controller.dismiss(id);

    expect(changes).toEqual([
      { id, action: "show" },
      { id, action: "dismiss" },
    ]);

    await waitForClose();
    controller.destroy();
  });

  it("applies ARIA roles by toast type", () => {
    const { root, controller } = setup({ duration: 0 });

    const errorId = controller.show({ title: "Error", type: "error" });
    const infoId = controller.show({ title: "Info", type: "info" });

    const errorItem = root.querySelector(`[data-id="${errorId}"]`) as HTMLElement;
    const infoItem = root.querySelector(`[data-id="${infoId}"]`) as HTMLElement;

    expect(errorItem.getAttribute("role")).toBe("alert");
    expect(errorItem.getAttribute("aria-live")).toBe("assertive");
    expect(infoItem.getAttribute("role")).toBe("status");
    expect(infoItem.getAttribute("aria-live")).toBe("polite");

    controller.destroy();
  });

  it("skips missing optional template parts without throwing", () => {
    const { controller } = setup(
      { duration: 0 },
      `
        <div data-slot="toast" id="root">
          <template data-slot="toast-template">
            <li data-slot="toast-item"><span data-slot="toast-title"></span></li>
          </template>
          <ol data-slot="toast-viewport"></ol>
        </div>
      `,
    );

    expect(() => controller.show({ title: "Minimal" })).not.toThrow();
    expect(controller.count).toBe(1);

    controller.destroy();
  });

  it("reusing an existing id force-replaces previous instance", async () => {
    const { root, controller } = setup({ duration: 0 });

    controller.show({ id: "job", title: "Loading" });
    controller.dismiss("job");

    controller.show({ id: "job", title: "Done" });

    const matching = root.querySelectorAll('[data-slot="toast-item"][data-id="job"]');
    expect(matching.length).toBe(1);
    expect(matching[0]?.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Done");

    await waitForClose();
    controller.destroy();
  });

  it("reusing an id while old toast is overflow-hidden emits dismiss once", () => {
    const dismissCalls: string[] = [];
    const dismissEvents: string[] = [];
    const { root, controller } = setup({
      duration: 0,
      limit: 1,
      onDismiss: (id) => dismissCalls.push(id),
    });

    root.addEventListener("toast:change", (event) => {
      const detail = (event as CustomEvent<{ id: string; action: "show" | "dismiss" }>).detail;
      if (detail.action === "dismiss") {
        dismissEvents.push(detail.id);
      }
    });

    controller.show({ id: "job", title: "Queued first" });
    controller.show({ id: "next", title: "Second" });
    controller.show({ id: "job", title: "Reused" });

    expect(dismissCalls.filter((id) => id === "job")).toHaveLength(1);
    expect(dismissEvents.filter((id) => id === "job")).toHaveLength(1);

    controller.destroy();
  });

  it("supports optional viewport portal and restores on destroy", () => {
    const { root, viewport, controller } = setup({ portal: true, duration: 0 });

    expect(viewport.parentElement).toBe(document.body);

    controller.destroy();

    expect(root.contains(viewport)).toBe(true);
  });

  it("writes stack animation variables and updates data-front", () => {
    const { root, viewport, controller } = setup({ duration: 0 });

    const firstId = controller.show({ title: "First" });
    const secondId = controller.show({ title: "Second" });

    const first = root.querySelector(`[data-id="${firstId}"]`) as HTMLElement;
    const second = root.querySelector(`[data-id="${secondId}"]`) as HTMLElement;

    expect(second.getAttribute("data-front")).toBe("");
    expect(first.hasAttribute("data-front")).toBe(false);
    expect(second.style.getPropertyValue("--toast-index")).toBe("0");
    expect(first.style.getPropertyValue("--toast-index")).toBe("1");
    expect(second.style.getPropertyValue("--toast-expanded-offset-y")).toContain("px");
    expect(first.style.getPropertyValue("--toast-collapsed-offset-y")).toContain("px");
    expect(viewport.style.getPropertyValue("--toast-count")).toBe("2");
    expect(viewport.style.getPropertyValue("--toast-expanded-stack-size")).toContain("px");
    expect(viewport.style.getPropertyValue("--toast-collapsed-stack-size")).toContain("px");
    expect(viewport.style.getPropertyValue("--toast-stack-size")).toBe(
      viewport.style.getPropertyValue("--toast-collapsed-stack-size"),
    );

    controller.destroy();
  });

  it("reindexes on ResizeObserver callback", () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    let resizeCb: ResizeObserverCallback | null = null;

    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCb = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    (
      globalThis as unknown as {
        ResizeObserver?: typeof ResizeObserver;
      }
    ).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { root, controller } = setup({ duration: 0 });

      const firstId = controller.show({ title: "One" });
      const secondId = controller.show({ title: "Two" });

      const first = root.querySelector(`[data-id="${firstId}"]`) as HTMLElement;
      const second = root.querySelector(`[data-id="${secondId}"]`) as HTMLElement;

      first.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 60,
            right: 200,
            bottom: 60,
            toJSON: () => ({}),
          }) as DOMRect);
      second.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 80,
            right: 200,
            bottom: 80,
            toJSON: () => ({}),
          }) as DOMRect);

      if (resizeCb) {
        (resizeCb as ResizeObserverCallback)([], {} as ResizeObserver);
      }

      expect(first.style.getPropertyValue("--toast-expanded-offset-y")).toBe("88px");
      expect(first.style.getPropertyValue("--toast-collapsed-offset-y")).toBe("34px");
      expect(first.style.getPropertyValue("--toast-offset-y")).toBe("88px");
      expect(second.style.getPropertyValue("--toast-expanded-offset-y")).toBe("0px");
      expect(second.style.getPropertyValue("--toast-collapsed-offset-y")).toBe("0px");
      expect(second.style.getPropertyValue("--toast-offset-y")).toBe("0px");
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-expanded-stack-size")).toBe(
        "148px",
      );
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-collapsed-stack-size")).toBe(
        "94px",
      );
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-stack-size")).toBe("94px");

      controller.destroy();
    } finally {
      (
        globalThis as unknown as {
          ResizeObserver?: typeof ResizeObserver;
        }
      ).ResizeObserver = OriginalResizeObserver;
    }
  });

  it("uses intrinsic toast height for stack offsets when rendered height is collapsed", () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    let resizeCb: ResizeObserverCallback | null = null;

    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCb = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    (
      globalThis as unknown as {
        ResizeObserver?: typeof ResizeObserver;
      }
    ).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { root, controller } = setup({ duration: 0 });

      const firstId = controller.show({ title: "Tall older" });
      const secondId = controller.show({ title: "Short front" });

      const first = root.querySelector(`[data-id="${firstId}"]`) as HTMLElement;
      const second = root.querySelector(`[data-id="${secondId}"]`) as HTMLElement;

      first.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 60,
            right: 200,
            bottom: 60,
            toJSON: () => ({}),
          }) as DOMRect);
      second.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 60,
            right: 200,
            bottom: 60,
            toJSON: () => ({}),
          }) as DOMRect);

      Object.defineProperty(first, "offsetHeight", { configurable: true, value: 60 });
      Object.defineProperty(second, "offsetHeight", { configurable: true, value: 60 });
      Object.defineProperty(first, "scrollHeight", { configurable: true, value: 140 });
      Object.defineProperty(second, "scrollHeight", { configurable: true, value: 60 });

      if (resizeCb) {
        (resizeCb as ResizeObserverCallback)([], {} as ResizeObserver);
      }

      expect(first.style.getPropertyValue("--toast-height")).toBe("140px");
      expect(first.style.getPropertyValue("--toast-expanded-offset-y")).toBe("68px");
      expect(first.style.getPropertyValue("--toast-collapsed-offset-y")).toBe("-66px");
      expect(first.style.getPropertyValue("--toast-offset-y")).toBe("68px");
      expect(second.style.getPropertyValue("--toast-height")).toBe("60px");
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-expanded-stack-size")).toBe(
        "208px",
      );
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-collapsed-stack-size")).toBe(
        "74px",
      );
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-stack-size")).toBe("74px");

      controller.destroy();
    } finally {
      (
        globalThis as unknown as {
          ResizeObserver?: typeof ResizeObserver;
        }
      ).ResizeObserver = OriginalResizeObserver;
    }
  });

  it("keeps a fixed collapsed peek distance across mixed toast heights", () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    let resizeCb: ResizeObserverCallback | null = null;

    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCb = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    (
      globalThis as unknown as {
        ResizeObserver?: typeof ResizeObserver;
      }
    ).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { root, controller } = setup({ duration: 0 });

      const firstId = controller.show({ title: "Oldest" });
      const secondId = controller.show({ title: "Middle" });
      const thirdId = controller.show({ title: "Newest" });

      const first = root.querySelector(`[data-id="${firstId}"]`) as HTMLElement;
      const second = root.querySelector(`[data-id="${secondId}"]`) as HTMLElement;
      const third = root.querySelector(`[data-id="${thirdId}"]`) as HTMLElement;

      first.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 110,
            right: 200,
            bottom: 110,
            toJSON: () => ({}),
          }) as DOMRect);
      second.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 70,
            right: 200,
            bottom: 70,
            toJSON: () => ({}),
          }) as DOMRect);
      third.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 90,
            right: 200,
            bottom: 90,
            toJSON: () => ({}),
          }) as DOMRect);

      if (resizeCb) {
        (resizeCb as ResizeObserverCallback)([], {} as ResizeObserver);
      }

      const c0 = Number.parseFloat(third.style.getPropertyValue("--toast-collapsed-offset-y"));
      const c1 = Number.parseFloat(second.style.getPropertyValue("--toast-collapsed-offset-y"));
      const c2 = Number.parseFloat(first.style.getPropertyValue("--toast-collapsed-offset-y"));
      const h0 = Number.parseFloat(third.style.getPropertyValue("--toast-height"));
      const h1 = Number.parseFloat(second.style.getPropertyValue("--toast-height"));
      const h2 = Number.parseFloat(first.style.getPropertyValue("--toast-height"));

      expect(c0).toBe(0);
      expect(c1).toBe(34);
      expect(c2).toBe(8);

      expect(c1 + h1 - (c0 + h0)).toBeCloseTo(14, 3);
      expect(c2 + h2 - (c1 + h1)).toBeCloseTo(14, 3);

      controller.destroy();
    } finally {
      (
        globalThis as unknown as {
          ResizeObserver?: typeof ResizeObserver;
        }
      ).ResizeObserver = OriginalResizeObserver;
    }
  });

  it("uses only visible overflow toasts when writing --toast-stack-size", () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    let resizeCb: ResizeObserverCallback | null = null;

    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCb = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    (
      globalThis as unknown as {
        ResizeObserver?: typeof ResizeObserver;
      }
    ).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { root, controller } = setup({ duration: 0, limit: 1 });

      const firstId = controller.show({ title: "One" });
      const secondId = controller.show({ title: "Two" });

      const first = root.querySelector(`[data-id="${firstId}"]`) as HTMLElement;
      const second = root.querySelector(`[data-id="${secondId}"]`) as HTMLElement;

      first.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 60,
            right: 200,
            bottom: 60,
            toJSON: () => ({}),
          }) as DOMRect);
      second.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 80,
            right: 200,
            bottom: 80,
            toJSON: () => ({}),
          }) as DOMRect);

      if (resizeCb) {
        (resizeCb as ResizeObserverCallback)([], {} as ResizeObserver);
      }

      expect(first.getAttribute("data-visible")).toBe("false");
      expect(second.getAttribute("data-visible")).toBe("true");
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-expanded-stack-size")).toBe(
        "80px",
      );
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-collapsed-stack-size")).toBe(
        "80px",
      );
      expect(root.querySelector('[data-slot="toast-viewport"]')?.style.getPropertyValue("--toast-stack-size")).toBe(
        "80px",
      );

      controller.destroy();
    } finally {
      (
        globalThis as unknown as {
          ResizeObserver?: typeof ResizeObserver;
        }
      ).ResizeObserver = OriginalResizeObserver;
    }
  });

  it("switches active --toast-stack-size between collapsed and expanded states", () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    let resizeCb: ResizeObserverCallback | null = null;

    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCb = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    (
      globalThis as unknown as {
        ResizeObserver?: typeof ResizeObserver;
      }
    ).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { root, viewport, controller } = setup({ duration: 0 });

      const firstId = controller.show({ title: "One" });
      const secondId = controller.show({ title: "Two" });

      const first = root.querySelector(`[data-id="${firstId}"]`) as HTMLElement;
      const second = root.querySelector(`[data-id="${secondId}"]`) as HTMLElement;

      first.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 60,
            right: 200,
            bottom: 60,
            toJSON: () => ({}),
          }) as DOMRect);
      second.getBoundingClientRect =
        (() =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width: 200,
            height: 80,
            right: 200,
            bottom: 80,
            toJSON: () => ({}),
          }) as DOMRect);

      if (resizeCb) {
        (resizeCb as ResizeObserverCallback)([], {} as ResizeObserver);
      }

      expect(viewport.hasAttribute("data-expanded")).toBe(false);
      expect(viewport.style.getPropertyValue("--toast-stack-size")).toBe("94px");

      viewport.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
      expect(viewport.hasAttribute("data-expanded")).toBe(true);
      expect(viewport.style.getPropertyValue("--toast-stack-size")).toBe("148px");

      viewport.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
      expect(viewport.hasAttribute("data-expanded")).toBe(false);
      expect(viewport.style.getPropertyValue("--toast-stack-size")).toBe("94px");

      controller.destroy();
    } finally {
      (
        globalThis as unknown as {
          ResizeObserver?: typeof ResizeObserver;
        }
      ).ResizeObserver = OriginalResizeObserver;
    }
  });

  it("does not inline override --toast-collapsed-peek", () => {
    const { viewport, controller } = setup({ duration: 0 });

    controller.show({ title: "One" });
    controller.show({ title: "Two" });

    expect(viewport.style.getPropertyValue("--toast-collapsed-peek")).toBe("");

    controller.destroy();
  });

  it("create() auto-binds and allows rebind after destroy", () => {
    document.body.innerHTML = `
      <div data-slot="toast" id="a"><ol data-slot="toast-viewport"></ol></div>
      <div data-slot="toast" id="b"><ol data-slot="toast-viewport"></ol></div>
    `;

    const first = create();
    expect(first).toHaveLength(2);

    const second = create();
    expect(second).toHaveLength(0);

    first[0]?.destroy();

    const third = create();
    expect(third).toHaveLength(1);

    first[1]?.destroy();
    third[0]?.destroy();
  });
});
