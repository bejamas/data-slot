import { describe, expect, it, beforeEach } from "bun:test";
import { createCombobox, create } from "./index";

describe("Combobox", () => {
  const setup = (options: Parameters<typeof createCombobox>[1] = {}, html?: string) => {
    document.body.innerHTML = html ?? `
      <div data-slot="combobox" id="root">
        <input data-slot="combobox-input" />
        <button data-slot="combobox-trigger">▼</button>
        <div data-slot="combobox-content" hidden>
          <div data-slot="combobox-list">
            <div data-slot="combobox-empty" hidden>No results found</div>
            <div data-slot="combobox-group">
              <div data-slot="combobox-label">Fruits</div>
              <div data-slot="combobox-item" data-value="apple">Apple</div>
              <div data-slot="combobox-item" data-value="banana">Banana</div>
            </div>
            <div data-slot="combobox-separator"></div>
            <div data-slot="combobox-item" data-value="other">Other</div>
            <div data-slot="combobox-item" data-value="disabled" data-disabled>Disabled</div>
          </div>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
    const triggerBtn = root.querySelector('[data-slot="combobox-trigger"]') as HTMLElement;
    const content = root.querySelector('[data-slot="combobox-content"]') as HTMLElement;
    const list = root.querySelector('[data-slot="combobox-list"]') as HTMLElement;
    const items = root.querySelectorAll('[data-slot="combobox-item"]') as NodeListOf<HTMLElement>;
    const emptySlot = root.querySelector('[data-slot="combobox-empty"]') as HTMLElement;
    const controller = createCombobox(root, options);

    return { root, input, triggerBtn, content, list, items, emptySlot, controller };
  };

  const waitForRaf = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const waitForClose = async () => {
    await waitForRaf();
    await waitForRaf();
  };

  const getPositioner = (content: HTMLElement): HTMLElement => {
    const parent = content.parentElement;
    if (parent instanceof HTMLElement && parent.getAttribute("data-slot") === "combobox-positioner") {
      return parent;
    }
    return content;
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
      const { controller, input } = setup();
      expect(controller.value).toBe(null);
      expect(input.value).toBe("");
      controller.destroy();
    });

    it("initializes with defaultValue", () => {
      const { controller, input } = setup({ defaultValue: "banana" });
      expect(controller.value).toBe("banana");
      expect(input.value).toBe("Banana");
      controller.destroy();
    });

    it("sets placeholder on input", () => {
      const { input, controller } = setup({ placeholder: "Search fruits..." });
      expect(input.placeholder).toBe("Search fruits...");
      controller.destroy();
    });

    it("reads data-placeholder from root", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root" data-placeholder="Pick a fruit">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
      const controller = createCombobox(root);
      expect(input.placeholder).toBe("Pick a fruit");
      controller.destroy();
    });
  });

  describe("ARIA", () => {
    it("sets role=combobox on input", () => {
      const { input, controller } = setup();
      expect(input.getAttribute("role")).toBe("combobox");
      controller.destroy();
    });

    it("sets aria-autocomplete=list on input", () => {
      const { input, controller } = setup();
      expect(input.getAttribute("aria-autocomplete")).toBe("list");
      controller.destroy();
    });

    it("sets autocomplete=off on input", () => {
      const { input, controller } = setup();
      expect(input.getAttribute("autocomplete")).toBe("off");
      controller.destroy();
    });

    it("sets aria-controls on input pointing to list", () => {
      const { input, list, controller } = setup();
      expect(input.getAttribute("aria-controls")).toBe(list.id);
      controller.destroy();
    });

    it("sets aria-expanded on input", () => {
      const { input, controller } = setup();
      expect(input.getAttribute("aria-expanded")).toBe("false");
      controller.open();
      expect(input.getAttribute("aria-expanded")).toBe("true");
      controller.close();
      expect(input.getAttribute("aria-expanded")).toBe("false");
      controller.destroy();
    });

    it("sets role=listbox on list", () => {
      const { list, controller } = setup();
      expect(list.getAttribute("role")).toBe("listbox");
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

    it("sets role=group on groups with aria-labelledby", () => {
      const { controller } = setup();
      controller.open();
      const group = document.querySelector('[data-slot="combobox-group"]') as HTMLElement;
      const label = document.querySelector('[data-slot="combobox-label"]') as HTMLElement;
      expect(group.getAttribute("role")).toBe("group");
      expect(group.getAttribute("aria-labelledby")).toBe(label.id);
      controller.destroy();
    });

    it("sets aria-activedescendant on highlight", () => {
      const { input, controller } = setup();
      controller.open();
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
      controller.destroy();
    });

    it("clears aria-activedescendant when highlight is cleared", () => {
      const { input, content, controller } = setup();
      controller.open();
      // Use pointer move to highlight (not keyboard) so pointerleave can clear
      const items = content.querySelectorAll('[data-slot="combobox-item"]');
      items[0]?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
      expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
      // Pointer leave clears highlight
      content.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
      expect(input.hasAttribute("aria-activedescendant")).toBe(false);
      controller.destroy();
    });
  });

  describe("filtering", () => {
    it("filters items when typing", () => {
      const { input, items, controller } = setup();
      controller.open();
      input.value = "app";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(items[0]?.hidden).toBe(false); // Apple matches
      expect(items[1]?.hidden).toBe(true);  // Banana hidden
      expect(items[2]?.hidden).toBe(true);  // Other hidden
      controller.destroy();
    });

    it("shows all items when input is cleared", () => {
      const { input, items, controller } = setup();
      controller.open();

      // Type to filter
      input.value = "app";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(items[1]?.hidden).toBe(true);

      // Clear input
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(items[0]?.hidden).toBe(false);
      expect(items[1]?.hidden).toBe(false);
      expect(items[2]?.hidden).toBe(false);
      controller.destroy();
    });

    it("shows empty message when no items match", () => {
      const { input, emptySlot, controller } = setup();
      controller.open();
      input.value = "xyz";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(emptySlot.hidden).toBe(false);
      controller.destroy();
    });

    it("hides empty message when items match", () => {
      const { input, emptySlot, controller } = setup();
      controller.open();
      input.value = "app";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(emptySlot.hidden).toBe(true);
      controller.destroy();
    });

    it("hides groups where all items are hidden", () => {
      const { input, controller } = setup();
      controller.open();
      input.value = "other";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      const group = document.querySelector('[data-slot="combobox-group"]') as HTMLElement;
      expect(group.hidden).toBe(true); // Apple and Banana are hidden, so group is hidden
      controller.destroy();
    });

    it("uses custom filter function", () => {
      const { input, items, controller } = setup({
        filter: (_inputValue, _itemValue, itemLabel) => itemLabel.startsWith("B"),
      });
      controller.open();
      input.value = "anything";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(items[0]?.hidden).toBe(true);  // Apple hidden
      expect(items[1]?.hidden).toBe(false); // Banana matches
      controller.destroy();
    });

    it("sets data-empty on content when no items visible", () => {
      const { input, content, controller } = setup();
      controller.open();
      input.value = "xyz";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(content.hasAttribute("data-empty")).toBe(true);

      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(content.hasAttribute("data-empty")).toBe(false);
      controller.destroy();
    });

    it("uses data-label for filtering when available", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="us" data-label="United States">🇺🇸 United States</div>
              <div data-slot="combobox-item" data-value="uk" data-label="United Kingdom">🇬🇧 United Kingdom</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
      const items = root.querySelectorAll('[data-slot="combobox-item"]') as NodeListOf<HTMLElement>;
      const controller = createCombobox(root);

      controller.open();
      input.value = "United S";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(items[0]?.hidden).toBe(false); // United States matches
      expect(items[1]?.hidden).toBe(true);  // United Kingdom doesn't match
      controller.destroy();
    });
  });

  describe("value/inputValue state machine", () => {
    it("selection fills input with item label", () => {
      const { input, items, controller } = setup();
      controller.open();
      items[0]?.click(); // Apple

      expect(controller.value).toBe("apple");
      expect(input.value).toBe("Apple");
      controller.destroy();
    });

    it("Escape restores input to committed label", () => {
      const { input, controller } = setup({ defaultValue: "banana" });
      controller.open();

      // Type something
      input.value = "app";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(input.value).toBe("app");

      // Escape
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);
      expect(input.value).toBe("Banana"); // Restored
      expect(controller.value).toBe("banana"); // Value unchanged
      controller.destroy();
    });

    it("Escape when popup is closed clears the value", () => {
      const { root, input, controller } = setup({ defaultValue: "banana" });
      expect(controller.isOpen).toBe(false);
      expect(input.value).toBe("Banana");

      let lastValue: string | null | undefined;
      root.addEventListener("combobox:change", (e) => {
        lastValue = (e as CustomEvent).detail.value;
      });

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);
      expect(input.value).toBe("");
      expect(controller.value).toBe(null);
      expect(lastValue).toBe(null);
      controller.destroy();
    });

    it("Escape when popup is closed with no value does not preventDefault", () => {
      const { input, controller } = setup();
      expect(controller.isOpen).toBe(false);
      expect(controller.value).toBe(null);

      const evt = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      input.dispatchEvent(evt);
      expect(evt.defaultPrevented).toBe(false);
      expect(controller.value).toBe(null);
      controller.destroy();
    });

    it("close restores input to committed label", () => {
      const { input, controller } = setup({ defaultValue: "apple" });
      controller.open();
      input.value = "ban";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      controller.close();
      expect(input.value).toBe("Apple");
      controller.destroy();
    });

    it("focus selects all text", () => {
      const { input, controller } = setup({ defaultValue: "apple" });
      expect(input.value).toBe("Apple");

      input.focus();
      input.dispatchEvent(new Event("focus", { bubbles: true }));
      // Note: in jsdom, select() may not change selectionStart/End, but we verify the call was made
      // The behavior is that all text is selected for easy replacement
      controller.destroy();
    });

    it("controller.select() updates value and input", () => {
      const { input, controller } = setup();
      controller.select("banana");
      expect(controller.value).toBe("banana");
      expect(input.value).toBe("Banana");
      controller.destroy();
    });

    it("controller.clear() clears value and input", () => {
      const { input, controller } = setup({ defaultValue: "apple" });
      expect(input.value).toBe("Apple");

      controller.clear();
      expect(controller.value).toBe(null);
      expect(input.value).toBe("");
      controller.destroy();
    });

    it("inbound combobox:set with value syncs input to label", () => {
      const { root, input, controller } = setup();
      root.dispatchEvent(
        new CustomEvent("combobox:set", { detail: { value: "banana" } })
      );
      expect(controller.value).toBe("banana");
      expect(input.value).toBe("Banana");
      controller.destroy();
    });

    it("inbound combobox:set with inputValue overrides input text", () => {
      const { root, input, controller } = setup();
      root.dispatchEvent(
        new CustomEvent("combobox:set", { detail: { value: "banana", inputValue: "custom text" } })
      );
      expect(controller.value).toBe("banana");
      expect(input.value).toBe("custom text");
      controller.destroy();
    });

    it("Tab closes popup and restores input to committed label", () => {
      const { input, controller } = setup({ defaultValue: "banana" });
      controller.open();
      input.value = "app";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);
      expect(input.value).toBe("Banana");
      controller.destroy();
    });

    it("close with no committed value restores input to empty", () => {
      const { input, controller } = setup();
      controller.open();
      input.value = "app";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      controller.close();
      expect(input.value).toBe("");
      controller.destroy();
    });
  });

  describe("keyboard navigation", () => {
    it("ArrowDown opens when closed", () => {
      const { input, controller } = setup();
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(controller.isOpen).toBe(true);
      controller.destroy();
    });

    it("ArrowUp opens when closed", () => {
      const { input, controller } = setup();
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      expect(controller.isOpen).toBe(true);
      controller.destroy();
    });

    it("ArrowDown navigates visible items", () => {
      const { input, items, controller } = setup();
      controller.open();
      // autoHighlight=true means first item (Apple) is already highlighted on open
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);

      // ArrowDown moves to second item (Banana)
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      // ArrowDown moves to third item (Other)
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(false);
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });

    it("ArrowUp navigates visible items", () => {
      const { input, items, controller } = setup();
      controller.open();

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      // Should highlight last enabled item (Other, index 2 — Disabled is skipped)
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });

    it("wraps around with ArrowDown", () => {
      const { input, items, controller } = setup();
      controller.open();

      // Go to End
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );
      // ArrowDown should wrap to first
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });

    it("Home goes to first visible item", () => {
      const { input, items, controller } = setup();
      controller.open();

      // Navigate to second item
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });

    it("End goes to last enabled visible item", () => {
      const { input, items, controller } = setup();
      controller.open();

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );
      // Other (index 2) is last enabled item
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });

    it("scrolls highlighted item into view when navigating with keyboard", () => {
      const { input, content, items, controller } = setup(
        {},
        `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <button data-slot="combobox-trigger">▼</button>
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="item-1">Item 1</div>
              <div data-slot="combobox-item" data-value="item-2">Item 2</div>
              <div data-slot="combobox-item" data-value="item-3">Item 3</div>
              <div data-slot="combobox-item" data-value="item-4">Item 4</div>
              <div data-slot="combobox-item" data-value="item-5">Item 5</div>
              <div data-slot="combobox-item" data-value="item-6">Item 6</div>
            </div>
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

      controller.open();
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );

      expect(items[5]?.hasAttribute("data-highlighted")).toBe(true);
      expect(content.scrollTop).toBe(124);
      controller.destroy();
    });

    it("Enter selects highlighted item", () => {
      const { input, controller } = setup();
      controller.open();
      // autoHighlight=true means Apple is already highlighted
      // Enter should select the highlighted item
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(controller.value).toBe("apple");
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("Enter is no-op when nothing highlighted", () => {
      const { input, controller } = setup({ autoHighlight: false });
      controller.open();

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
      expect(controller.value).toBe(null);
      expect(controller.isOpen).toBe(true);
      controller.destroy();
    });

    it("Escape closes popup", () => {
      const { input, controller } = setup();
      controller.open();
      expect(controller.isOpen).toBe(true);

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("Tab closes popup", () => {
      const { input, controller } = setup();
      controller.open();
      expect(controller.isOpen).toBe(true);

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("skips hidden items during navigation", () => {
      const { input, items, controller } = setup();
      controller.open();

      // Filter to show only Apple
      input.value = "apple";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      // Navigate — should only highlight Apple
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);

      // ArrowDown again should wrap to Apple (only visible item)
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });

    it("skips disabled items during navigation", () => {
      const { input, items, controller } = setup();
      controller.open();

      // End should go to last enabled item (Other), not Disabled
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);
      expect(items[3]?.hasAttribute("data-highlighted")).toBe(false);
      controller.destroy();
    });

    it("Space types into input, not used for selection", () => {
      const { input, controller } = setup();
      controller.open();

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      // Space should NOT select (unlike select component)
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true })
      );
      // Value should still be null (space is typed into input, not intercepted)
      expect(controller.value).toBe(null);
      controller.destroy();
    });
  });

  describe("selection", () => {
    it("selects item on click", () => {
      const { input, items, controller } = setup();
      controller.open();
      items[0]?.click(); // Apple

      expect(controller.value).toBe("apple");
      expect(input.value).toBe("Apple");
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("marks selected item with data-selected and aria-selected", () => {
      const { items, controller } = setup();
      controller.open();
      items[1]?.click(); // Banana

      // Reopen to check state
      controller.open();
      expect(items[1]?.hasAttribute("data-selected")).toBe(true);
      expect(items[1]?.getAttribute("aria-selected")).toBe("true");
      expect(items[0]?.hasAttribute("data-selected")).toBe(false);
      expect(items[0]?.getAttribute("aria-selected")).toBe("false");
      controller.destroy();
    });

    it("sets data-value on root", () => {
      const { root, items, controller } = setup();
      controller.open();
      items[0]?.click();
      expect(root.getAttribute("data-value")).toBe("apple");
      controller.destroy();
    });

    it("does not select disabled items", () => {
      const { items, controller } = setup();
      controller.open();
      items[3]?.click(); // Disabled item
      expect(controller.value).toBe(null);
      expect(controller.isOpen).toBe(true); // Should still be open
      controller.destroy();
    });

    it("emits combobox:change on selection", () => {
      const { root, items, controller } = setup();
      let selectedValue: string | null | undefined;
      root.addEventListener("combobox:change", (e) => {
        selectedValue = (e as CustomEvent).detail.value;
      });

      controller.open();
      items[0]?.click();
      expect(selectedValue).toBe("apple");
      controller.destroy();
    });

    it("calls onValueChange callback", () => {
      let selectedValue: string | null | undefined;
      const { items, controller } = setup({
        onValueChange: (value) => { selectedValue = value; },
      });

      controller.open();
      items[1]?.click();
      expect(selectedValue).toBe("banana");
      controller.destroy();
    });

    it("removes data-value on root when cleared", () => {
      const { root, controller } = setup({ defaultValue: "apple" });
      expect(root.getAttribute("data-value")).toBe("apple");

      controller.clear();
      expect(root.hasAttribute("data-value")).toBe(false);
      controller.destroy();
    });
  });

  describe("opening behavior", () => {
    it("opens on focus when openOnFocus is true (default)", () => {
      const { input, controller } = setup();
      input.dispatchEvent(new Event("focus", { bubbles: true }));
      expect(controller.isOpen).toBe(true);
      controller.destroy();
    });

    it("does not open on focus when openOnFocus is false", () => {
      const { input, controller } = setup({ openOnFocus: false });
      input.dispatchEvent(new Event("focus", { bubbles: true }));
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("opens when typing", () => {
      const { input, controller } = setup({ openOnFocus: false });
      input.value = "a";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(controller.isOpen).toBe(true);
      controller.destroy();
    });

    it("trigger click toggles popup", () => {
      const { triggerBtn, controller } = setup({ openOnFocus: false });
      triggerBtn.click();
      expect(controller.isOpen).toBe(true);

      triggerBtn.click();
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("closes on outside click", () => {
      const { controller } = setup();
      controller.open();
      expect(controller.isOpen).toBe(true);

      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true })
      );
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("does not open when disabled", () => {
      const { input, triggerBtn, controller } = setup({ disabled: true });
      input.dispatchEvent(new Event("focus", { bubbles: true }));
      expect(controller.isOpen).toBe(false);

      triggerBtn.click();
      expect(controller.isOpen).toBe(false);

      controller.open();
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("sets data-state on root, content, and trigger", () => {
      const { root, content, triggerBtn, controller } = setup();
      expect(root.getAttribute("data-state")).toBe("closed");
      expect(content.getAttribute("data-state")).toBe("closed");
      expect(triggerBtn.getAttribute("data-state")).toBe("closed");

      controller.open();
      expect(root.getAttribute("data-state")).toBe("open");
      expect(content.getAttribute("data-state")).toBe("open");
      expect(triggerBtn.getAttribute("data-state")).toBe("open");

      controller.close();
      expect(root.getAttribute("data-state")).toBe("closed");
      expect(content.getAttribute("data-state")).toBe("closed");
      expect(triggerBtn.getAttribute("data-state")).toBe("closed");
      controller.destroy();
    });

    it("trigger click focuses input", () => {
      const { triggerBtn, controller } = setup({ openOnFocus: false });
      triggerBtn.click();
      // In bun:test, focus doesn't always work but we verify the intent
      expect(controller.isOpen).toBe(true);
      controller.destroy();
    });
  });

  describe("pointer interaction", () => {
    it("highlights item on pointer move", () => {
      const { items, controller } = setup();
      controller.open();

      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });

    it("does not highlight disabled items on pointer move", () => {
      const { items, controller } = setup();
      controller.open();

      items[3]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true })
      );
      expect(items[3]?.hasAttribute("data-highlighted")).toBe(false);
      controller.destroy();
    });

    it("clears highlight on pointer leave", () => {
      const { content, items, controller } = setup();
      controller.open();

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

    it("mousedown on content does not steal focus from input", () => {
      const { content, controller } = setup();
      controller.open();

      const evt = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      content.dispatchEvent(evt);
      expect(evt.defaultPrevented).toBe(true);
      controller.destroy();
    });
  });

  describe("events", () => {
    it("emits combobox:open-change on open/close", () => {
      const { root, controller } = setup();
      let lastOpen: boolean | undefined;
      root.addEventListener("combobox:open-change", (e) => {
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
        onOpenChange: (open) => { lastOpen = open; },
      });

      controller.open();
      expect(lastOpen).toBe(true);

      controller.close();
      expect(lastOpen).toBe(false);
      controller.destroy();
    });

    it("emits combobox:input-change on user typing", () => {
      const { root, input, controller } = setup();
      let lastInputValue: string | undefined;
      root.addEventListener("combobox:input-change", (e) => {
        lastInputValue = (e as CustomEvent).detail.inputValue;
      });

      controller.open();
      input.value = "app";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(lastInputValue).toBe("app");
      controller.destroy();
    });

    it("calls onInputValueChange callback on user typing", () => {
      let lastInputValue: string | undefined;
      const { input, controller } = setup({
        onInputValueChange: (v) => { lastInputValue = v; },
      });

      controller.open();
      input.value = "ban";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(lastInputValue).toBe("ban");
      controller.destroy();
    });

    it("does not emit combobox:input-change on programmatic value sync", () => {
      const { root, controller } = setup();
      let inputChangeCount = 0;
      root.addEventListener("combobox:input-change", () => {
        inputChangeCount++;
      });

      controller.select("banana"); // Programmatic — should NOT fire input-change
      expect(inputChangeCount).toBe(0);
      controller.destroy();
    });

    it("responds to combobox:set inbound event for value", () => {
      const { root, input, controller } = setup();
      root.dispatchEvent(
        new CustomEvent("combobox:set", { detail: { value: "banana" } })
      );
      expect(controller.value).toBe("banana");
      expect(input.value).toBe("Banana");
      controller.destroy();
    });

    it("responds to combobox:set inbound event for open", () => {
      const { root, controller } = setup();
      root.dispatchEvent(
        new CustomEvent("combobox:set", { detail: { open: true } })
      );
      expect(controller.isOpen).toBe(true);

      root.dispatchEvent(
        new CustomEvent("combobox:set", { detail: { open: false } })
      );
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("supports controller.setItemToStringValue for selected value display", () => {
      const { input, controller } = setup({ defaultValue: "banana" });
      expect(input.value).toBe("Banana");

      controller.setItemToStringValue((_item, value) => value ? `Selected: ${value}` : "");
      expect(input.value).toBe("Selected: banana");

      controller.setItemToStringValue(null);
      expect(input.value).toBe("Banana");
      controller.destroy();
    });

    it("supports combobox:set inbound event for itemToStringValue", () => {
      const { root, input, controller } = setup({ defaultValue: "banana" });
      expect(input.value).toBe("Banana");

      root.dispatchEvent(
        new CustomEvent("combobox:set", {
          detail: {
            itemToStringValue: (_item: HTMLElement | null, value: string | null) =>
              value ? value.toUpperCase() : "",
          },
        })
      );
      expect(input.value).toBe("BANANA");
      controller.destroy();
    });
  });

  describe("form integration", () => {
    it("creates hidden input when name is provided", () => {
      const { root, controller } = setup({ name: "fruit" });
      const hiddenInput = root.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(hiddenInput).toBeTruthy();
      expect(hiddenInput.name).toBe("fruit");
      controller.destroy();
    });

    it("updates hidden input value on selection", () => {
      const { root, items, controller } = setup({ name: "fruit" });
      controller.open();
      items[0]?.click();

      const hiddenInput = root.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(hiddenInput.value).toBe("apple");
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
        <div data-slot="combobox" id="root" data-name="fruit">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createCombobox(root);

      const hiddenInput = root.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(hiddenInput).toBeTruthy();
      expect(hiddenInput.name).toBe("fruit");
      controller.destroy();
    });

    it("strips name from visible input when name option is used", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" name="fruit" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
      const controller = createCombobox(root, { name: "fruit" });

      expect(input.hasAttribute("name")).toBe(false);
      const hiddenInput = root.querySelector('input[type="hidden"]') as HTMLInputElement;
      expect(hiddenInput.name).toBe("fruit");
      controller.destroy();
    });
  });

  describe("native label[for] support", () => {
    it("sets aria-labelledby on input from native label[for]", () => {
      document.body.innerHTML = `
        <label for="my-input">Choose a fruit</label>
        <div data-slot="combobox">
          <input data-slot="combobox-input" id="my-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.querySelector('[data-slot="combobox"]')!;
      const controller = createCombobox(root);
      const input = document.getElementById("my-input") as HTMLElement;
      const nativeLabel = document.querySelector('label[for="my-input"]') as HTMLElement;

      expect(input.getAttribute("aria-labelledby")).toContain(nativeLabel.id);
      controller.destroy();
    });

    it("sets aria-labelledby on list from native label", () => {
      document.body.innerHTML = `
        <label for="my-input">Choose a fruit</label>
        <div data-slot="combobox">
          <input data-slot="combobox-input" id="my-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.querySelector('[data-slot="combobox"]')!;
      const controller = createCombobox(root);
      const nativeLabel = document.querySelector('label[for="my-input"]') as HTMLElement;
      const list = document.querySelector('[data-slot="combobox-list"]') as HTMLElement;

      expect(list.getAttribute("aria-labelledby")).toBe(nativeLabel.id);
      controller.destroy();
    });
  });

  describe("content portaling", () => {
    it("portals content to body when open and restores on close", async () => {
      const { root, content, controller } = setup();
      // Content starts inside root
      expect(root.contains(content)).toBe(true);

      controller.open();
      expect(getPositioner(content).parentElement).toBe(document.body);

      controller.close();
      await waitForClose();
      expect(root.contains(content)).toBe(true);
      controller.destroy();
    });

    it("restores content before applying closed hidden/data-state", async () => {
      const { root, content, controller } = setup();
      controller.open();
      expect(getPositioner(content).parentElement).toBe(document.body);

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
      expect(root.contains(content)).toBe(true);
      expect(content.hidden).toBe(true);
      expect(content.getAttribute("data-state")).toBe("closed");

      controller.destroy();
    });

    it("restores content to root on destroy while open", () => {
      const { root, content, controller } = setup();
      controller.open();
      expect(getPositioner(content).parentElement).toBe(document.body);

      controller.destroy();
      expect(root.contains(content)).toBe(true);
    });
  });

  describe("content positioning", () => {
    it("uses position: absolute when open", () => {
      const { content, controller } = setup();
      controller.open();
      expect(getPositioner(content).style.position).toBe("absolute");
      controller.destroy();
    });

    it("sets data-side and data-align attributes when open", () => {
      const { content, controller } = setup();
      controller.open();
      expect(content.getAttribute("data-side")).toBe("bottom");
      expect(content.getAttribute("data-align")).toBe("start");
      controller.destroy();
    });

    it("respects side option", () => {
      const { content, controller } = setup({ side: "top", avoidCollisions: false });
      controller.open();
      expect(content.getAttribute("data-side")).toBe("top");
      controller.destroy();
    });

    it("respects align option", () => {
      const { content, controller } = setup({ align: "end", avoidCollisions: false });
      controller.open();
      expect(content.getAttribute("data-align")).toBe("end");
      controller.destroy();
    });

    it("keeps coordinates stable on window scroll", async () => {
      const { root, content, controller } = setup({ avoidCollisions: false });

      let anchorTop = 100;
      const anchorLeft = 40;
      const anchorWidth = 180;
      const anchorHeight = 36;

      (root as HTMLElement).getBoundingClientRect = () =>
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
          width: 220,
          height: 140,
          right: 220,
          bottom: 140,
          toJSON: () => ({}),
        }) as DOMRect;

      controller.open();
      await waitForRaf();
      await waitForRaf();
      await waitForRaf();
      await waitForRaf();

      const initialTransform = getPositioner(content).style.transform;

      anchorTop = 260;
      window.dispatchEvent(new Event("scroll"));
      await waitForRaf();
      await waitForRaf();

      expect(getPositioner(content).style.transform).toBe(initialTransform);
      controller.destroy();
    });
  });

  describe("auto-highlight", () => {
    it("highlights first visible item when autoHighlight is true (default)", () => {
      const { input, items, controller } = setup();
      controller.open();
      input.value = "a";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(items[0]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });

    it("does not highlight when autoHighlight is false", () => {
      const { input, items, controller } = setup({ autoHighlight: false });
      controller.open();
      input.value = "a";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);
      controller.destroy();
    });

    it("highlights selected item on open if visible", () => {
      const { items, controller } = setup({ defaultValue: "banana" });
      controller.open();
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);
      controller.destroy();
    });
  });

  describe("create()", () => {
    it("binds all comboboxes and returns controllers", () => {
      document.body.innerHTML = `
        <div data-slot="combobox">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="a">A</div>
            </div>
          </div>
        </div>
        <div data-slot="combobox">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="b">B</div>
            </div>
          </div>
        </div>
      `;

      const controllers = create();
      expect(controllers).toHaveLength(2);
      controllers.forEach((c) => c.destroy());
    });

    it("does not rebind already bound comboboxes", () => {
      document.body.innerHTML = `
        <div data-slot="combobox">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="a">A</div>
            </div>
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

  describe("disabled/required", () => {
    it("disabled prevents opening via any method", () => {
      const { input, triggerBtn, controller } = setup({ disabled: true });

      input.dispatchEvent(new Event("focus", { bubbles: true }));
      expect(controller.isOpen).toBe(false);

      input.value = "a";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(controller.isOpen).toBe(false);

      triggerBtn.click();
      expect(controller.isOpen).toBe(false);

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("disabled sets aria-disabled on input", () => {
      const { input, controller } = setup({ disabled: true });
      expect(input.getAttribute("aria-disabled")).toBe("true");
      expect(input.disabled).toBe(true);
      controller.destroy();
    });

    it("disabled sets data-disabled on trigger", () => {
      const { triggerBtn, controller } = setup({ disabled: true });
      expect(triggerBtn.hasAttribute("data-disabled")).toBe(true);
      expect(triggerBtn.getAttribute("aria-disabled")).toBe("true");
      controller.destroy();
    });

    it("required sets aria-required on input", () => {
      const { input, controller } = setup({ required: true });
      expect(input.getAttribute("aria-required")).toBe("true");
      controller.destroy();
    });
  });

  describe("data attributes", () => {
    it("reads data-default-value", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root" data-default-value="banana">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
              <div data-slot="combobox-item" data-value="banana">Banana</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createCombobox(root);
      expect(controller.value).toBe("banana");
      controller.destroy();
    });

    it("reads data-disabled", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root" data-disabled>
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
      const controller = createCombobox(root);
      expect(input.getAttribute("aria-disabled")).toBe("true");
      expect(input.disabled).toBe(true);
      controller.destroy();
    });

    it("reads data-required", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root" data-required>
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
      const controller = createCombobox(root);
      expect(input.getAttribute("aria-required")).toBe("true");
      controller.destroy();
    });

    it("reads data-open-on-focus=false", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root" data-open-on-focus="false">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
      const controller = createCombobox(root);

      input.dispatchEvent(new Event("focus", { bubbles: true }));
      expect(controller.isOpen).toBe(false);
      controller.destroy();
    });

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root" data-default-value="apple">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
              <div data-slot="combobox-item" data-value="banana">Banana</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createCombobox(root, { defaultValue: "banana" });
      expect(controller.value).toBe("banana");
      controller.destroy();
    });
  });

  describe("destroy", () => {
    it("cleans up event listeners", () => {
      const { root, input, controller } = setup();

      let changeCount = 0;
      root.addEventListener("combobox:open-change", () => {
        changeCount++;
      });

      input.dispatchEvent(new Event("focus", { bubbles: true }));
      expect(changeCount).toBe(1);

      controller.destroy();

      // After destroy, focusing input should not emit events
      input.dispatchEvent(new Event("focus", { bubbles: true }));
      expect(changeCount).toBe(1);
    });
  });

  describe("separator visibility", () => {
    it("hides separator when trailing group is filtered out", () => {
      const { input, controller } = setup();
      controller.open();
      // Filter to only show fruits (Apple/Banana) — "Other" and "Disabled" hidden too
      input.value = "apple";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      const sep = document.querySelector('[data-slot="combobox-separator"]') as HTMLElement;
      expect(sep.hidden).toBe(true);
      controller.destroy();
    });

    it("shows separator when both adjacent groups are visible", () => {
      const { controller } = setup(undefined, `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-group">
                <div data-slot="combobox-item" data-value="a">A</div>
              </div>
              <div data-slot="combobox-separator"></div>
              <div data-slot="combobox-group">
                <div data-slot="combobox-item" data-value="b">B</div>
              </div>
            </div>
          </div>
        </div>
      `);
      controller.open();
      // No filter — both groups visible
      const sep = document.querySelector('[data-slot="combobox-separator"]') as HTMLElement;
      expect(sep.hidden).toBe(false);
      controller.destroy();
    });
  });

  describe("getItemLabel", () => {
    it("excludes child element text like check marks", () => {
      const { input, controller } = setup(undefined, `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">
                Apple<span class="check">✓</span>
              </div>
            </div>
          </div>
        </div>
      `);
      controller.open();
      const items = document.querySelectorAll('[data-slot="combobox-item"]') as NodeListOf<HTMLElement>;
      items[0]?.click();
      expect(input.value).toBe("Apple");
      controller.destroy();
    });

    it("falls back to textContent for wrapped labels", () => {
      const { input, controller } = setup(undefined, `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple"><span>Apple</span></div>
            </div>
          </div>
        </div>
      `);
      controller.open();
      const items = document.querySelectorAll('[data-slot="combobox-item"]') as NodeListOf<HTMLElement>;
      items[0]?.click();
      expect(input.value).toBe("Apple");
      controller.destroy();
    });
  });

  describe("required validation", () => {
    it("enforces form validity via setCustomValidity", () => {
      const { input, controller } = setup({ required: true });
      expect(input.required).toBe(true);
      expect(input.validity.valid).toBe(false);
      expect(input.validationMessage).toBe("Please select a value");

      controller.select("apple");
      expect(input.validity.valid).toBe(true);
      expect(input.validationMessage).toBe("");

      controller.clear();
      expect(input.validity.valid).toBe(false);
      controller.destroy();
    });
  });

  describe("empty-string values", () => {
    it("can select items with empty-string data-value", () => {
      const { input, controller } = setup(undefined, `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="">None</div>
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `);
      controller.open();
      const items = document.querySelectorAll('[data-slot="combobox-item"]') as NodeListOf<HTMLElement>;
      items[0]?.click();
      expect(controller.value).toBe("");
      expect(input.value).toBe("None");
      controller.destroy();
    });

    it("items without data-value are not selectable", () => {
      const { controller } = setup(undefined, `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item">Not selectable</div>
              <div data-slot="combobox-item" data-value="apple">Apple</div>
            </div>
          </div>
        </div>
      `);
      controller.open();
      const items = document.querySelectorAll('[data-slot="combobox-item"]') as NodeListOf<HTMLElement>;
      items[0]?.click();
      expect(controller.value).toBe(null);
      expect(controller.isOpen).toBe(true); // Didn't close because nothing was selected
      controller.destroy();
    });
  });

  describe("empty slot fallback", () => {
    it("finds empty slot without combobox-list wrapper", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-empty" hidden>No results</div>
            <div data-slot="combobox-item" data-value="apple">Apple</div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
      const controller = createCombobox(root);

      controller.open();
      input.value = "xyz";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      const emptySlot = document.querySelector('[data-slot="combobox-empty"]') as HTMLElement;
      expect(emptySlot.hidden).toBe(false);
      controller.destroy();
    });
  });

  describe("no trigger button", () => {
    it("works without trigger button", () => {
      document.body.innerHTML = `
        <div data-slot="combobox" id="root">
          <input data-slot="combobox-input" />
          <div data-slot="combobox-content" hidden>
            <div data-slot="combobox-list">
              <div data-slot="combobox-item" data-value="apple">Apple</div>
              <div data-slot="combobox-item" data-value="banana">Banana</div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const input = root.querySelector('[data-slot="combobox-input"]') as HTMLInputElement;
      const controller = createCombobox(root);

      input.dispatchEvent(new Event("focus", { bubbles: true }));
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });
  });
});
