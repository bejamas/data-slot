import { describe, expect, it } from "bun:test";
import { keydown, mockGeometry, recordChanges, render, withProperty } from "./test-helpers";

describe("reachable scroll positions", () => {
  for (const orientation of ["horizontal", "vertical"] as const) {
    it(`trims clamped ${orientation} positions and navigates symmetrically`, () => {
      const { root, content, controller, prev, next } = render({ slideCount: 5,
        options: { orientation, slides: "multiple" },
        geometry: { size: 360, gap: 20, viewport: 1280 } });
      const scroll = orientation === "horizontal" ? "scrollLeft" : "scrollTop";
      const changes = recordChanges(root);
      expect(controller.count).toBe(3);
      controller.next();
      expect(content[scroll]).toBe(380);
      controller.next();
      expect(content[scroll]).toBe(600);
      content.dispatchEvent(new Event("scrollend"));
      expect(controller.index).toBe(2);
      expect(controller.canScrollNext).toBe(false);
      expect(next!.disabled).toBe(true);
      controller.next();
      expect(changes).toEqual([1, 2]);
      controller.prev();
      expect(content[scroll]).toBe(380);
      controller.prev();
      expect(content[scroll]).toBe(0);
      expect(prev!.disabled).toBe(true);
      keydown(root, "End");
      expect(content[scroll]).toBe(600);
      controller.goTo(99);
      expect(controller.index).toBe(2);
      controller.destroy();
    });
  }

  it("disables both controls when all slides fit, even with loop", () => {
    const { controller, next, prev } = render({ geometry: { viewport: 1000 }, options: { loop: true } });
    expect(controller.count).toBe(1);
    expect(prev!.disabled).toBe(true);
    expect(next!.disabled).toBe(true);
    controller.destroy();
  });

  it("wraps among reachable positions", () => {
    const { controller, content } = render({ slideCount: 5,
      options: { loop: true, defaultIndex: 99 }, geometry: { size: 360, gap: 20, viewport: 1280 } });
    controller.goTo(2);
    controller.next();
    expect(content.scrollLeft).toBe(0);
    controller.prev();
    expect(content.scrollLeft).toBe(600);
    controller.destroy();
  });

  it("remeasures on resize, updates visibility and emits the new index", () => {
    let resize = () => {};
    const Observer = class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    withProperty(globalThis, "ResizeObserver", Observer, () => {
      const { root, content, items, controller, next } = render({ slideCount: 5,
        options: { slides: "multiple" }, geometry: { size: 360, gap: 20, viewport: 1280 } });
      controller.goTo(2);
      const changes = recordChanges(root);
      mockGeometry(content, "horizontal", 360, 1880, 20);
      resize();
      expect(controller.count).toBe(1);
      expect(controller.index).toBe(0);
      expect(content.scrollLeft).toBe(0);
      expect(next!.disabled).toBe(true);
      expect(items.every(item => !item.hasAttribute("inert"))).toBe(true);
      expect(changes).toEqual([0]);
      controller.destroy();
    });
  });
});
