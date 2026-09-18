import { beforeEach, describe, expect, it } from "bun:test";
import { create, createCarousel } from "./index";
import {
  flushMutations,
  keydown,
  mockGeometry,
  recordChanges,
  render,
  scrollContent,
  spyScrollTo,
  withProperty,
} from "./test-helpers";

describe("Carousel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("setup", () => {
    it("throws when carousel-content or carousel-item slots are missing", () => {
      document.body.innerHTML = `<div data-slot="carousel" id="root"></div>`;
      expect(() => createCarousel(document.getElementById("root")!)).toThrow(
        "Carousel requires carousel-content and at least one carousel-item",
      );

      document.body.innerHTML = `<div data-slot="carousel" id="root"><div data-slot="carousel-content"></div></div>`;
      expect(() => createCarousel(document.getElementById("root")!)).toThrow(
        "Carousel requires carousel-content and at least one carousel-item",
      );
    });

    it("initializes from data attributes", () => {
      const { root, controller } = render({ attrs: 'data-default-index="2" data-orientation="vertical" data-loop' });

      expect(controller.index).toBe(2);
      expect(root.getAttribute("data-index")).toBe("2");
      expect(root.getAttribute("data-orientation")).toBe("vertical");

      controller.destroy();
    });

    it("prefers JS options over data attributes", () => {
      const { controller } = render({
        attrs: 'data-default-index="0" data-loop="false"',
        options: { defaultIndex: 1, loop: true },
      });

      expect(controller.index).toBe(1);
      controller.next();
      controller.next();
      expect(controller.index).toBe(0);

      controller.destroy();
    });

    it("sets nav control buttons to type=button without overriding authored types", () => {
      document.body.innerHTML = `
        <form>
          <div data-slot="carousel" id="root">
            <div data-slot="carousel-content">
              <div data-slot="carousel-item">Slide 1</div>
              <div data-slot="carousel-item">Slide 2</div>
            </div>
            <button data-slot="carousel-previous" id="prev">Prev</button>
            <button data-slot="carousel-next" id="next" type="submit">Next</button>
          </div>
        </form>
      `;
      const controller = createCarousel(document.getElementById("root")!);

      expect(document.getElementById("prev")!.getAttribute("type")).toBe("button");
      expect(document.getElementById("next")!.getAttribute("type")).toBe("submit");

      controller.destroy();
    });
  });

  describe("navigation", () => {
    it("applies canScroll state and optional nav button disabled states", () => {
      const { controller, prev, next } = render();

      expect(controller.canScrollPrev).toBe(false);
      expect(controller.canScrollNext).toBe(true);
      expect(prev?.disabled).toBe(true);
      expect(next?.disabled).toBe(false);

      controller.goTo(2);
      expect(controller.canScrollPrev).toBe(true);
      expect(controller.canScrollNext).toBe(false);
      expect(prev?.disabled).toBe(false);
      expect(next?.disabled).toBe(true);

      controller.destroy();
    });

    it("supports soft-wrap loop mode", () => {
      const { controller } = render({ options: { defaultIndex: 2, loop: true } });

      controller.next();
      expect(controller.index).toBe(0);
      controller.prev();
      expect(controller.index).toBe(2);
      controller.goTo(8);
      expect(controller.index).toBe(2);

      controller.destroy();
    });

    it("handles keyboard navigation for horizontal orientation", () => {
      const { root, controller } = render({ options: { defaultIndex: 1 } });

      keydown(root, "ArrowRight");
      expect(controller.index).toBe(2);
      keydown(root, "ArrowLeft");
      expect(controller.index).toBe(1);
      keydown(root, "Home");
      expect(controller.index).toBe(0);
      keydown(root, "End");
      expect(controller.index).toBe(2);

      controller.destroy();
    });

    it("handles keyboard navigation for vertical orientation", () => {
      const { root, controller } = render({ options: { orientation: "vertical", defaultIndex: 1 } });

      keydown(root, "ArrowDown");
      expect(controller.index).toBe(2);
      keydown(root, "ArrowUp");
      expect(controller.index).toBe(1);
      keydown(root, "ArrowRight");
      expect(controller.index).toBe(1);

      controller.destroy();
    });

    it("ignores keyboard navigation from editable targets", () => {
      document.body.innerHTML = `
        <div data-slot="carousel" id="root">
          <input id="field" />
          <div data-slot="carousel-content">
            <div data-slot="carousel-item">Slide 1</div>
            <div data-slot="carousel-item">Slide 2</div>
          </div>
        </div>
      `;
      const controller = createCarousel(document.getElementById("root")!);

      keydown(document.getElementById("field")!, "ArrowRight");
      expect(controller.index).toBe(0);

      controller.destroy();
    });

    it("does not navigate when a nested widget handles the key event", () => {
      document.body.innerHTML = `
        <div data-slot="carousel" id="root">
          <div data-slot="carousel-content">
            <div data-slot="carousel-item"><button id="nested">Nested</button></div>
            <div data-slot="carousel-item">Slide 2</div>
          </div>
        </div>
      `;
      const nested = document.getElementById("nested")!;
      const controller = createCarousel(document.getElementById("root")!);
      nested.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") event.preventDefault();
      });

      keydown(nested, "ArrowRight");
      expect(controller.index).toBe(0);

      controller.destroy();
    });

    it("responds to inbound carousel:set events", () => {
      const { root, controller } = render();

      root.dispatchEvent(new CustomEvent("carousel:set", { detail: { action: "next" } }));
      expect(controller.index).toBe(1);
      root.dispatchEvent(new CustomEvent("carousel:set", { detail: { index: 2 } }));
      expect(controller.index).toBe(2);
      root.dispatchEvent(new CustomEvent("carousel:set", { detail: { action: "prev" } }));
      expect(controller.index).toBe(1);

      controller.destroy();
    });

    it("emits carousel:change and onIndexChange only when index changes", () => {
      const callbackChanges: number[] = [];
      const { root, controller } = render({ options: { onIndexChange: (index) => callbackChanges.push(index) } });
      const changes = recordChanges(root);

      controller.next();
      controller.next();
      controller.next();

      expect(changes).toEqual([1, 2]);
      expect(callbackChanges).toEqual([1, 2]);

      controller.destroy();
    });
  });

  describe("scroll behavior", () => {
    it("uses smooth scrolling for every navigation entry point by default", () => {
      const { root, controller, content, prev, next } = render({ options: { defaultIndex: 1 } });
      const calls = spyScrollTo(content);

      controller.next();
      controller.prev();
      controller.goTo(0);
      next?.click();
      prev?.click();
      keydown(root, "ArrowRight");
      keydown(root, "Home");
      root.dispatchEvent(new CustomEvent("carousel:set", { detail: { action: "next" } }));
      root.dispatchEvent(new CustomEvent("carousel:set", { detail: { index: 2 } }));

      expect(calls).toHaveLength(9);
      expect(calls.every((call) => call.behavior === "smooth")).toBe(true);

      controller.destroy();
    });

    it("falls back to auto scroll behavior when reduced-motion is preferred", () => {
      const matchMedia = ((query: string) =>
        ({ matches: query === "(prefers-reduced-motion: reduce)", media: query }) as MediaQueryList) as typeof window.matchMedia;

      withProperty(window, "matchMedia", matchMedia, () => {
        const { root, content, controller } = render({ options: { defaultIndex: 1 } });
        const calls = spyScrollTo(content);

        controller.next();
        keydown(root, "Home");
        root.dispatchEvent(new CustomEvent("carousel:set", { detail: { index: 2 } }));

        expect(calls).toHaveLength(3);
        expect(calls.every((call) => call.behavior === "auto")).toBe(true);

        controller.destroy();
      });
    });

    it("keeps programmatic smooth navigation index stable during intermediate scroll events", () => {
      const { root, content, controller } = render();
      const changes = recordChanges(root);

      controller.next();
      expect(controller.index).toBe(1);

      scrollContent(content, 20);
      expect(controller.index).toBe(1);
      expect(changes).toEqual([1]);

      scrollContent(content, 100);
      scrollContent(content, 210, true);
      expect(controller.index).toBe(2);
      expect(changes).toEqual([1, 2]);

      controller.destroy();
    });

    it("syncs active index once native scrolling settles", async () => {
      const { content, controller } = render();

      scrollContent(content, 190, true);
      expect(controller.index).toBe(2);

      // Without scrollend, the index follows after a short quiet period.
      scrollContent(content, 90);
      expect(controller.index).toBe(2);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(controller.index).toBe(1);

      controller.destroy();
    });
  });

  describe("accessibility", () => {
    it("labels the region and slides", () => {
      const { root, items, controller } = render();

      expect(root.getAttribute("role")).toBe("region");
      expect(root.getAttribute("aria-roledescription")).toBe("carousel");
      expect(items[1]?.getAttribute("role")).toBe("group");
      expect(items[1]?.getAttribute("aria-roledescription")).toBe("slide");
      expect(items[1]?.getAttribute("aria-label")).toBe("2 of 3");

      controller.destroy();
    });

    it("hides inactive slides with inert and aria-hidden without touching authored tabindex", () => {
      document.body.innerHTML = `
        <div data-slot="carousel" id="root">
          <div data-slot="carousel-content">
            <div data-slot="carousel-item" id="slide-1"><a href="#first" id="first-link">First</a></div>
            <div data-slot="carousel-item" id="slide-2">
              <button id="second-button">Second</button>
              <div id="second-custom" tabindex="0">Custom</div>
            </div>
          </div>
        </div>
      `;
      const slide1 = document.getElementById("slide-1")!;
      const slide2 = document.getElementById("slide-2")!;
      const controller = createCarousel(document.getElementById("root")!);

      expect(slide1.getAttribute("aria-hidden")).toBe("false");
      expect(slide1.hasAttribute("inert")).toBe(false);
      expect(slide2.getAttribute("aria-hidden")).toBe("true");
      expect(slide2.hasAttribute("inert")).toBe(true);

      controller.goTo(1);

      expect(slide1.getAttribute("aria-hidden")).toBe("true");
      expect(slide1.hasAttribute("inert")).toBe(true);
      expect(slide2.getAttribute("aria-hidden")).toBe("false");
      expect(slide2.hasAttribute("inert")).toBe(false);
      expect(document.getElementById("first-link")!.hasAttribute("tabindex")).toBe(false);
      expect(document.getElementById("second-button")!.hasAttribute("tabindex")).toBe(false);
      expect(document.getElementById("second-custom")!.getAttribute("tabindex")).toBe("0");

      controller.destroy();
    });
  });

  describe("slide mutations", () => {
    it("updates slide count when carousel-item children are added", async () => {
      const { content, controller } = render({ slideCount: 2 });

      const item = document.createElement("div");
      item.setAttribute("data-slot", "carousel-item");
      content.appendChild(item);
      await flushMutations();

      expect(controller.count).toBe(3);
      expect(item.getAttribute("role")).toBe("group");
      expect(item.getAttribute("aria-label")).toBe("3 of 3");

      controller.destroy();
    });

    it("preserves the active slide when items are inserted or removed before it", async () => {
      const { root, content, items, controller, layout } = render();
      const changes = recordChanges(root);

      controller.goTo(1);
      expect(changes).toEqual([1]);

      const inserted = document.createElement("div");
      inserted.setAttribute("data-slot", "carousel-item");
      content.insertBefore(inserted, items[1]!);
      layout();
      await flushMutations();

      expect(controller.index).toBe(2);
      expect(content.scrollLeft).toBe(200);
      expect(changes).toEqual([1, 2]);

      inserted.remove();
      layout();
      await flushMutations();

      expect(controller.index).toBe(1);
      expect(content.scrollLeft).toBe(100);
      expect(changes).toEqual([1, 2, 1]);

      controller.destroy();
    });

    it("parks at index 0 without emitting when every slide is removed", async () => {
      const { root, content, items, controller, prev, next } = render({ options: { defaultIndex: 1 } });
      const changes = recordChanges(root);

      items.forEach((item) => item.remove());
      await flushMutations();

      expect(controller.count).toBe(0);
      expect(controller.index).toBe(0);
      expect(root.getAttribute("data-index")).toBe("0");
      expect(prev?.disabled).toBe(true);
      expect(next?.disabled).toBe(true);

      controller.next();
      controller.goTo(3);
      content.dispatchEvent(new Event("scrollend"));
      expect(controller.index).toBe(0);
      expect(changes).toEqual([]);

      controller.destroy();
    });
  });

  describe("lifecycle", () => {
    it("auto-discovers with create(), dedupes bound roots and rebinds after destroy", () => {
      document.body.innerHTML = `
        <div data-slot="carousel"><div data-slot="carousel-content"><div data-slot="carousel-item">One</div></div></div>
        <div data-slot="carousel"><div data-slot="carousel-content"><div data-slot="carousel-item">Two</div></div></div>
      `;

      const first = create();
      expect(first).toHaveLength(2);
      expect(create()).toHaveLength(0);

      first.forEach((controller) => controller.destroy());
      expect(create()).toHaveLength(2);
    });

    it("returns the existing controller when a bound root is created again", () => {
      const { root, controller } = render();

      expect(createCarousel(root)).toBe(controller);

      controller.destroy();
    });

    it("stops reacting to input after destroy", () => {
      const { root, content, controller } = render();
      mockGeometry(content, "horizontal");

      controller.destroy();
      keydown(root, "ArrowRight");
      scrollContent(content, 190, true);

      expect(controller.index).toBe(0);
      expect(root.getAttribute("data-index")).toBe("0");
    });
  });
});
