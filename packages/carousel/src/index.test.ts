import { beforeEach, describe, expect, it } from "bun:test";
import { create, createCarousel } from "./index";

describe("Carousel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const waitForRaf =
    typeof requestAnimationFrame === "function"
      ? () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          })
      : () => Promise.resolve();

  const setup = ({
    attrs = "",
    slideCount = 3,
    withControls = true,
    options,
  }: {
    attrs?: string;
    slideCount?: number;
    withControls?: boolean;
    options?: Parameters<typeof createCarousel>[1];
  } = {}) => {
    const slides = Array.from({ length: slideCount }, (_, index) => {
      return `<div data-slot="carousel-item">Slide ${index + 1}</div>`;
    }).join("\n");

    document.body.innerHTML = `
      <div data-slot="carousel" id="root" ${attrs}>
        <div data-slot="carousel-content" id="content">${slides}</div>
        ${withControls ? '<button data-slot="carousel-previous" id="prev">Prev</button>' : ""}
        ${withControls ? '<button data-slot="carousel-next" id="next">Next</button>' : ""}
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    const items = Array.from(
      content.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
    );
    const prev = document.getElementById("prev") as HTMLButtonElement | null;
    const next = document.getElementById("next") as HTMLButtonElement | null;
    const controller = createCarousel(root, options ?? {});

    return { root, content, items, prev, next, controller };
  };

  const mockHorizontalGeometry = (
    content: HTMLElement,
    items: HTMLElement[],
    itemSize = 100,
  ) => {
    content.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: itemSize,
        height: 80,
        right: itemSize,
        bottom: 80,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;

    items.forEach((item, index) => {
      item.getBoundingClientRect = () =>
        {
          const left = index * itemSize - content.scrollLeft;

          return ({
            left,
            top: 0,
            width: itemSize,
            height: 80,
            right: left + itemSize,
            bottom: 80,
            x: left,
            y: 0,
            toJSON() {},
          }) as DOMRect;
        };
    });

    content.scrollTo = ((options: ScrollToOptions) => {
      if (typeof options.left === "number") content.scrollLeft = options.left;
      if (typeof options.top === "number") content.scrollTop = options.top;
    }) as typeof content.scrollTo;
  };

  const mockVerticalGeometry = (
    content: HTMLElement,
    items: HTMLElement[],
    itemSize = 100,
  ) => {
    content.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 120,
        height: itemSize,
        right: 120,
        bottom: itemSize,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;

    items.forEach((item, index) => {
      item.getBoundingClientRect = () => {
        const top = index * itemSize - content.scrollTop;

        return ({
          left: 0,
          top,
          width: 120,
          height: itemSize,
          right: 120,
          bottom: top + itemSize,
          x: 0,
          y: top,
          toJSON() {},
        }) as DOMRect;
      };
    });

    content.scrollTo = ((options: ScrollToOptions) => {
      if (typeof options.left === "number") content.scrollLeft = options.left;
      if (typeof options.top === "number") content.scrollTop = options.top;
    }) as typeof content.scrollTo;
  };

  const mockDynamicHorizontalGeometry = (
    content: HTMLElement,
    itemSize = 100,
  ) => {
    content.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: itemSize,
        height: 80,
        right: itemSize,
        bottom: 80,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;

    const sync = () => {
      Array.from(content.children).forEach((child, index) => {
        if (!(child instanceof HTMLElement)) return;

        child.getBoundingClientRect = () =>
          {
            const left = index * itemSize - content.scrollLeft;

            return ({
              left,
              top: 0,
              width: itemSize,
              height: 80,
              right: left + itemSize,
              bottom: 80,
              x: left,
              y: 0,
              toJSON() {},
            }) as DOMRect;
          };
      });
    };

    content.scrollTo = ((options: ScrollToOptions) => {
      if (typeof options.left === "number") content.scrollLeft = options.left;
      if (typeof options.top === "number") content.scrollTop = options.top;
    }) as typeof content.scrollTo;

    sync();
    return sync;
  };

  const createScrollSpy = (content: HTMLElement) => {
    const calls: ScrollToOptions[] = [];
    content.scrollTo = ((options: ScrollToOptions) => {
      calls.push(options);
      if (typeof options.left === "number") content.scrollLeft = options.left;
      if (typeof options.top === "number") content.scrollTop = options.top;
    }) as typeof content.scrollTo;
    return calls;
  };

  const setupWithGeometry = ({
    attrs = "",
    slideCount = 3,
    options,
  }: {
    attrs?: string;
    slideCount?: number;
    options?: Parameters<typeof createCarousel>[1];
  } = {}) => {
    const slides = Array.from({ length: slideCount }, (_, index) => {
      return `<div data-slot="carousel-item">Slide ${index + 1}</div>`;
    }).join("\n");

    document.body.innerHTML = `
      <div data-slot="carousel" id="root" ${attrs}>
        <div data-slot="carousel-content" id="content">${slides}</div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    const items = Array.from(
      content.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
    );

    if (attrs.includes('data-orientation="vertical"')) {
      mockVerticalGeometry(content, items, 100);
    } else {
      mockHorizontalGeometry(content, items, 100);
    }

    const controller = createCarousel(root, options ?? {});

    return { root, content, items, controller };
  };

  it("throws when carousel-content slot is missing", () => {
    document.body.innerHTML = `<div data-slot="carousel" id="root"></div>`;
    const root = document.getElementById("root")!;

    expect(() => createCarousel(root)).toThrow(
      "Carousel requires carousel-content and at least one carousel-item",
    );
  });

  it("throws when no carousel-item children exist", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content"></div>
      </div>
    `;
    const root = document.getElementById("root")!;

    expect(() => createCarousel(root)).toThrow(
      "Carousel requires carousel-content and at least one carousel-item",
    );
  });

  it("initializes from data attributes", () => {
    const { root, controller } = setup({
      attrs: 'data-default-index="2" data-orientation="vertical" data-loop',
    });

    expect(controller.index).toBe(2);
    expect(root.getAttribute("data-index")).toBe("2");
    expect(root.getAttribute("data-orientation")).toBe("vertical");

    controller.destroy();
  });

  it("prefers JS options over data attributes", () => {
    const { controller } = setup({
      attrs: 'data-default-index="0" data-loop="false"',
      options: { defaultIndex: 1, loop: true },
    });

    expect(controller.index).toBe(1);
    controller.next();
    controller.next();
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("leaves pointer drag disabled by default", () => {
    const { content, items, controller } = setup();
    mockHorizontalGeometry(content, items, 100);

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        clientX: 20,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        clientX: 20,
        clientY: 40,
      }),
    );

    expect(content.style.touchAction).toBe("");
    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("enables pointer drag from the data-drag attribute", () => {
    const { content, controller } = setup({ attrs: "data-drag" });

    expect(content.style.touchAction).toBe("pan-y");

    controller.destroy();
  });

  it("enables pointer drag from the JS option and restores touch-action on destroy", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content" id="content">
          <div data-slot="carousel-item">Slide 1</div>
          <div data-slot="carousel-item">Slide 2</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    content.style.touchAction = "manipulation";
    const controller = createCarousel(root, { drag: true });

    expect(content.style.touchAction).toBe("pan-y");

    controller.destroy();

    expect(content.style.touchAction).toBe("manipulation");
  });

  it("applies canScroll state and optional nav button disabled states", () => {
    const { controller, prev, next } = setup();

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
    const { controller } = setup({ options: { defaultIndex: 2, loop: true } });

    controller.next();
    expect(controller.index).toBe(0);

    controller.prev();
    expect(controller.index).toBe(2);

    controller.goTo(8);
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("handles keyboard navigation for horizontal orientation", () => {
    const { root, controller } = setup({ options: { defaultIndex: 1 } });

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(controller.index).toBe(2);

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(controller.index).toBe(1);

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(controller.index).toBe(0);

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("handles keyboard navigation for vertical orientation", () => {
    const { root, controller } = setup({ options: { orientation: "vertical", defaultIndex: 1 } });

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(controller.index).toBe(2);

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
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

    const root = document.getElementById("root")!;
    const field = document.getElementById("field") as HTMLInputElement;
    const controller = createCarousel(root);

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("drags horizontally and snaps to the nearest slide on release", () => {
    const { root, content, controller } = setupWithGeometry({
      options: { drag: true },
    });

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 10,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );

    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 10,
        clientX: 20,
        clientY: 45,
      }),
    );

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.style.scrollSnapType).toBe("none");
    expect(content.scrollLeft).toBe(160);
    expect(controller.index).toBe(0);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 10,
        clientX: 20,
        clientY: 45,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.style.scrollSnapType).toBe("");
    expect(content.scrollLeft).toBe(200);
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("drags vertically and snaps to the nearest slide on release", () => {
    const { root, content, controller } = setupWithGeometry({
      attrs: 'data-orientation="vertical"',
      options: { drag: true },
    });

    expect(content.style.touchAction).toBe("pan-x");

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 11,
        button: 0,
        clientX: 40,
        clientY: 180,
      }),
    );

    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 11,
        clientX: 45,
        clientY: 20,
      }),
    );

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollTop).toBe(160);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 11,
        clientX: 45,
        clientY: 20,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollTop).toBe(200);
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("snaps back to the current slide when a drag does not pass the next snap point", () => {
    const { root, content, items, controller } = setup({
      options: { drag: true },
    });
    mockHorizontalGeometry(content, items, 100);

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 12,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );

    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 12,
        clientX: 150,
        clientY: 40,
      }),
    );

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollLeft).toBe(30);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 12,
        clientX: 150,
        clientY: 40,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("does not start drag gestures from nested interactive content", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content" id="content">
          <div data-slot="carousel-item">
            <button id="nested">Nested</button>
          </div>
          <div data-slot="carousel-item">Slide 2</div>
          <div data-slot="carousel-item">Slide 3</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    const nested = document.getElementById("nested") as HTMLButtonElement;
    const items = Array.from(
      content.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
    );
    mockHorizontalGeometry(content, items, 100);
    const controller = createCarousel(root, { drag: true });

    nested.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 13,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 13,
        clientX: 20,
        clientY: 45,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 13,
        clientX: 20,
        clientY: 45,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("does not start drag gestures from SVG descendants of interactive content", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content" id="content">
          <div data-slot="carousel-item">
            <button id="nested">
              <svg viewBox="0 0 10 10" aria-hidden="true">
                <path id="nested-path" d="M0 0h10v10H0z"></path>
              </svg>
            </button>
          </div>
          <div data-slot="carousel-item">Slide 2</div>
          <div data-slot="carousel-item">Slide 3</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    const nestedPath = document.getElementById("nested-path")!;
    const items = Array.from(
      content.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
    );
    mockHorizontalGeometry(content, items, 100);
    const controller = createCarousel(root, { drag: true });

    nestedPath.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 21,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 21,
        clientX: 20,
        clientY: 45,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 21,
        clientX: 20,
        clientY: 45,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("ignores opposite-axis gestures when drag is enabled", () => {
    const { root, content, items, controller } = setup({
      options: { drag: true },
    });
    mockHorizontalGeometry(content, items, 100);

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 14,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );

    const moveEvent = new PointerEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      pointerId: 14,
      clientX: 190,
      clientY: 170,
    });
    const dispatchResult = document.dispatchEvent(moveEvent);

    expect(dispatchResult).toBe(true);
    expect(moveEvent.defaultPrevented).toBe(false);
    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.scrollLeft).toBe(0);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 14,
        clientX: 190,
        clientY: 170,
      }),
    );

    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("prevents default browser behavior during an active drag", () => {
    const { root, content, items, controller } = setup({
      options: { drag: true },
    });
    mockHorizontalGeometry(content, items, 100);

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 15,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );

    const moveEvent = new PointerEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      pointerId: 15,
      clientX: 60,
      clientY: 50,
    });
    const dispatchResult = document.dispatchEvent(moveEvent);

    expect(dispatchResult).toBe(false);
    expect(moveEvent.defaultPrevented).toBe(true);
    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollLeft).toBe(120);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 15,
        clientX: 60,
        clientY: 50,
      }),
    );

    controller.destroy();
  });

  it("uses smooth scrolling when snapping after a drag by default", () => {
    const { content, controller } = setupWithGeometry({
      options: { drag: true },
    });
    const calls = createScrollSpy(content);

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 19,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 19,
        clientX: 20,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 19,
        clientX: 20,
        clientY: 40,
      }),
    );

    expect(calls[calls.length - 1]?.behavior).toBe("smooth");

    controller.destroy();
  });

  it("restores authored scroll snapping after drag cleanup", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content" id="content">
          <div data-slot="carousel-item">Slide 1</div>
          <div data-slot="carousel-item">Slide 2</div>
          <div data-slot="carousel-item">Slide 3</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    const items = Array.from(
      content.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
    );
    content.style.scrollSnapType = "x mandatory";
    mockHorizontalGeometry(content, items, 100);
    const controller = createCarousel(root, { drag: true });

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 20,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 20,
        clientX: 60,
        clientY: 40,
      }),
    );

    expect(content.style.scrollSnapType).toBe("none");

    document.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: 20,
      }),
    );

    expect(content.style.scrollSnapType).toBe("x mandatory");

    controller.destroy();
  });

  it("ignores extra pointers while a drag is active", () => {
    const { root, content, controller } = setupWithGeometry({
      options: { drag: true },
    });

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 22,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 22,
        clientX: 60,
        clientY: 40,
      }),
    );

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.style.scrollSnapType).toBe("none");
    expect(content.scrollLeft).toBe(120);

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 23,
        button: 0,
        clientX: 20,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 23,
        clientX: 200,
        clientY: 40,
      }),
    );

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollLeft).toBe(120);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 22,
        clientX: 60,
        clientY: 40,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(content.style.scrollSnapType).toBe("");
    expect(controller.index).toBe(1);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 23,
        clientX: 200,
        clientY: 40,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(controller.index).toBe(1);

    controller.destroy();
  });

  it("allows a new pointer to take over before drag activation", () => {
    const { root, content, controller } = setupWithGeometry({
      options: { drag: true },
    });

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 24,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 25,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 25,
        clientX: 60,
        clientY: 40,
      }),
    );

    expect(root.getAttribute("data-dragging")).toBe("true");
    expect(content.scrollLeft).toBe(120);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 25,
        clientX: 60,
        clientY: 40,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(controller.index).toBe(1);

    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 24,
        clientX: 180,
        clientY: 40,
      }),
    );

    expect(controller.index).toBe(1);

    controller.destroy();
  });

  it("cleans up active drag state on pointercancel", () => {
    const { root, content, controller } = setupWithGeometry({
      options: { drag: true },
    });

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 16,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 16,
        clientX: 60,
        clientY: 40,
      }),
    );

    expect(root.getAttribute("data-dragging")).toBe("true");

    document.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: 16,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(controller.index).toBe(1);

    controller.next();
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("cleans up active drag state on lost pointer capture", () => {
    const { root, content, controller } = setupWithGeometry({
      options: { drag: true },
    });

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 17,
        button: 0,
        clientX: 180,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 17,
        clientX: 60,
        clientY: 40,
      }),
    );

    expect(root.getAttribute("data-dragging")).toBe("true");

    content.dispatchEvent(
      new PointerEvent("lostpointercapture", {
        bubbles: true,
        pointerId: 17,
      }),
    );

    expect(root.hasAttribute("data-dragging")).toBe(false);
    expect(controller.index).toBe(1);

    controller.next();
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("does not wrap drag gestures when loop mode is enabled", () => {
    const { content, items, controller } = setup({
      options: { drag: true, loop: true },
    });
    mockHorizontalGeometry(content, items, 100);

    content.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 18,
        button: 0,
        clientX: 100,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 18,
        clientX: 260,
        clientY: 40,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 18,
        clientX: 260,
        clientY: 40,
      }),
    );

    expect(content.scrollLeft).toBe(0);
    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("does not navigate when a nested widget handles the key event", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content">
          <div data-slot="carousel-item">
            <button id="nested">Nested</button>
          </div>
          <div data-slot="carousel-item">Slide 2</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const nested = document.getElementById("nested") as HTMLButtonElement;
    const controller = createCarousel(root);

    nested.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
      }
    });

    nested.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(controller.index).toBe(0);

    controller.destroy();
  });

  it("removes hidden slides from the tab order and restores authored tabindex values", () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content">
          <div data-slot="carousel-item" id="slide-1">
            <a href="#first" id="first-link">First</a>
          </div>
          <div data-slot="carousel-item" id="slide-2">
            <button id="second-button">Second</button>
            <div id="second-custom" tabindex="0">Custom</div>
          </div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const slide1 = document.getElementById("slide-1") as HTMLElement;
    const slide2 = document.getElementById("slide-2") as HTMLElement;
    const firstLink = document.getElementById("first-link") as HTMLAnchorElement;
    const secondButton = document.getElementById("second-button") as HTMLButtonElement;
    const secondCustom = document.getElementById("second-custom") as HTMLElement;
    const controller = createCarousel(root);

    expect(slide2.getAttribute("aria-hidden")).toBe("true");
    expect(slide2.hasAttribute("inert")).toBe(true);
    expect(secondButton.getAttribute("tabindex")).toBe("-1");
    expect(secondCustom.getAttribute("tabindex")).toBe("-1");

    controller.goTo(1);

    expect(slide1.getAttribute("aria-hidden")).toBe("true");
    expect(slide1.hasAttribute("inert")).toBe(true);
    expect(firstLink.getAttribute("tabindex")).toBe("-1");
    expect(slide2.getAttribute("aria-hidden")).toBe("false");
    expect(slide2.hasAttribute("inert")).toBe(false);
    expect(secondButton.hasAttribute("tabindex")).toBe(false);
    expect(secondCustom.getAttribute("tabindex")).toBe("0");

    controller.destroy();
  });

  it("emits carousel:change and onIndexChange only when index changes", () => {
    const changes: number[] = [];
    const callbackChanges: number[] = [];

    const { root, controller } = setup({
      options: {
        onIndexChange: (index) => callbackChanges.push(index),
      },
    });

    root.addEventListener("carousel:change", (event) => {
      changes.push((event as CustomEvent<{ index: number }>).detail.index);
    });

    expect(changes).toEqual([]);
    expect(callbackChanges).toEqual([]);

    controller.next();
    controller.next();
    controller.next();

    expect(changes).toEqual([1, 2]);
    expect(callbackChanges).toEqual([1, 2]);

    controller.destroy();
  });

  it("responds to inbound carousel:set events", () => {
    const { root, controller } = setup();

    root.dispatchEvent(
      new CustomEvent("carousel:set", {
        detail: { action: "next" },
      }),
    );
    expect(controller.index).toBe(1);

    root.dispatchEvent(
      new CustomEvent("carousel:set", {
        detail: { index: 2 },
      }),
    );
    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("uses smooth scrolling for controller and arrow button navigation by default", () => {
    const { controller, content, prev, next } = setup({
      options: { defaultIndex: 1 },
    });
    const calls = createScrollSpy(content);

    controller.next();
    expect(calls[calls.length - 1]?.behavior).toBe("smooth");

    controller.prev();
    expect(calls[calls.length - 1]?.behavior).toBe("smooth");

    controller.goTo(0);
    expect(calls[calls.length - 1]?.behavior).toBe("smooth");

    next?.click();
    expect(calls[calls.length - 1]?.behavior).toBe("smooth");

    prev?.click();
    expect(calls[calls.length - 1]?.behavior).toBe("smooth");

    controller.destroy();
  });

  it("uses smooth scrolling for keyboard and carousel:set navigation by default", () => {
    const { root, content, controller } = setup({
      options: { defaultIndex: 1 },
    });
    const calls = createScrollSpy(content);

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    root.dispatchEvent(new CustomEvent("carousel:set", { detail: { action: "next" } }));
    root.dispatchEvent(new CustomEvent("carousel:set", { detail: { index: 2 } }));

    expect(calls).toHaveLength(4);
    expect(calls.every((call) => call.behavior === "smooth")).toBe(true);

    controller.destroy();
  });

  it("falls back to auto scroll behavior when reduced-motion is preferred", () => {
    const originalMatchMedia = window.matchMedia;

    (
      window as unknown as {
        matchMedia?: typeof window.matchMedia;
      }
    ).matchMedia = ((query: string) =>
      ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      const { root, content, controller } = setup({
        options: { defaultIndex: 1 },
      });
      const calls = createScrollSpy(content);

      controller.next();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      root.dispatchEvent(new CustomEvent("carousel:set", { detail: { index: 2 } }));

      expect(calls).toHaveLength(3);
      expect(calls.every((call) => call.behavior === "auto")).toBe(true);

      controller.destroy();
    } finally {
      if (originalMatchMedia) {
        (
          window as unknown as {
            matchMedia?: typeof window.matchMedia;
          }
        ).matchMedia = originalMatchMedia;
      } else {
        delete (
          window as unknown as {
            matchMedia?: typeof window.matchMedia;
          }
        ).matchMedia;
      }
    }
  });

  it("keeps programmatic smooth navigation index stable during intermediate scroll events", async () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content" id="content">
          <div data-slot="carousel-item">Slide 1</div>
          <div data-slot="carousel-item">Slide 2</div>
          <div data-slot="carousel-item">Slide 3</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    const items = Array.from(
      content.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
    );
    mockHorizontalGeometry(content, items, 100);
    const controller = createCarousel(root);
    const changes: number[] = [];

    root.addEventListener("carousel:change", (event) => {
      changes.push((event as CustomEvent<{ index: number }>).detail.index);
    });

    controller.next();
    expect(controller.index).toBe(1);
    expect(changes).toEqual([1]);

    content.scrollLeft = 20;
    content.dispatchEvent(new Event("scroll", { bubbles: true }));
    await waitForRaf();

    expect(controller.index).toBe(1);
    expect(changes).toEqual([1]);

    content.scrollLeft = 100;
    content.dispatchEvent(new Event("scroll", { bubbles: true }));
    await waitForRaf();

    content.scrollLeft = 210;
    content.dispatchEvent(new Event("scroll", { bubbles: true }));
    await waitForRaf();

    expect(controller.index).toBe(2);
    expect(changes).toEqual([1, 2]);

    controller.destroy();
  });

  it("syncs active index from native scroll position", async () => {
    document.body.innerHTML = `
      <div data-slot="carousel" id="root">
        <div data-slot="carousel-content" id="content">
          <div data-slot="carousel-item">Slide 1</div>
          <div data-slot="carousel-item">Slide 2</div>
          <div data-slot="carousel-item">Slide 3</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = document.getElementById("content") as HTMLElement;
    const items = Array.from(
      content.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
    );
    mockHorizontalGeometry(content, items, 100);
    const controller = createCarousel(root);

    controller.goTo(0);
    content.scrollLeft = 190;
    content.dispatchEvent(new Event("scroll", { bubbles: true }));
    await waitForRaf();

    expect(controller.index).toBe(2);

    controller.destroy();
  });

  it("updates slide count when carousel-item children are added", () => {
    const OriginalMutationObserver = globalThis.MutationObserver;
    let callback: MutationCallback | null = null;

    class MockMutationObserver {
      constructor(cb: MutationCallback) {
        callback = cb;
      }

      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }

    (
      globalThis as unknown as {
        MutationObserver?: typeof MutationObserver;
      }
    ).MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;

    try {
      const { content, controller } = setup({ slideCount: 2 });

      const item = document.createElement("div");
      item.setAttribute("data-slot", "carousel-item");
      item.textContent = "Slide 3";
      content.appendChild(item);

      if (callback) {
        callback([] as MutationRecord[], {} as MutationObserver);
      }

      expect(controller.count).toBe(3);
      expect(item.getAttribute("role")).toBe("group");

      controller.destroy();
    } finally {
      if (OriginalMutationObserver) {
        (
          globalThis as unknown as {
            MutationObserver?: typeof MutationObserver;
          }
        ).MutationObserver = OriginalMutationObserver;
      } else {
        delete (
          globalThis as unknown as {
            MutationObserver?: typeof MutationObserver;
          }
        ).MutationObserver;
      }
    }
  });

  it("preserves the active slide when items are inserted or removed before it", () => {
    const OriginalMutationObserver = globalThis.MutationObserver;
    let callback: MutationCallback | null = null;

    class MockMutationObserver {
      constructor(cb: MutationCallback) {
        callback = cb;
      }

      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }

    (
      globalThis as unknown as {
        MutationObserver?: typeof MutationObserver;
      }
    ).MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;

    try {
      document.body.innerHTML = `
        <div data-slot="carousel" id="root">
          <div data-slot="carousel-content" id="content">
            <div data-slot="carousel-item">Slide 1</div>
            <div data-slot="carousel-item" id="active-slide">Slide 2</div>
            <div data-slot="carousel-item">Slide 3</div>
          </div>
        </div>
      `;

      const root = document.getElementById("root")!;
      const content = document.getElementById("content") as HTMLElement;
      const activeSlide = document.getElementById("active-slide") as HTMLElement;
      const syncGeometry = mockDynamicHorizontalGeometry(content, 100);
      const controller = createCarousel(root);
      const changes: number[] = [];

      root.addEventListener("carousel:change", (event) => {
        changes.push((event as CustomEvent<{ index: number }>).detail.index);
      });

      controller.goTo(1);
      expect(controller.index).toBe(1);
      expect(changes).toEqual([1]);

      const inserted = document.createElement("div");
      inserted.setAttribute("data-slot", "carousel-item");
      inserted.textContent = "Inserted";
      content.insertBefore(inserted, activeSlide);
      syncGeometry();
      if (callback) {
        callback([] as MutationRecord[], {} as MutationObserver);
      }

      expect(controller.index).toBe(2);
      expect(content.scrollLeft).toBe(200);
      expect(changes).toEqual([1, 2]);

      inserted.remove();
      syncGeometry();
      if (callback) {
        callback([] as MutationRecord[], {} as MutationObserver);
      }

      expect(controller.index).toBe(1);
      expect(content.scrollLeft).toBe(100);
      expect(changes).toEqual([1, 2, 1]);

      controller.destroy();
    } finally {
      if (OriginalMutationObserver) {
        (
          globalThis as unknown as {
            MutationObserver?: typeof MutationObserver;
          }
        ).MutationObserver = OriginalMutationObserver;
      } else {
        delete (
          globalThis as unknown as {
            MutationObserver?: typeof MutationObserver;
          }
        ).MutationObserver;
      }
    }
  });

  it("sets nav control buttons to type=button without overriding authored types", () => {
    document.body.innerHTML = `
      <form id="form">
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

    const root = document.getElementById("root")!;
    const prev = document.getElementById("prev") as HTMLButtonElement;
    const next = document.getElementById("next") as HTMLButtonElement;
    const controller = createCarousel(root);

    expect(prev.getAttribute("type")).toBe("button");
    expect(next.getAttribute("type")).toBe("submit");

    controller.destroy();
  });

  it("auto-discovers with create() and dedupes already-bound roots", () => {
    document.body.innerHTML = `
      <div data-slot="carousel">
        <div data-slot="carousel-content">
          <div data-slot="carousel-item">One</div>
        </div>
      </div>
      <div data-slot="carousel">
        <div data-slot="carousel-content">
          <div data-slot="carousel-item">Two</div>
        </div>
      </div>
    `;

    const first = create();
    const second = create();

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(0);

    first.forEach((controller) => controller.destroy());
  });
});
