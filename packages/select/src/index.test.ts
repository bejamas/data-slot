import { describe, expect, it, beforeEach } from "bun:test";
import { createSelect, create } from "./index";

describe("Select", () => {
  const setup = (options: Parameters<typeof createSelect>[1] = {}, html?: string) => {
    document.body.innerHTML = html ?? `
      <div data-slot="select" id="root">
        <button data-slot="select-trigger">
          <span data-slot="select-value"></span>
        </button>
        <div data-slot="select-content">
          <div data-slot="select-group">
            <div data-slot="select-label">Fruits</div>
            <div data-slot="select-item" data-value="apple">Apple</div>
            <div data-slot="select-item" data-value="banana">Banana</div>
          </div>
          <div data-slot="select-separator"></div>
          <div data-slot="select-item" data-value="other">Other</div>
          <div data-slot="select-item" data-value="disabled" data-disabled>Disabled</div>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const trigger = document.querySelector('[data-slot="select-trigger"]') as HTMLElement;
    const content = document.querySelector('[data-slot="select-content"]') as HTMLElement;
    const valueSlot = document.querySelector('[data-slot="select-value"]') as HTMLElement;
    const items = document.querySelectorAll('[data-slot="select-item"]') as NodeListOf<HTMLElement>;
    const controller = createSelect(root, options);

    return { root, trigger, content, valueSlot, items, controller };
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("initialization", () => {
    it("initializes with content hidden", () => {
      const { content, controller } = setup();

      expect(content.hidden).toBe(true);
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("initializes with no value selected", () => {
      const { controller } = setup();

      expect(controller.value).toBe(null);

      controller.destroy();
    });

    it("initializes with defaultValue", () => {
      const { controller, valueSlot } = setup({ defaultValue: "banana" });

      expect(controller.value).toBe("banana");
      expect(valueSlot.textContent).toBe("Banana");

      controller.destroy();
    });

    it("shows placeholder when no value", () => {
      const { trigger, valueSlot, controller } = setup({ placeholder: "Select a fruit..." });

      expect(valueSlot.textContent).toBe("Select a fruit...");
      expect(trigger.hasAttribute("data-placeholder")).toBe(true);

      controller.destroy();
    });

    it("sets ARIA attributes on trigger", () => {
      const { trigger, content, controller } = setup();

      expect(trigger.getAttribute("role")).toBe("combobox");
      expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
      expect(trigger.getAttribute("aria-controls")).toBe(content.id);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");

      controller.destroy();
    });

    it("sets role=listbox on content", () => {
      const { content, controller } = setup();

      expect(content.getAttribute("role")).toBe("listbox");

      controller.destroy();
    });

    it("sets role=option on items when opened", () => {
      const { items, controller } = setup();

      controller.open();

      items.forEach((item) => {
        expect(item.getAttribute("role")).toBe("option");
      });

      controller.destroy();
    });

    it("sets aria-disabled on disabled items when opened", () => {
      const { items, controller } = setup();

      controller.open();

      const disabledItem = items[3]; // The "Disabled" item
      expect(disabledItem?.getAttribute("aria-disabled")).toBe("true");

      controller.destroy();
    });

    it("sets aria-labelledby on content linking to trigger", () => {
      const { trigger, content, controller } = setup();

      const triggerId = trigger.id;
      expect(triggerId).toBeTruthy();
      expect(content.getAttribute("aria-labelledby")).toBe(triggerId);

      controller.destroy();
    });

    it("sets type=button on trigger if not set", () => {
      const { trigger, controller } = setup();

      expect(trigger.getAttribute("type")).toBe("button");

      controller.destroy();
    });

    it("sets role=group on groups with aria-labelledby", () => {
      const { controller } = setup();

      controller.open();

      const group = document.querySelector('[data-slot="select-group"]') as HTMLElement;
      const label = document.querySelector('[data-slot="select-label"]') as HTMLElement;

      expect(group.getAttribute("role")).toBe("group");
      expect(group.getAttribute("aria-labelledby")).toBe(label.id);

      controller.destroy();
    });
  });

  describe("open/close", () => {
    it("opens on trigger click", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.hidden).toBe(false);
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("closes on trigger click when open", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.hidden).toBe(false);

      trigger.click();
      expect(content.hidden).toBe(true);

      controller.destroy();
    });

    it("updates aria-expanded on open/close", () => {
      const { trigger, controller } = setup();

      expect(trigger.getAttribute("aria-expanded")).toBe("false");

      controller.open();
      expect(trigger.getAttribute("aria-expanded")).toBe("true");

      controller.close();
      expect(trigger.getAttribute("aria-expanded")).toBe("false");

      controller.destroy();
    });

    it("sets data-state on root, trigger, and content", () => {
      const { root, trigger, content, controller } = setup();

      expect(root.getAttribute("data-state")).toBe("closed");
      expect(trigger.getAttribute("data-state")).toBe("closed");
      expect(content.getAttribute("data-state")).toBe("closed");

      controller.open();
      expect(root.getAttribute("data-state")).toBe("open");
      expect(trigger.getAttribute("data-state")).toBe("open");
      expect(content.getAttribute("data-state")).toBe("open");

      controller.close();
      expect(root.getAttribute("data-state")).toBe("closed");
      expect(trigger.getAttribute("data-state")).toBe("closed");
      expect(content.getAttribute("data-state")).toBe("closed");

      controller.destroy();
    });

    it("does not open when disabled", () => {
      const { trigger, controller } = setup({ disabled: true });

      trigger.click();
      expect(controller.isOpen).toBe(false);

      controller.open();
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });
  });

  describe("selection", () => {
    it("selects item on click", () => {
      const { trigger, items, valueSlot, controller } = setup();

      trigger.click();
      items[0]?.click(); // Apple

      expect(controller.value).toBe("apple");
      expect(valueSlot.textContent).toBe("Apple");
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("marks selected item with data-selected and aria-selected", () => {
      const { trigger, items, controller } = setup();

      trigger.click();
      items[1]?.click(); // Banana

      // Reopen to check state
      trigger.click();

      expect(items[1]?.hasAttribute("data-selected")).toBe(true);
      expect(items[1]?.getAttribute("aria-selected")).toBe("true");
      expect(items[0]?.hasAttribute("data-selected")).toBe(false);
      expect(items[0]?.getAttribute("aria-selected")).toBe("false");

      controller.destroy();
    });

    it("sets data-value on root", () => {
      const { root, trigger, items, controller } = setup();

      trigger.click();
      items[0]?.click();

      expect(root.getAttribute("data-value")).toBe("apple");

      controller.destroy();
    });

    it("removes data-placeholder from trigger after selection", () => {
      const { trigger, items, controller } = setup({ placeholder: "Pick one" });

      expect(trigger.hasAttribute("data-placeholder")).toBe(true);

      trigger.click();
      items[0]?.click();

      expect(trigger.hasAttribute("data-placeholder")).toBe(false);

      controller.destroy();
    });

    it("does not select disabled items", () => {
      const { trigger, items, controller } = setup();

      trigger.click();
      items[3]?.click(); // Disabled item

      expect(controller.value).toBe(null);
      expect(controller.isOpen).toBe(true); // Should still be open

      controller.destroy();
    });

    it("select() method updates value", () => {
      const { valueSlot, controller } = setup();

      controller.select("banana");

      expect(controller.value).toBe("banana");
      expect(valueSlot.textContent).toBe("Banana");

      controller.destroy();
    });

    it("emits select:change on selection", () => {
      const { root, trigger, items, controller } = setup();

      let selectedValue: string | null | undefined;
      root.addEventListener("select:change", (e) => {
        selectedValue = (e as CustomEvent).detail.value;
      });

      trigger.click();
      items[0]?.click();

      expect(selectedValue).toBe("apple");

      controller.destroy();
    });

    it("calls onValueChange callback", () => {
      let selectedValue: string | null | undefined;
      const { trigger, items, controller } = setup({
        onValueChange: (value) => {
          selectedValue = value;
        },
      });

      trigger.click();
      items[1]?.click();

      expect(selectedValue).toBe("banana");

      controller.destroy();
    });
  });

  describe("keyboard navigation", () => {
    it("opens on ArrowDown when trigger is focused", () => {
      const { trigger, controller } = setup();

      trigger.focus();
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("opens on ArrowUp when trigger is focused", () => {
      const { trigger, controller } = setup();

      trigger.focus();
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );

      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("opens on Enter when trigger is focused", () => {
      const { trigger, controller } = setup();

      trigger.focus();
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("opens on Space when trigger is focused", () => {
      const { trigger, controller } = setup();

      trigger.focus();
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true })
      );

      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("navigates with ArrowDown", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // ArrowDown highlights first item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);

      // ArrowDown to second item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });

    it("navigates with ArrowUp", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // ArrowUp highlights last enabled item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true); // Other (last enabled)

      // ArrowUp to second item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });

    it("wraps around with ArrowDown at end", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // Navigate to last enabled item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );

      // ArrowDown should wrap to first
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });

    it("jumps to first item with Home", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // Navigate to second item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      // Home should go to first
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });

    it("jumps to last enabled item with End", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // End should go to last enabled item (Other, not Disabled)
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });

    it("selects item with Enter", () => {
      const { trigger, content, controller } = setup();

      trigger.click();

      // First highlight an item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(controller.value).toBe("apple");
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("selects item with Space", () => {
      const { trigger, content, controller } = setup();

      trigger.click();

      // First highlight an item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true })
      );

      expect(controller.value).toBe("apple");

      controller.destroy();
    });

    it("closes on Escape", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(controller.isOpen).toBe(true);

      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("closes on Tab", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(controller.isOpen).toBe(true);

      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("does not restore focus to trigger when closing via Tab", () => {
      // Create a focusable element after the select
      document.body.innerHTML = `
        <div data-slot="select" id="root">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
        <button id="next-button">Next</button>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="select-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);

      trigger.click();
      expect(controller.isOpen).toBe(true);

      // Simulate Tab - focus should NOT be restored to trigger
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
      );

      // Give time for any rAF that might restore focus
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Focus should not have been forced back to trigger
            // (browser would have moved it to next-button)
            expect(document.activeElement).not.toBe(trigger);
            controller.destroy();
            resolve();
          });
        });
      });
    });

    it("skips disabled items during navigation", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // Navigate to last enabled item (Other, index 2)
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);

      // Disabled item (index 3) should never be highlighted
      expect(items[3]?.hasAttribute("data-highlighted")).toBe(false);

      controller.destroy();
    });

    it("highlights selected item when opening", () => {
      const { trigger, items, controller } = setup({ defaultValue: "banana" });

      trigger.click();

      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });
  });

  describe("typeahead", () => {
    it("jumps to matching item on character press", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // Type 'b' for Banana
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", bubbles: true })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });

    it("matches multi-character typeahead", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // Type 'ot' for Other
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "o", bubbles: true })
      );
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "t", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });
  });

  describe("pointer interaction", () => {
    it("highlights item on pointer move", () => {
      const { trigger, items, controller } = setup();

      trigger.click();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });

    it("does not highlight disabled items on pointer move", () => {
      const { trigger, items, controller } = setup();

      trigger.click();

      items[3]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true })
      );
      expect(items[3]?.hasAttribute("data-highlighted")).toBe(false);

      controller.destroy();
    });

    it("clears highlight on pointer leave", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      content.dispatchEvent(
        new PointerEvent("pointerleave", { bubbles: true })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);

      controller.destroy();
    });
  });

  describe("click outside", () => {
    it("closes on click outside", () => {
      const { trigger, controller } = setup();

      trigger.click();
      expect(controller.isOpen).toBe(true);

      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true })
      );
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });
  });

  describe("events", () => {
    it("emits select:open-change on open/close", () => {
      const { root, controller } = setup();

      let lastOpen: boolean | undefined;
      root.addEventListener("select:open-change", (e) => {
        lastOpen = (e as CustomEvent).detail.open;
      });

      controller.open();
      expect(lastOpen).toBe(true);

      controller.close();
      expect(lastOpen).toBe(false);

      controller.destroy();
    });

    it("calls onOpenChange callback", () => {
      let lastOpen: boolean | undefined;
      const { controller } = setup({
        onOpenChange: (open) => {
          lastOpen = open;
        },
      });

      controller.open();
      expect(lastOpen).toBe(true);

      controller.close();
      expect(lastOpen).toBe(false);

      controller.destroy();
    });

    it("responds to select:set inbound event for value", () => {
      const { root, valueSlot, controller } = setup();

      root.dispatchEvent(
        new CustomEvent("select:set", { detail: { value: "banana" } })
      );

      expect(controller.value).toBe("banana");
      expect(valueSlot.textContent).toBe("Banana");

      controller.destroy();
    });

    it("responds to select:set inbound event for open", () => {
      const { root, controller } = setup();

      root.dispatchEvent(
        new CustomEvent("select:set", { detail: { open: true } })
      );
      expect(controller.isOpen).toBe(true);

      root.dispatchEvent(
        new CustomEvent("select:set", { detail: { open: false } })
      );
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });
  });

  describe("form integration", () => {
    it("creates hidden input when name is provided", () => {
      const { root, controller } = setup({ name: "fruit" });

      const input = root.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.name).toBe("fruit");

      controller.destroy();
    });

    it("updates hidden input value on selection", () => {
      const { root, trigger, items, controller } = setup({ name: "fruit" });

      trigger.click();
      items[0]?.click();

      const input = root.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(input.value).toBe("apple");

      controller.destroy();
    });

    it("removes hidden input on destroy", () => {
      const { root, controller } = setup({ name: "fruit" });

      expect(root.querySelector('input[type="hidden"]')).toBeTruthy();

      controller.destroy();

      expect(root.querySelector('input[type="hidden"]')).toBeFalsy();
    });

    it("reads data-name attribute", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-name="fruit">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createSelect(root);

      const input = root.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.name).toBe("fruit");

      controller.destroy();
    });
  });

  describe("content positioning", () => {
    it("uses position: fixed when open", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.style.position).toBe("fixed");

      controller.destroy();
    });

    it("sets data-side and data-align attributes when open (item-aligned)", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      // Item-aligned mode sets align to "center"
      expect(content.getAttribute("data-align")).toBe("center");
      // Side depends on position relative to trigger
      expect(content.hasAttribute("data-side")).toBe(true);

      controller.destroy();
    });

    it("sets data-side and data-align attributes when open (popper)", () => {
      const { trigger, content, controller } = setup({ position: "popper" });

      trigger.click();
      expect(content.getAttribute("data-side")).toBe("bottom");
      expect(content.getAttribute("data-align")).toBe("start");

      controller.destroy();
    });

    it("respects side option in popper mode", () => {
      const { trigger, content, controller } = setup({ position: "popper", side: "top", avoidCollisions: false });

      trigger.click();
      expect(content.getAttribute("data-side")).toBe("top");

      controller.destroy();
    });

    it("respects align option in popper mode", () => {
      const { trigger, content, controller } = setup({ position: "popper", align: "end", avoidCollisions: false });

      trigger.click();
      expect(content.getAttribute("data-align")).toBe("end");

      controller.destroy();
    });

    it("matches trigger width in item-aligned mode", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.style.minWidth).toBe(`${trigger.getBoundingClientRect().width}px`);

      controller.destroy();
    });
  });

  describe("create()", () => {
    it("binds all selects and returns controllers", () => {
      document.body.innerHTML = `
        <div data-slot="select">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
        <div data-slot="select">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="b">B</div>
          </div>
        </div>
      `;

      const controllers = create();
      expect(controllers).toHaveLength(2);

      const trigger = document.querySelector('[data-slot="select-trigger"]') as HTMLElement;
      const content = document.querySelector('[data-slot="select-content"]') as HTMLElement;

      expect(content.hidden).toBe(true);
      trigger.click();
      expect(content.hidden).toBe(false);

      controllers.forEach((c) => c.destroy());
    });

    it("does not rebind already bound selects", () => {
      document.body.innerHTML = `
        <div data-slot="select">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
      `;

      const controllers1 = create();
      const controllers2 = create();

      expect(controllers1).toHaveLength(1);
      expect(controllers2).toHaveLength(0);

      controllers1.forEach((c) => c.destroy());
    });
  });

  describe("data attributes", () => {
    it("reads data-default-value", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-default-value="banana">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
            <div data-slot="select-item" data-value="banana">Banana</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createSelect(root);

      expect(controller.value).toBe("banana");

      controller.destroy();
    });

    it("reads data-placeholder", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-placeholder="Pick a fruit">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const valueSlot = root.querySelector('[data-slot="select-value"]') as HTMLElement;
      const controller = createSelect(root);

      expect(valueSlot.textContent).toBe("Pick a fruit");

      controller.destroy();
    });

    it("reads data-disabled", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-disabled>
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="select-trigger"]') as HTMLElement;
      const controller = createSelect(root);

      expect(trigger.getAttribute("aria-disabled")).toBe("true");
      expect(trigger.hasAttribute("data-disabled")).toBe(true);

      trigger.click();
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("reads data-required", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-required>
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="select-trigger"]') as HTMLElement;
      const controller = createSelect(root);

      expect(trigger.getAttribute("aria-required")).toBe("true");

      controller.destroy();
    });

    it("reads data-side from content in popper mode", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-position="popper">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content" data-side="top" data-avoid-collisions="false">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);

      controller.open();
      expect(content.getAttribute("data-side")).toBe("top");

      controller.destroy();
    });

    it("reads data-position from root", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-position="popper">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);

      controller.open();
      // In popper mode, default is bottom/start
      expect(content.getAttribute("data-side")).toBe("bottom");
      expect(content.getAttribute("data-align")).toBe("start");

      controller.destroy();
    });

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-default-value="apple">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
            <div data-slot="select-item" data-value="banana">Banana</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createSelect(root, { defaultValue: "banana" });

      expect(controller.value).toBe("banana");

      controller.destroy();
    });
  });

  describe("destroy", () => {
    it("cleans up event listeners", () => {
      const { root, trigger, controller } = setup();

      let changeCount = 0;
      root.addEventListener("select:open-change", () => {
        changeCount++;
      });

      trigger.click();
      expect(changeCount).toBe(1);

      controller.destroy();

      // After destroy, clicking trigger should not emit events
      trigger.click();
      expect(changeCount).toBe(1);
    });
  });

  describe("multiple selects", () => {
    it("each select shows its own placeholder", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="select1" data-placeholder="Select fruit...">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
        <div data-slot="select" id="select2" data-placeholder="Select veggie...">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="carrot">Carrot</div>
          </div>
        </div>
        <div data-slot="select" id="select3" data-placeholder="Select color...">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="red">Red</div>
          </div>
        </div>
      `;

      const roots = document.querySelectorAll('[data-slot="select"]');
      const controllers: ReturnType<typeof createSelect>[] = [];

      roots.forEach((el) => {
        controllers.push(createSelect(el as Element));
      });

      // Each select should show its own placeholder
      const valueSlot1 = document.querySelector('#select1 [data-slot="select-value"]') as HTMLElement;
      const valueSlot2 = document.querySelector('#select2 [data-slot="select-value"]') as HTMLElement;
      const valueSlot3 = document.querySelector('#select3 [data-slot="select-value"]') as HTMLElement;

      expect(valueSlot1.textContent).toBe("Select fruit...");
      expect(valueSlot2.textContent).toBe("Select veggie...");
      expect(valueSlot3.textContent).toBe("Select color...");

      // Check data-placeholder attribute on triggers
      const trigger1 = document.querySelector('#select1 [data-slot="select-trigger"]') as HTMLElement;
      const trigger2 = document.querySelector('#select2 [data-slot="select-trigger"]') as HTMLElement;
      const trigger3 = document.querySelector('#select3 [data-slot="select-trigger"]') as HTMLElement;

      expect(trigger1.hasAttribute("data-placeholder")).toBe(true);
      expect(trigger2.hasAttribute("data-placeholder")).toBe(true);
      expect(trigger3.hasAttribute("data-placeholder")).toBe(true);

      controllers.forEach((c) => c.destroy());
    });

    it("using create() initializes all selects with correct placeholders", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="select1" data-placeholder="First placeholder">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
        <div data-slot="select" id="select2" data-placeholder="Second placeholder">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="b">B</div>
          </div>
        </div>
      `;

      const controllers = create();

      const valueSlot1 = document.querySelector('#select1 [data-slot="select-value"]') as HTMLElement;
      const valueSlot2 = document.querySelector('#select2 [data-slot="select-value"]') as HTMLElement;

      expect(valueSlot1.textContent).toBe("First placeholder");
      expect(valueSlot2.textContent).toBe("Second placeholder");

      controllers.forEach((c) => c.destroy());
    });

    it("works with selects in separate preview containers (like website demo)", () => {
      document.body.innerHTML = `
        <div class="example-block">
          <div class="preview-css">
            <div data-slot="select" id="select-css" data-placeholder="Select a fruit...">
              <button data-slot="select-trigger">
                <span data-slot="select-value"></span>
              </button>
              <div data-slot="select-content">
                <div data-slot="select-item" data-value="apple">Apple</div>
                <div data-slot="select-item" data-value="banana">Banana</div>
              </div>
            </div>
          </div>
          <div class="preview-tailwind" style="display: none;">
            <div data-slot="select" id="select-tw" data-placeholder="Select a fruit...">
              <button data-slot="select-trigger">
                <span data-slot="select-value"></span>
              </button>
              <div data-slot="select-content">
                <div data-slot="select-item" data-value="carrot">Carrot</div>
                <div data-slot="select-item" data-value="broccoli">Broccoli</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const controllers: ReturnType<typeof createSelect>[] = [];
      document.querySelectorAll('[data-slot="select"]').forEach((el) => {
        controllers.push(createSelect(el as Element));
      });

      const valueSlotCss = document.querySelector('#select-css [data-slot="select-value"]') as HTMLElement;
      const valueSlotTw = document.querySelector('#select-tw [data-slot="select-value"]') as HTMLElement;
      const triggerCss = document.querySelector('#select-css [data-slot="select-trigger"]') as HTMLElement;
      const triggerTw = document.querySelector('#select-tw [data-slot="select-trigger"]') as HTMLElement;

      // Both should show placeholder
      expect(valueSlotCss.textContent).toBe("Select a fruit...");
      expect(valueSlotTw.textContent).toBe("Select a fruit...");
      expect(triggerCss.hasAttribute("data-placeholder")).toBe(true);
      expect(triggerTw.hasAttribute("data-placeholder")).toBe(true);

      controllers.forEach((c) => c.destroy());
    });

    it("works when some selects have same placeholder text", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="s1" data-placeholder="Choose...">
          <button data-slot="select-trigger"><span data-slot="select-value"></span></button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
        <div data-slot="select" id="s2" data-placeholder="Choose...">
          <button data-slot="select-trigger"><span data-slot="select-value"></span></button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="b">B</div>
          </div>
        </div>
      `;

      const controllers: ReturnType<typeof createSelect>[] = [];
      document.querySelectorAll('[data-slot="select"]').forEach((el) => {
        controllers.push(createSelect(el as Element));
      });

      const v1 = document.querySelector('#s1 [data-slot="select-value"]') as HTMLElement;
      const v2 = document.querySelector('#s2 [data-slot="select-value"]') as HTMLElement;

      expect(v1.textContent).toBe("Choose...");
      expect(v2.textContent).toBe("Choose...");

      controllers.forEach((c) => c.destroy());
    });

    it("correctly scopes value slot to its own root", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="s1" data-placeholder="First">
          <button data-slot="select-trigger" id="t1"><span data-slot="select-value" id="v1"></span></button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
        <div data-slot="select" id="s2" data-placeholder="Second">
          <button data-slot="select-trigger" id="t2"><span data-slot="select-value" id="v2"></span></button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="b">B</div>
          </div>
        </div>
      `;

      // Initialize selects
      const s1 = document.getElementById("s1")!;
      const s2 = document.getElementById("s2")!;
      const c1 = createSelect(s1);
      const c2 = createSelect(s2);

      // Verify value slots are correctly scoped
      const v1 = document.getElementById("v1") as HTMLElement;
      const v2 = document.getElementById("v2") as HTMLElement;

      // Check the parent is the correct trigger
      expect(v1.closest('[data-slot="select"]')?.id).toBe("s1");
      expect(v2.closest('[data-slot="select"]')?.id).toBe("s2");

      // Check content is correct
      expect(v1.textContent).toBe("First");
      expect(v2.textContent).toBe("Second");

      c1.destroy();
      c2.destroy();
    });

    it("shows empty string when no placeholder attribute", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="s1" data-placeholder="Has placeholder">
          <button data-slot="select-trigger"><span data-slot="select-value"></span></button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
        <div data-slot="select" id="s2">
          <button data-slot="select-trigger"><span data-slot="select-value"></span></button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="b">B</div>
          </div>
        </div>
      `;

      const s1 = document.getElementById("s1")!;
      const s2 = document.getElementById("s2")!;
      createSelect(s1);
      createSelect(s2);

      const v1 = document.querySelector('#s1 [data-slot="select-value"]') as HTMLElement;
      const v2 = document.querySelector('#s2 [data-slot="select-value"]') as HTMLElement;

      expect(v1.textContent).toBe("Has placeholder");
      expect(v2.textContent).toBe(""); // No placeholder = empty string
    });

    it("reads placeholder from value slot if not on root", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="s1">
          <button data-slot="select-trigger">
            <span data-slot="select-value" data-placeholder="Select radius"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="small">Small</div>
          </div>
        </div>
        <div data-slot="select" id="s2">
          <button data-slot="select-trigger">
            <span data-slot="select-value" data-placeholder="Choose..."></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
      `;

      const s1 = document.getElementById("s1")!;
      const s2 = document.getElementById("s2")!;
      createSelect(s1);
      createSelect(s2);

      const v1 = document.querySelector('#s1 [data-slot="select-value"]') as HTMLElement;
      const v2 = document.querySelector('#s2 [data-slot="select-value"]') as HTMLElement;

      expect(v1.textContent).toBe("Select radius");
      expect(v2.textContent).toBe("Choose...");
    });

    it("prefers root placeholder over value slot placeholder", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="s1" data-placeholder="From root">
          <button data-slot="select-trigger">
            <span data-slot="select-value" data-placeholder="From span"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
      `;

      const s1 = document.getElementById("s1")!;
      createSelect(s1);

      const v1 = document.querySelector('#s1 [data-slot="select-value"]') as HTMLElement;
      expect(v1.textContent).toBe("From root");
    });
  });

  describe("native label[for] support", () => {
    it("sets aria-labelledby on trigger from native label[for]", () => {
      document.body.innerHTML = `
        <label for="my-trigger">Choose a fruit</label>
        <div data-slot="select">
          <button data-slot="select-trigger" id="my-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-group">
              <div data-slot="select-label">Fruits</div>
              <div data-slot="select-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.querySelector('[data-slot="select"]')!;
      const controller = createSelect(root);
      const trigger = document.getElementById("my-trigger") as HTMLElement;
      const nativeLabel = document.querySelector('label[for="my-trigger"]') as HTMLElement;

      // Native label should be linked to trigger via aria-labelledby
      expect(trigger.getAttribute("aria-labelledby")).toContain(nativeLabel.id);

      controller.destroy();
    });

    it("clicking native label opens the select", () => {
      document.body.innerHTML = `
        <label for="my-trigger">Choose a fruit</label>
        <div data-slot="select">
          <button data-slot="select-trigger" id="my-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.querySelector('[data-slot="select"]')!;
      const controller = createSelect(root);
      const nativeLabel = document.querySelector('label[for="my-trigger"]') as HTMLLabelElement;

      expect(controller.isOpen).toBe(false);
      nativeLabel.click();
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("clicking native label toggles the select", () => {
      document.body.innerHTML = `
        <label for="my-trigger">Choose a fruit</label>
        <div data-slot="select">
          <button data-slot="select-trigger" id="my-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.querySelector('[data-slot="select"]')!;
      const controller = createSelect(root);
      const nativeLabel = document.querySelector('label[for="my-trigger"]') as HTMLLabelElement;

      nativeLabel.click();
      expect(controller.isOpen).toBe(true);

      nativeLabel.click();
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("works with auto-generated trigger id", () => {
      document.body.innerHTML = `
        <div data-slot="select">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.querySelector('[data-slot="select"]')!;
      const trigger = root.querySelector('[data-slot="select-trigger"]') as HTMLElement;

      // Put label in DOM before creating select — but we need the trigger id first
      // In practice, user sets an explicit id on the trigger
      trigger.id = "fruit-select";
      const label = document.createElement("label");
      label.setAttribute("for", "fruit-select");
      label.textContent = "Fruit";
      root.parentNode!.insertBefore(label, root);

      const controller = createSelect(root);

      expect(trigger.getAttribute("aria-labelledby")).toContain(label.id);
      label.click();
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("appends to existing aria-labelledby instead of overwriting", () => {
      document.body.innerHTML = `
        <label for="my-trigger">Choose a fruit</label>
        <div data-slot="select">
          <button data-slot="select-trigger" id="my-trigger" aria-labelledby="custom-id">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.querySelector('[data-slot="select"]')!;
      const controller = createSelect(root);
      const trigger = document.getElementById("my-trigger") as HTMLElement;
      const nativeLabel = document.querySelector('label[for="my-trigger"]') as HTMLElement;

      const labelledBy = trigger.getAttribute("aria-labelledby")!;
      expect(labelledBy).toContain("custom-id");
      expect(labelledBy).toContain(nativeLabel.id);

      controller.destroy();
    });

    it("does nothing when no matching label exists", () => {
      const { trigger, controller } = setup();

      // Default setup has no label[for] — trigger should not have aria-labelledby
      expect(trigger.hasAttribute("aria-labelledby")).toBe(false);

      controller.destroy();
    });

    it("does not treat select-label inside content as field label", () => {
      const { trigger, controller } = setup();

      // Default setup has a group label inside content but no native label[for]
      expect(trigger.hasAttribute("aria-labelledby")).toBe(false);

      controller.destroy();
    });

    it("group select-label still works inside select-group", () => {
      document.body.innerHTML = `
        <label for="my-trigger">Choose a fruit</label>
        <div data-slot="select">
          <button data-slot="select-trigger" id="my-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-group">
              <div data-slot="select-label">Fruits</div>
              <div data-slot="select-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.querySelector('[data-slot="select"]')!;
      const controller = createSelect(root);

      controller.open();

      const group = root.querySelector('[data-slot="select-group"]') as HTMLElement;
      const groupLabel = group.querySelector('[data-slot="select-label"]') as HTMLElement;

      expect(group.getAttribute("role")).toBe("group");
      expect(group.getAttribute("aria-labelledby")).toBe(groupLabel.id);

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
        <div data-slot="select" id="root" data-lock-scroll="false">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="a">A</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createSelect(root);

      controller.open();
      expect(document.documentElement.style.overflow).toBe("");

      controller.destroy();
    });
  });
});
