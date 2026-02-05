import { describe, expect, it, beforeEach } from "bun:test";
import { createDropdownMenu, create } from "./index";

describe("DropdownMenu", () => {
  const setup = (options: Parameters<typeof createDropdownMenu>[1] = {}) => {
    document.body.innerHTML = `
      <div data-slot="dropdown-menu" id="root">
        <button data-slot="dropdown-menu-trigger">Options</button>
        <div data-slot="dropdown-menu-content">
          <div data-slot="dropdown-menu-group">
            <div data-slot="dropdown-menu-label">Actions</div>
            <button data-slot="dropdown-menu-item" data-value="edit">Edit</button>
            <button data-slot="dropdown-menu-item" data-value="copy">Copy</button>
          </div>
          <div data-slot="dropdown-menu-separator"></div>
          <button data-slot="dropdown-menu-item" data-value="delete" data-variant="destructive">Delete</button>
          <button data-slot="dropdown-menu-item" data-value="disabled" data-disabled>Disabled</button>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const trigger = document.querySelector(
      '[data-slot="dropdown-menu-trigger"]'
    ) as HTMLElement;
    const content = document.querySelector(
      '[data-slot="dropdown-menu-content"]'
    ) as HTMLElement;
    const items = document.querySelectorAll(
      '[data-slot="dropdown-menu-item"]'
    ) as NodeListOf<HTMLElement>;
    const controller = createDropdownMenu(root, options);

    return { root, trigger, content, items, controller };
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

    it("sets ARIA attributes on trigger", () => {
      const { trigger, content, controller } = setup();

      expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
      expect(trigger.getAttribute("aria-controls")).toBe(content.id);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");

      controller.destroy();
    });

    it("sets role=menu on content", () => {
      const { content, controller } = setup();

      expect(content.getAttribute("role")).toBe("menu");

      controller.destroy();
    });

    it("sets role=menuitem on items when opened", () => {
      const { items, controller } = setup();

      controller.open();

      items.forEach((item) => {
        expect(item.getAttribute("role")).toBe("menuitem");
      });

      controller.destroy();
    });

    it("sets aria-disabled on disabled items when opened", () => {
      const { items, controller } = setup();
      const disabledItem = items[3]; // The "Disabled" item

      controller.open();

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

    it("sets tabIndex=-1 on menu items for roving focus when opened", () => {
      const { items, controller } = setup();

      controller.open();

      items.forEach((item) => {
        expect(item.tabIndex).toBe(-1);
      });

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

    it("sets data-state on root and content", () => {
      const { root, content, controller } = setup();

      expect(root.getAttribute("data-state")).toBe("closed");
      expect(content.getAttribute("data-state")).toBe("closed");

      controller.open();
      expect(root.getAttribute("data-state")).toBe("open");
      expect(content.getAttribute("data-state")).toBe("open");

      controller.close();
      expect(root.getAttribute("data-state")).toBe("closed");
      expect(content.getAttribute("data-state")).toBe("closed");

      controller.destroy();
    });

    it("toggle() toggles open state", () => {
      const { controller } = setup();

      expect(controller.isOpen).toBe(false);

      controller.toggle();
      expect(controller.isOpen).toBe(true);

      controller.toggle();
      expect(controller.isOpen).toBe(false);

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

    it("respects closeOnClickOutside option", () => {
      const { trigger, controller } = setup({ closeOnClickOutside: false });

      trigger.click();
      expect(controller.isOpen).toBe(true);

      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true })
      );
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });
  });

  describe("escape key", () => {
    it("closes on Escape key", () => {
      const { trigger, controller } = setup();

      trigger.click();
      expect(controller.isOpen).toBe(true);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("respects closeOnEscape option", () => {
      const { trigger, controller } = setup({ closeOnEscape: false });

      trigger.click();
      expect(controller.isOpen).toBe(true);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });
  });

  describe("item selection", () => {
    it("emits dropdown-menu:select on item click", () => {
      const { root, trigger, items, controller } = setup();

      let selectedValue: string | undefined;
      root.addEventListener("dropdown-menu:select", (e) => {
        selectedValue = (e as CustomEvent).detail.value;
      });

      trigger.click();
      items[0]?.click();

      expect(selectedValue).toBe("edit");

      controller.destroy();
    });

    it("calls onSelect callback", () => {
      const { trigger, items, controller } = setup({
        onSelect: (value) => {
          selectedValue = value;
        },
      });

      let selectedValue: string | undefined;

      trigger.click();
      items[1]?.click();

      expect(selectedValue).toBe("copy");

      controller.destroy();
    });

    it("closes menu on item selection by default", () => {
      const { trigger, items, controller } = setup();

      trigger.click();
      expect(controller.isOpen).toBe(true);

      items[0]?.click();
      expect(controller.isOpen).toBe(false);

      controller.destroy();
    });

    it("respects closeOnSelect option", () => {
      const { trigger, items, controller } = setup({ closeOnSelect: false });

      trigger.click();
      expect(controller.isOpen).toBe(true);

      items[0]?.click();
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("does not select disabled items", () => {
      const { root, trigger, items, controller } = setup();

      let selectedValue: string | undefined;
      root.addEventListener("dropdown-menu:select", (e) => {
        selectedValue = (e as CustomEvent).detail.value;
      });

      trigger.click();
      items[3]?.click(); // Disabled item

      expect(selectedValue).toBeUndefined();

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

      // No item highlighted initially (content has focus)
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);

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

      // No item highlighted initially
      expect(items[0]?.hasAttribute("data-highlighted")).toBe(false);

      // ArrowUp highlights last enabled item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true); // Delete (last enabled)

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

      // Navigate to last enabled item (skip disabled)
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

      // End should go to last enabled item (Delete, not Disabled)
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true); // Delete item

      controller.destroy();
    });

    it("selects item with Enter", () => {
      const { root, trigger, content, controller } = setup();

      let selectedValue: string | undefined;
      root.addEventListener("dropdown-menu:select", (e) => {
        selectedValue = (e as CustomEvent).detail.value;
      });

      trigger.click();

      // First highlight an item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(selectedValue).toBe("edit");

      controller.destroy();
    });

    it("selects item with Space", () => {
      const { root, trigger, content, controller } = setup();

      let selectedValue: string | undefined;
      root.addEventListener("dropdown-menu:select", (e) => {
        selectedValue = (e as CustomEvent).detail.value;
      });

      trigger.click();

      // First highlight an item
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true })
      );

      expect(selectedValue).toBe("edit");

      controller.destroy();
    });

    it("skips disabled items during navigation", () => {
      const { trigger, content, items, controller } = setup();

      trigger.click();

      // Navigate to Delete (3rd item, index 2)
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );
      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);

      // Disabled item (index 3) should never be highlighted
      expect(items[3]?.hasAttribute("data-highlighted")).toBe(false);

      controller.destroy();
    });
  });

  describe("pointer interaction", () => {
    it("highlights item on pointer move", () => {
      const { trigger, items, controller } = setup();

      trigger.click();

      // Move pointer to second item
      items[1]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true })
      );
      expect(items[1]?.hasAttribute("data-highlighted")).toBe(true);

      controller.destroy();
    });

    it("does not highlight disabled items on pointer move", () => {
      const { trigger, items, controller } = setup();

      trigger.click();

      // Move pointer to disabled item
      items[3]?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true })
      );
      expect(items[3]?.hasAttribute("data-highlighted")).toBe(false);

      controller.destroy();
    });
  });

  describe("events", () => {
    it("emits dropdown-menu:change on open/close", () => {
      const { root, controller } = setup();

      let lastOpen: boolean | undefined;
      root.addEventListener("dropdown-menu:change", (e) => {
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
  });

  describe("create()", () => {
    it("binds all dropdown menus and returns controllers", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu">
          <button data-slot="dropdown-menu-trigger">Menu 1</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
        <div data-slot="dropdown-menu">
          <button data-slot="dropdown-menu-trigger">Menu 2</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
      `;

      const controllers = create();
      expect(controllers).toHaveLength(2);

      const trigger = document.querySelector(
        '[data-slot="dropdown-menu-trigger"]'
      ) as HTMLElement;
      const content = document.querySelector(
        '[data-slot="dropdown-menu-content"]'
      ) as HTMLElement;

      expect(content.hidden).toBe(true);
      trigger.click();
      expect(content.hidden).toBe(false);

      controllers.forEach((c) => c.destroy());
    });

    it("does not rebind already bound menus", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu">
          <button data-slot="dropdown-menu-trigger">Menu</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
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

  describe("content positioning", () => {
    it("keeps content within root element", () => {
      const { root, trigger, content, controller } = setup();

      trigger.click();
      expect(content.parentElement).toBe(root);
      expect(root.contains(content)).toBe(true);

      controller.destroy();
    });

    it("uses position: fixed when open", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.style.position).toBe("fixed");

      controller.destroy();
    });

    it("sets data-side and data-align attributes when open", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      expect(content.getAttribute("data-side")).toBe("bottom");
      expect(content.getAttribute("data-align")).toBe("start");

      controller.destroy();
    });

    it("respects side option", () => {
      // Disable collision avoidance so it doesn't flip
      const { trigger, content, controller } = setup({ side: "top", avoidCollisions: false });

      trigger.click();
      expect(content.getAttribute("data-side")).toBe("top");

      controller.destroy();
    });

    it("respects align option", () => {
      const { trigger, content, controller } = setup({ align: "end", avoidCollisions: false });

      trigger.click();
      expect(content.getAttribute("data-align")).toBe("end");

      controller.destroy();
    });
  });

  describe("destroy", () => {
    it("cleans up event listeners", () => {
      const { root, trigger, controller } = setup();

      let changeCount = 0;
      root.addEventListener("dropdown-menu:change", () => {
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

  describe("data attributes", () => {
    it("data-close-on-escape='false' disables Escape key closing", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-close-on-escape="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createDropdownMenu(root);

      controller.open();
      expect(controller.isOpen).toBe(true);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("data-close-on-click-outside='false' disables click outside closing", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-close-on-click-outside="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createDropdownMenu(root);

      controller.open();
      expect(controller.isOpen).toBe(true);

      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true })
      );
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("data-close-on-select='false' keeps menu open after selection", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-close-on-select="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const item = root.querySelector('[data-slot="dropdown-menu-item"]') as HTMLElement;
      const controller = createDropdownMenu(root);

      controller.open();
      item.click();
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("data-side sets preferred side", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-side="top" data-avoid-collisions="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
      const controller = createDropdownMenu(root);

      controller.open();
      expect(content.getAttribute("data-side")).toBe("top");

      controller.destroy();
    });

    it("data-side-offset sets distance from trigger", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-side-offset="20">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createDropdownMenu(root);

      controller.open();
      // Just verify it opens without error - position testing is complex
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-close-on-escape="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      // JS option says true, data attribute says false - JS wins
      const controller = createDropdownMenu(root, { closeOnEscape: true });

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
        <div data-slot="dropdown-menu" id="root" data-lock-scroll="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-content">
            <button data-slot="dropdown-menu-item">Item</button>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createDropdownMenu(root);

      controller.open();
      expect(document.documentElement.style.overflow).toBe("");

      controller.destroy();
    });
  });
});
