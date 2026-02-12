import { describe, expect, it } from "bun:test";
import { createNavigationMenu, create } from "./index";

describe("NavigationMenu", () => {
  const waitForPresenceExit = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

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

  const getViewportPositioner = (viewport: HTMLElement): HTMLElement => {
    const parent = viewport.parentElement;
    if (!(parent instanceof HTMLElement)) {
      throw new Error("Expected viewport to have a parent element");
    }
    if (parent.getAttribute("data-slot") !== "navigation-menu-viewport-positioner") {
      throw new Error("Expected viewport to be wrapped by navigation-menu-viewport-positioner");
    }
    return parent;
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
    const { contents, viewport, controller } = setup();
    const originalParent = contents[0]?.parentElement;

    controller.open("products");
    expect(contents[0]?.hidden).toBe(false);
    expect(contents[0]?.getAttribute("data-state")).toBe("active");
    expect(contents[0]?.parentElement).toBe(viewport);
    expect(originalParent?.contains(contents[0]!)).toBe(false);
    const viewportPositioner = getViewportPositioner(viewport);
    expect(viewportPositioner.parentElement).toBe(document.body);
    expect(controller.value).toBe("products");

    controller.destroy();
  });

  it("closes on programmatic close()", async () => {
    const { contents, viewport, controller } = setup();
    const originalParent = contents[0]?.parentElement;

    controller.open("products");
    expect(controller.value).toBe("products");

    controller.close();
    expect(controller.value).toBe(null);
    await waitForPresenceExit();
    contents.forEach((content) => {
      expect(content.hidden).toBe(true);
    });
    expect(contents[0]?.parentElement).toBe(originalParent);
    expect(viewport.closest('[data-slot="navigation-menu-viewport-positioner"]')).toBeNull();

    controller.destroy();
  });

  it("switches between items", async () => {
    const { contents, controller } = setup();
    const originalFirstParent = contents[0]?.parentElement;
    const originalSecondParent = contents[1]?.parentElement;

    controller.open("products");
    expect(contents[0]?.hidden).toBe(false);
    expect(contents[0]?.parentElement).not.toBe(originalFirstParent);
    expect(contents[1]?.hidden).toBe(true);

    controller.open("solutions");
    await waitForPresenceExit();
    expect(contents[0]?.hidden).toBe(true);
    expect(contents[0]?.parentElement).toBe(originalFirstParent);
    expect(contents[1]?.hidden).toBe(false);
    expect(contents[1]?.parentElement).not.toBe(originalSecondParent);
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

  it("does not close on Escape when menu is open but inactive", () => {
    const { controller } = setup();

    controller.open("products");
    expect(controller.value).toBe("products");

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(controller.value).toBe("products");

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

  it("does not close on click outside when menu is open but inactive", () => {
    const { controller } = setup();

    controller.open("products");
    expect(controller.value).toBe("products");

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true })
    );
    expect(controller.value).toBe("products");

    controller.destroy();
  });

  it("closes when focus leaves root", () => {
    const { triggers, controller } = setup();

    const outside = document.createElement("button");
    document.body.appendChild(outside);

    triggers[0]?.focus();
    controller.open("products");
    expect(controller.value).toBe("products");

    outside.focus();
    expect(controller.value).toBe(null);

    controller.destroy();
  });

  it("closes when pointer leaves portaled content to outside", async () => {
    const { root, contents, controller } = setup({ delayClose: 0 });
    controller.open("products");

    const content = contents[0]!;
    content.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    content.dispatchEvent(
      new PointerEvent("pointerleave", {
        bubbles: true,
        relatedTarget: document.body,
      } as PointerEventInit)
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.value).toBe(null);
    expect(root.getAttribute("data-state")).toBe("closed");

    controller.destroy();
  });

  it("stays open when pointer leaves root into portaled content", () => {
    const { root, contents, controller } = setup({ delayClose: 0 });
    controller.open("products");
    expect(controller.value).toBe("products");

    const content = contents[0]!;
    root.dispatchEvent(
      new PointerEvent("pointerleave", {
        bubbles: true,
        relatedTarget: content,
      } as PointerEventInit)
    );

    expect(controller.value).toBe("products");
    expect(root.getAttribute("data-state")).toBe("open");

    controller.destroy();
  });

  it("bridges side-offset gap between root and viewport", async () => {
    const { root, triggers, contents, viewport, controller } = setup({ delayClose: 30 });
    const trigger = triggers[0]!;
    const content = contents[0]!;

    const rect = (left: number, top: number, width: number, height: number): DOMRect =>
      ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      }) as DOMRect;

    root.getBoundingClientRect = () => rect(100, 100, 400, 40);
    trigger.getBoundingClientRect = () => rect(120, 100, 140, 40);
    content.getBoundingClientRect = () => rect(0, 0, 300, 180);
    // Simulate a 12px side-offset gap from root bottom (140) to viewport top (152)
    viewport.getBoundingClientRect = () => rect(100, 152, 300, 180);

    controller.open("products");
    await waitForPresenceExit();

    const viewportPositioner = getViewportPositioner(viewport);
    const bridge = viewportPositioner.querySelector(
      '[data-slot="navigation-menu-bridge"]'
    ) as HTMLElement;

    expect(bridge).toBeTruthy();
    expect(bridge.parentElement).toBe(viewportPositioner);
    expect(bridge.style.height).toBe("12px");
    expect(bridge.style.width).toBe("300px");
    expect(bridge.style.top).toBe("28px");
    expect(bridge.style.left).toBe("20px");
    expect(bridge.style.transform).toBe("none");

    // Simulate leaving root across the gap; entering the bridge should cancel delayed close.
    root.dispatchEvent(
      new PointerEvent("pointerleave", {
        bubbles: true,
        relatedTarget: null,
      } as PointerEventInit)
    );
    bridge.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(controller.value).toBe("products");

    controller.destroy();
  });

  it("uses intrinsic content dimensions when transformed content rect is smaller", async () => {
    const { root, triggers, contents, viewport, controller } = setup({ align: "center" });
    const trigger = triggers[0]!;
    const content = contents[0]!;

    const rect = (left: number, top: number, width: number, height: number): DOMRect =>
      ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      }) as DOMRect;

    root.getBoundingClientRect = () => rect(100, 100, 400, 40);
    trigger.getBoundingClientRect = () => rect(120, 100, 100, 40);
    // Simulate transform-shrunken visual rect during enter animation.
    content.getBoundingClientRect = () => rect(0, 0, 190, 171);
    Object.defineProperty(content, "scrollWidth", {
      configurable: true,
      get: () => 200,
    });
    Object.defineProperty(content, "scrollHeight", {
      configurable: true,
      get: () => 180,
    });

    controller.open("products");
    await waitForPresenceExit();

    expect(viewport.style.getPropertyValue("--viewport-width")).toBe("200px");
    expect(viewport.style.getPropertyValue("--viewport-height")).toBe("180px");
    expect(viewport.style.top).toBe("0px");
    expect(viewport.style.left).toBe("0px");
    expect(viewport.style.transform).toBe("translate3d(-30px, 40px, 0)");

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

  it("uses authored portal/positioner slots when provided", async () => {
    document.body.innerHTML = `
      <nav data-slot="navigation-menu" id="root">
        <ul data-slot="navigation-menu-list">
          <li data-slot="navigation-menu-item" data-value="products">
            <button data-slot="navigation-menu-trigger">Products</button>
            <div data-slot="navigation-menu-portal" id="content-portal">
              <div data-slot="navigation-menu-positioner" id="content-positioner">
                <div data-slot="navigation-menu-content">Products content</div>
              </div>
            </div>
          </li>
        </ul>
        <div data-slot="navigation-menu-portal" id="viewport-portal">
          <div data-slot="navigation-menu-viewport-positioner" id="viewport-positioner">
            <div data-slot="navigation-menu-viewport"></div>
          </div>
        </div>
      </nav>
    `;
    const root = document.getElementById("root")!;
    const contentPortal = document.getElementById("content-portal") as HTMLElement;
    const contentPositioner = document.getElementById("content-positioner") as HTMLElement;
    const viewportPortal = document.getElementById("viewport-portal") as HTMLElement;
    const viewportPositioner = document.getElementById("viewport-positioner") as HTMLElement;
    const content = root.querySelector('[data-slot="navigation-menu-content"]') as HTMLElement;
    const viewport = root.querySelector('[data-slot="navigation-menu-viewport"]') as HTMLElement;
    const controller = createNavigationMenu(root, { delayOpen: 0, delayClose: 0 });

    controller.open("products");
    expect(contentPortal.parentElement).toBe(root.querySelector('[data-slot="navigation-menu-item"]'));
    expect(viewportPortal.parentElement).toBe(document.body);
    expect(content.parentElement).toBe(viewport);
    expect(viewport.parentElement).toBe(viewportPositioner);

    controller.close();
    await waitForPresenceExit();
    expect(content.parentElement).toBe(contentPositioner);
    expect(contentPortal.parentElement).toBe(root.querySelector('[data-slot="navigation-menu-item"]'));
    expect(viewportPortal.parentElement).toBe(root);

    controller.destroy();
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

  // Data attribute tests
  describe("data attributes", () => {
    it("data-open-on-focus='false' disables opening on focus", () => {
      document.body.innerHTML = `
        <nav data-slot="navigation-menu" id="root" data-open-on-focus="false">
          <ul data-slot="navigation-menu-list">
            <li data-slot="navigation-menu-item" data-value="products">
              <button data-slot="navigation-menu-trigger">Products</button>
              <div data-slot="navigation-menu-content">Content</div>
            </li>
          </ul>
        </nav>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="navigation-menu-trigger"]') as HTMLElement;
      const controller = createNavigationMenu(root, { delayOpen: 0 });

      trigger.focus();
      // Without openOnFocus, focus alone should not open the menu
      expect(controller.value).toBe(null);

      controller.destroy();
    });

    it("data-delay-open sets custom open delay", () => {
      document.body.innerHTML = `
        <nav data-slot="navigation-menu" id="root" data-delay-open="0">
          <ul data-slot="navigation-menu-list">
            <li data-slot="navigation-menu-item" data-value="products">
              <button data-slot="navigation-menu-trigger">Products</button>
              <div data-slot="navigation-menu-content">Content</div>
            </li>
          </ul>
        </nav>
      `;
      const root = document.getElementById("root")!;
      const controller = createNavigationMenu(root);

      // Just verify it initializes without error
      expect(controller.value).toBe(null);

      controller.destroy();
    });

    it("JS option overrides data attribute", () => {
      document.body.innerHTML = `
        <nav data-slot="navigation-menu" id="root" data-open-on-focus="false">
          <ul data-slot="navigation-menu-list">
            <li data-slot="navigation-menu-item" data-value="products">
              <button data-slot="navigation-menu-trigger">Products</button>
              <div data-slot="navigation-menu-content">Content</div>
            </li>
          </ul>
        </nav>
      `;
      const root = document.getElementById("root")!;
      const trigger = root.querySelector('[data-slot="navigation-menu-trigger"]') as HTMLElement;
      // JS option says true, data attribute says false - JS wins
      const controller = createNavigationMenu(root, { openOnFocus: true, delayOpen: 0 });

      trigger.focus();
      // With openOnFocus: true from JS, focus should open the menu
      expect(controller.value).toBe("products");

      controller.destroy();
    });

    it("placement attributes resolve as content > item > root", async () => {
      document.body.innerHTML = `
        <nav
          data-slot="navigation-menu"
          id="root"
          data-side="top"
          data-align="end"
          data-side-offset="2"
          data-align-offset="3"
        >
          <ul data-slot="navigation-menu-list">
            <li
              data-slot="navigation-menu-item"
              data-value="products"
              data-align="center"
              data-side-offset="8"
              data-align-offset="6"
            >
              <button data-slot="navigation-menu-trigger">Products</button>
              <div
                data-slot="navigation-menu-content"
                data-side="bottom"
                data-align-offset="12"
              >
                Content
              </div>
            </li>
          </ul>
          <div
            data-slot="navigation-menu-viewport-positioner"
            data-side="left"
            data-align="end"
            data-side-offset="10"
            data-align-offset="5"
          >
            <div data-slot="navigation-menu-viewport"></div>
          </div>
        </nav>
      `;
      const root = document.getElementById("root") as HTMLElement;
      const trigger = root.querySelector('[data-slot="navigation-menu-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="navigation-menu-content"]') as HTMLElement;
      const viewport = root.querySelector('[data-slot="navigation-menu-viewport"]') as HTMLElement;
      const controller = createNavigationMenu(root, { delayOpen: 0, delayClose: 0 });

      const rect = (left: number, top: number, width: number, height: number): DOMRect =>
        ({
          x: left,
          y: top,
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      root.getBoundingClientRect = () => rect(100, 100, 400, 40);
      trigger.getBoundingClientRect = () => rect(150, 100, 100, 40);
      content.getBoundingClientRect = () => rect(0, 0, 300, 180);

      controller.open("products");
      await waitForPresenceExit();

      expect(viewport.getAttribute("data-side")).toBe("bottom");
      expect(viewport.getAttribute("data-align")).toBe("center");
      expect(content.getAttribute("data-side")).toBe("bottom");
      expect(content.getAttribute("data-align")).toBe("center");
      expect(viewport.style.top).toBe("0px");
      expect(viewport.style.left).toBe("0px");
      expect(viewport.style.transform).toBe("translate3d(-38px, 48px, 0)");

      const viewportPositioner = getViewportPositioner(viewport);
      // Positioner mirrors resolved values for styling, but is not an input source.
      expect(viewportPositioner.getAttribute("data-side")).toBe("bottom");
      expect(viewportPositioner.getAttribute("data-align")).toBe("center");

      controller.destroy();
    });

    it("ignores legacy navigation-menu-positioner around content for placement input", async () => {
      document.body.innerHTML = `
        <nav
          data-slot="navigation-menu"
          id="root"
          data-side="top"
          data-align="end"
          data-side-offset="2"
          data-align-offset="3"
        >
          <ul data-slot="navigation-menu-list">
            <li data-slot="navigation-menu-item" data-value="products">
              <button data-slot="navigation-menu-trigger">Products</button>
              <div
                data-slot="navigation-menu-positioner"
                data-side="bottom"
                data-align="start"
                data-side-offset="14"
                data-align-offset="9"
              >
                <div data-slot="navigation-menu-content">Content</div>
              </div>
            </li>
          </ul>
          <div data-slot="navigation-menu-viewport"></div>
        </nav>
      `;
      const root = document.getElementById("root") as HTMLElement;
      const trigger = root.querySelector('[data-slot="navigation-menu-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="navigation-menu-content"]') as HTMLElement;
      const viewport = root.querySelector('[data-slot="navigation-menu-viewport"]') as HTMLElement;
      const controller = createNavigationMenu(root, { delayOpen: 0, delayClose: 0 });

      const rect = (left: number, top: number, width: number, height: number): DOMRect =>
        ({
          x: left,
          y: top,
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      root.getBoundingClientRect = () => rect(100, 100, 400, 40);
      trigger.getBoundingClientRect = () => rect(150, 100, 100, 40);
      content.getBoundingClientRect = () => rect(0, 0, 300, 180);

      controller.open("products");
      await waitForPresenceExit();

      // Wrapper attrs are ignored; placement falls back to root defaults.
      expect(viewport.getAttribute("data-side")).toBe("top");
      expect(viewport.getAttribute("data-align")).toBe("end");
      expect(content.getAttribute("data-side")).toBe("top");
      expect(content.getAttribute("data-align")).toBe("end");
      expect(viewport.style.top).toBe("0px");
      expect(viewport.style.left).toBe("0px");
      expect(viewport.style.transform).toBe("translate3d(-153px, -182px, 0)");

      controller.destroy();
    });

    it("recomputes placement per active content when items use different aligns", async () => {
      document.body.innerHTML = `
        <nav data-slot="navigation-menu" id="root">
          <ul data-slot="navigation-menu-list">
            <li data-slot="navigation-menu-item" data-value="products">
              <button data-slot="navigation-menu-trigger">Products</button>
              <div
                data-slot="navigation-menu-content"
                data-side="bottom"
                data-align="start"
                data-side-offset="8"
              >
                Products content
              </div>
            </li>
            <li data-slot="navigation-menu-item" data-value="solutions">
              <button data-slot="navigation-menu-trigger">Solutions</button>
              <div
                data-slot="navigation-menu-content"
                data-side="bottom"
                data-align="center"
                data-side-offset="8"
              >
                Solutions content
              </div>
            </li>
          </ul>
          <div data-slot="navigation-menu-viewport"></div>
        </nav>
      `;

      const root = document.getElementById("root") as HTMLElement;
      const triggers = root.querySelectorAll(
        '[data-slot="navigation-menu-trigger"]'
      ) as NodeListOf<HTMLElement>;
      const contents = root.querySelectorAll(
        '[data-slot="navigation-menu-content"]'
      ) as NodeListOf<HTMLElement>;
      const viewport = root.querySelector('[data-slot="navigation-menu-viewport"]') as HTMLElement;
      const controller = createNavigationMenu(root, { delayOpen: 0, delayClose: 0 });

      const rect = (left: number, top: number, width: number, height: number): DOMRect =>
        ({
          x: left,
          y: top,
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      root.getBoundingClientRect = () => rect(100, 100, 400, 40);
      triggers[0]!.getBoundingClientRect = () => rect(120, 100, 100, 40);
      triggers[1]!.getBoundingClientRect = () => rect(280, 100, 100, 40);
      contents[0]!.getBoundingClientRect = () => rect(0, 0, 200, 180);
      contents[1]!.getBoundingClientRect = () => rect(0, 0, 200, 180);

      controller.open("products");
      await waitForPresenceExit();
      expect(viewport.getAttribute("data-align")).toBe("start");
      expect(viewport.style.top).toBe("0px");
      expect(viewport.style.left).toBe("0px");
      expect(viewport.style.transform).toBe("translate3d(20px, 48px, 0)");

      controller.open("solutions");
      await waitForPresenceExit();
      expect(viewport.getAttribute("data-align")).toBe("center");
      expect(viewport.style.top).toBe("0px");
      expect(viewport.style.left).toBe("0px");
      expect(viewport.style.transform).toBe("translate3d(130px, 48px, 0)");

      controller.destroy();
    });

    it("JS placement options override data attributes", async () => {
      document.body.innerHTML = `
        <nav
          data-slot="navigation-menu"
          id="root"
          data-side="top"
          data-align="end"
          data-side-offset="20"
          data-align-offset="30"
        >
          <ul data-slot="navigation-menu-list">
            <li data-slot="navigation-menu-item" data-value="products">
              <button data-slot="navigation-menu-trigger">Products</button>
              <div
                data-slot="navigation-menu-content"
                data-side="left"
                data-align="end"
                data-side-offset="16"
                data-align-offset="12"
              >
                Content
              </div>
            </li>
          </ul>
          <div data-slot="navigation-menu-viewport"></div>
        </nav>
      `;
      const root = document.getElementById("root") as HTMLElement;
      const trigger = root.querySelector('[data-slot="navigation-menu-trigger"]') as HTMLElement;
      const content = root.querySelector('[data-slot="navigation-menu-content"]') as HTMLElement;
      const viewport = root.querySelector('[data-slot="navigation-menu-viewport"]') as HTMLElement;
      const controller = createNavigationMenu(root, {
        delayOpen: 0,
        delayClose: 0,
        side: "bottom",
        align: "start",
        sideOffset: 4,
        alignOffset: 7,
      });

      const rect = (left: number, top: number, width: number, height: number): DOMRect =>
        ({
          x: left,
          y: top,
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      root.getBoundingClientRect = () => rect(100, 100, 400, 40);
      trigger.getBoundingClientRect = () => rect(150, 100, 100, 40);
      content.getBoundingClientRect = () => rect(0, 0, 300, 180);

      controller.open("products");
      await waitForPresenceExit();

      expect(viewport.getAttribute("data-side")).toBe("bottom");
      expect(viewport.getAttribute("data-align")).toBe("start");
      expect(content.getAttribute("data-side")).toBe("bottom");
      expect(content.getAttribute("data-align")).toBe("start");
      expect(viewport.style.top).toBe("0px");
      expect(viewport.style.left).toBe("0px");
      expect(viewport.style.transform).toBe("translate3d(57px, 44px, 0)");

      controller.destroy();
    });
  });
});
