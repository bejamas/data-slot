import { describe, expect, it, beforeEach } from "bun:test";
import { createToggle, create } from "./index";

describe("Toggle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const setup = (attrs = "") => {
    document.body.innerHTML = `
      <button data-slot="toggle" id="root" ${attrs}>Toggle</button>
    `;
    const root = document.getElementById("root") as HTMLButtonElement;
    const controller = createToggle(root);

    return { root, controller };
  };

  describe("initialization", () => {
    it("initializes with unpressed state by default", () => {
      const { root, controller } = setup();

      expect(controller.pressed).toBe(false);
      expect(root.getAttribute("aria-pressed")).toBe("false");
      expect(root.dataset.state).toBe("off");
    });

    it("initializes with pressed state when data-default-pressed is set", () => {
      const { root, controller } = setup("data-default-pressed");

      expect(controller.pressed).toBe(true);
      expect(root.getAttribute("aria-pressed")).toBe("true");
      expect(root.dataset.state).toBe("on");
    });

    it("respects defaultPressed option over data attribute", () => {
      document.body.innerHTML = `
        <button data-slot="toggle" id="root" data-default-pressed>Toggle</button>
      `;
      const root = document.getElementById("root") as HTMLButtonElement;
      const controller = createToggle(root, { defaultPressed: false });

      expect(controller.pressed).toBe(false);
    });

    it("sets type=button on button elements", () => {
      const { root } = setup();
      expect(root.getAttribute("type")).toBe("button");
    });

    it("does not override existing type attribute", () => {
      document.body.innerHTML = `
        <button data-slot="toggle" id="root" type="submit">Toggle</button>
      `;
      const root = document.getElementById("root") as HTMLButtonElement;
      createToggle(root);

      expect(root.getAttribute("type")).toBe("submit");
    });

    it("reads data-disabled attribute on initialization", () => {
      const { root, controller } = setup("data-disabled");

      expect(root.hasAttribute("disabled")).toBe(true);
      expect(root.getAttribute("aria-disabled")).toBe("true");
      // Click should be blocked
      root.click();
      expect(controller.pressed).toBe(false);
    });
  });

  describe("disabled state", () => {
    it("sets native disabled and aria-disabled when disabled option is true", () => {
      document.body.innerHTML = `
        <button data-slot="toggle" id="root">Toggle</button>
      `;
      const root = document.getElementById("root") as HTMLButtonElement;
      createToggle(root, { disabled: true });

      expect(root.hasAttribute("disabled")).toBe(true);
      expect(root.getAttribute("aria-disabled")).toBe("true");
    });

    it("sets only aria-disabled on non-button elements", () => {
      document.body.innerHTML = `
        <div data-slot="toggle" id="root" role="button" tabindex="0">Toggle</div>
      `;
      const root = document.getElementById("root") as HTMLElement;
      createToggle(root, { disabled: true });

      expect(root.hasAttribute("disabled")).toBe(false);
      expect(root.getAttribute("aria-disabled")).toBe("true");
    });

    it("blocks click when disabled attribute is set", () => {
      const { root, controller } = setup("disabled");

      root.click();
      expect(controller.pressed).toBe(false);
    });

    it("blocks click when aria-disabled is true", () => {
      const { root, controller } = setup('aria-disabled="true"');

      root.click();
      expect(controller.pressed).toBe(false);
    });

    it("blocks toggle:set event when disabled", () => {
      const { root, controller } = setup("disabled");

      root.dispatchEvent(
        new CustomEvent("toggle:set", { detail: { pressed: true } })
      );
      expect(controller.pressed).toBe(false);
    });

    it("blocks toggle:set event when aria-disabled is true", () => {
      const { root, controller } = setup('aria-disabled="true"');

      root.dispatchEvent(new CustomEvent("toggle:set", { detail: true }));
      expect(controller.pressed).toBe(false);
    });

    it("allows programmatic toggle() when disabled", () => {
      const { controller } = setup("disabled");

      controller.toggle();
      expect(controller.pressed).toBe(true);

      controller.toggle();
      expect(controller.pressed).toBe(false);
    });

    it("allows programmatic press() when disabled", () => {
      const { controller } = setup("disabled");

      controller.press();
      expect(controller.pressed).toBe(true);
    });

    it("allows programmatic release() when disabled", () => {
      const { controller } = setup("disabled data-default-pressed");

      controller.release();
      expect(controller.pressed).toBe(false);
    });
  });

  describe("click interaction", () => {
    it("toggles state on click", () => {
      const { root, controller } = setup();

      root.click();
      expect(controller.pressed).toBe(true);
      expect(root.getAttribute("aria-pressed")).toBe("true");
      expect(root.dataset.state).toBe("on");

      root.click();
      expect(controller.pressed).toBe(false);
      expect(root.getAttribute("aria-pressed")).toBe("false");
      expect(root.dataset.state).toBe("off");
    });
  });

  describe("programmatic control", () => {
    it("toggle() toggles the state", () => {
      const { controller } = setup();

      controller.toggle();
      expect(controller.pressed).toBe(true);

      controller.toggle();
      expect(controller.pressed).toBe(false);
    });

    it("press() sets state to true", () => {
      const { controller } = setup();

      controller.press();
      expect(controller.pressed).toBe(true);

      controller.press();
      expect(controller.pressed).toBe(true);
    });

    it("release() sets state to false", () => {
      const { controller } = setup("data-default-pressed");

      controller.release();
      expect(controller.pressed).toBe(false);

      controller.release();
      expect(controller.pressed).toBe(false);
    });
  });

  describe("events", () => {
    it("emits toggle:change event on state change", () => {
      const { root, controller } = setup();
      const events: Array<{ pressed: boolean }> = [];

      root.addEventListener("toggle:change", (e) => {
        events.push((e as CustomEvent).detail);
      });

      controller.toggle();
      expect(events).toEqual([{ pressed: true }]);

      controller.toggle();
      expect(events).toEqual([{ pressed: true }, { pressed: false }]);
    });

    it("calls onPressedChange callback", () => {
      document.body.innerHTML = `
        <button data-slot="toggle" id="root">Toggle</button>
      `;
      const root = document.getElementById("root") as HTMLButtonElement;
      const calls: boolean[] = [];
      const controller = createToggle(root, {
        onPressedChange: (pressed) => calls.push(pressed),
      });

      controller.toggle();
      expect(calls).toEqual([true]);

      controller.toggle();
      expect(calls).toEqual([true, false]);
    });

    it("does not emit event on initialization", () => {
      document.body.innerHTML = `
        <button data-slot="toggle" id="root" data-default-pressed>Toggle</button>
      `;
      const root = document.getElementById("root") as HTMLButtonElement;
      const events: Array<{ pressed: boolean }> = [];

      root.addEventListener("toggle:change", (e) => {
        events.push((e as CustomEvent).detail);
      });

      createToggle(root);
      expect(events).toEqual([]);
    });

    it("responds to toggle:set inbound event with object", () => {
      const { root, controller } = setup();

      root.dispatchEvent(
        new CustomEvent("toggle:set", { detail: { pressed: true } })
      );
      expect(controller.pressed).toBe(true);

      root.dispatchEvent(
        new CustomEvent("toggle:set", { detail: { pressed: false } })
      );
      expect(controller.pressed).toBe(false);
    });

    it("responds to toggle:set inbound event with boolean", () => {
      const { root, controller } = setup();

      root.dispatchEvent(new CustomEvent("toggle:set", { detail: true }));
      expect(controller.pressed).toBe(true);

      root.dispatchEvent(new CustomEvent("toggle:set", { detail: false }));
      expect(controller.pressed).toBe(false);
    });
  });

  describe("destroy", () => {
    it("removes event listeners", () => {
      const { root, controller } = setup();

      controller.destroy();
      root.click();
      expect(controller.pressed).toBe(false);
    });

    it("allows re-binding after destroy", () => {
      const { root, controller } = setup();

      controller.destroy();

      const newController = createToggle(root);
      root.click();
      expect(newController.pressed).toBe(true);
    });
  });

  describe("create() auto-discovery", () => {
    it("finds and binds all toggle instances", () => {
      document.body.innerHTML = `
        <button data-slot="toggle" id="t1">Toggle 1</button>
        <button data-slot="toggle" id="t2" data-default-pressed>Toggle 2</button>
      `;

      const controllers = create();
      expect(controllers).toHaveLength(2);
      expect(controllers[0].pressed).toBe(false);
      expect(controllers[1].pressed).toBe(true);
    });

    it("scopes discovery to provided element", () => {
      document.body.innerHTML = `
        <div id="scope">
          <button data-slot="toggle" id="t1">Toggle 1</button>
        </div>
        <button data-slot="toggle" id="t2">Toggle 2</button>
      `;

      const scope = document.getElementById("scope")!;
      const controllers = create(scope);
      expect(controllers).toHaveLength(1);
    });

    it("does not double-bind same element", () => {
      document.body.innerHTML = `
        <button data-slot="toggle" id="t1">Toggle 1</button>
      `;

      const first = create();
      const second = create();

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(0);
    });
  });
});
