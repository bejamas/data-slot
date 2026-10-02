import { describe, expect, it } from "bun:test";
import { mockGeometry, recordChanges, render, scrollContent } from "./test-helpers";

describe("multiple visible slides", () => {
  for (const orientation of ["horizontal", "vertical"] as const) {
    it(`keeps partially visible ${orientation} neighbours accessible during scroll`, () => {
      const { root, content, items, controller } = render({
        attrs: 'data-slides="multiple"', options: { orientation },
        slideCount: 5, geometry: { size: 100, viewport: 250 },
      });
      const changes = recordChanges(root);
      const active = () => items.map(item => !item.hasAttribute("inert"));
      expect(active()).toEqual([true, true, true, false, false]);
      expect(items[1]!.hasAttribute("aria-hidden")).toBe(false);
      const button = document.createElement("button");
      items[1]!.append(button);
      button.focus();
      content[orientation === "horizontal" ? "scrollLeft" : "scrollTop"] = 100;
      content.dispatchEvent(new Event("scroll"));
      expect(active()).toEqual([false, true, true, true, false]);
      expect(document.activeElement).toBe(button);
      expect(controller.index).toBe(0);
      expect(changes).toEqual([]);
      content[orientation === "horizontal" ? "scrollLeft" : "scrollTop"] = 200;
      content.dispatchEvent(new Event("scroll"));
      expect(document.activeElement).toBe(content);
      expect(items[1]!.getAttribute("aria-hidden")).toBe("true");
      controller.destroy();
      content[orientation === "horizontal" ? "scrollLeft" : "scrollTop"] = 0;
      content.dispatchEvent(new Event("scroll"));
      expect(items[1]!.hasAttribute("inert")).toBe(true);
    });
  }

  it("keeps single-slide mode as the default and lets JS override markup", () => {
    const { items, controller } = render({ attrs: 'data-slides="multiple"',
      options: { slides: "single" }, geometry: { viewport: 250 } });
    expect(items.map(item => item.hasAttribute("inert"))).toEqual([false, true, true]);
    controller.destroy();
  });

  it("refreshes visibility when layout is remeasured", () => {
    const { content, items, controller } = render({ options: { slides: "multiple" } });
    mockGeometry(content, "horizontal", 100, 250);
    scrollContent(content, 0);
    expect(items.every(item => !item.hasAttribute("inert"))).toBe(true);
    controller.destroy();
  });
});
