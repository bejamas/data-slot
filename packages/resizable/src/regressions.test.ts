import { afterEach, describe, expect, it } from "bun:test";
import { createResizable, type ResizableController } from "./index";

const controllers: ResizableController[] = [];
const panel = '<div data-slot="resizable-panel"></div>';
const handle = '<div data-slot="resizable-handle"></div>';
const bind = (root: HTMLElement) => {
  const controller = createResizable(root);
  controllers.push(controller);
  return controller;
};
const setup = (direction = "horizontal") => {
  document.body.innerHTML = `<div data-slot="resizable" data-direction="${direction}">${panel}${handle}${panel}</div>`;
  const root = document.body.firstElementChild as HTMLElement;
  Object.defineProperty(root, "getBoundingClientRect", {
    value: () => ({ width: 500, height: 500 }),
  });
  return {
    root,
    handle: root.querySelector<HTMLElement>('[data-slot="resizable-handle"]')!,
    controller: bind(root),
  };
};

afterEach(() => {
  controllers.splice(0).reverse().forEach(controller => controller.destroy());
  document.body.innerHTML = "";
});

describe("Resizable regressions", () => {
  it.each(["horizontal", "vertical"])("restores the layout when a %s drag returns to its origin", direction => {
    const { handle, controller } = setup(direction);
    const position = direction === "horizontal" ? "clientX" : "clientY";
    handle.dispatchEvent(new MouseEvent("mousedown", { [position]: 250, bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("mousemove", { [position]: 350, bubbles: true }));
    expect(controller.layout).toEqual([70, 30]);
    document.body.dispatchEvent(new MouseEvent("mousemove", { [position]: 250, bubbles: true }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(controller.layout).toEqual([50, 50]);
    expect(handle.getAttribute("aria-valuenow")).toBe("50");
    expect(handle.hasAttribute("data-active")).toBe(false);
  });

  it("does not apply a nested group's bubbling layout event to its parent", () => {
    document.body.innerHTML = `
      <div data-slot="resizable" id="outer">
        <div data-slot="resizable-panel">
          <div data-slot="resizable" id="inner">${panel}${handle}${panel}</div>
        </div>
        ${handle}${panel}${handle}${panel}
      </div>`;
    const outer = bind(document.getElementById("outer")!);
    const innerRoot = document.getElementById("inner")!;
    const inner = bind(innerRoot);
    const original = outer.layout;
    innerRoot.dispatchEvent(new CustomEvent("resizable:set", {
      bubbles: true,
      detail: { layout: [25, 75] },
    }));
    expect(inner.layout).toEqual([25, 75]);
    expect(outer.layout).toEqual(original);
  });

  it("rejects invalid layouts without changing sizes or emitting a change", () => {
    const { root, handle, controller } = setup();
    let changes = 0;
    root.addEventListener("resizable:change", () => { changes += 1; });
    const invalidLayouts = [[0, 0], [NaN, 50], [Infinity, 50], [-10, 110], [50], [Number.MAX_VALUE, Number.MAX_VALUE]];
    for (const layout of invalidLayouts) {
      expect(() => controller.setLayout(layout)).toThrow();
      expect(controller.layout).toEqual([50, 50]);
      expect(handle.getAttribute("aria-valuenow")).toBe("50");
    }
    expect(changes).toBe(0);
    controller.setLayout([0, 100]);
    expect(controller.layout).toEqual([0, 100]);
  });

  it("keeps a single panel at full size when resized", () => {
    document.body.innerHTML = `<div data-slot="resizable">${panel}</div>`;
    const controller = bind(document.body.firstElementChild as HTMLElement);
    controller.resizePane(0, 25);
    expect(controller.layout).toEqual([100]);
  });

  it("rejects invalid imperative indices and sizes before changing the layout", () => {
    const { controller } = setup();
    for (const index of [-1, 2, 0.5]) {
      expect(() => controller.getSize(index)).toThrow("Invalid pane index");
      expect(() => controller.resizePane(index, 25)).toThrow("Invalid pane index");
      expect(() => controller.collapse(index)).toThrow("Invalid pane index");
      expect(() => controller.expand(index)).toThrow("Invalid pane index");
    }
    expect(() => controller.resizePane(0, NaN)).toThrow("Pane size must be finite");
    expect(controller.layout).toEqual([50, 50]);
  });
});
