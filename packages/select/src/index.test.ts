import { describe, expect, it, beforeEach } from "bun:test";
import { createSelect, create } from "./index";
import { clearRootBinding, setRootBinding } from "../../core/src/index";
import { resetScrollLock } from "../../core/src/scroll";

describe("Select", () => {
  const ROOT_BINDING_KEY = "@data-slot/select";

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

  const waitForRaf = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const waitForClose = async () => {
    await waitForRaf();
    await waitForRaf();
  };

  const getTranslate3dXY = (transform: string): [number, number] => {
    const match = /translate3d\(\s*([-\d.]+)px,\s*([-\d.]+)px,\s*0(?:px)?\)/.exec(transform);
    if (!match) {
      throw new Error(`Expected translate3d transform, got "${transform}"`);
    }
    return [Number(match[1]), Number(match[2])];
  };

  const getTranslate3dY = (transform: string): number => {
    return getTranslate3dXY(transform)[1];
  };

  const getPositioner = (content: HTMLElement): HTMLElement => {
    const parent = content.parentElement;
    if (parent instanceof HTMLElement && parent.getAttribute("data-slot") === "select-positioner") {
      return parent;
    }
    return content;
  };

  beforeEach(() => {
    document.body.innerHTML = "";
    resetScrollLock();
    document.documentElement.style.cssText = "";
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

    it("closes on trigger click when open", async () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.hidden).toBe(false);

      trigger.click();
      await waitForClose();
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

    it("uses native disabled button behavior for disabled trigger (Base UI parity)", () => {
      const { trigger, controller } = setup({ disabled: true });

      const button = trigger as HTMLButtonElement;
      expect(button.disabled).toBe(true);

      button.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("stays open when reopened after trigger close and outside close", async () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(controller.isOpen).toBe(true);

      trigger.click();
      await waitForClose();
      expect(controller.isOpen).toBe(false);

      trigger.click();
      expect(controller.isOpen).toBe(true);

      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" })
      );
      await waitForClose();
      expect(controller.isOpen).toBe(false);

      trigger.click();
      expect(controller.isOpen).toBe(true);
      expect(content.getAttribute("data-state")).toBe("open");
      expect(content.hidden).toBe(false);

      await waitForClose();
      expect(controller.isOpen).toBe(true);
      expect(content.getAttribute("data-state")).toBe("open");
      expect(content.hidden).toBe(false);

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

    it("hides content immediately when selecting on click", () => {
      const { root, trigger, content, items, controller } = setup();

      trigger.click();
      const positioner = getPositioner(content);
      expect(positioner.parentElement).toBe(document.body);

      items[0]?.click();

      expect(controller.isOpen).toBe(false);
      expect(content.hidden).toBe(true);
      expect(content.parentElement).toBe(root);
      expect(content.getAttribute("data-state")).toBe("closed");
      expect(content.hasAttribute("data-ending-style")).toBe(false);

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

    it("uses select-item-text for the trigger label when item markup includes extra text", () => {
      const { trigger, items, valueSlot, controller } = setup(
        {},
        `
        <div data-slot="select" id="root">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">
              <span>*</span>
              <span data-slot="select-item-text">Apple</span>
              <span>✓</span>
            </div>
            <div data-slot="select-item" data-value="banana">
              <span>*</span>
              <span data-slot="select-item-text">Banana</span>
              <span>✓</span>
            </div>
          </div>
        </div>
      `
      );

      trigger.click();
      items[1]?.click();

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

    it("stays on last item when pressing ArrowDown at end", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // Navigate to last enabled item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );

      // ArrowDown should stay on last
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);

      controller.destroy();
    });

    it("stays on first item when pressing ArrowUp at start", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // Navigate to first item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true })
      );

      // ArrowUp should stay on first
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(false);

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

    it("hides content immediately when selecting with Enter", () => {
      const { root, trigger, content, controller } = setup();

      trigger.click();
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(controller.isOpen).toBe(false);
      expect(content.hidden).toBe(true);
      expect(content.parentElement).toBe(root);
      expect(content.hasAttribute("data-ending-style")).toBe(false);

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

    it("hides content immediately when selecting with Space", () => {
      const { root, trigger, content, controller } = setup();

      trigger.click();
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true })
      );

      expect(controller.isOpen).toBe(false);
      expect(content.hidden).toBe(true);
      expect(content.parentElement).toBe(root);
      expect(content.hasAttribute("data-ending-style")).toBe(false);

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

    it("scrolls highlighted item into view during keyboard navigation", () => {
      const { trigger, content, items, controller } = setup(
        {},
        `
        <div data-slot="select" id="root">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="item-1">Item 1</div>
            <div data-slot="select-item" data-value="item-2">Item 2</div>
            <div data-slot="select-item" data-value="item-3">Item 3</div>
            <div data-slot="select-item" data-value="item-4">Item 4</div>
            <div data-slot="select-item" data-value="item-5">Item 5</div>
            <div data-slot="select-item" data-value="item-6">Item 6</div>
          </div>
        </div>
      `
      );
      const rect = (top: number, height: number) =>
        ({
          x: 0,
          y: top,
          top,
          left: 0,
          width: 200,
          height,
          right: 200,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 120 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 400 });
      content.scrollTop = 0;
      content.getBoundingClientRect = () => rect(0, 120);
      items.forEach((item, index) => {
        item.getBoundingClientRect = () => rect(index * 40, 40);
      });

      trigger.click();
      const initialScrollTop = content.scrollTop;
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );

      expect(items[5]?.hasAttribute("data-highlighted")).toBe(true);
      const itemRect = items[5]!.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const itemBottomInContent = itemRect.bottom - contentRect.top + initialScrollTop;
      const expectedScrollTop = itemBottomInContent - content.clientHeight + 4;
      expect(content.scrollTop).toBe(expectedScrollTop);
      controller.destroy();
    });

    it("keeps animated close behavior for controller.close()", async () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      controller.close();

      expect(controller.isOpen).toBe(false);
      expect(content.hidden).toBe(false);
      expect(content.hasAttribute("data-ending-style")).toBe(true);

      await waitForClose();

      expect(content.hidden).toBe(true);
      expect(content.hasAttribute("data-ending-style")).toBe(false);

      controller.destroy();
    });

    it("keeps animated close behavior for trigger toggle", async () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      trigger.click();

      expect(controller.isOpen).toBe(false);
      expect(content.hidden).toBe(false);
      expect(content.hasAttribute("data-ending-style")).toBe(true);

      await waitForClose();

      expect(content.hidden).toBe(true);
      expect(content.hasAttribute("data-ending-style")).toBe(false);

      controller.destroy();
    });

    it("keeps animated close behavior for Escape", async () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );

      expect(controller.isOpen).toBe(false);
      expect(content.hidden).toBe(false);
      expect(content.hasAttribute("data-ending-style")).toBe(true);

      await waitForClose();

      expect(content.hidden).toBe(true);
      expect(content.hasAttribute("data-ending-style")).toBe(false);

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

    it("prefers select-item-text over full item text during typeahead", () => {
      const { trigger, content, items, controller } = setup(
        {},
        `
        <div data-slot="select" id="root">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="apple">
              <span>*</span>
              <span data-slot="select-item-text">Apple</span>
            </div>
            <div data-slot="select-item" data-value="banana">
              <span>*</span>
              <span data-slot="select-item-text">Banana</span>
            </div>
          </div>
        </div>
      `
      );

      trigger.click();
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", bubbles: true })
      );

      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });
  });

  describe("pointer interaction", () => {
    it("highlights and focuses an item on pointer move", () => {
      const { trigger, items, controller } = setup();

      trigger.click();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);
      expect(document.activeElement).toBe(items[1]!);

      controller.destroy();
    });

    it("clears hover highlight and refocuses content on disabled items", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
      );
      expect(document.activeElement).toBe(items[1]!);

      items[3]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
      );
      expect(items[3]?.hasAttribute("data-highlighted")).toBe(false);
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
      expect(document.activeElement).toBe(content);

      controller.destroy();
    });

    it("clears highlight on pointer leave and refocuses content", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);
      expect(document.activeElement).toBe(items[1]!);

      content.dispatchEvent(
        new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
      expect(document.activeElement).toBe(content);

      controller.destroy();
    });

    it("does not highlight or focus items on touch pointer move", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "touch" })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
      expect(document.activeElement).toBe(content);

      controller.destroy();
    });

    it("does not highlight items on pointer move when highlightItemOnHover is false", () => {
      const { trigger, content, items, controller } = setup({
        highlightItemOnHover: false,
      });

      trigger.click();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
      expect(document.activeElement).toBe(content);

      controller.destroy();
    });

    it("respects data-highlight-item-on-hover on the root", () => {
      const { trigger, content, items, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-highlight-item-on-hover="false">
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
      `
      );

      trigger.click();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
      expect(document.activeElement).toBe(content);

      controller.destroy();
    });

    it("preserves keyboard highlight on pointer leave when highlightItemOnHover is false", () => {
      const { trigger, content, items, controller } = setup({
        highlightItemOnHover: false,
      });

      trigger.click();

      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);
      expect(document.activeElement).toBe(items[0]!);

      content.dispatchEvent(
        new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);
      expect(document.activeElement).toBe(items[0]!);

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
      const positioner = getPositioner(content);
      expect(positioner.style.position).toBe("fixed");
      expect(positioner.style.getPropertyValue("--transform-origin")).not.toBe("");

      controller.destroy();
    });

    it("uses position: absolute when lockScroll is false", () => {
      const { trigger, content, controller } = setup({ lockScroll: false });

      trigger.click();
      expect(getPositioner(content).style.position).toBe("absolute");

      controller.destroy();
    });

    it("sets data-side and data-align attributes when open (item-aligned)", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.getAttribute("data-position")).toBe("item-aligned");
      expect(content.getAttribute("data-align-trigger")).toBe("true");
      // Item-aligned mode sets align to "center"
      expect(content.getAttribute("data-align")).toBe("center");
      // Side depends on position relative to trigger
      expect(content.hasAttribute("data-side")).toBe(true);

      controller.destroy();
    });

    it("falls back to trigger-aligned placement when item-aligned text anchoring is too close to the viewport edge", () => {
      const { trigger, content, valueSlot, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-3">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="item-1"><span data-slot="select-item-text">Item 1</span></div>
            <div data-slot="select-item" data-value="item-2"><span data-slot="select-item-text">Item 2</span></div>
            <div data-slot="select-item" data-value="item-3"><span data-slot="select-item-text">Item 3</span></div>
          </div>
        </div>
      `
      );
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-3"]'
      ) as HTMLElement;
      const selectedItemText = selectedItem.querySelector(
        '[data-slot="select-item-text"]'
      ) as HTMLElement;
      const innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight");
      const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      try {
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 240 });
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });

        trigger.getBoundingClientRect = () => rect(12, 80, 180, 32);
        valueSlot.getBoundingClientRect = () => rect(22, 96, 72, 12);
        content.getBoundingClientRect = () => rect(0, 80, 180, 120);
        selectedItemText.getBoundingClientRect = () => rect(75, 112, 56, 12);

        Object.defineProperty(content, "clientHeight", { configurable: true, value: 120 });
        Object.defineProperty(content, "scrollHeight", { configurable: true, value: 120 });
        Object.defineProperty(selectedItemText, "offsetParent", { configurable: true, value: null });
        content.scrollTop = 0;

        controller.open();

        expect(content.getAttribute("data-align-trigger")).toBe("false");
        expect(content.getAttribute("data-side")).toBe("bottom");
        expect(content.getAttribute("data-align")).toBe("start");
        expect(getTranslate3dXY(getPositioner(content).style.transform)).toEqual([80, 48]);
      } finally {
        if (innerHeightDescriptor) {
          Object.defineProperty(window, "innerHeight", innerHeightDescriptor);
        } else {
          delete (window as { innerHeight?: number }).innerHeight;
        }
        if (innerWidthDescriptor) {
          Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
        } else {
          delete (window as { innerWidth?: number }).innerWidth;
        }
      }

      controller.destroy();
    });

    it("falls back to trigger-aligned placement when the aligned popup cannot satisfy min-height constraints", () => {
      const { trigger, content, valueSlot, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-3">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content" style="min-height: 260px;">
            <div data-slot="select-item" data-value="item-1"><span data-slot="select-item-text">Item 1</span></div>
            <div data-slot="select-item" data-value="item-2"><span data-slot="select-item-text">Item 2</span></div>
            <div data-slot="select-item" data-value="item-3"><span data-slot="select-item-text">Item 3</span></div>
          </div>
        </div>
      `
      );
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-3"]'
      ) as HTMLElement;
      const selectedItemText = selectedItem.querySelector(
        '[data-slot="select-item-text"]'
      ) as HTMLElement;
      const innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight");
      const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      try {
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 220 });
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });

        trigger.getBoundingClientRect = () => rect(90, 80, 180, 32);
        valueSlot.getBoundingClientRect = () => rect(100, 96, 72, 12);
        content.getBoundingClientRect = () => rect(0, 80, 180, 180);
        selectedItemText.getBoundingClientRect = () => rect(75, 112, 56, 12);

        Object.defineProperty(content, "clientHeight", { configurable: true, value: 140 });
        Object.defineProperty(content, "scrollHeight", { configurable: true, value: 280 });
        Object.defineProperty(selectedItemText, "offsetParent", { configurable: true, value: null });
        content.scrollTop = 0;

        controller.open();

        expect(content.getAttribute("data-align-trigger")).toBe("false");
        expect(content.getAttribute("data-side")).toBe("bottom");
        expect(content.getAttribute("data-align")).toBe("start");
        expect(getTranslate3dXY(getPositioner(content).style.transform)).toEqual([80, 32]);
      } finally {
        if (innerHeightDescriptor) {
          Object.defineProperty(window, "innerHeight", innerHeightDescriptor);
        } else {
          delete (window as { innerHeight?: number }).innerHeight;
        }
        if (innerWidthDescriptor) {
          Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
        } else {
          delete (window as { innerWidth?: number }).innerWidth;
        }
      }

      controller.destroy();
    });

    it("sets data-side and data-align attributes when open (popper)", () => {
      const { trigger, content, controller } = setup({ position: "popper" });

      trigger.click();
      expect(content.getAttribute("data-position")).toBe("popper");
      expect(content.getAttribute("data-align-trigger")).toBe("false");
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

    it("uses layout dimensions for positioning when content is transform-scaled in popper mode", () => {
      const { trigger, content, controller } = setup({
        position: "popper",
        side: "top",
        align: "start",
        sideOffset: 4,
        avoidCollisions: false,
        lockScroll: false,
      });

      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(100, 100, 80, 20);
      content.getBoundingClientRect = () => rect(0, 0, 100, 40);

      Object.defineProperty(content, "offsetWidth", { configurable: true, value: 100 });
      Object.defineProperty(content, "offsetHeight", { configurable: true, value: 80 });

      controller.open();

      const positioner = getPositioner(content);
      expect(getTranslate3dY(positioner.style.transform)).toBe(16);
      expect(positioner.style.getPropertyValue("--transform-origin")).toBe("0px 84px");

      controller.destroy();
    });

    it("matches trigger width in item-aligned mode", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.style.minWidth).toBe(`${trigger.getBoundingClientRect().width}px`);

      controller.destroy();
    });

    it("aligns selected item in item-aligned mode when there is no internal scroll", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-3">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="item-1">Item 1</div>
            <div data-slot="select-item" data-value="item-2">Item 2</div>
            <div data-slot="select-item" data-value="item-3">Item 3</div>
          </div>
        </div>
      `
      );
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-3"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 120);
      selectedItem.getBoundingClientRect = () => rect(64, 80, 180, 32);

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 120 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 120 });
      content.scrollTop = 0;

      controller.open();

      const triggerCenterY = 400 + (40 / 2);
      const selectedCenterInContent = 64 + (32 / 2);
      const expectedY = triggerCenterY - selectedCenterInContent;
      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(expectedY);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("aligns select-item-text with select-value in item-aligned mode when there is no internal scroll", () => {
      const { trigger, content, valueSlot, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-3">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="item-1">
              <span data-slot="select-item-text">Item 1</span>
            </div>
            <div data-slot="select-item" data-value="item-2">
              <span data-slot="select-item-text">Item 2</span>
            </div>
            <div data-slot="select-item" data-value="item-3">
              <span data-slot="select-item-text">Item 3</span>
            </div>
          </div>
        </div>
      `
      );
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-3"]'
      ) as HTMLElement;
      const selectedItemText = selectedItem.querySelector(
        '[data-slot="select-item-text"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 32);
      valueSlot.getBoundingClientRect = () => rect(410, 96, 72, 12);
      content.getBoundingClientRect = () => rect(0, 80, 180, 120);
      selectedItem.getBoundingClientRect = () => rect(64, 80, 180, 32);
      selectedItemText.getBoundingClientRect = () => rect(75, 112, 56, 12);

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 120 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 120 });
      Object.defineProperty(selectedItemText, "offsetParent", { configurable: true, value: null });
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dXY(getPositioner(content).style.transform)).toEqual([64, 335]);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("keeps rect-fallback item-aligned positioning correct when select-content has a border", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-3">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="item-1">Item 1</div>
            <div data-slot="select-item" data-value="item-2">Item 2</div>
            <div data-slot="select-item" data-value="item-3">Item 3</div>
          </div>
        </div>
      `
      );
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-3"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 120);
      selectedItem.getBoundingClientRect = () => rect(65, 80, 180, 32);

      Object.defineProperty(content, "clientTop", { configurable: true, value: 1 });
      Object.defineProperty(content, "clientHeight", { configurable: true, value: 120 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 120 });
      Object.defineProperty(selectedItem, "offsetParent", { configurable: true, value: null });
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(339);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("adds intermediate group borders when item-aligned positioning uses offset-parent traversal", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="beef">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-group">
              <div data-slot="select-label">Proteins</div>
              <div data-slot="select-item" data-value="tofu">Tofu</div>
              <div data-slot="select-item" data-value="chicken">Chicken</div>
              <div data-slot="select-item" data-value="beef">Beef</div>
            </div>
          </div>
        </div>
      `
      );
      const group = content.querySelector('[data-slot="select-group"]') as HTMLElement;
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="beef"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 160);
      selectedItem.getBoundingClientRect = () => rect(0, 80, 180, 32);

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 160 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 160 });
      Object.defineProperty(group, "offsetParent", { configurable: true, value: content });
      Object.defineProperty(group, "offsetTop", { configurable: true, value: 24 });
      Object.defineProperty(group, "clientTop", { configurable: true, value: 1 });
      Object.defineProperty(selectedItem, "offsetParent", { configurable: true, value: group });
      Object.defineProperty(selectedItem, "offsetTop", { configurable: true, value: 40 });
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(339);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("aligns grouped select-item-text with select-value in item-aligned mode", () => {
      const { trigger, content, valueSlot, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="beef">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-group">
              <div data-slot="select-label">Proteins</div>
              <div data-slot="select-item" data-value="tofu">
                <span data-slot="select-item-text">Tofu</span>
              </div>
              <div data-slot="select-item" data-value="chicken">
                <span data-slot="select-item-text">Chicken</span>
              </div>
              <div data-slot="select-item" data-value="beef">
                <span data-slot="select-item-text">Beef</span>
              </div>
            </div>
          </div>
        </div>
      `
      );
      const group = content.querySelector('[data-slot="select-group"]') as HTMLElement;
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="beef"]'
      ) as HTMLElement;
      const selectedItemText = selectedItem.querySelector(
        '[data-slot="select-item-text"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 32);
      valueSlot.getBoundingClientRect = () => rect(410, 96, 72, 12);
      content.getBoundingClientRect = () => rect(0, 80, 180, 160);
      selectedItem.getBoundingClientRect = () => rect(0, 80, 180, 32);
      selectedItemText.getBoundingClientRect = () => rect(0, 112, 48, 12);

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 160 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 160 });
      Object.defineProperty(group, "offsetParent", { configurable: true, value: content });
      Object.defineProperty(group, "offsetTop", { configurable: true, value: 24 });
      Object.defineProperty(selectedItem, "offsetParent", { configurable: true, value: group });
      Object.defineProperty(selectedItem, "offsetTop", { configurable: true, value: 40 });
      Object.defineProperty(selectedItemText, "offsetParent", { configurable: true, value: selectedItem });
      Object.defineProperty(selectedItemText, "offsetTop", { configurable: true, value: 11 });
      Object.defineProperty(selectedItemText, "offsetHeight", { configurable: true, value: 12 });
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dXY(getPositioner(content).style.transform)).toEqual([64, 335]);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("keeps selected item anchoring even when pointer highlights another item on open", async () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-3">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="item-1">Item 1</div>
            <div data-slot="select-item" data-value="item-2">Item 2</div>
            <div data-slot="select-item" data-value="item-3">Item 3</div>
          </div>
        </div>
      `
      );
      const middleItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-2"]'
      ) as HTMLElement;
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-3"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 120);
      selectedItem.getBoundingClientRect = () => rect(64, 80, 180, 32);

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 120 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 120 });
      content.scrollTop = 0;

      trigger.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 100 })
      );
      trigger.click();

      middleItem.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
      await waitForRaf();
      await waitForRaf();

      const triggerCenterY = 400 + (40 / 2);
      const selectedCenterInContent = 64 + (32 / 2);
      const expectedY = triggerCenterY - selectedCenterInContent;
      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(expectedY);

      controller.destroy();
    });

    it("keeps item-aligned popup near trigger by using internal scroll for deep selections", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-9">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="item-1">Item 1</div>
            <div data-slot="select-item" data-value="item-2">Item 2</div>
            <div data-slot="select-item" data-value="item-3">Item 3</div>
            <div data-slot="select-item" data-value="item-4">Item 4</div>
            <div data-slot="select-item" data-value="item-5">Item 5</div>
            <div data-slot="select-item" data-value="item-6">Item 6</div>
            <div data-slot="select-item" data-value="item-7">Item 7</div>
            <div data-slot="select-item" data-value="item-8">Item 8</div>
            <div data-slot="select-item" data-value="item-9">Item 9</div>
            <div data-slot="select-item" data-value="item-10">Item 10</div>
          </div>
        </div>
      `
      );
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-9"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 220);
      selectedItem.getBoundingClientRect = () => rect(420, 80, 180, 32);

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 220 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 640 });
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(310);
      expect(content.scrollTop).toBe(326);

      controller.destroy();
    });

    it("keeps item-aligned popup near trigger for grouped bottom selections", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="beef">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-group">
              <div data-slot="select-label">Fruits</div>
              <div data-slot="select-item" data-value="apple">Apple</div>
              <div data-slot="select-item" data-value="banana">Banana</div>
              <div data-slot="select-item" data-value="cherry">Cherry</div>
            </div>
            <div data-slot="select-separator"></div>
            <div data-slot="select-group">
              <div data-slot="select-label">Vegetables</div>
              <div data-slot="select-item" data-value="carrot">Carrot</div>
              <div data-slot="select-item" data-value="broccoli">Broccoli</div>
              <div data-slot="select-item" data-value="spinach">Spinach</div>
            </div>
            <div data-slot="select-separator"></div>
            <div data-slot="select-group">
              <div data-slot="select-label">Proteins</div>
              <div data-slot="select-item" data-value="tofu">Tofu</div>
              <div data-slot="select-item" data-value="chicken">Chicken</div>
              <div data-slot="select-item" data-value="beef">Beef</div>
            </div>
          </div>
        </div>
      `
      );
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="beef"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(520, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 220);
      selectedItem.getBoundingClientRect = () => rect(690, 80, 180, 32);

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 220 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 840 });
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(430);
      expect(content.scrollTop).toBe(596);

      controller.destroy();
    });

    it("uses select-viewport as the scroll container in item-aligned mode", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-9">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-viewport">
              <div data-slot="select-item" data-value="item-1">Item 1</div>
              <div data-slot="select-item" data-value="item-2">Item 2</div>
              <div data-slot="select-item" data-value="item-3">Item 3</div>
              <div data-slot="select-item" data-value="item-4">Item 4</div>
              <div data-slot="select-item" data-value="item-5">Item 5</div>
              <div data-slot="select-item" data-value="item-6">Item 6</div>
              <div data-slot="select-item" data-value="item-7">Item 7</div>
              <div data-slot="select-item" data-value="item-8">Item 8</div>
              <div data-slot="select-item" data-value="item-9">Item 9</div>
              <div data-slot="select-item" data-value="item-10">Item 10</div>
            </div>
          </div>
        </div>
      `
      );
      const viewport = content.querySelector('[data-slot="select-viewport"]') as HTMLElement;
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-9"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(520, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 220);
      selectedItem.getBoundingClientRect = () => rect(690, 80, 180, 32);

      Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 220 });
      Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 840 });
      viewport.scrollTop = 0;
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(430);
      expect(viewport.scrollTop).toBe(596);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("keeps viewport scroll alignment correct when bordered content uses item-aligned positioning", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-9">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-viewport">
              <div data-slot="select-item" data-value="item-1">Item 1</div>
              <div data-slot="select-item" data-value="item-2">Item 2</div>
              <div data-slot="select-item" data-value="item-3">Item 3</div>
              <div data-slot="select-item" data-value="item-4">Item 4</div>
              <div data-slot="select-item" data-value="item-5">Item 5</div>
              <div data-slot="select-item" data-value="item-6">Item 6</div>
              <div data-slot="select-item" data-value="item-7">Item 7</div>
              <div data-slot="select-item" data-value="item-8">Item 8</div>
              <div data-slot="select-item" data-value="item-9">Item 9</div>
              <div data-slot="select-item" data-value="item-10">Item 10</div>
            </div>
          </div>
        </div>
      `
      );
      const viewport = content.querySelector('[data-slot="select-viewport"]') as HTMLElement;
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-9"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(520, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 220);
      selectedItem.getBoundingClientRect = () => rect(0, 80, 180, 32);

      Object.defineProperty(content, "clientTop", { configurable: true, value: 1 });
      Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 220 });
      Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 840 });
      Object.defineProperty(viewport, "offsetParent", { configurable: true, value: content });
      Object.defineProperty(viewport, "offsetTop", { configurable: true, value: 0 });
      Object.defineProperty(selectedItem, "offsetParent", { configurable: true, value: viewport });
      Object.defineProperty(selectedItem, "offsetTop", { configurable: true, value: 690 });
      viewport.scrollTop = 0;
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dXY(getPositioner(content).style.transform)).toEqual([80, 430]);
      expect(viewport.scrollTop).toBe(597);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("uses select-item-text for viewport-backed item-aligned scrolling", () => {
      const { trigger, content, valueSlot, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-9">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-viewport">
              <div data-slot="select-item" data-value="item-1"><span data-slot="select-item-text">Item 1</span></div>
              <div data-slot="select-item" data-value="item-2"><span data-slot="select-item-text">Item 2</span></div>
              <div data-slot="select-item" data-value="item-3"><span data-slot="select-item-text">Item 3</span></div>
              <div data-slot="select-item" data-value="item-4"><span data-slot="select-item-text">Item 4</span></div>
              <div data-slot="select-item" data-value="item-5"><span data-slot="select-item-text">Item 5</span></div>
              <div data-slot="select-item" data-value="item-6"><span data-slot="select-item-text">Item 6</span></div>
              <div data-slot="select-item" data-value="item-7"><span data-slot="select-item-text">Item 7</span></div>
              <div data-slot="select-item" data-value="item-8"><span data-slot="select-item-text">Item 8</span></div>
              <div data-slot="select-item" data-value="item-9"><span data-slot="select-item-text">Item 9</span></div>
              <div data-slot="select-item" data-value="item-10"><span data-slot="select-item-text">Item 10</span></div>
            </div>
          </div>
        </div>
      `
      );
      const viewport = content.querySelector('[data-slot="select-viewport"]') as HTMLElement;
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-9"]'
      ) as HTMLElement;
      const selectedItemText = selectedItem.querySelector(
        '[data-slot="select-item-text"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(520, 80, 180, 40);
      valueSlot.getBoundingClientRect = () => rect(534, 96, 72, 12);
      content.getBoundingClientRect = () => rect(0, 80, 180, 220);
      selectedItem.getBoundingClientRect = () => rect(0, 80, 180, 32);
      selectedItemText.getBoundingClientRect = () => rect(0, 112, 48, 12);

      Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 220 });
      Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 840 });
      Object.defineProperty(viewport, "offsetParent", { configurable: true, value: content });
      Object.defineProperty(viewport, "offsetTop", { configurable: true, value: 0 });
      Object.defineProperty(selectedItem, "offsetParent", { configurable: true, value: viewport });
      Object.defineProperty(selectedItem, "offsetTop", { configurable: true, value: 690 });
      Object.defineProperty(selectedItemText, "offsetParent", { configurable: true, value: selectedItem });
      Object.defineProperty(selectedItemText, "offsetTop", { configurable: true, value: 11 });
      Object.defineProperty(selectedItemText, "offsetHeight", { configurable: true, value: 12 });
      viewport.scrollTop = 0;
      content.scrollTop = 0;

      controller.open();

      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(430);
      expect(viewport.scrollTop).toBe(597);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("aligns selected item with select-viewport when there is no internal scroll", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-3">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-viewport">
              <div data-slot="select-item" data-value="item-1">Item 1</div>
              <div data-slot="select-item" data-value="item-2">Item 2</div>
              <div data-slot="select-item" data-value="item-3">Item 3</div>
            </div>
          </div>
        </div>
      `
      );
      const viewport = content.querySelector('[data-slot="select-viewport"]') as HTMLElement;
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-3"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 120);
      selectedItem.getBoundingClientRect = () => rect(64, 80, 180, 32);

      Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 120 });
      Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 120 });
      viewport.scrollTop = 0;
      content.scrollTop = 0;

      controller.open();

      const triggerCenterY = 400 + (40 / 2);
      const selectedCenterInContent = 64 + (32 / 2);
      const expectedY = triggerCenterY - selectedCenterInContent;
      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(expectedY);
      expect(viewport.scrollTop).toBe(0);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("aligns selected item as much as possible when deep selection cannot be internally scrolled", () => {
      const { trigger, content, controller } = setup(
        {},
        `
        <div data-slot="select" id="root" data-default-value="item-9">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-item" data-value="item-1">Item 1</div>
            <div data-slot="select-item" data-value="item-2">Item 2</div>
            <div data-slot="select-item" data-value="item-3">Item 3</div>
            <div data-slot="select-item" data-value="item-4">Item 4</div>
            <div data-slot="select-item" data-value="item-5">Item 5</div>
            <div data-slot="select-item" data-value="item-6">Item 6</div>
            <div data-slot="select-item" data-value="item-7">Item 7</div>
            <div data-slot="select-item" data-value="item-8">Item 8</div>
            <div data-slot="select-item" data-value="item-9">Item 9</div>
            <div data-slot="select-item" data-value="item-10">Item 10</div>
          </div>
        </div>
      `
      );
      const selectedItem = content.querySelector(
        '[data-slot="select-item"][data-value="item-9"]'
      ) as HTMLElement;
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(400, 80, 180, 40);
      content.getBoundingClientRect = () => rect(0, 80, 180, 700);
      selectedItem.getBoundingClientRect = () => rect(640, 80, 180, 32);

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 700 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 700 });
      content.scrollTop = 0;

      controller.open();

      const triggerCenterY = 400 + (40 / 2);
      const selectedCenterInContent = 640 + (32 / 2);
      const alignedY = triggerCenterY - selectedCenterInContent;
      const minY = 8;
      const maxY = window.innerHeight - 700 - 8;
      const expectedY = maxY < minY ? minY : Math.min(Math.max(alignedY, minY), maxY);
      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(expectedY);
      expect(content.scrollTop).toBe(0);

      controller.destroy();
    });

    it("does not reuse stale pointer coordinates when opened without pointer", async () => {
      const { trigger, items, controller } = setup({ defaultValue: "banana" });
      const originalElementFromPoint = document.elementFromPoint.bind(document);

      try {
        document.elementFromPoint = () => items[0]!;

        trigger.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 })
        );
        trigger.click();

        await waitForRaf();
        await waitForRaf();
        expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);

        controller.close();
        await waitForClose();

        controller.open();
        await waitForRaf();
        await waitForRaf();

        expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);
        expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);
      } finally {
        document.elementFromPoint = originalElementFromPoint;
        controller.destroy();
      }
    });

    it("keeps coordinates stable on window scroll when lockScroll is false", async () => {
      const { trigger, content, controller } = setup({
        position: "popper",
        side: "bottom",
        align: "start",
        avoidCollisions: false,
        lockScroll: false,
      });
      let anchorTop = 140;
      const anchorLeft = 56;
      const anchorWidth = 160;
      const anchorHeight = 34;

      trigger.getBoundingClientRect = () =>
        ({
          x: anchorLeft,
          y: anchorTop,
          top: anchorTop,
          left: anchorLeft,
          width: anchorWidth,
          height: anchorHeight,
          right: anchorLeft + anchorWidth,
          bottom: anchorTop + anchorHeight,
          toJSON: () => ({}),
        }) as DOMRect;

      content.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          width: 240,
          height: 160,
          right: 240,
          bottom: 160,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.click();
      await waitForRaf();
      await waitForRaf();
      await waitForRaf();
      await waitForRaf();

      const initialTransform = getPositioner(content).style.transform;

      anchorTop = 320;
      window.dispatchEvent(new Event("scroll"));
      await waitForRaf();
      await waitForRaf();

      expect(getPositioner(content).style.transform).toBe(initialTransform);
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

    it("reuses the existing controller for duplicate direct binds", async () => {
      const { root, trigger, content } = setup();

      const first = createSelect(root);
      const second = createSelect(root);

      expect(second).toBe(first);

      trigger.click();
      expect(content.hidden).toBe(false);
      expect(document.body.querySelectorAll('[data-slot="select-positioner"]')).toHaveLength(1);

      first.close();
      await waitForClose();
      expect(document.body.querySelectorAll('[data-slot="select-positioner"]')).toHaveLength(0);

      trigger.click();
      expect(content.hidden).toBe(false);
      expect(document.body.querySelectorAll('[data-slot="select-positioner"]')).toHaveLength(1);

      first.destroy();
    });

    it("reuses a controller bound by another module copy", () => {
      const { root, controller } = setup();
      controller.destroy();

      const foreignController = {
        get value() {
          return null;
        },
        get isOpen() {
          return false;
        },
        select() {},
        open() {},
        close() {},
        destroy() {
          clearRootBinding(root, ROOT_BINDING_KEY, foreignController);
        },
      };

      setRootBinding(root, ROOT_BINDING_KEY, foreignController);

      expect(createSelect(root)).toBe(foreignController);

      foreignController.destroy();
    });

    it("create() skips roots already bound directly", () => {
      const { root, controller } = setup();

      const manual = createSelect(root);
      const auto = create();

      expect(manual).toBe(controller);
      expect(auto).toHaveLength(0);

      manual.destroy();
    });

    it("create() skips roots bound by another module copy", () => {
      const { root, controller } = setup();
      controller.destroy();

      const foreignController = {
        get value() {
          return null;
        },
        get isOpen() {
          return false;
        },
        select() {},
        open() {},
        close() {},
        destroy() {
          clearRootBinding(root, ROOT_BINDING_KEY, foreignController);
        },
      };

      setRootBinding(root, ROOT_BINDING_KEY, foreignController);

      expect(create()).toHaveLength(0);

      foreignController.destroy();
    });

    it("allows rebinding after destroy", () => {
      const { root, controller } = setup();

      controller.destroy();

      const rebound = createSelect(root);
      expect(rebound).not.toBe(controller);

      rebound.destroy();
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
      expect((trigger as HTMLButtonElement).disabled).toBe(true);

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

    it("authors resolved data-position and data-align-trigger on content during initialization", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root">
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

      expect(content.getAttribute("data-position")).toBe("item-aligned");
      expect(content.getAttribute("data-align-trigger")).toBe("true");
      expect(content.getAttribute("data-state")).toBe("closed");
      expect(content.hasAttribute("data-closed")).toBe(true);

      controller.destroy();
    });

    it("authors resolved data-position on select-viewport during initialization", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-position="popper">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content">
            <div data-slot="select-viewport">
              <div data-slot="select-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const viewport = root.querySelector('[data-slot="select-viewport"]') as HTMLElement;
      const controller = createSelect(root);

      expect(content.getAttribute("data-position")).toBe("popper");
      expect(content.getAttribute("data-align-trigger")).toBe("false");
      expect(viewport.getAttribute("data-position")).toBe("popper");

      controller.destroy();
    });

    it("reads data-position from content", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-content" data-position="popper" data-side="top" data-avoid-collisions="false">
            <div data-slot="select-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);

      expect(content.getAttribute("data-position")).toBe("popper");
      expect(content.getAttribute("data-align-trigger")).toBe("false");
      controller.open();
      expect(content.getAttribute("data-side")).toBe("top");
      expect(content.getAttribute("data-align")).toBe("start");

      controller.destroy();
    });

    it("reads data-position from positioner when content does not specify it", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-portal">
            <div data-slot="select-positioner" data-position="popper" data-side="top" data-avoid-collisions="false">
              <div data-slot="select-content">
                <div data-slot="select-item" data-value="apple">Apple</div>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);

      expect(content.getAttribute("data-position")).toBe("popper");
      expect(content.getAttribute("data-align-trigger")).toBe("false");
      controller.open();
      expect(content.getAttribute("data-side")).toBe("top");
      expect(content.getAttribute("data-align")).toBe("start");

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

    it("falls back to data-side from positioner before root", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-position="popper" data-side="bottom">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-portal">
            <div data-slot="select-positioner" data-side="top" data-avoid-collisions="false">
              <div data-slot="select-content">
                <div data-slot="select-item" data-value="apple">Apple</div>
              </div>
            </div>
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

    it("prefers data-side on content over positioner and root", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-position="popper" data-side="bottom">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-portal">
            <div data-slot="select-positioner" data-side="bottom" data-avoid-collisions="false">
              <div data-slot="select-content" data-side="top">
                <div data-slot="select-item" data-value="apple">Apple</div>
              </div>
            </div>
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

      expect(content.getAttribute("data-position")).toBe("popper");
      expect(content.getAttribute("data-align-trigger")).toBe("false");
      controller.open();
      // In popper mode, default is bottom/start
      expect(content.getAttribute("data-side")).toBe("bottom");
      expect(content.getAttribute("data-align")).toBe("start");

      controller.destroy();
    });

    it("falls back to data-side-offset from positioner before root", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-position="popper" data-side="top" data-side-offset="2">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-portal">
            <div data-slot="select-positioner" data-side-offset="12" data-avoid-collisions="false">
              <div data-slot="select-content">
                <div data-slot="select-item" data-value="apple">Apple</div>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="select-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(100, 100, 80, 20);
      content.getBoundingClientRect = () => rect(0, 0, 100, 40);

      controller.open();

      expect(getTranslate3dY(getPositioner(content).style.transform)).toBe(48);

      controller.destroy();
    });

    it("falls back to avoidCollisions/collisionPadding from positioner before root", () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root" data-position="popper" data-side="bottom" data-align="start" data-avoid-collisions="false" data-collision-padding="8">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-portal">
            <div data-slot="select-positioner" data-avoid-collisions="true" data-collision-padding="24">
              <div data-slot="select-content">
                <div data-slot="select-item" data-value="apple">Apple</div>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="select-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);
      const rect = (top: number, left: number, width: number, height: number) =>
        ({
          x: left,
          y: top,
          top,
          left,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.getBoundingClientRect = () => rect(100, 0, 80, 20);
      content.getBoundingClientRect = () => rect(0, 0, 100, 40);

      controller.open();

      const [x] = getTranslate3dXY(getPositioner(content).style.transform);
      expect(x).toBe(24);

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
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);

      controller.open();

      // Content is portaled to body when open, so query from content
      const group = content.querySelector('[data-slot="select-group"]') as HTMLElement;
      const groupLabel = group.querySelector('[data-slot="select-label"]') as HTMLElement;

      expect(group.getAttribute("role")).toBe("group");
      expect(group.getAttribute("aria-labelledby")).toBe(groupLabel.id);

      controller.destroy();
    });
  });

  describe("content portaling", () => {
    it("portals content to body when open and restores on close", async () => {
      const { root, trigger, content, controller } = setup();

      // Content starts inside root
      expect(content.parentElement).toBe(root);

      trigger.click();
      // Content is portaled to body when open
      const positioner = getPositioner(content);
      expect(positioner.parentElement).toBe(document.body);

      controller.close();
      await waitForClose();
      // Content is restored to root when closed
      expect(content.parentElement).toBe(root);

      controller.destroy();
    });

    it("restores content before applying closed hidden/data-state", async () => {
      const { root, trigger, content, controller } = setup();

      trigger.click();
      const positioner = getPositioner(content);
      expect(positioner.parentElement).toBe(document.body);

      type ParentWithHooks = HTMLElement & {
        appendChild(node: Node): Node;
        insertBefore(node: Node, child: Node | null): Node;
      };

      const rootNode = root as ParentWithHooks;
      const originalAppendChild = rootNode.appendChild.bind(rootNode);
      const originalInsertBefore = rootNode.insertBefore.bind(rootNode);
      let observedRestore = false;

      const assertRestoreBeforeClose = (node: Node) => {
        if (node !== content) return;
        observedRestore = true;
        expect(content.hidden).toBe(false);
        expect(content.getAttribute("data-state")).toBe("closed");
      };

      rootNode.appendChild = ((node: Node) => {
        assertRestoreBeforeClose(node);
        return originalAppendChild(node);
      }) as ParentWithHooks["appendChild"];

      rootNode.insertBefore = ((node: Node, child: Node | null) => {
        assertRestoreBeforeClose(node);
        return originalInsertBefore(node, child);
      }) as ParentWithHooks["insertBefore"];

      try {
        controller.close();
        await waitForClose();
      } finally {
        rootNode.appendChild = originalAppendChild as ParentWithHooks["appendChild"];
        rootNode.insertBefore = originalInsertBefore as ParentWithHooks["insertBefore"];
      }

      expect(observedRestore).toBe(true);
      expect(content.parentElement).toBe(root);
      expect(content.hidden).toBe(true);
      expect(content.getAttribute("data-state")).toBe("closed");

      controller.destroy();
    });

    it("restores content to root on destroy while open", () => {
      const { root, trigger, content, controller } = setup();

      trigger.click();
      const positioner = getPositioner(content);
      expect(positioner.parentElement).toBe(document.body);

      controller.destroy();
      expect(content.parentElement).toBe(root);
    });

    it("uses authored portal and positioner slots when provided", async () => {
      document.body.innerHTML = `
        <div data-slot="select" id="root">
          <button data-slot="select-trigger">
            <span data-slot="select-value"></span>
          </button>
          <div data-slot="select-portal" id="portal">
            <div data-slot="select-positioner" id="positioner">
              <div data-slot="select-content">
                <div data-slot="select-item" data-value="apple">Apple</div>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const portal = document.getElementById("portal") as HTMLElement;
      const positioner = document.getElementById("positioner") as HTMLElement;
      const trigger = root.querySelector('[data-slot="select-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="select-content"]') as HTMLElement;
      const controller = createSelect(root);

      trigger.click();
      expect(portal.parentElement).toBe(document.body);
      expect(content.parentElement).toBe(positioner);
      expect(positioner.style.transform).toContain("translate3d(");

      controller.close();
      await waitForClose();
      expect(portal.parentElement).toBe(root);
      expect(content.parentElement).toBe(positioner);

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

    it("restores scroll lock after outside close in the reopen sequence", async () => {
      const { trigger, controller } = setup();

      trigger.click();
      expect(document.documentElement.style.overflow).toBe("hidden");

      trigger.click();
      await waitForClose();
      expect(document.documentElement.style.overflow).toBe("");

      trigger.click();
      expect(document.documentElement.style.overflow).toBe("hidden");

      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" })
      );
      await waitForClose();
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
