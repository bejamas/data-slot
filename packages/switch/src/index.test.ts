import { beforeEach, describe, expect, it } from "bun:test";
import { createSwitch, create } from "./index";
import { clearRootBinding, setRootBinding } from "../../core/src/index";

describe("Switch", () => {
  const ROOT_BINDING_KEY = "@data-slot/switch";

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const getHiddenCheckbox = () =>
    document.querySelector<HTMLInputElement>('input[type="checkbox"][data-switch-generated="input"]');

  const getHiddenUncheckedInput = () =>
    document.querySelector<HTMLInputElement>('input[type="hidden"][data-switch-generated="unchecked"]');

  const setup = (attrs = "") => {
    document.body.innerHTML = `
      <label id="wrap">
        <span data-slot="switch" id="root" ${attrs}>
          <span data-slot="switch-thumb" id="thumb"></span>
        </span>
        Notifications
      </label>
    `;
    const root = document.getElementById("root") as HTMLElement;
    const thumb = document.getElementById("thumb") as HTMLElement;
    const controller = createSwitch(root);

    return { root, thumb, controller };
  };

  describe("initialization", () => {
    it("initializes with unchecked state by default", () => {
      const { root, thumb, controller } = setup();

      expect(controller.checked).toBe(false);
      expect(root.getAttribute("aria-checked")).toBe("false");
      expect(root.hasAttribute("data-unchecked")).toBe(true);
      expect(root.hasAttribute("data-checked")).toBe(false);
      expect(thumb.hasAttribute("data-unchecked")).toBe(true);
    });

    it("reads data-default-checked on initialization", () => {
      const { root, thumb, controller } = setup("data-default-checked");

      expect(controller.checked).toBe(true);
      expect(root.getAttribute("aria-checked")).toBe("true");
      expect(root.hasAttribute("data-checked")).toBe(true);
      expect(thumb.hasAttribute("data-checked")).toBe(true);
    });

    it("prefers the JS defaultChecked option over data attributes", () => {
      document.body.innerHTML = `
        <span data-slot="switch" id="root" data-default-checked>
          <span data-slot="switch-thumb"></span>
        </span>
      `;
      const root = document.getElementById("root") as HTMLElement;
      const controller = createSwitch(root, { defaultChecked: false });

      expect(controller.checked).toBe(false);
    });

    it("creates a hidden checkbox for form integration", () => {
      setup();

      const hidden = getHiddenCheckbox();
      expect(hidden).not.toBeNull();
      expect(hidden?.checked).toBe(false);
      expect(hidden?.tabIndex).toBe(-1);
    });

    it("sets role=switch and tabindex for neutral roots", () => {
      const { root } = setup();

      expect(root.getAttribute("role")).toBe("switch");
      expect(root.tabIndex).toBe(0);
    });

    it("preserves authored tabindex when enabled", () => {
      const { root } = setup('tabindex="5"');
      expect(root.tabIndex).toBe(5);
    });

    it("keeps authored data attributes intact", () => {
      const { root } = setup('data-size="sm"');
      expect(root.getAttribute("data-size")).toBe("sm");
    });

    it("wires a wrapping label as the accessible name", () => {
      const { root } = setup();
      const label = document.getElementById("wrap") as HTMLLabelElement;

      expect(label.id).toBeTruthy();
      expect(root.getAttribute("aria-labelledby")).toContain(label.id);
    });
  });

  describe("interaction", () => {
    it("toggles on root click", () => {
      const { root, thumb, controller } = setup();

      root.click();
      expect(controller.checked).toBe(true);
      expect(root.hasAttribute("data-checked")).toBe(true);
      expect(thumb.hasAttribute("data-checked")).toBe(true);

      root.click();
      expect(controller.checked).toBe(false);
    });

    it("toggles when the wrapping label is clicked", () => {
      const { controller } = setup();
      const label = document.getElementById("wrap") as HTMLLabelElement;

      label.click();
      expect(controller.checked).toBe(true);
    });

    it("toggles on Enter and Space for neutral roots", () => {
      const { root, controller } = setup();

      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(controller.checked).toBe(true);

      root.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      expect(controller.checked).toBe(false);
    });

    it("does not toggle repeatedly for held keys", () => {
      const { root, controller } = setup();

      root.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, repeat: true }),
      );

      expect(controller.checked).toBe(false);
    });
  });

  describe("labels", () => {
    it("supports explicit label[for] associations without changing the root id", () => {
      document.body.innerHTML = `
        <label for="notifications-switch" id="label">Notifications</label>
        <span data-slot="switch" id="notifications-switch">
          <span data-slot="switch-thumb"></span>
        </span>
      `;
      const root = document.getElementById("notifications-switch") as HTMLElement;
      const label = document.getElementById("label") as HTMLLabelElement;
      const controller = createSwitch(root);

      expect(root.id).toBe("notifications-switch");
      expect(root.getAttribute("aria-labelledby")).toContain(label.id);

      label.click();
      expect(controller.checked).toBe(true);
    });
  });

  describe("disabled and readonly state", () => {
    it("reads disabled and syncs disabled attrs on root and thumb", () => {
      const { root, thumb } = setup("data-disabled");
      const hidden = getHiddenCheckbox();

      expect(root.getAttribute("aria-disabled")).toBe("true");
      expect(root.tabIndex).toBe(-1);
      expect(root.hasAttribute("data-disabled")).toBe(true);
      expect(thumb.hasAttribute("data-disabled")).toBe(true);
      expect(hidden?.disabled).toBe(true);
    });

    it("forces disabled neutral roots out of the tab order even with authored tabindex", () => {
      const { root } = setup('data-disabled tabindex="7"');
      expect(root.tabIndex).toBe(-1);
    });

    it("blocks user interaction when disabled", () => {
      const { root, controller } = setup("data-disabled");

      root.click();
      expect(controller.checked).toBe(false);
    });

    it("blocks user interaction when readonly", () => {
      const { root, controller } = setup("data-read-only");
      const label = document.getElementById("wrap") as HTMLLabelElement;

      root.click();
      label.click();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(root.getAttribute("aria-readonly")).toBe("true");
      expect(controller.checked).toBe(false);
    });

    it("allows controller methods while readonly", () => {
      const { controller } = setup("data-read-only");

      controller.check();
      expect(controller.checked).toBe(true);
    });

    it("allows switch:set even while disabled", () => {
      const { root, controller } = setup("data-disabled");

      root.dispatchEvent(new CustomEvent("switch:set", { detail: { checked: true } }));
      expect(controller.checked).toBe(true);
    });
  });

  describe("form integration", () => {
    it("applies name and checked value to the hidden checkbox", () => {
      const { controller } = setup('data-name="notifications" data-value="yes" data-default-checked');
      const hidden = getHiddenCheckbox();

      expect(hidden?.name).toBe("notifications");
      expect(hidden?.value).toBe("yes");
      expect(hidden?.checked).toBe(true);
      expect(getHiddenUncheckedInput()).toBeNull();

      controller.uncheck();
      expect(getHiddenUncheckedInput()).toBeNull();
    });

    it("creates an unchecked hidden input only when needed", () => {
      const { controller } = setup('data-name="notifications" data-unchecked-value="off"');
      const hiddenUnchecked = getHiddenUncheckedInput();

      expect(hiddenUnchecked?.name).toBe("notifications");
      expect(hiddenUnchecked?.value).toBe("off");

      controller.check();
      expect(getHiddenUncheckedInput()).toBeNull();

      controller.uncheck();
      expect(getHiddenUncheckedInput()?.value).toBe("off");
    });

    it("does not create unchecked hidden input when disabled", () => {
      setup('data-name="notifications" data-unchecked-value="off" data-disabled');
      expect(getHiddenUncheckedInput()).toBeNull();
    });

    it("syncs required to root and hidden checkbox", () => {
      const { root, thumb } = setup("data-required");
      const hidden = getHiddenCheckbox();

      expect(root.getAttribute("aria-required")).toBe("true");
      expect(root.hasAttribute("data-required")).toBe(true);
      expect(thumb.hasAttribute("data-required")).toBe(true);
      expect(hidden?.required).toBe(true);
    });

    it("restores a checked-by-default switch on native form reset", async () => {
      document.body.innerHTML = `
        <form id="form">
          <label>
            <span data-slot="switch" id="root" data-default-checked data-name="notifications">
              <span data-slot="switch-thumb"></span>
            </span>
            Notifications
          </label>
        </form>
      `;

      const form = document.getElementById("form") as HTMLFormElement;
      const root = document.getElementById("root") as HTMLElement;
      const controller = createSwitch(root);

      controller.uncheck();
      expect(controller.checked).toBe(false);

      form.reset();
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(controller.checked).toBe(true);
      expect(root.getAttribute("aria-checked")).toBe("true");
      expect(root.hasAttribute("data-checked")).toBe(true);
      expect(getHiddenCheckbox()?.checked).toBe(true);
    });

    it("restores an unchecked-by-default switch on native form reset", async () => {
      document.body.innerHTML = `
        <form id="form">
          <label>
            <span
              data-slot="switch"
              id="root"
              data-name="notifications"
              data-unchecked-value="off"
            >
              <span data-slot="switch-thumb"></span>
            </span>
            Notifications
          </label>
        </form>
      `;

      const form = document.getElementById("form") as HTMLFormElement;
      const root = document.getElementById("root") as HTMLElement;
      const controller = createSwitch(root);

      controller.check();
      expect(controller.checked).toBe(true);
      expect(getHiddenUncheckedInput()).toBeNull();

      form.reset();
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(controller.checked).toBe(false);
      expect(root.getAttribute("aria-checked")).toBe("false");
      expect(root.hasAttribute("data-unchecked")).toBe(true);
      expect(getHiddenCheckbox()?.checked).toBe(false);
      expect(getHiddenUncheckedInput()?.value).toBe("off");
    });
  });

  describe("events", () => {
    it("emits switch:change on state changes", () => {
      const { controller, root } = setup();
      const events: Array<{ checked: boolean }> = [];

      root.addEventListener("switch:change", (event) => {
        events.push((event as CustomEvent).detail);
      });

      controller.toggle();
      controller.toggle();

      expect(events).toEqual([{ checked: true }, { checked: false }]);
    });

    it("calls onCheckedChange when state changes", () => {
      document.body.innerHTML = `
        <span data-slot="switch" id="root">
          <span data-slot="switch-thumb"></span>
        </span>
      `;
      const root = document.getElementById("root") as HTMLElement;
      const calls: boolean[] = [];
      const controller = createSwitch(root, {
        onCheckedChange: (checked) => calls.push(checked),
      });

      controller.check();
      controller.uncheck();

      expect(calls).toEqual([true, false]);
    });

    it("supports switch:set with object and boolean detail", () => {
      const { root, controller } = setup();

      root.dispatchEvent(new CustomEvent("switch:set", { detail: { checked: true } }));
      expect(controller.checked).toBe(true);

      root.dispatchEvent(new CustomEvent("switch:set", { detail: false }));
      expect(controller.checked).toBe(false);
    });
  });

  describe("destroy", () => {
    it("removes generated inputs on destroy", () => {
      const { controller } = setup('data-name="notifications" data-unchecked-value="off"');

      controller.destroy();

      expect(getHiddenCheckbox()).toBeNull();
      expect(getHiddenUncheckedInput()).toBeNull();
    });

    it("allows re-binding after destroy", () => {
      const { controller, root } = setup();

      controller.destroy();
      const rebound = createSwitch(root);

      expect(rebound).not.toBe(controller);
      expect(rebound.checked).toBe(false);
    });
  });

  describe("create() auto-discovery", () => {
    it("finds and binds all switch instances", () => {
      document.body.innerHTML = `
        <span data-slot="switch" id="one">
          <span data-slot="switch-thumb"></span>
        </span>
        <span data-slot="switch" id="two" data-default-checked>
          <span data-slot="switch-thumb"></span>
        </span>
      `;

      const controllers = create();
      expect(controllers).toHaveLength(2);
      expect(controllers[0]?.checked).toBe(false);
      expect(controllers[1]?.checked).toBe(true);
    });

    it("scopes discovery to the provided element", () => {
      document.body.innerHTML = `
        <div id="scope">
          <span data-slot="switch" id="one">
            <span data-slot="switch-thumb"></span>
          </span>
        </div>
        <span data-slot="switch" id="two">
          <span data-slot="switch-thumb"></span>
        </span>
      `;

      const scope = document.getElementById("scope") as HTMLElement;
      const controllers = create(scope);

      expect(controllers).toHaveLength(1);
      expect(controllers[0]).toBeDefined();
    });

    it("does not double-bind the same root", () => {
      document.body.innerHTML = `
        <span data-slot="switch" id="root">
          <span data-slot="switch-thumb"></span>
        </span>
      `;

      const first = create();
      const second = create();

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(0);
    });

    it("reuses a controller bound by another module copy", () => {
      document.body.innerHTML = `
        <span data-slot="switch" id="root">
          <span data-slot="switch-thumb"></span>
        </span>
      `;

      const root = document.getElementById("root") as HTMLElement;
      const foreignController = {
        checked: true,
        toggle() {},
        check() {},
        uncheck() {},
        setChecked() {},
        destroy() {},
      };
      setRootBinding(root, ROOT_BINDING_KEY, foreignController);

      const controller = createSwitch(root);
      expect(controller).toBe(foreignController);
    });

    it("create() skips roots bound by another module copy", () => {
      document.body.innerHTML = `
        <span data-slot="switch" id="root">
          <span data-slot="switch-thumb"></span>
        </span>
      `;

      const root = document.getElementById("root") as HTMLElement;
      setRootBinding(root, ROOT_BINDING_KEY, { destroy() {} });

      const controllers = create();
      expect(controllers).toHaveLength(0);
    });

    it("allows rebinding after foreign destroy cleanup", () => {
      document.body.innerHTML = `
        <span data-slot="switch" id="root">
          <span data-slot="switch-thumb"></span>
        </span>
      `;

      const root = document.getElementById("root") as HTMLElement;
      const foreignController = { destroy() {} };
      setRootBinding(root, ROOT_BINDING_KEY, foreignController);
      clearRootBinding(root, ROOT_BINDING_KEY, foreignController);

      const controller = createSwitch(root);
      expect(controller.checked).toBe(false);
    });
  });
});
