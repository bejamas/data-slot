import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createDialog, create } from "./index";

describe("Dialog", () => {
  const setup = (options: Parameters<typeof createDialog>[1] = {}) => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <button data-slot="dialog-trigger">Open Dialog</button>
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">
          <h2 data-slot="dialog-title">Dialog Title</h2>
          <p data-slot="dialog-description">Dialog description text.</p>
          <button data-slot="dialog-close">Close</button>
          <input type="text" placeholder="Focus me" />
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const trigger = document.querySelector(
      '[data-slot="dialog-trigger"]'
    ) as HTMLElement;
    const content = document.querySelector(
      '[data-slot="dialog-content"]'
    ) as HTMLElement;
    const closeBtn = document.querySelector(
      '[data-slot="dialog-close"]'
    ) as HTMLElement;
    const title = document.querySelector(
      '[data-slot="dialog-title"]'
    ) as HTMLElement;
    const description = document.querySelector(
      '[data-slot="dialog-description"]'
    ) as HTMLElement;
    const input = document.querySelector("input") as HTMLInputElement;
    const controller = createDialog(root, options);

    return {
      root,
      trigger,
      content,
      closeBtn,
      title,
      description,
      input,
      controller,
    };
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.style.overflow = "";
    document.documentElement.style.scrollbarGutter = "";
  });

  it("initializes with content hidden", () => {
    const { content, controller } = setup();

    expect(content.hidden).toBe(true);
    expect(controller.isOpen).toBe(false);

    controller.destroy();
  });

  it("opens on trigger click", () => {
    const { trigger, content, controller } = setup();

    trigger.click();
    expect(content.hidden).toBe(false);
    expect(controller.isOpen).toBe(true);

    controller.destroy();
  });

  it("closes on close button click", () => {
    const { trigger, content, closeBtn, controller } = setup();

    trigger.click();
    expect(content.hidden).toBe(false);

    closeBtn.click();
    expect(content.hidden).toBe(true);

    controller.destroy();
  });

  it("closes on Escape key", () => {
    const { controller } = setup();

    controller.open();
    expect(controller.isOpen).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(controller.isOpen).toBe(false);

    controller.destroy();
  });

  it("respects closeOnEscape option", () => {
    const { controller } = setup({ closeOnEscape: false });

    controller.open();
    expect(controller.isOpen).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(controller.isOpen).toBe(true);

    controller.destroy();
  });

  it("closes on click outside content", () => {
    const { controller } = setup();
    const overlay = document.querySelector(
      '[data-slot="dialog-overlay"]'
    ) as HTMLElement;

    controller.open();
    expect(controller.isOpen).toBe(true);

    // Click on overlay closes the dialog
    overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(controller.isOpen).toBe(false);

    controller.destroy();
  });

  it("respects closeOnClickOutside option", () => {
    const { controller } = setup({ closeOnClickOutside: false });

    controller.open();
    expect(controller.isOpen).toBe(true);

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true })
    );
    expect(controller.isOpen).toBe(true);

    controller.destroy();
  });

  it("sets correct ARIA attributes", () => {
    const { trigger, content, title, description, controller } = setup();

    expect(content.getAttribute("role")).toBe("dialog");
    expect(content.getAttribute("aria-modal")).toBe("true");
    expect(content.getAttribute("aria-labelledby")).toBe(title.id);
    expect(content.getAttribute("aria-describedby")).toBe(description.id);
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-controls")).toBe(content.id);

    controller.destroy();
  });

  it("sets aria-haspopup, aria-controls, and aria-expanded on trigger", () => {
    const { trigger, content, controller } = setup();

    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-controls")).toBe(content.id);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    controller.open();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    controller.close();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    controller.destroy();
  });

  it("sets data-state on root", () => {
    const { root, controller } = setup();

    expect(root.getAttribute("data-state")).toBe("closed");

    controller.open();
    expect(root.getAttribute("data-state")).toBe("open");

    controller.close();
    expect(root.getAttribute("data-state")).toBe("closed");

    controller.destroy();
  });

  it("locks scroll when open", () => {
    const { controller } = setup({ lockScroll: true });

    controller.open();
    expect(document.documentElement.style.overflow).toBe("hidden");

    controller.close();
    expect(document.documentElement.style.overflow).toBe("");

    controller.destroy();
  });

  it("respects lockScroll option", () => {
    const { controller } = setup({ lockScroll: false });

    controller.open();
    expect(document.documentElement.style.overflow).toBe("");

    controller.destroy();
  });

  it("emits dialog:change event", () => {
    const { root, controller } = setup();

    let lastOpen: boolean | undefined;
    root.addEventListener("dialog:change", (e) => {
      lastOpen = (e as CustomEvent).detail.open;
    });

    controller.open();
    expect(lastOpen).toBe(true);

    controller.close();
    expect(lastOpen).toBe(false);

    controller.destroy();
  });

  it("calls onOpenChange callback", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <button data-slot="dialog-trigger">Open</button>
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Content</div>
      </div>
    `;
    const root = document.getElementById("root")!;
    let lastOpen: boolean | undefined;

    const controller = createDialog(root, {
      onOpenChange: (open) => {
        lastOpen = open;
      },
    });

    controller.open();
    expect(lastOpen).toBe(true);

    controller.toggle();
    expect(lastOpen).toBe(false);

    controller.destroy();
  });

  it("toggle method works correctly", () => {
    const { controller } = setup();

    expect(controller.isOpen).toBe(false);
    controller.toggle();
    expect(controller.isOpen).toBe(true);
    controller.toggle();
    expect(controller.isOpen).toBe(false);

    controller.destroy();
  });

  it("works without a trigger", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">
          <button data-slot="dialog-close">Close</button>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const controller = createDialog(root);

    expect(controller.isOpen).toBe(false);
    controller.open();
    expect(controller.isOpen).toBe(true);

    const closeBtn = document.querySelector(
      '[data-slot="dialog-close"]'
    ) as HTMLElement;
    closeBtn.click();
    expect(controller.isOpen).toBe(false);

    controller.destroy();
  });

  it("create binds all dialog components and returns controllers", () => {
    document.body.innerHTML = `
      <div data-slot="dialog">
        <button data-slot="dialog-trigger">Open</button>
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Content</div>
      </div>
    `;

    const controllers = create();
    expect(controllers).toHaveLength(1);

    const trigger = document.querySelector(
      '[data-slot="dialog-trigger"]'
    ) as HTMLElement;
    const content = document.querySelector(
      '[data-slot="dialog-content"]'
    ) as HTMLElement;

    expect(content.hidden).toBe(true);
    trigger.click();
    expect(content.hidden).toBe(false);

    // Can control programmatically
    controllers[0]?.close();
    expect(content.hidden).toBe(true);

    controllers.forEach((c) => c.destroy());
  });

  it("moves dialog-portal to body on open and restores on destroy", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <button data-slot="dialog-trigger">Open</button>
        <div data-slot="dialog-portal" id="portal">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Content</div>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const portal = document.getElementById("portal") as HTMLElement;
    const controller = createDialog(root);

    expect(portal.parentElement).toBe(root);

    controller.open();
    expect(portal.parentElement).toBe(document.body);

    // Portal stays in body while closed and is restored only on destroy.
    controller.close();
    expect(portal.parentElement).toBe(document.body);

    controller.destroy();
    expect(portal.parentElement).toBe(root);
  });

  it("handles defaultOpen with dialog-portal and restores on destroy", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root" data-default-open>
        <div data-slot="dialog-portal" id="portal">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Content</div>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const portal = document.getElementById("portal") as HTMLElement;
    const controller = createDialog(root);

    expect(controller.isOpen).toBe(true);
    expect(portal.parentElement).toBe(document.body);

    controller.destroy();
    expect(portal.parentElement).toBe(root);
  });

  it("throws error when missing content slot", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <button data-slot="dialog-trigger">Open</button>
      </div>
    `;
    const root = document.getElementById("root")!;

    expect(() => createDialog(root)).toThrow();
  });

  it("handles stacked dialogs - only topmost responds to Escape", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="dialog1">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Dialog 1</div>
      </div>
      <div data-slot="dialog" id="dialog2">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Dialog 2</div>
      </div>
    `;
    const root1 = document.getElementById("dialog1")!;
    const root2 = document.getElementById("dialog2")!;
    const controller1 = createDialog(root1);
    const controller2 = createDialog(root2);

    controller1.open();
    controller2.open();
    expect(controller1.isOpen).toBe(true);
    expect(controller2.isOpen).toBe(true);

    // Escape should only close topmost (dialog2)
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(controller2.isOpen).toBe(false);
    expect(controller1.isOpen).toBe(true);

    // Next Escape closes dialog1
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(controller1.isOpen).toBe(false);

    controller1.destroy();
    controller2.destroy();
  });

  it("does not set inline z-index and exposes stack metadata for styling", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="dialog1">
        <div data-slot="dialog-overlay" id="overlay1"></div>
        <div data-slot="dialog-content" id="content1">Dialog 1</div>
      </div>
      <div data-slot="dialog" id="dialog2">
        <div data-slot="dialog-overlay" id="overlay2"></div>
        <div data-slot="dialog-content" id="content2">Dialog 2</div>
      </div>
    `;

    const controller1 = createDialog(document.getElementById("dialog1")!);
    const controller2 = createDialog(document.getElementById("dialog2")!);
    const overlay1 = document.getElementById("overlay1") as HTMLElement;
    const content1 = document.getElementById("content1") as HTMLElement;
    const overlay2 = document.getElementById("overlay2") as HTMLElement;
    const content2 = document.getElementById("content2") as HTMLElement;

    controller1.open();
    controller2.open();

    expect(overlay1.style.zIndex).toBe("");
    expect(content1.style.zIndex).toBe("");
    expect(overlay2.style.zIndex).toBe("");
    expect(content2.style.zIndex).toBe("");

    expect(overlay1.getAttribute("data-stack-index")).toBe("0");
    expect(content1.getAttribute("data-stack-index")).toBe("0");
    expect(overlay2.getAttribute("data-stack-index")).toBe("1");
    expect(content2.getAttribute("data-stack-index")).toBe("1");

    controller2.close();
    expect(overlay2.hasAttribute("data-stack-index")).toBe(false);
    expect(content2.hasAttribute("data-stack-index")).toBe(false);
    expect(overlay1.getAttribute("data-stack-index")).toBe("0");
    expect(content1.getAttribute("data-stack-index")).toBe("0");

    controller1.destroy();
    controller2.destroy();
  });

  it("handles stacked dialogs - scroll lock uses ref counting", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="dialog1">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Dialog 1</div>
      </div>
      <div data-slot="dialog" id="dialog2">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Dialog 2</div>
      </div>
    `;
    const root1 = document.getElementById("dialog1")!;
    const root2 = document.getElementById("dialog2")!;
    const controller1 = createDialog(root1, { lockScroll: true });
    const controller2 = createDialog(root2, { lockScroll: true });

    controller1.open();
    expect(document.documentElement.style.overflow).toBe("hidden");

    controller2.open();
    expect(document.documentElement.style.overflow).toBe("hidden");

    // Close dialog2 - scroll should still be locked (dialog1 open)
    controller2.close();
    expect(document.documentElement.style.overflow).toBe("hidden");

    // Close dialog1 - scroll should be unlocked
    controller1.close();
    expect(document.documentElement.style.overflow).toBe("");

    controller1.destroy();
    controller2.destroy();
  });

  it("supports alertDialog role option", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Alert content</div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const content = document.querySelector(
      '[data-slot="dialog-content"]'
    ) as HTMLElement;
    const controller = createDialog(root, { alertDialog: true });

    expect(content.getAttribute("role")).toBe("alertdialog");

    controller.destroy();
  });

  it("prioritizes [autofocus] element when opening", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">
          <input type="text" placeholder="First input" />
          <input type="text" placeholder="Autofocus input" autofocus />
          <button>Button</button>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const autofocusInput = document.querySelector(
      "[autofocus]"
    ) as HTMLInputElement;
    const controller = createDialog(root);

    controller.open();

    // Need to wait for requestAnimationFrame
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(document.activeElement).toBe(autofocusInput);
        controller.destroy();
        resolve();
      });
    });
  });

  it("aria-controls always points to content", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <button data-slot="dialog-trigger">Open</button>
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Content</div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const trigger = document.querySelector(
      '[data-slot="dialog-trigger"]'
    ) as HTMLElement;
    const content = document.querySelector(
      '[data-slot="dialog-content"]'
    ) as HTMLElement;
    const controller = createDialog(root);

    expect(trigger.getAttribute("aria-controls")).toBe(content.id);

    controller.destroy();
  });

  it("handles double open() calls without duplicating stack entries", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Content</div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const controller = createDialog(root);

    // Open twice
    controller.open();
    controller.open();
    expect(controller.isOpen).toBe(true);

    // Single close should fully close
    controller.close();
    expect(controller.isOpen).toBe(false);

    controller.destroy();
  });

  it("sets role=presentation on overlay", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="root">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">Content</div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const overlay = document.querySelector(
      '[data-slot="dialog-overlay"]'
    ) as HTMLElement;
    const controller = createDialog(root);

    expect(overlay.getAttribute("role")).toBe("presentation");
    expect(overlay.getAttribute("aria-hidden")).toBe("true");

    controller.destroy();
  });

  it("restores focus on destroy() if dialog is open", () => {
    document.body.innerHTML = `
      <button id="outside-btn">Outside</button>
      <div data-slot="dialog" id="root">
        <div data-slot="dialog-overlay"></div>
        <div data-slot="dialog-content">
          <button>Inside</button>
        </div>
      </div>
    `;
    const outsideBtn = document.getElementById(
      "outside-btn"
    ) as HTMLButtonElement;
    const root = document.getElementById("root")!;

    outsideBtn.focus();
    expect(document.activeElement).toBe(outsideBtn);

    const controller = createDialog(root);
    controller.open();

    // Destroy while open
    controller.destroy();

    // Focus should be scheduled to restore
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(document.activeElement).toBe(outsideBtn);
        resolve();
      });
    });
  });

  // Data attribute tests
  describe("data attributes", () => {
    it("data-close-on-escape='false' disables Escape key closing", () => {
      document.body.innerHTML = `
        <div data-slot="dialog" id="root" data-close-on-escape="false">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Content</div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createDialog(root);

      controller.open();
      expect(controller.isOpen).toBe(true);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("data-close-on-click-outside='false' disables overlay click closing", () => {
      document.body.innerHTML = `
        <div data-slot="dialog" id="root" data-close-on-click-outside="false">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Content</div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const overlay = root.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;
      const controller = createDialog(root);

      controller.open();
      expect(controller.isOpen).toBe(true);

      overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("data-lock-scroll='false' disables scroll lock", () => {
      document.body.innerHTML = `
        <div data-slot="dialog" id="root" data-lock-scroll="false">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Content</div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createDialog(root);

      controller.open();
      expect(document.documentElement.style.overflow).toBe("");

      controller.destroy();
    });

    it("data-alert-dialog enables alertdialog role", () => {
      document.body.innerHTML = `
        <div data-slot="dialog" id="root" data-alert-dialog>
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Alert content</div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="dialog-content"]') as HTMLElement;
      const controller = createDialog(root);

      expect(content.getAttribute("role")).toBe("alertdialog");

      controller.destroy();
    });

    it("data-default-open opens dialog initially", () => {
      document.body.innerHTML = `
        <div data-slot="dialog" id="root" data-default-open>
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Content</div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createDialog(root);

      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="dialog" id="root" data-close-on-escape="false">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Content</div>
        </div>
      `;
      const root = document.getElementById("root")!;
      // JS option says true, data attribute says false - JS wins
      const controller = createDialog(root, { closeOnEscape: true });

      controller.open();
      expect(controller.isOpen).toBe(true);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });
  });

  describe("scroll lock", () => {
    it("locks scroll when opening", () => {
      const { controller } = setup();

      controller.open();
      expect(document.documentElement.style.overflow).toBe("hidden");

      controller.destroy();
    });

    it("unlocks scroll when closing", () => {
      const { controller } = setup();

      controller.open();
      expect(document.documentElement.style.overflow).toBe("hidden");

      controller.close();
      expect(document.documentElement.style.overflow).toBe("");

      controller.destroy();
    });

    it("unlocks scroll on destroy while open", () => {
      const { controller } = setup();

      controller.open();
      expect(document.documentElement.style.overflow).toBe("hidden");

      controller.destroy();
      expect(document.documentElement.style.overflow).toBe("");
    });

    it("respects lockScroll: false option", () => {
      const { controller } = setup({ lockScroll: false });

      controller.open();
      expect(document.documentElement.style.overflow).toBe("");

      controller.destroy();
    });

    it("respects data-lock-scroll='false' attribute", () => {
      document.body.innerHTML = `
        <div data-slot="dialog" id="root" data-lock-scroll="false">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Content</div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createDialog(root);

      controller.open();
      expect(document.documentElement.style.overflow).toBe("");

      controller.destroy();
    });

    it("handles nested dialogs with ref counting", () => {
      document.body.innerHTML = `
        <div data-slot="dialog" id="dialog1">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Dialog 1</div>
        </div>
        <div data-slot="dialog" id="dialog2">
          <div data-slot="dialog-overlay"></div>
          <div data-slot="dialog-content">Dialog 2</div>
        </div>
      `;
      const dialog1 = document.getElementById("dialog1")!;
      const dialog2 = document.getElementById("dialog2")!;
      const controller1 = createDialog(dialog1);
      const controller2 = createDialog(dialog2);

      // Open first dialog
      controller1.open();
      expect(document.documentElement.style.overflow).toBe("hidden");

      // Open second dialog (nested)
      controller2.open();
      expect(document.documentElement.style.overflow).toBe("hidden");

      // Close second dialog - first still open, should stay locked
      controller2.close();
      expect(document.documentElement.style.overflow).toBe("hidden");

      // Close first dialog - all closed, should unlock
      controller1.close();
      expect(document.documentElement.style.overflow).toBe("");

      controller1.destroy();
      controller2.destroy();
    });
  });
});
