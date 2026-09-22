import { beforeEach, describe, expect, it } from "bun:test";
import { createCarousel } from "./index";
import { cancelPointer, lift, mockGeometry, move, press, render, spyScrollTo, withProperty } from "./test-helpers";

/** Keep smooth scrolling pending until the test advances the scroll position. */
const deferSmoothScroll = (content: HTMLElement) => {
  const calls: Array<ScrollToOptions & { snap: string }> = [];
  const apply = content.scrollTo.bind(content);
  content.scrollTo = ((options: ScrollToOptions) => {
    calls.push({ ...options, snap: content.style.scrollSnapType });
    if (options.behavior !== "smooth") apply(options);
  }) as typeof content.scrollTo;
  return calls;
};

describe("Carousel drag", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("leaves pointer drag disabled by default", () => {
    const { content, controller } = render();

    press(content, 1, 180, 40);
    move(1, 20, 40);
    lift(1, 20, 40);

    expect(content.style.touchAction).toBe("");
    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("enables pointer drag from the data-drag attribute", () => {
    const { content, controller } = render({ attrs: "data-drag" });

    expect(content.style.touchAction).toBe("pan-y");

    controller.destroy();
  });

  it("enables pointer drag from the JS option and restores touch-action on destroy", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content" id="content" style="touch-action: manipulation">
          <div data-slot="carousel-item">Slide 1</div>
          <div data-slot="carousel-item">Slide 2</div>
        </div>
      </div>
    `;
    const content = document.getElementById("content") as HTMLElement;
    const controller = createCarousel(document.getElementById("root")!, { drag: true });

    expect(content.style.touchAction).toBe("pan-y");
    controller.destroy();
    expect(content.style.touchAction).toBe("manipulation");
  });

  it("drags horizontally and snaps to the nearest slide on release", () => {
    const { root, content, controller } = render({ options: { drag: true } });

    press(content, 10, 180, 40);
    move(10, 20, 45);

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.style.scrollSnapType).toBe("none");
    expect(content.scrollLeft).toBe(160);
    expect(controller.index).toBe(0);

    lift(10, 20, 45);

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.style.scrollSnapType).toBe("");
    expect(content.scrollLeft).toBe(200);
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("drags vertically and snaps to the nearest slide on release", () => {
    const { root, content, controller } = render({ attrs: 'data-orientation="vertical"', options: { drag: true } });

    expect(content.style.touchAction).toBe("pan-x");

    press(content, 11, 40, 180);
    move(11, 45, 20);

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollTop).toBe(160);

    lift(11, 45, 20);

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollTop).toBe(200);
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("snaps back to the current slide when a drag does not pass the next snap point", () => {
    const { root, content, controller } = render({ options: { drag: true } });

    press(content, 12, 180, 40);
    move(12, 150, 40);

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollLeft).toBe(30);

    lift(12, 150, 40);

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("uses smooth scrolling when snapping after a drag by default", () => {
    const { content, controller } = render({ options: { drag: true } });
    const calls = spyScrollTo(content);

    press(content, 19, 180, 40);
    move(19, 20, 40);
    lift(19, 20, 40);

    expect(calls.at(-1)?.behavior).toBe("smooth");

    controller.destroy();
  });

  for (const orientation of ["horizontal", "vertical"] as const) {
    it(`keeps snapping disabled throughout the ${orientation} release animation`, () => {
      const { content, controller } = render({ options: { drag: true, orientation } });
      const horizontal = orientation === "horizontal";
      const scroll = horizontal ? "scrollLeft" : "scrollTop";
      const snap = horizontal ? "x mandatory" : "y mandatory";
      content.style.scrollSnapType = snap;
      const calls = deferSmoothScroll(content);

      press(content, 30, 180, 180);
      move(30, horizontal ? 20 : 180, horizontal ? 180 : 20);
      lift(30, 20, 20);

      expect(calls.at(-1)).toMatchObject({ behavior: "smooth", snap: "none" });
      expect(content[scroll]).toBe(160);
      expect(content.style.scrollSnapType).toBe("none");
      content[scroll] = 180;
      content.dispatchEvent(new Event("scroll"));
      expect(content.style.scrollSnapType).toBe("none");
      content[scroll] = 200;
      content.dispatchEvent(new Event("scrollend"));
      expect(content.style.scrollSnapType).toBe(snap);
      expect(controller.index).toBe(2);
      controller.destroy();
    });
  }

  it("restores snapping after a cancelled drag settles without scrollend", async () => {
    const { content, controller } = render({ options: { drag: true } });
    content.style.scrollSnapType = "x mandatory";
    deferSmoothScroll(content);
    press(content, 31, 180, 40);
    move(31, 20, 40);
    cancelPointer(31);
    expect(content.style.scrollSnapType).toBe("none");
    content.scrollLeft = 200;
    content.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(content.style.scrollSnapType).toBe("x mandatory");
    controller.destroy();
  });

  it("interrupts a release animation without losing authored snapping", () => {
    const { content, controller } = render({ options: { drag: true } });
    content.style.scrollSnapType = "x mandatory";
    const calls = deferSmoothScroll(content);
    press(content, 32, 180, 40);
    move(32, 20, 40);
    lift(32, 20, 40);
    content.scrollLeft = 175;
    press(content, 33, 100, 40);
    move(33, 130, 40);
    expect(calls.at(-1)).toMatchObject({ left: 175, behavior: "instant", snap: "none" });
    expect(content.scrollLeft).toBe(145);
    // A queued completion from the interrupted scroll cannot restore snapping mid-drag.
    content.dispatchEvent(new Event("scrollend"));
    expect(content.style.scrollSnapType).toBe("none");
    lift(33, 130, 40);
    content.scrollLeft = 100;
    content.dispatchEvent(new Event("scrollend"));
    expect(content.style.scrollSnapType).toBe("x mandatory");
    expect(controller.index).toBe(1);
    controller.destroy();
  });

  it("restores snapping when destroyed during a release animation", async () => {
    const { content, controller } = render({ options: { drag: true } });
    content.style.scrollSnapType = "x mandatory";
    deferSmoothScroll(content);
    press(content, 34, 180, 40);
    move(34, 20, 40);
    lift(34, 20, 40);
    controller.destroy();
    expect(content.style.scrollSnapType).toBe("x mandatory");
    content.style.scrollSnapType = "x proximity";
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(content.style.scrollSnapType).toBe("x proximity");
  });

  it("settles immediately with reduced motion and restores snapping without scroll events", () => {
    const matchMedia = ((query: string) => ({ matches: true, media: query }) as MediaQueryList) as typeof window.matchMedia;
    withProperty(window, "matchMedia", matchMedia, () => {
      const { content, controller } = render({ options: { drag: true } });
      const calls = spyScrollTo(content);
      press(content, 35, 180, 40);
      move(35, 20, 40);
      lift(35, 20, 40);
      expect(calls.at(-1)?.behavior).toBe("auto");
      expect(content.scrollLeft).toBe(200);
      expect(content.style.scrollSnapType).toBe("");
      controller.destroy();
    });
  });

  it("does not wrap drag gestures when loop mode is enabled", () => {
    const { content, controller } = render({ options: { drag: true, loop: true } });

    press(content, 18, 100, 40);
    move(18, 260, 40);
    lift(18, 260, 40);

    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("does not start drag gestures from nested interactive content, including SVG descendants", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content" id="content">
          <div data-slot="carousel-item">
            <button id="nested"><svg viewBox="0 0 10 10"><path id="nested-path" d="M0 0h10v10H0z"></path></svg></button>
          </div>
          <div data-slot="carousel-item">Slide 2</div>
          <div data-slot="carousel-item">Slide 3</div>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    mockGeometry(content, "horizontal");
    const controller = createCarousel(root, { drag: true });

    for (const id of ["nested", "nested-path"]) {
      press(document.getElementById(id)!, 13, 180, 40);
      move(13, 20, 45);
      lift(13, 20, 45);
    }

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("leaves opposite-axis gestures to the page", () => {
    const { root, content, controller } = render({ options: { drag: true } });

    press(content, 14, 180, 40);
    const event = move(14, 190, 170);

    expect(event.defaultPrevented).toBe(false);
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollLeft).toBe(0);

    lift(14, 190, 170);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("prevents default browser behavior during an active drag", () => {
    const { root, content, controller } = render({ options: { drag: true } });

    press(content, 15, 180, 40);
    const event = move(15, 60, 50);

    expect(event.defaultPrevented).toBe(true);
    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollLeft).toBe(120);

    lift(15, 60, 50);
    controller.destroy();
  });

  it("restores authored scroll snapping and settles on pointercancel", () => {
    const { root, content, controller } = render({ options: { drag: true } });
    content.style.scrollSnapType = "x mandatory";

    press(content, 20, 180, 40);
    move(20, 60, 40);
    expect(content.style.scrollSnapType).toBe("none");

    cancelPointer(20);

    expect(content.style.scrollSnapType).toBe("x mandatory");
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(controller.index).toBe(1);

    controller.next();
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("lets a new pointer take over an active drag", () => {
    const { root, content, controller } = render({ options: { drag: true } });

    press(content, 22, 180, 40);
    move(22, 60, 40);
    expect(content.scrollLeft).toBe(120);

    // The first drag settles on the nearest slide and the new pointer drags from there.
    press(content, 23, 20, 40);
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollLeft).toBe(100);
    expect(controller.index).toBe(1);

    move(23, 60, 40);
    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollLeft).toBe(60);

    lift(22, 60, 40);
    expect(root.getAttribute("data-dragging")).toBe("true");

    lift(23, 60, 40);
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.style.scrollSnapType).toBe("");
    expect(content.scrollLeft).toBe(100);
    expect(controller.index).toBe(1);

    controller.destroy();
  });

  it("allows a new pointer to take over before drag activation", () => {
    const { root, content, controller } = render({ options: { drag: true } });

    press(content, 24, 180, 40);
    press(content, 25, 180, 40);
    move(25, 60, 40);

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollLeft).toBe(120);

    lift(25, 60, 40);
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(controller.index).toBe(1);

    lift(24, 180, 40);
    expect(controller.index).toBe(1);

    controller.destroy();
  });

  it("does not snap or emit when destroyed mid-drag", () => {
    const { root, content, controller } = render({ options: { drag: true } });
    const changes: number[] = [];
    root.addEventListener("carousel:change", (event) => changes.push((event as CustomEvent<{ index: number }>).detail.index));

    press(content, 26, 180, 40);
    move(26, 60, 40);
    controller.destroy();

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.style.scrollSnapType).toBe("");
    expect(content.scrollLeft).toBe(120);
    expect(changes).toEqual([]);
  });
});
