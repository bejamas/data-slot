import { describe, expect, it } from "bun:test";
import { createCarousel } from "./index";
import { flushMutations, lift, mockGeometry, move, press, recordChanges, render, scrollContent, spyScrollTo, withProperty } from "./test-helpers";

describe("indicators", () => {
  it("generates reachable buttons and synchronizes before emitting, retaining focus", async () => {
    const { root, content, controller: initial } = render({ slideCount: 5,
      geometry: { size: 360, viewport: 1280, gap: 20 } });
    initial.destroy();
    const indicators = document.createElement("div");
    indicators.dataset.slot = "carousel-indicators";
    root.append(indicators);
    const controller = createCarousel(root);
    expect(indicators.children.length).toBe(3);
    const last = indicators.children[2] as HTMLButtonElement;
    expect(last.type).toBe("button");
    expect(last.getAttribute("aria-label")).toBe("Go to slide 3");
    expect(last.getAttribute("aria-controls")).toBe(content.id);
    const changes = recordChanges(root);
    root.addEventListener("carousel:change", () => expect(last.getAttribute("aria-current")).toBe("true"), { once: true });
    last.focus();
    last.click();
    expect(document.activeElement).toBe(last);
    expect(content.scrollLeft).toBe(600);
    expect(changes).toEqual([2]);
    expect(indicators.children[0]!.hasAttribute("aria-current")).toBe(false);
    content.lastElementChild!.remove();
    await flushMutations();
    expect(indicators.children.length).toBe(2);
    controller.destroy();
    (indicators.children[0] as HTMLButtonElement).click();
    expect(controller.index).toBe(1);
  });

  it("preserves authored labels and hides unreachable or malformed indices", () => {
    const { root, controller: initial } = render();
    initial.destroy();
    root.insertAdjacentHTML("beforeend", `
      <button data-slot="carousel-indicator" data-index="1" aria-label="Details"></button>
      <button data-slot="carousel-indicator" data-index="9"></button>
      <button data-slot="carousel-indicator" data-index="-1"></button>
      <button data-slot="carousel-indicator"></button>`);
    const controller = createCarousel(root);
    const indicators = root.querySelectorAll<HTMLButtonElement>('[data-slot="carousel-indicator"]');
    expect(indicators[0]!.getAttribute("aria-label")).toBe("Details");
    for (const indicator of Array.from(indicators).slice(1)) {
      expect(indicator.hidden).toBe(true);
      expect(indicator.disabled).toBe(true);
    }
    indicators[0]!.click();
    expect(controller.index).toBe(1);
    scrollContent(root.querySelector<HTMLElement>('[data-slot="carousel-content"]')!, 200, true);
    expect(indicators[0]!.hasAttribute("aria-current")).toBe(false);
    controller.destroy();
  });
});

describe("free scroll", () => {
  for (const orientation of ["horizontal", "vertical"] as const) {
    for (const snap of [false, undefined]) {
      for (const mutation of ["insert", "remove"] as const) {
        it(`preserves ${orientation} free scrolling after ${mutation} (snap=${snap})`, async () => {
          const { content, controller, layout } = render({ slideCount: 4, options: { orientation, snap } });
          content.style.scrollSnapType = "none";
          const scroll = orientation === "horizontal" ? "scrollLeft" : "scrollTop";
          content[scroll] = 60;
          content.dispatchEvent(new Event("scrollend"));
          const calls = spyScrollTo(content);
          if (mutation === "insert") {
            const item = document.createElement("div");
            item.dataset.slot = "carousel-item";
            content.prepend(item);
          } else {
            content.firstElementChild!.remove();
          }
          layout();
          await flushMutations();

          expect(content[scroll]).toBe(60);
          expect(controller.index).toBe(1);
          expect(controller.count).toBe(mutation === "insert" ? 5 : 3);
          expect(calls).toHaveLength(0);
          controller.destroy();
        });
      }
    }

    it(`keeps ${orientation} drag release between snaps and still navigates`, () => {
      const { root, content, controller } = render({ attrs: 'data-snap="none"',
        options: { drag: true, orientation } });
      const calls = spyScrollTo(content);
      press(content, 91, 180, 180);
      move(91, orientation === "horizontal" ? 120 : 180, orientation === "vertical" ? 120 : 180);
      lift(91, 120, 120);
      const scroll = orientation === "horizontal" ? "scrollLeft" : "scrollTop";
      expect(content[scroll]).toBe(60);
      expect(controller.index).toBe(1);
      expect(calls).toHaveLength(1); // Only cancel the native animation at axis lock.
      content.dispatchEvent(new Event("scrollend"));
      expect(content[scroll]).toBe(60);
      controller.next();
      expect(content[scroll]).toBe(100);
      controller.prev();
      expect(content[scroll]).toBe(0);
      expect(root.hasAttribute("data-dragging")).toBe(false);
      controller.destroy();
      expect(content.style.scrollSnapType).toBe("");
    });
  }

  it("honours computed snap-none CSS when snap is omitted", () => {
    const { content, controller } = render({ options: { drag: true } });
    content.style.scrollSnapType = "none";
    press(content, 92, 180, 40);
    move(92, 120, 40);
    lift(92, 120, 40);
    expect(content.scrollLeft).toBe(60);
    expect(controller.index).toBe(1);
    content.style.scrollSnapType = "x mandatory";
    press(content, 93, 180, 40);
    move(93, 150, 40);
    lift(93, 150, 40);
    expect(content.scrollLeft).toBe(100);
    controller.destroy();
  });

  it("does not reposition free scroll on resize", () => {
    let resize = () => {};
    const Observer = class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    withProperty(globalThis, "ResizeObserver", Observer, () => {
      const { content, controller } = render({ options: { snap: false } });
      scrollContent(content, 60, true);
      mockGeometry(content, "horizontal", 110);
      resize();
      expect(content.scrollLeft).toBe(60);
      expect(controller.index).toBe(1);
      controller.destroy();
    });
  });
});

it("allows free-scroll navigation back to an endpoint even when nearest index is already there", () => {
  const { content, controller, prev, next } = render({ options: { snap: false } });
  scrollContent(content, 30, true);
  expect(controller.index).toBe(0);
  expect(prev!.disabled).toBe(false);
  controller.prev();
  expect(content.scrollLeft).toBe(0);
  scrollContent(content, 170, true);
  expect(controller.index).toBe(2);
  expect(next!.disabled).toBe(false);
  controller.next();
  expect(content.scrollLeft).toBe(200);
  controller.destroy();
});

it("restores the original authored snap style after destroying a free drag", () => {
  const { root, content, controller: initial } = render();
  initial.destroy();
  content.style.scrollSnapType = "x mandatory";
  const controller = createCarousel(root, { drag: true, snap: false });
  press(content, 94, 180, 40);
  move(94, 120, 40);
  controller.destroy();
  expect(content.style.scrollSnapType).toBe("x mandatory");
});

it("lets an explicit snap option override data-snap=none and restores authored CSS", () => {
  const { root, content, controller: initial } = render({ attrs: 'data-snap="none"' });
  initial.destroy();
  content.style.scrollSnapType = "x proximity";
  const controller = createCarousel(root, { snap: true });
  expect(content.style.scrollSnapType).toBe("x mandatory");
  controller.destroy();
  expect(content.style.scrollSnapType).toBe("x proximity");
});
