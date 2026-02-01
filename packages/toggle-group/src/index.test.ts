import { describe, expect, it, beforeEach } from "bun:test";
import { createToggleGroup, create } from "./index";

describe("ToggleGroup", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const setup = (attrs = "", itemAttrs: string[] = []) => {
    const items = ["left", "center", "right"];
    document.body.innerHTML = `
      <div data-slot="toggle-group" id="root" ${attrs}>
        ${items
          .map(
            (v, i) =>
              `<button data-slot="toggle-group-item" data-value="${v}" ${itemAttrs[i] || ""}>${v}</button>`
          )
          .join("\n")}
      </div>
    `;
    const root = document.getElementById("root")!;
    const controller = createToggleGroup(root);
    const buttons = Array.from(
      root.querySelectorAll('[data-slot="toggle-group-item"]')
    ) as HTMLButtonElement[];

    return { root, controller, buttons };
  };

  describe("initialization", () => {
    it("initializes with no selection by default", () => {
      const { controller, buttons } = setup();

      expect(controller.value).toEqual([]);
      for (const btn of buttons) {
        expect(btn.getAttribute("aria-pressed")).toBe("false");
        expect(btn.dataset.state).toBe("off");
      }
    });

    it("initializes with default value from data attribute", () => {
      const { controller, buttons } = setup('data-default-value="center"');

      expect(controller.value).toEqual(["center"]);
      expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
      expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
      expect(buttons[2].getAttribute("aria-pressed")).toBe("false");
    });

    it("respects defaultValue option over data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="root" data-default-value="left">
          <button data-slot="toggle-group-item" data-value="left">Left</button>
          <button data-slot="toggle-group-item" data-value="right">Right</button>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createToggleGroup(root, { defaultValue: "right" });

      expect(controller.value).toEqual(["right"]);
    });

    it("sets type=button on button elements", () => {
      const { buttons } = setup();

      for (const btn of buttons) {
        expect(btn.getAttribute("type")).toBe("button");
      }
    });

    it("does not override existing type attribute", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="root">
          <button data-slot="toggle-group-item" data-value="a" type="submit">A</button>
        </div>
      `;
      const root = document.getElementById("root")!;
      createToggleGroup(root);

      const btn = root.querySelector("button")!;
      expect(btn.getAttribute("type")).toBe("submit");
    });

    it("sets role=group on root", () => {
      const { root } = setup();
      expect(root.getAttribute("role")).toBe("group");
    });

    it("makes items without data-value non-interactive", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="root">
          <button data-slot="toggle-group-item" data-value="a">A</button>
          <button data-slot="toggle-group-item" id="no-value">No value</button>
          <button data-slot="toggle-group-item" data-value="b">B</button>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createToggleGroup(root);
      const noValueBtn = document.getElementById("no-value")!;

      // Should only have 2 valid items
      controller.setValue("a");
      expect(controller.value).toEqual(["a"]);

      // Item without data-value should be non-interactive
      expect(noValueBtn.tabIndex).toBe(-1);
      expect(noValueBtn.getAttribute("aria-disabled")).toBe("true");

      // Click on invalid item should do nothing
      noValueBtn.click();
      expect(controller.value).toEqual(["a"]);
    });

    it("throws if all items lack data-value", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="root">
          <button data-slot="toggle-group-item">No value 1</button>
          <button data-slot="toggle-group-item">No value 2</button>
        </div>
      `;
      const root = document.getElementById("root")!;

      expect(() => createToggleGroup(root)).toThrow(
        "ToggleGroup requires at least one toggle-group-item with a data-value attribute"
      );
    });
  });

  describe("single selection mode", () => {
    it("selects one item at a time", () => {
      const { controller, buttons } = setup();

      buttons[0].click();
      expect(controller.value).toEqual(["left"]);
      expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
      expect(buttons[1].getAttribute("aria-pressed")).toBe("false");

      buttons[1].click();
      expect(controller.value).toEqual(["center"]);
      expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
      expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    });

    it("allows deselection (empty selection)", () => {
      const { controller, buttons } = setup('data-default-value="left"');

      expect(controller.value).toEqual(["left"]);

      buttons[0].click();
      expect(controller.value).toEqual([]);
      expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    });

    it("only uses first value when multiple default values provided", () => {
      const { controller } = setup('data-default-value="left center"');

      expect(controller.value).toEqual(["left"]);
    });
  });

  describe("multiple selection mode", () => {
    it("allows multiple selections", () => {
      const { controller, buttons } = setup("data-multiple");

      buttons[0].click();
      buttons[1].click();
      expect(controller.value).toEqual(["left", "center"]);
      expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
      expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    });

    it("toggles individual items", () => {
      const { controller, buttons } = setup("data-multiple");

      buttons[0].click();
      buttons[1].click();
      expect(controller.value).toEqual(["left", "center"]);

      buttons[0].click();
      expect(controller.value).toEqual(["center"]);
    });

    it("initializes with multiple default values", () => {
      const { controller, buttons } = setup(
        'data-multiple data-default-value="left right"'
      );

      expect(controller.value).toEqual(["left", "right"]);
      expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
      expect(buttons[1].getAttribute("aria-pressed")).toBe("false");
      expect(buttons[2].getAttribute("aria-pressed")).toBe("true");
    });

    it("accepts array defaultValue option", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="root" data-multiple>
          <button data-slot="toggle-group-item" data-value="a">A</button>
          <button data-slot="toggle-group-item" data-value="b">B</button>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createToggleGroup(root, {
        defaultValue: ["a", "b"],
      });

      expect(controller.value).toEqual(["a", "b"]);
    });
  });

  describe("disabled state", () => {
    describe("group disabled", () => {
      it("sets aria-disabled on root when disabled option is true", () => {
        document.body.innerHTML = `
          <div data-slot="toggle-group" id="root">
            <button data-slot="toggle-group-item" data-value="a">A</button>
          </div>
        `;
        const root = document.getElementById("root")!;
        createToggleGroup(root, { disabled: true });

        expect(root.getAttribute("aria-disabled")).toBe("true");
      });

      it("blocks click when group has data-disabled", () => {
        const { controller, buttons } = setup("data-disabled");

        buttons[0].click();
        expect(controller.value).toEqual([]);
      });

      it("blocks click when group has aria-disabled=true", () => {
        const { controller, buttons } = setup('aria-disabled="true"');

        buttons[0].click();
        expect(controller.value).toEqual([]);
      });

      it("blocks toggle-group:set event when group disabled", () => {
        const { root, controller } = setup("data-disabled");

        root.dispatchEvent(
          new CustomEvent("toggle-group:set", { detail: { value: "left" } })
        );
        expect(controller.value).toEqual([]);
      });

      it("allows programmatic setValue when group disabled", () => {
        const { controller } = setup("data-disabled");

        controller.setValue("left");
        expect(controller.value).toEqual(["left"]);
      });

      it("allows programmatic toggle when group disabled", () => {
        const { controller } = setup("data-disabled");

        controller.toggle("left");
        expect(controller.value).toEqual(["left"]);
      });
    });

    describe("individual item disabled", () => {
      it("blocks click on disabled item (disabled attribute)", () => {
        const { controller, buttons } = setup("", ["disabled", "", ""]);

        buttons[0].click();
        expect(controller.value).toEqual([]);

        buttons[1].click();
        expect(controller.value).toEqual(["center"]);
      });

      it("blocks click on disabled item (data-disabled)", () => {
        const { controller, buttons } = setup("", ["data-disabled", "", ""]);

        buttons[0].click();
        expect(controller.value).toEqual([]);
      });

      it("blocks click on disabled item (aria-disabled)", () => {
        const { controller, buttons } = setup("", [
          'aria-disabled="true"',
          "",
          "",
        ]);

        buttons[0].click();
        expect(controller.value).toEqual([]);
      });

      it("sets native disabled and aria-disabled on disabled items", () => {
        const { buttons } = setup("", ["disabled", "", ""]);

        expect(buttons[0].hasAttribute("disabled")).toBe(true);
        expect(buttons[0].getAttribute("aria-disabled")).toBe("true");
      });

      it("respects dynamically disabled items during keyboard navigation", () => {
        const { buttons } = setup();

        // Start with all enabled, navigate normally
        buttons[0].focus();
        buttons[0].dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
        expect(document.activeElement).toBe(buttons[1]);

        // Dynamically disable the third button
        buttons[2].setAttribute("aria-disabled", "true");

        // Arrow right should now skip the disabled button and loop to first
        buttons[1].dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
        expect(document.activeElement).toBe(buttons[0]);
      });

      it("respects dynamically disabled items during click", () => {
        const { controller, buttons } = setup();

        // Click works initially
        buttons[0].click();
        expect(controller.value).toEqual(["left"]);

        // Dynamically disable the button
        buttons[1].setAttribute("data-disabled", "");

        // Click should now be blocked
        buttons[1].click();
        expect(controller.value).toEqual(["left"]);
      });
    });
  });

  describe("keyboard navigation", () => {
    const keydown = (
      el: HTMLElement,
      key: string,
      opts: Partial<KeyboardEventInit> = {}
    ) => {
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, ...opts })
      );
    };

    it("navigates with ArrowRight/ArrowLeft in horizontal mode", () => {
      const { buttons } = setup();

      buttons[0].focus();
      keydown(buttons[0], "ArrowRight");
      expect(document.activeElement).toBe(buttons[1]);

      keydown(buttons[1], "ArrowRight");
      expect(document.activeElement).toBe(buttons[2]);

      keydown(buttons[2], "ArrowLeft");
      expect(document.activeElement).toBe(buttons[1]);
    });

    it("navigates with ArrowUp/ArrowDown in vertical mode", () => {
      const { buttons } = setup('data-orientation="vertical"');

      buttons[0].focus();
      keydown(buttons[0], "ArrowDown");
      expect(document.activeElement).toBe(buttons[1]);

      keydown(buttons[1], "ArrowUp");
      expect(document.activeElement).toBe(buttons[0]);
    });

    it("loops focus by default", () => {
      const { buttons } = setup();

      buttons[2].focus();
      keydown(buttons[2], "ArrowRight");
      expect(document.activeElement).toBe(buttons[0]);

      keydown(buttons[0], "ArrowLeft");
      expect(document.activeElement).toBe(buttons[2]);
    });

    it("does not loop when loop=false", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="root">
          <button data-slot="toggle-group-item" data-value="a">A</button>
          <button data-slot="toggle-group-item" data-value="b">B</button>
        </div>
      `;
      const root = document.getElementById("root")!;
      createToggleGroup(root, { loop: false });
      const buttons = Array.from(
        root.querySelectorAll("button")
      ) as HTMLButtonElement[];

      buttons[0].focus();
      keydown(buttons[0], "ArrowLeft");
      expect(document.activeElement).toBe(buttons[0]);

      buttons[1].focus();
      keydown(buttons[1], "ArrowRight");
      expect(document.activeElement).toBe(buttons[1]);
    });

    it("Home/End navigate to first/last enabled item", () => {
      const { buttons } = setup();

      buttons[1].focus();
      keydown(buttons[1], "Home");
      expect(document.activeElement).toBe(buttons[0]);

      keydown(buttons[0], "End");
      expect(document.activeElement).toBe(buttons[2]);
    });

    it("skips disabled items during navigation", () => {
      const { buttons } = setup("", ["", "disabled", ""]);

      buttons[0].focus();
      keydown(buttons[0], "ArrowRight");
      expect(document.activeElement).toBe(buttons[2]);

      keydown(buttons[2], "ArrowLeft");
      expect(document.activeElement).toBe(buttons[0]);
    });

    it("updates tabindex on navigation", () => {
      const { buttons } = setup();

      buttons[0].focus();
      expect(buttons[0].tabIndex).toBe(0);

      keydown(buttons[0], "ArrowRight");
      expect(buttons[0].tabIndex).toBe(-1);
      expect(buttons[1].tabIndex).toBe(0);
    });

    it("sets tabindex=0 on first pressed item or first enabled", () => {
      // No selection - first enabled gets tabindex=0
      const { buttons } = setup();
      expect(buttons[0].tabIndex).toBe(0);
      expect(buttons[1].tabIndex).toBe(-1);
      expect(buttons[2].tabIndex).toBe(-1);
    });

    it("sets tabindex=0 on first pressed item when there is a selection", () => {
      const { buttons } = setup('data-default-value="center"');
      expect(buttons[0].tabIndex).toBe(-1);
      expect(buttons[1].tabIndex).toBe(0);
      expect(buttons[2].tabIndex).toBe(-1);
    });
  });

  describe("programmatic control", () => {
    it("setValue changes selection", () => {
      const { controller, buttons } = setup();

      controller.setValue("center");
      expect(controller.value).toEqual(["center"]);
      expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    });

    it("setValue accepts array in multiple mode", () => {
      const { controller } = setup("data-multiple");

      controller.setValue(["left", "right"]);
      expect(controller.value).toEqual(["left", "right"]);
    });

    it("setValue accepts space-separated string", () => {
      const { controller } = setup("data-multiple");

      controller.setValue("left right");
      expect(controller.value).toEqual(["left", "right"]);
    });

    it("toggle toggles individual value", () => {
      const { controller } = setup("data-multiple");

      controller.toggle("left");
      expect(controller.value).toEqual(["left"]);

      controller.toggle("center");
      expect(controller.value).toEqual(["left", "center"]);

      controller.toggle("left");
      expect(controller.value).toEqual(["center"]);
    });

    it("toggle in single mode replaces selection", () => {
      const { controller } = setup();

      controller.toggle("left");
      expect(controller.value).toEqual(["left"]);

      controller.toggle("center");
      expect(controller.value).toEqual(["center"]);
    });

    it("toggle in single mode allows deselection", () => {
      const { controller } = setup('data-default-value="left"');

      controller.toggle("left");
      expect(controller.value).toEqual([]);
    });
  });

  describe("events", () => {
    it("emits toggle-group:change event on state change", () => {
      const { root, controller } = setup();
      const events: Array<{ value: string[] }> = [];

      root.addEventListener("toggle-group:change", (e) => {
        events.push((e as CustomEvent).detail);
      });

      controller.setValue("left");
      expect(events).toEqual([{ value: ["left"] }]);

      controller.setValue("center");
      expect(events).toEqual([{ value: ["left"] }, { value: ["center"] }]);
    });

    it("calls onValueChange callback", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="root">
          <button data-slot="toggle-group-item" data-value="a">A</button>
          <button data-slot="toggle-group-item" data-value="b">B</button>
        </div>
      `;
      const root = document.getElementById("root")!;
      const calls: string[][] = [];
      const controller = createToggleGroup(root, {
        onValueChange: (value) => calls.push(value),
      });

      controller.setValue("a");
      expect(calls).toEqual([["a"]]);

      controller.setValue("b");
      expect(calls).toEqual([["a"], ["b"]]);
    });

    it("does not emit event on initialization", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="root" data-default-value="a">
          <button data-slot="toggle-group-item" data-value="a">A</button>
        </div>
      `;
      const root = document.getElementById("root")!;
      const events: Array<{ value: string[] }> = [];

      root.addEventListener("toggle-group:change", (e) => {
        events.push((e as CustomEvent).detail);
      });

      createToggleGroup(root);
      expect(events).toEqual([]);
    });

    it("responds to toggle-group:set inbound event with object", () => {
      const { root, controller } = setup();

      root.dispatchEvent(
        new CustomEvent("toggle-group:set", { detail: { value: "center" } })
      );
      expect(controller.value).toEqual(["center"]);
    });

    it("responds to toggle-group:set inbound event with string", () => {
      const { root, controller } = setup();

      root.dispatchEvent(new CustomEvent("toggle-group:set", { detail: "left" }));
      expect(controller.value).toEqual(["left"]);
    });

    it("responds to toggle-group:set inbound event with array", () => {
      const { root, controller } = setup("data-multiple");

      root.dispatchEvent(
        new CustomEvent("toggle-group:set", { detail: ["left", "right"] })
      );
      expect(controller.value).toEqual(["left", "right"]);
    });

    it("does not emit when value does not change", () => {
      const { root, controller } = setup('data-default-value="left"');
      const events: Array<{ value: string[] }> = [];

      root.addEventListener("toggle-group:change", (e) => {
        events.push((e as CustomEvent).detail);
      });

      controller.setValue("left");
      expect(events).toEqual([]);
    });
  });

  describe("destroy", () => {
    it("removes event listeners", () => {
      const { controller, buttons } = setup();

      controller.destroy();
      buttons[0].click();
      expect(controller.value).toEqual([]);
    });

    it("allows re-binding after destroy", () => {
      const { root, controller } = setup();

      controller.destroy();

      const newController = createToggleGroup(root);
      const buttons = root.querySelectorAll("button");
      (buttons[0] as HTMLButtonElement).click();
      expect(newController.value).toEqual(["left"]);
    });
  });

  describe("create() auto-discovery", () => {
    it("finds and binds all toggle-group instances", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group" id="g1">
          <button data-slot="toggle-group-item" data-value="a">A</button>
        </div>
        <div data-slot="toggle-group" id="g2" data-default-value="b">
          <button data-slot="toggle-group-item" data-value="b">B</button>
        </div>
      `;

      const controllers = create();
      expect(controllers).toHaveLength(2);
      expect(controllers[0].value).toEqual([]);
      expect(controllers[1].value).toEqual(["b"]);
    });

    it("scopes discovery to provided element", () => {
      document.body.innerHTML = `
        <div id="scope">
          <div data-slot="toggle-group">
            <button data-slot="toggle-group-item" data-value="a">A</button>
          </div>
        </div>
        <div data-slot="toggle-group">
          <button data-slot="toggle-group-item" data-value="b">B</button>
        </div>
      `;

      const scope = document.getElementById("scope")!;
      const controllers = create(scope);
      expect(controllers).toHaveLength(1);
    });

    it("does not double-bind same element", () => {
      document.body.innerHTML = `
        <div data-slot="toggle-group">
          <button data-slot="toggle-group-item" data-value="a">A</button>
        </div>
      `;

      const first = create();
      const second = create();

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(0);
    });
  });

  describe("data-value attribute on root", () => {
    it("sets space-separated data-value on root", () => {
      const { root, controller } = setup("data-multiple");

      controller.setValue(["left", "center"]);
      expect(root.getAttribute("data-value")).toBe("left center");
    });

    it("sets empty data-value when no selection", () => {
      const { root, controller } = setup('data-default-value="left"');

      controller.toggle("left");
      expect(root.getAttribute("data-value")).toBe("");
    });
  });
});
