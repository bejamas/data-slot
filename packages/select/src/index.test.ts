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
});
