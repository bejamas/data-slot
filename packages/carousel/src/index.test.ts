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
        ({
          left: index * itemSize,
          top: 0,
          width: itemSize,
          height: 80,
          right: (index + 1) * itemSize,
          bottom: 80,
          x: index * itemSize,
          y: 0,
          toJSON() {},
        }) as DOMRect;
    });

    content.scrollTo = ((options: ScrollToOptions) => {
      if (typeof options.left === "number") content.scrollLeft = options.left;
      if (typeof options.top === "number") content.scrollTop = options.top;
    }) as typeof content.scrollTo;
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

      callback?.([], {} as MutationObserver);

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
