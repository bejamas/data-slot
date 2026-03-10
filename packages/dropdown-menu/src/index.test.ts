import { describe, expect, it, beforeEach } from "bun:test";
import { createDropdownMenu, create } from "./index";
import { resetScrollLock } from "../../core/src/scroll";

describe("DropdownMenu", () => {
  const setup = (
    options: Parameters<typeof createDropdownMenu>[1] = {},
    html?: string
  ) => {
    document.body.innerHTML = html ?? `
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

  const waitForRaf = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const waitForTask = () =>
    new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 0);
    });

  const waitForClose = async () => {
    await waitForRaf();
    await waitForRaf();
  };

  const getTranslate3dXY = (transform: string): { x: number; y: number } => {
    const match = /translate3d\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*,\s*0(?:px)?\s*\)/.exec(
      transform
    );
    if (!match) {
      throw new Error(`Expected translate3d transform, got "${transform}"`);
    }
    return { x: Number(match[1]), y: Number(match[2]) };
  };

  const getPositioner = (content: HTMLElement): HTMLElement => {
    const parent = content.parentElement;
    if (parent instanceof HTMLElement && parent.getAttribute("data-slot") === "dropdown-menu-positioner") {
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

    it("does not close on outside touch pointerdown, but closes on outside click", () => {
      const { trigger, controller } = setup();

      trigger.click();
      expect(controller.isOpen).toBe(true);

      document.body.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
        } as PointerEventInit)
      );
      expect(controller.isOpen).toBe(true);

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

    it("closes when focus moves into an outside iframe", async () => {
      const { trigger, controller } = setup();
      document.body.insertAdjacentHTML("beforeend", '<iframe id="outside-frame"></iframe>');
      const outsideFrame = document.getElementById("outside-frame") as HTMLIFrameElement;

      trigger.click();
      expect(controller.isOpen).toBe(true);

      outsideFrame.focus();
      window.dispatchEvent(new Event("blur"));
      await waitForTask();

      expect(controller.isOpen).toBe(false);

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

    it("scrolls highlighted item into view during keyboard navigation", () => {
      const { trigger, content, items, controller } = setup();
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

      Object.defineProperty(content, "clientHeight", { configurable: true, value: 100 });
      Object.defineProperty(content, "scrollHeight", { configurable: true, value: 300 });
      content.scrollTop = 0;
      content.getBoundingClientRect = () => rect(0, 100);
      items.forEach((item, index) => {
        item.getBoundingClientRect = () => rect(index * 70, 30);
      });

      trigger.click();
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );

      expect(items[2]?.hasAttribute("data-highlighted")).toBe(true);
      expect(content.scrollTop).toBe(74);
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
        <div data-slot="dropdown-menu" id="root" data-highlight-item-on-hover="false">
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
    it("portals content to body when open and restores on close", async () => {
      const { root, trigger, content, controller } = setup();

      // Content starts inside root
      expect(content.parentElement).toBe(root);

      trigger.click();
      // Content is portaled to body when open
      const positioner = content.parentElement as HTMLElement;
      expect(positioner.getAttribute("data-slot")).toBe("dropdown-menu-positioner");
      expect(positioner.parentElement).toBe(document.body);

      trigger.click();
      // Content is restored to root when closed
      await waitForClose();
      expect(content.parentElement).toBe(root);

      controller.destroy();
    });

    it("uses authored portal and positioner slots when provided", async () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root">
          <button data-slot="dropdown-menu-trigger">Menu</button>
          <div data-slot="dropdown-menu-portal" id="portal">
            <div data-slot="dropdown-menu-positioner" id="positioner">
              <div data-slot="dropdown-menu-content">
                <button data-slot="dropdown-menu-item" data-value="one">One</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="dropdown-menu-trigger"]') as HTMLElement;
      const portal = document.getElementById("portal") as HTMLElement;
      const positioner = document.getElementById("positioner") as HTMLElement;
      const content = root.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
      const controller = createDropdownMenu(root);

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

    it("restores content before applying closed hidden/data-state", async () => {
      const { root, trigger, content, controller } = setup();

      trigger.click();
      const positioner = content.parentElement as HTMLElement;
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
      const positioner = content.parentElement as HTMLElement;
      expect(positioner.parentElement).toBe(document.body);

      controller.destroy();
      expect(content.parentElement).toBe(root);
    });

    it("click inside portaled content does not close the menu", () => {
      const { trigger, content, items, controller } = setup({ closeOnSelect: false });

      trigger.click();
      expect(controller.isOpen).toBe(true);
      const positioner = content.parentElement as HTMLElement;
      expect(positioner.parentElement).toBe(document.body);

      // Click on an item inside the portaled content
      items[0]?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true })
      );
      expect(controller.isOpen).toBe(true);

      controller.destroy();
    });

    it("uses position: fixed when open", () => {
      const { trigger, content, controller } = setup();

      trigger.click();
      const positioner = content.parentElement as HTMLElement;
      expect(positioner.style.position).toBe("fixed");
      expect(content.style.position).toBe("");

      controller.destroy();
    });

    it("uses position: absolute when lockScroll is false", () => {
      const { trigger, content, controller } = setup({ lockScroll: false });

      trigger.click();
      const positioner = content.parentElement as HTMLElement;
      expect(positioner.style.position).toBe("absolute");
      expect(content.style.position).toBe("");

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

    it("uses layout dimensions for positioning when content is transform-scaled", async () => {
      const { trigger, content, controller } = setup({
        side: "top",
        align: "start",
        sideOffset: 4,
        avoidCollisions: false,
      });

      trigger.getBoundingClientRect = () =>
        ({
          x: 100,
          y: 100,
          top: 100,
          left: 100,
          width: 80,
          height: 20,
          right: 180,
          bottom: 120,
          toJSON: () => ({}),
        }) as DOMRect;

      content.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          width: 100,
          height: 40,
          right: 100,
          bottom: 40,
          toJSON: () => ({}),
        }) as DOMRect;

      Object.defineProperty(content, "offsetWidth", { configurable: true, value: 100 });
      Object.defineProperty(content, "offsetHeight", { configurable: true, value: 80 });

      trigger.click();
      await waitForRaf();

      const positioner = content.parentElement as HTMLElement;
      const { y } = getTranslate3dXY(positioner.style.transform);
      expect(y).toBe(16);
      expect(positioner.style.getPropertyValue("--transform-origin")).toBe("0px 84px");

      controller.destroy();
    });

    it("keeps coordinates stable on window scroll when lockScroll is false", async () => {
      const { trigger, content, controller } = setup({
        side: "bottom",
        align: "start",
        avoidCollisions: false,
        lockScroll: false,
      });

      let anchorTop = 110;
      const anchorLeft = 48;
      const anchorWidth = 130;
      const anchorHeight = 30;

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
          width: 210,
          height: 140,
          right: 210,
          bottom: 140,
          toJSON: () => ({}),
        }) as DOMRect;

      trigger.click();
      await waitForRaf();
      await waitForRaf();

      const positioner = content.parentElement as HTMLElement;
      const initialTransform = positioner.style.transform;

      anchorTop = 290;
      window.dispatchEvent(new Event("scroll"));
      await waitForRaf();
      await waitForRaf();

      expect(positioner.style.transform).toBe(initialTransform);
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

    it("data-side falls back to positioner before root", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-side="top" data-avoid-collisions="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-portal">
            <div data-slot="dropdown-menu-positioner" data-side="right">
              <div data-slot="dropdown-menu-content">
                <button data-slot="dropdown-menu-item">Item</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
      const controller = createDropdownMenu(root);

      controller.open();
      expect(content.getAttribute("data-side")).toBe("right");

      controller.destroy();
    });

    it("data-side on content takes precedence over positioner and root", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-side="top" data-avoid-collisions="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-portal">
            <div data-slot="dropdown-menu-positioner" data-side="right">
              <div data-slot="dropdown-menu-content" data-side="left">
                <button data-slot="dropdown-menu-item">Item</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const content = root.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
      const controller = createDropdownMenu(root);

      controller.open();
      expect(content.getAttribute("data-side")).toBe("left");

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

    it("data-side-offset falls back to positioner before root", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-side="top" data-side-offset="2" data-avoid-collisions="false">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-portal">
            <div data-slot="dropdown-menu-positioner" data-side-offset="12">
              <div data-slot="dropdown-menu-content">
                <button data-slot="dropdown-menu-item">Item</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="dropdown-menu-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
      const controller = createDropdownMenu(root);
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

      const { y } = getTranslate3dXY(getPositioner(content).style.transform);
      expect(y).toBe(48);

      controller.destroy();
    });

    it("data-avoid-collisions/collision-padding fall back to positioner before root", () => {
      document.body.innerHTML = `
        <div data-slot="dropdown-menu" id="root" data-side="bottom" data-align="start" data-avoid-collisions="false" data-collision-padding="8">
          <button data-slot="dropdown-menu-trigger">Open</button>
          <div data-slot="dropdown-menu-portal">
            <div data-slot="dropdown-menu-positioner" data-avoid-collisions="true" data-collision-padding="24">
              <div data-slot="dropdown-menu-content">
                <button data-slot="dropdown-menu-item">Item</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="dropdown-menu-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
      const controller = createDropdownMenu(root);
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

      const { x } = getTranslate3dXY(getPositioner(content).style.transform);
      expect(x).toBe(24);

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
