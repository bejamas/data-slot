import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createAlertDialog, create } from "./index";
import { createDialog } from "../../dialog/src/index";

describe("AlertDialog", () => {
  const waitForRaf = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const waitForPresence = async () => {
    await waitForRaf();
    await waitForRaf();
  };

  const setup = (options: Parameters<typeof createAlertDialog>[1] = {}) => {
    document.body.innerHTML = `
      <div data-slot="alert-dialog" id="root">
        <button data-slot="alert-dialog-trigger">Delete project</button>
        <div data-slot="alert-dialog-portal" id="portal">
          <div data-slot="alert-dialog-overlay"></div>
          <div data-slot="alert-dialog-content">
            <div data-slot="alert-dialog-header">
              <div data-slot="alert-dialog-media">!</div>
              <h2 data-slot="alert-dialog-title">Delete project?</h2>
              <p data-slot="alert-dialog-description">
                This action cannot be undone.
              </p>
            </div>
            <div data-slot="alert-dialog-footer">
              <button data-slot="alert-dialog-cancel">Cancel</button>
              <button data-slot="alert-dialog-action">Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const trigger = root.querySelector('[data-slot="alert-dialog-trigger"]') as HTMLButtonElement;
    const portal = document.getElementById("portal") as HTMLElement;
    const overlay = root.querySelector('[data-slot="alert-dialog-overlay"]') as HTMLElement;
    const content = root.querySelector('[data-slot="alert-dialog-content"]') as HTMLElement;
    const title = root.querySelector('[data-slot="alert-dialog-title"]') as HTMLElement;
    const description = root.querySelector(
      '[data-slot="alert-dialog-description"]'
    ) as HTMLElement;
    const cancel = root.querySelector('[data-slot="alert-dialog-cancel"]') as HTMLButtonElement;
    const action = root.querySelector('[data-slot="alert-dialog-action"]') as HTMLButtonElement;
    const controller = createAlertDialog(root, options);

    return {
      root,
      trigger,
      portal,
      overlay,
      content,
      title,
      description,
      cancel,
      action,
      controller,
    };
  };


  for (const singleControl of [true, false]) {
    for (const shiftKey of [false, true]) {
      it(`moves ${shiftKey ? "backward" : "forward"} from programmatic focus with ${singleControl ? "one tabbable control" : "two tabbable controls"}`, async () => {
        const { title, cancel, action, controller } = setup();
        title.setAttribute("tabindex", "-1");
        if (singleControl) action.remove();
        try {
          controller.open();
          await waitForRaf();
          expect(document.activeElement?.getAttribute("data-slot")).toBe("alert-dialog-title");
          const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
          title.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(shiftKey && !singleControl ? action : cancel);
        } finally {
          controller.destroy();
        }
      });
    }
  }

  it("focuses the content when no eligible descendants remain", async () => {
    const { content, controller } = setup();
    content.innerHTML = '<summary>Not focusable</summary><button hidden>Hidden</button>';
    try {
      controller.open();
      await waitForRaf();
      expect(document.activeElement).toBe(content);
      const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      content.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(content);
    } finally {
      controller.destroy();
    }
  });

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.style.overflow = "";
    document.documentElement.style.scrollbarGutter = "";
  });

  it("initializes with content hidden", () => {
    const { content, overlay, controller } = setup();

    expect(content.hidden).toBe(true);
    expect(overlay.hidden).toBe(true);
    expect(controller.isOpen).toBe(false);

    controller.destroy();
  });

  it("opens on trigger click and closes on cancel click", async () => {
    const { trigger, cancel, content, overlay, controller } = setup();

    trigger.click();
    expect(controller.isOpen).toBe(true);
    expect(content.hidden).toBe(false);
    expect(overlay.hidden).toBe(false);

    cancel.click();
    expect(controller.isOpen).toBe(false);

    await waitForPresence();
    expect(content.hidden).toBe(true);
    expect(overlay.hidden).toBe(true);

    controller.destroy();
  });

  it("does not close on overlay click by default", () => {
    const { overlay, controller } = setup();

    controller.open();
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    expect(controller.isOpen).toBe(true);
    controller.destroy();
  });

  it("respects closeOnClickOutside option", () => {
    const { overlay, controller } = setup({ closeOnClickOutside: true });

    controller.open();
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    expect(controller.isOpen).toBe(false);
    controller.destroy();
  });

  it("closes on Escape by default and respects closeOnEscape false", () => {
    const enabled = setup();
    enabled.controller.open();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(enabled.controller.isOpen).toBe(false);
    enabled.controller.destroy();

    const disabled = setup({ closeOnEscape: false });
    disabled.controller.open();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(disabled.controller.isOpen).toBe(true);
    disabled.controller.destroy();
  });

  it("sets alertdialog ARIA attributes", () => {
    const { trigger, content, title, description, controller } = setup();

    expect(content.getAttribute("role")).toBe("alertdialog");
    expect(content.getAttribute("aria-modal")).toBe("true");
    expect(content.getAttribute("aria-labelledby")).toBe(title.id);
    expect(content.getAttribute("aria-describedby")).toBe(description.id);
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-controls")).toBe(content.id);

    controller.destroy();
  });

  it("alert-dialog-action does not close automatically", () => {
    const { action, controller } = setup();

    controller.open();
    action.click();

    expect(controller.isOpen).toBe(true);
    controller.destroy();
  });

  it("emits alert-dialog:change and calls onOpenChange", () => {
    let lastEvent: boolean | undefined;
    let lastCallback: boolean | undefined;
    const { root, controller } = setup({
      onOpenChange: (open) => {
        lastCallback = open;
      },
    });

    root.addEventListener("alert-dialog:change", (e) => {
      lastEvent = (e as CustomEvent).detail.open;
    });

    controller.open();
    expect(lastEvent).toBe(true);
    expect(lastCallback).toBe(true);

    controller.close();
    expect(lastEvent).toBe(false);
    expect(lastCallback).toBe(false);

    controller.destroy();
  });

  it("supports alert-dialog:set inbound events", () => {
    const { root, controller } = setup();

    root.dispatchEvent(
      new CustomEvent("alert-dialog:set", { detail: { open: true } })
    );
    expect(controller.isOpen).toBe(true);

    root.dispatchEvent(
      new CustomEvent("alert-dialog:set", { detail: { open: false } })
    );
    expect(controller.isOpen).toBe(false);

    controller.destroy();
  });

  it("moves alert-dialog-portal to body on open and restores on destroy", () => {
    const { portal, controller } = setup();

    expect(portal.parentElement?.id).toBe("root");

    controller.open();
    expect(portal.parentElement).toBe(document.body);

    controller.destroy();
    expect(portal.parentElement?.id).toBe("root");
  });

  it("create binds all alert dialogs in scope", () => {
    document.body.innerHTML = `
      <div data-slot="alert-dialog">
        <button data-slot="alert-dialog-trigger">Open</button>
        <div data-slot="alert-dialog-overlay"></div>
        <div data-slot="alert-dialog-content">
          <button data-slot="alert-dialog-cancel">Close</button>
        </div>
      </div>
    `;

    const controllers = create();
    expect(controllers).toHaveLength(1);

    const trigger = document.querySelector(
      '[data-slot="alert-dialog-trigger"]'
    ) as HTMLButtonElement;
    trigger.click();

    expect(controllers[0]?.isOpen).toBe(true);
    controllers.forEach((controller) => controller.destroy());
  });

  it("throws when required slots are missing", () => {
    document.body.innerHTML = `<div data-slot="alert-dialog" id="root"></div>`;
    const root = document.getElementById("root")!;

    expect(() => createAlertDialog(root)).toThrow();
  });

  it("shares modal stack routing with dialog", async () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="dialog-root">
        <div data-slot="dialog-overlay" id="dialog-overlay"></div>
        <div data-slot="dialog-content" id="dialog-content">
          <button id="dialog-a">Dialog A</button>
          <button id="dialog-b">Dialog B</button>
        </div>
      </div>
      <div data-slot="alert-dialog" id="alert-root">
        <div data-slot="alert-dialog-overlay" id="alert-overlay"></div>
        <div data-slot="alert-dialog-content" id="alert-content">
          <button id="alert-a">Alert A</button>
          <button id="alert-b">Alert B</button>
        </div>
      </div>
    `;

    const dialogRoot = document.getElementById("dialog-root")!;
    const alertRoot = document.getElementById("alert-root")!;
    const dialogController = createDialog(dialogRoot);
    const alertController = createAlertDialog(alertRoot);
    const dialogContent = document.getElementById("dialog-content") as HTMLElement;
    const alertContent = document.getElementById("alert-content") as HTMLElement;
    const alertOverlay = document.getElementById("alert-overlay") as HTMLElement;
    const alertFirst = document.getElementById("alert-a") as HTMLButtonElement;
    const alertLast = document.getElementById("alert-b") as HTMLButtonElement;

    dialogController.open();
    alertController.open();
    await waitForRaf();

    expect(dialogContent.getAttribute("data-stack-index")).toBe("0");
    expect(alertContent.getAttribute("data-stack-index")).toBe("1");
    expect(alertOverlay.style.getPropertyValue("--alert-dialog-overlay-stack-index")).toBe("1");

    alertLast.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
    );

    expect(document.activeElement).toBe(alertFirst);

    alertController.close();
    expect(dialogContent.getAttribute("data-stack-index")).toBe("0");

    alertController.destroy();
    dialogController.destroy();
  });

  it("recreates shared modal stack routing after the last modal closes", async () => {
    document.body.innerHTML = `
      <div data-slot="alert-dialog" id="alert-root">
        <div data-slot="alert-dialog-overlay"></div>
        <div data-slot="alert-dialog-content">
          <button id="alert-a">Alert A</button>
          <button id="alert-b">Alert B</button>
        </div>
      </div>
    `;

    const alertRoot = document.getElementById("alert-root")!;
    const alertController = createAlertDialog(alertRoot);
    const alertFirst = document.getElementById("alert-a") as HTMLButtonElement;
    const alertLast = document.getElementById("alert-b") as HTMLButtonElement;

    alertController.open();
    await waitForRaf();

    alertLast.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
    );
    expect(document.activeElement).toBe(alertFirst);

    alertController.close();
    await waitForPresence();

    alertController.open();
    await waitForRaf();

    alertLast.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
    );
    expect(document.activeElement).toBe(alertFirst);

    alertController.destroy();
  });

  it("traps Tab among currently tabbable controls, skipping hidden, inert, and newly disabled descendants", async () => {
    document.body.innerHTML = `
      <div data-slot="alert-dialog" id="alert-root">
        <div data-slot="alert-dialog-overlay"></div>
        <div data-slot="alert-dialog-content">
          <div hidden><button id="hidden-control">Hidden</button></div>
          <div inert><button id="inert-control">Inert</button></div>
          <button id="first-control">First</button>
          <button id="last-control">Last</button>
        </div>
      </div>
    `;
    const root = document.getElementById("alert-root")!;
    const controller = createAlertDialog(root);
    const first = document.getElementById("first-control") as HTMLButtonElement;
    const last = document.getElementById("last-control") as HTMLButtonElement;

    controller.open();
    await waitForRaf();
    expect(document.activeElement).toBe(first);

    last.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(first);

    last.disabled = true;
    first.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(first);

    controller.destroy();
  });

  it("keeps a retained controller inert, cancels queued focus, and releases scroll lock on destroy", async () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <div data-slot="alert-dialog" id="root">
        <div data-slot="alert-dialog-overlay"></div>
        <div data-slot="alert-dialog-content"><button id="inside">Inside</button></div>
      </div>
    `;
    const outside = document.getElementById("outside") as HTMLButtonElement;
    const root = document.getElementById("root")!;
    const controller = createAlertDialog(root);

    outside.focus();
    controller.open();
    expect(document.documentElement.style.overflow).toBe("hidden");
    controller.destroy();
    controller.open();
    controller.destroy();

    await waitForRaf();
    expect(document.activeElement).toBe(outside);
    expect(document.documentElement.style.overflow).toBe("");
  });
});
