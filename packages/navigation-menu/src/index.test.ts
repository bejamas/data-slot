import { describe, expect, it } from "bun:test";
import { createNavigationMenu, create } from "./index";

describe("NavigationMenu", () => {
  const setup = (options: Parameters<typeof createNavigationMenu>[1] = {}) => {
    document.body.innerHTML = `
      <nav data-slot="navigation-menu" id="root">
        <ul data-slot="navigation-menu-list">
          <li data-slot="navigation-menu-item" data-value="products">
            <button data-slot="navigation-menu-trigger">Products</button>
            <div data-slot="navigation-menu-content">Products content</div>
          </li>
          <li data-slot="navigation-menu-item" data-value="solutions">
            <button data-slot="navigation-menu-trigger">Solutions</button>
            <div data-slot="navigation-menu-content">Solutions content</div>
          </li>
          <li data-slot="navigation-menu-item" data-value="resources">
            <button data-slot="navigation-menu-trigger">Resources</button>
            <div data-slot="navigation-menu-content">Resources content</div>
          </li>
        </ul>
        <div data-slot="navigation-menu-viewport"></div>
      </nav>
    `;
    const root = document.getElementById("root")!;
    const triggers = document.querySelectorAll(
      '[data-slot="navigation-menu-trigger"]'
    ) as NodeListOf<HTMLElement>;
    const contents = document.querySelectorAll(
      '[data-slot="navigation-menu-content"]'
    ) as NodeListOf<HTMLElement>;
    const viewport = document.querySelector(
      '[data-slot="navigation-menu-viewport"]'
    ) as HTMLElement;
    const controller = createNavigationMenu(root, {
      delayOpen: 0,
      delayClose: 0,
      ...options,
    });

    return { root, triggers, contents, viewport, controller };
  };

  it("initializes with all content hidden", () => {
    const { contents, controller } = setup();

    contents.forEach((content) => {
      expect(content.hidden).toBe(true);
      expect(content.getAttribute("data-state")).toBe("inactive");
    });
    expect(controller.value).toBe(null);

    controller.destroy();
  });

  it("opens on programmatic open()", () => {
    const { contents, controller } = setup();

    controller.open("products");
    expect(contents[0]?.hidden).toBe(false);
    expect(contents[0]?.getAttribute("data-state")).toBe("active");
    expect(controller.value).toBe("products");

    controller.destroy();
  });

  it("closes on programmatic close()", () => {
    const { contents, controller } = setup();

    controller.open("products");
    expect(controller.value).toBe("products");

    controller.close();
    expect(controller.value).toBe(null);
    contents.forEach((content) => {
      expect(content.hidden).toBe(true);
    });

    controller.destroy();
  });

  it("switches between items", () => {
    const { contents, controller } = setup();

    controller.open("products");
    expect(contents[0]?.hidden).toBe(false);
    expect(contents[1]?.hidden).toBe(true);

    controller.open("solutions");
    expect(contents[0]?.hidden).toBe(true);
    expect(contents[1]?.hidden).toBe(false);
    expect(controller.value).toBe("solutions");

    controller.destroy();
  });

  it("sets ARIA attributes correctly", () => {
    const { triggers, contents, controller } = setup();

    const trigger = triggers[0]!;
    const content = contents[0]!;

    expect(trigger.getAttribute("aria-haspopup")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(content.id);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    controller.open("products");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    controller.destroy();
  });

  it("sets data-state on root and viewport", () => {
    const { root, viewport, controller } = setup();

    expect(root.getAttribute("data-state")).toBe("closed");
    expect(viewport.getAttribute("data-state")).toBe("closed");

    controller.open("products");
    expect(root.getAttribute("data-state")).toBe("open");
    expect(viewport.getAttribute("data-state")).toBe("open");

    controller.close();
    expect(root.getAttribute("data-state")).toBe("closed");
    expect(viewport.getAttribute("data-state")).toBe("closed");

    controller.destroy();
  });

  it("does NOT set data-motion on initial open", () => {
    const { root, contents, controller } = setup();

    controller.open("products");
    // Initial open should not have direction animation
    expect(root.getAttribute("data-motion")).toBeNull();
    expect(contents[0]?.getAttribute("data-motion")).toBeNull();

    controller.destroy();
  });

  it("sets data-motion direction when navigating right (switching)", () => {
    const { root, contents, controller } = setup();

    // Initial open - no motion
    controller.open("products");
    expect(root.getAttribute("data-motion")).toBeNull();

    // Navigate right (products -> solutions) - should have motion
    controller.open("solutions");
    expect(root.getAttribute("data-motion")).toBe("from-right");
    expect(contents[1]?.getAttribute("data-motion")).toBe("from-right");
    expect(contents[0]?.getAttribute("data-motion")).toBe("to-left");

    controller.destroy();
  });

  it("sets data-motion direction when navigating left (switching)", () => {
    const { root, contents, controller } = setup();

    // Open solutions first
    controller.open("solutions");
    // Switch to products (left direction)
    controller.open("products");

    // Navigate left (solutions -> products)
    expect(root.getAttribute("data-motion")).toBe("from-left");
    expect(contents[0]?.getAttribute("data-motion")).toBe("from-left");
    expect(contents[1]?.getAttribute("data-motion")).toBe("to-right");

    controller.destroy();
  });

  it("sets CSS variables on viewport when switching", () => {
    const { viewport, controller } = setup();

    // Initial open - no motion direction set
    controller.open("products");
    // Motion direction is not set on initial open
    expect(viewport.style.getPropertyValue("--motion-direction")).toBe("");

    // Navigate right (products -> solutions)
    controller.open("solutions");
    expect(viewport.style.getPropertyValue("--motion-direction")).toBe("1");

    // Navigate left (solutions -> products)
    controller.open("products");
    expect(viewport.style.getPropertyValue("--motion-direction")).toBe("-1");

    controller.destroy();
  });

  it("emits navigation-menu:change event", () => {
    const { root, controller } = setup();

    let lastValue: string | null | undefined;
    root.addEventListener("navigation-menu:change", (e) => {
      lastValue = (e as CustomEvent).detail.value;
    });

    controller.open("products");
    expect(lastValue).toBe("products");

    controller.close();
    expect(lastValue).toBe(null);

    controller.destroy();
  });

  it("calls onValueChange callback", () => {
    let lastValue: string | null | undefined;
    const { controller } = setup({
      onValueChange: (value) => {
        lastValue = value;
      },
    });

    controller.open("products");
    expect(lastValue).toBe("products");

    controller.open("solutions");
    expect(lastValue).toBe("solutions");

    controller.close();
    expect(lastValue).toBe(null);

    controller.destroy();
  });

  it("closes on Escape key", () => {
    const { triggers, controller } = setup();

    // Focus trigger so isMenuActive() returns true
    triggers[0]?.focus();
    controller.open("products");
    expect(controller.value).toBe("products");

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(controller.value).toBe(null);

    controller.destroy();
  });

  it("closes on click outside", () => {
    const { triggers, controller } = setup();

    // Focus trigger so isMenuActive() returns true
    triggers[0]?.focus();
    controller.open("products");
    expect(controller.value).toBe("products");

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true })
    );
    expect(controller.value).toBe(null);

    controller.destroy();
  });

  it("handles keyboard navigation with ArrowRight", () => {
    const { triggers, controller } = setup();

    triggers[0]?.focus();
    controller.open("products");

    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );

    expect(document.activeElement).toBe(triggers[1]);

    controller.destroy();
  });

  it("handles keyboard navigation with ArrowLeft", () => {
    const { triggers, controller } = setup();

    triggers[1]?.focus();
    controller.open("solutions");

    triggers[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );

    expect(document.activeElement).toBe(triggers[0]);

    controller.destroy();
  });

  it("wraps keyboard navigation at edges", () => {
    const { triggers, controller } = setup();

    triggers[0]?.focus();
    controller.open("products");

    // ArrowLeft from first should go to last
    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
    expect(document.activeElement).toBe(triggers[2]);

    // ArrowRight from last should go to first
    triggers[2]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    expect(document.activeElement).toBe(triggers[0]);

    controller.destroy();
  });

  it("Home key focuses first trigger", () => {
    const { triggers, controller } = setup();

    triggers[2]?.focus();

    triggers[2]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true })
    );

    expect(document.activeElement).toBe(triggers[0]);

    controller.destroy();
  });

  it("End key focuses last trigger", () => {
    const { triggers, controller } = setup();

    triggers[0]?.focus();

    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true })
    );

    expect(document.activeElement).toBe(triggers[2]);

    controller.destroy();
  });

  it("create() binds all navigation menu components", () => {
    document.body.innerHTML = `
      <nav data-slot="navigation-menu">
        <ul data-slot="navigation-menu-list">
          <li data-slot="navigation-menu-item" data-value="test">
            <button data-slot="navigation-menu-trigger">Test</button>
            <div data-slot="navigation-menu-content">Test content</div>
          </li>
        </ul>
      </nav>
    `;

    const controllers = create();
    expect(controllers).toHaveLength(1);

    const content = document.querySelector(
      '[data-slot="navigation-menu-content"]'
    ) as HTMLElement;
    expect(content.hidden).toBe(true);

    controllers[0]?.open("test");
    expect(content.hidden).toBe(false);

    controllers.forEach((c) => c.destroy());
  });

  // Content keyboard navigation tests
  describe("content keyboard navigation", () => {
    // Helper to flush requestAnimationFrame
    const flushRAF = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const setupWithLinks = () => {
      document.body.innerHTML = `
        <nav data-slot="navigation-menu" id="root">
          <ul data-slot="navigation-menu-list">
            <li data-slot="navigation-menu-item" data-value="products">
              <button data-slot="navigation-menu-trigger">Products</button>
              <div data-slot="navigation-menu-content">
                <a href="#" id="link1">Link 1</a>
                <a href="#" id="link2">Link 2</a>
                <a href="#" id="link3">Link 3</a>
              </div>
            </li>
            <li data-slot="navigation-menu-item" data-value="solutions">
              <button data-slot="navigation-menu-trigger">Solutions</button>
              <div data-slot="navigation-menu-content">
                <button id="btn1">Button 1</button>
                <button id="btn2">Button 2</button>
              </div>
            </li>
          </ul>
          <div data-slot="navigation-menu-viewport"></div>
        </nav>
      `;
      const root = document.getElementById("root")!;
      const triggers = document.querySelectorAll(
        '[data-slot="navigation-menu-trigger"]'
      ) as NodeListOf<HTMLElement>;
      const contents = document.querySelectorAll(
        '[data-slot="navigation-menu-content"]'
      ) as NodeListOf<HTMLElement>;
      const link1 = document.getElementById("link1") as HTMLElement;
      const link2 = document.getElementById("link2") as HTMLElement;
      const link3 = document.getElementById("link3") as HTMLElement;
      const controller = createNavigationMenu(root, {
        delayOpen: 0,
        delayClose: 0,
      });

      return { root, triggers, contents, link1, link2, link3, controller };
    };

    it("ArrowDown from trigger moves focus to first content element", async () => {
      const { triggers, link1, controller } = setupWithLinks();

      triggers[0]?.focus();
      controller.open("products");

      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      // Focus happens in requestAnimationFrame
      await flushRAF();
      expect(document.activeElement).toBe(link1);

      controller.destroy();
    });

    it("ArrowDown navigates through content elements", async () => {
      const { triggers, link1, link2, link3, controller } = setupWithLinks();

      triggers[0]?.focus();
      controller.open("products");

      // Move into content
      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      await flushRAF();
      expect(document.activeElement).toBe(link1);

      // Navigate to second link
      link1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(document.activeElement).toBe(link2);

      // Navigate to third link
      link2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(document.activeElement).toBe(link3);

      controller.destroy();
    });

    it("ArrowUp from first content element returns focus to trigger", async () => {
      const { triggers, link1, controller } = setupWithLinks();

      triggers[0]?.focus();
      controller.open("products");

      // Move into content
      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      await flushRAF();
      expect(document.activeElement).toBe(link1);

      // ArrowUp should return to trigger
      link1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      expect(document.activeElement).toBe(triggers[0]);

      controller.destroy();
    });

    it("ArrowUp navigates backwards through content elements", async () => {
      const { triggers, link1, link2, link3, controller } = setupWithLinks();

      triggers[0]?.focus();
      controller.open("products");

      // Move into content and to the last link
      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      await flushRAF();
      link1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      link2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      expect(document.activeElement).toBe(link3);

      // Navigate backwards
      link3.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      expect(document.activeElement).toBe(link2);

      link2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
      expect(document.activeElement).toBe(link1);

      controller.destroy();
    });

    it("Escape from content closes menu and returns focus to trigger", async () => {
      const { triggers, link1, controller } = setupWithLinks();

      triggers[0]?.focus();
      controller.open("products");

      // Move into content
      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      await flushRAF();
      expect(document.activeElement).toBe(link1);

      // Escape should close and return to trigger
      link1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(controller.value).toBe(null);
      expect(document.activeElement).toBe(triggers[0]);

      controller.destroy();
    });

    it("ArrowDown does nothing when content has no focusable elements", () => {
      // Use the basic setup without focusable elements in content
      const { triggers, controller } = setup();

      triggers[0]?.focus();
      controller.open("products");

      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );

      // Should stay on trigger since content has no focusable elements
      expect(document.activeElement).toBe(triggers[0]);

      controller.destroy();
    });

    it("ArrowRight navigates through content elements", async () => {
      const { triggers, link1, link2, link3, controller } = setupWithLinks();

      triggers[0]?.focus();
      controller.open("products");

      // Move into content
      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      await flushRAF();
      expect(document.activeElement).toBe(link1);

      // Navigate with ArrowRight
      link1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      expect(document.activeElement).toBe(link2);

      link2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      expect(document.activeElement).toBe(link3);

      controller.destroy();
    });

    it("ArrowLeft navigates backwards through content elements", async () => {
      const { triggers, link1, link2, link3, controller } = setupWithLinks();

      triggers[0]?.focus();
      controller.open("products");

      // Move into content and navigate to last link
      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      await flushRAF();
      link1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      link2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      expect(document.activeElement).toBe(link3);

      // Navigate backwards with ArrowLeft
      link3.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
      );
      expect(document.activeElement).toBe(link2);

      link2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
      );
      expect(document.activeElement).toBe(link1);

      controller.destroy();
    });

    it("ArrowLeft from first content element returns focus to trigger", async () => {
      const { triggers, link1, controller } = setupWithLinks();

      triggers[0]?.focus();
      controller.open("products");

      // Move into content
      triggers[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
      await flushRAF();
      expect(document.activeElement).toBe(link1);

      // ArrowLeft should return to trigger
      link1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
      );
      expect(document.activeElement).toBe(triggers[0]);

      controller.destroy();
    });
  });
});

