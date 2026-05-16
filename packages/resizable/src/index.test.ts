import { describe, expect, it } from "bun:test";
import { createResizable, create } from "./index";
import { clearRootBinding, setRootBinding } from "../../core/src/index";

describe("Resizable", () => {
  const ROOT_BINDING_KEY = "@data-slot/resizable";

  const markup = (opts?: { direction?: string; panes?: Array<Record<string, string>> }) => {
    const direction = opts?.direction ?? "horizontal";
    const panes = opts?.panes ?? [{ "data-default-size": "50" }, { "data-default-size": "50" }];
    const paneEls = panes
      .map((attrs, i) => {
        const attrStr = Object.entries(attrs)
          .map(([k, v]) => `${k}="${v}"`)
          .join(" ");
        const handle = i < panes.length - 1 ? `<div data-slot="resizable-handle"></div>` : "";
        return `<div data-slot="resizable-panel" ${attrStr}>Pane ${i}</div>${handle}`;
      })
      .join("");
    document.body.innerHTML = `
      <div data-slot="resizable" id="root" data-direction="${direction}">
        ${paneEls}
      </div>
    `;
    return document.getElementById("root")!;
  };

  const setup = (opts?: Parameters<typeof markup>[0]) => {
    const root = markup(opts);
    const panes = Array.from(
      root.querySelectorAll('[data-slot="resizable-panel"]'),
    ) as HTMLElement[];
    const handles = Array.from(
      root.querySelectorAll('[data-slot="resizable-handle"]'),
    ) as HTMLElement[];
    const controller = createResizable(root);
    return { root, panes, handles, controller };
  };

  // jsdom does not implement layout; force a deterministic group size.
  const mockGroupSize = (root: HTMLElement, size: number, horizontal = true) => {
    Object.defineProperty(root, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          width: horizontal ? size : 0,
          height: horizontal ? 0 : size,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON: () => {},
        }) as DOMRect,
    });
  };

  it("initializes with an even default layout", () => {
    const { controller } = setup({
      panes: [{}, {}],
    });
    expect(controller.layout).toEqual([50, 50]);
    controller.destroy();
  });

  it("respects data-default-size on panes", () => {
    const { controller } = setup({
      panes: [{ "data-default-size": "30" }, { "data-default-size": "70" }],
    });
    expect(controller.layout).toEqual([30, 70]);
    controller.destroy();
  });

  it("distributes remaining space among panes without a default size", () => {
    const { controller } = setup({
      panes: [{ "data-default-size": "40" }, {}, {}],
    });
    const [a, b, c] = controller.layout;
    expect(a).toBe(40);
    expect(b).toBeCloseTo(30);
    expect(c).toBeCloseTo(30);
    controller.destroy();
  });

  it("sets flex-grow style on each pane", () => {
    const { panes, controller } = setup({
      panes: [{ "data-default-size": "25" }, { "data-default-size": "75" }],
    });
    // CSS normalizes the number, so `25` not `25.0` regardless of how it's set.
    expect(parseFloat(panes[0].style.flexGrow)).toBeCloseTo(25);
    expect(parseFloat(panes[1].style.flexGrow)).toBeCloseTo(75);
    controller.destroy();
  });

  it("clamps a default layout that exceeds constraints", () => {
    const { controller } = setup({
      panes: [{ "data-default-size": "90", "data-max-size": "60" }, { "data-default-size": "10" }],
    });
    const [a, b] = controller.layout;
    expect(a).toBeLessThanOrEqual(60);
    expect(a + b).toBeCloseTo(100);
    controller.destroy();
  });

  it('sets role="separator" and aria-orientation on handles', () => {
    const { handles, controller } = setup();
    expect(handles[0].getAttribute("role")).toBe("separator");
    expect(handles[0].getAttribute("aria-orientation")).toBe("vertical");
    controller.destroy();
  });

  it('uses aria-orientation="horizontal" for a vertical group', () => {
    const { handles, controller } = setup({ direction: "vertical" });
    expect(handles[0].getAttribute("aria-orientation")).toBe("horizontal");
    controller.destroy();
  });

  it("sets aria-controls linking handle to the preceding pane", () => {
    const { handles, panes, controller } = setup();
    expect(handles[0].getAttribute("aria-controls")).toBe(panes[0].id);
    controller.destroy();
  });

  it("sets aria-value attributes on handles", () => {
    const { handles, controller } = setup({
      panes: [{ "data-default-size": "40" }, { "data-default-size": "60" }],
    });
    expect(handles[0].getAttribute("aria-valuenow")).toBe("40");
    expect(handles[0].getAttribute("aria-valuemin")).toBe("0");
    expect(handles[0].getAttribute("aria-valuemax")).toBe("100");
    controller.destroy();
  });

  it("adds a default tabindex to handles", () => {
    const { handles, controller } = setup();
    expect(handles[0].getAttribute("tabindex")).toBe("0");
    controller.destroy();
  });

  it("respects an author-provided tabindex", () => {
    document.body.innerHTML = `
      <div data-slot="resizable" id="root">
        <div data-slot="resizable-panel">A</div>
        <div data-slot="resizable-handle" tabindex="-1"></div>
        <div data-slot="resizable-panel">B</div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const controller = createResizable(root);
    const handle = root.querySelector('[data-slot="resizable-handle"]')!;
    expect(handle.getAttribute("tabindex")).toBe("-1");
    controller.destroy();
  });

  it("sets data-state / data-expanded on panes", () => {
    const { panes, controller } = setup();
    expect(panes[0].getAttribute("data-state")).toBe("expanded");
    expect(panes[0].hasAttribute("data-expanded")).toBe(true);
    expect(panes[0].hasAttribute("data-collapsed")).toBe(false);
    controller.destroy();
  });

  it("resizes via the imperative API", () => {
    const { controller } = setup({
      panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
    });
    controller.resizePane(0, 70);
    expect(controller.layout[0]).toBeCloseTo(70);
    expect(controller.layout[1]).toBeCloseTo(30);
    controller.destroy();
  });

  it("clamps imperative resize to minSize", () => {
    const { controller } = setup({
      panes: [
        { "data-default-size": "50", "data-min-size": "20" },
        { "data-default-size": "50", "data-min-size": "20" },
      ],
    });
    controller.resizePane(0, 5);
    expect(controller.layout[0]).toBeGreaterThanOrEqual(20);
    expect(controller.layout[1]).toBeLessThanOrEqual(80);
    controller.destroy();
  });

  it("collapses and expands a collapsible pane", () => {
    const { controller } = setup({
      panes: [
        {
          "data-default-size": "50",
          "data-min-size": "20",
          "data-collapsible": "true",
          "data-collapsed-size": "0",
        },
        { "data-default-size": "50" },
      ],
    });

    expect(controller.isCollapsed(0)).toBe(false);
    controller.collapse(0);
    expect(controller.isCollapsed(0)).toBe(true);
    expect(controller.layout[0]).toBeCloseTo(0);
    expect(controller.layout[1]).toBeCloseTo(100);

    controller.expand(0);
    expect(controller.isCollapsed(0)).toBe(false);
    expect(controller.layout[0]).toBeCloseTo(50);
    controller.destroy();
  });

  it("expand restores the pre-collapse size", () => {
    const { controller } = setup({
      panes: [
        {
          "data-default-size": "35",
          "data-min-size": "10",
          "data-collapsible": "true",
          "data-collapsed-size": "0",
        },
        { "data-default-size": "65" },
      ],
    });
    controller.collapse(0);
    controller.expand(0);
    expect(controller.layout[0]).toBeCloseTo(35);
    controller.destroy();
  });

  it("collapse is a no-op for non-collapsible panes", () => {
    const { controller } = setup({
      panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
    });
    controller.collapse(0);
    expect(controller.layout).toEqual([50, 50]);
    controller.destroy();
  });

  it("updates the data-collapsed attribute when collapsed", () => {
    const { panes, controller } = setup({
      panes: [
        {
          "data-default-size": "50",
          "data-collapsible": "true",
          "data-collapsed-size": "0",
          "data-min-size": "15",
        },
        { "data-default-size": "50" },
      ],
    });
    controller.collapse(0);
    expect(panes[0].getAttribute("data-state")).toBe("collapsed");
    expect(panes[0].hasAttribute("data-collapsed")).toBe(true);
    controller.destroy();
  });

  it("reports getSize / isExpanded correctly", () => {
    const { controller } = setup({
      panes: [{ "data-default-size": "60" }, { "data-default-size": "40" }],
    });
    expect(controller.getSize(0)).toBe(60);
    expect(controller.isExpanded(0)).toBe(true);
    controller.destroy();
  });

  it("setLayout validates and normalizes", () => {
    const { controller } = setup({
      panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
    });
    controller.setLayout([20, 80]);
    expect(controller.layout[0]).toBeCloseTo(20);
    expect(controller.layout[1]).toBeCloseTo(80);
    controller.destroy();
  });

  it("setLayout renormalizes a layout that does not sum to 100", () => {
    const { controller } = setup({
      panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
    });
    controller.setLayout([30, 30]);
    const sum = controller.layout[0] + controller.layout[1];
    expect(sum).toBeCloseTo(100);
    controller.destroy();
  });

  it("emits resizable:change with the layout", () => {
    const { root, controller } = setup();
    let last: number[] | undefined;
    root.addEventListener("resizable:change", (e) => {
      last = (e as CustomEvent).detail.layout;
    });
    controller.resizePane(0, 65);
    expect(last).toBeDefined();
    expect(last![0]).toBeCloseTo(65);
    controller.destroy();
  });

  it("calls onLayoutChange callback", () => {
    const root = markup({
      panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
    });
    let last: number[] | undefined;
    const controller = createResizable(root, {
      onLayoutChange: (layout) => {
        last = layout;
      },
    });
    controller.resizePane(0, 60);
    expect(last![0]).toBeCloseTo(60);
    controller.destroy();
  });

  it("responds to the inbound resizable:set event", () => {
    const { root, controller } = setup({
      panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
    });
    root.dispatchEvent(new CustomEvent("resizable:set", { detail: { layout: [25, 75] } }));
    expect(controller.layout[0]).toBeCloseTo(25);
    controller.destroy();
  });

  it("drags a handle with pointer events", () => {
    const { root, handles, controller } = setup({
      panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
    });
    mockGroupSize(root as HTMLElement, 1000, true);

    handles[0].dispatchEvent(new MouseEvent("mousedown", { clientX: 500, bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("mousemove", { clientX: 600, bubbles: true }));
    // Moved +100px of 1000px == +10%.
    expect(controller.layout[0]).toBeCloseTo(60);
    expect(controller.layout[1]).toBeCloseTo(40);

    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    controller.destroy();
  });

  it("ignores movement when not dragging", () => {
    const { root, controller } = setup();
    mockGroupSize(root as HTMLElement, 1000, true);
    document.body.dispatchEvent(new MouseEvent("mousemove", { clientX: 600, bubbles: true }));
    expect(controller.layout).toEqual([50, 50]);
    controller.destroy();
  });

  it("sets data-active during a pointer drag", () => {
    const { root, handles, controller } = setup();
    mockGroupSize(root as HTMLElement, 1000, true);
    handles[0].dispatchEvent(new MouseEvent("mousedown", { clientX: 500, bubbles: true }));
    expect(handles[0].getAttribute("data-active")).toBe("pointer");
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(handles[0].hasAttribute("data-active")).toBe(false);
    controller.destroy();
  });

  it("resizes with the keyboard arrow keys", () => {
    const { handles, controller } = setup({
      panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
    });
    handles[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    // default keyboardResizeBy is 10
    expect(controller.layout[0]).toBeCloseTo(60);
    controller.destroy();
  });

  it("Home / End keys jump to extremes", () => {
    const { handles, controller } = setup({
      panes: [
        { "data-default-size": "50", "data-min-size": "10" },
        { "data-default-size": "50", "data-min-size": "10" },
      ],
    });
    handles[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(controller.layout[0]).toBeCloseTo(10);
    handles[0].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(controller.layout[0]).toBeCloseTo(90);
    controller.destroy();
  });

  it("Enter toggles collapse from the keyboard", () => {
    const { handles, controller } = setup({
      panes: [
        {
          "data-default-size": "50",
          "data-min-size": "20",
          "data-collapsible": "true",
          "data-collapsed-size": "0",
        },
        { "data-default-size": "50" },
      ],
    });
    handles[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(controller.isCollapsed(0)).toBe(true);
    controller.destroy();
  });

  it('sets data-active="keyboard" on focus', () => {
    const { handles, controller } = setup();
    handles[0].dispatchEvent(new FocusEvent("focus"));
    expect(handles[0].getAttribute("data-active")).toBe("keyboard");
    controller.destroy();
  });

  it("supports more than two panes", () => {
    const { handles, controller } = setup({
      panes: [
        { "data-default-size": "33" },
        { "data-default-size": "33" },
        { "data-default-size": "34" },
      ],
    });
    expect(handles).toHaveLength(2);
    expect(controller.layout).toHaveLength(3);
    controller.resizePane(0, 50);
    expect(controller.layout[0]).toBeCloseTo(50);
    expect(controller.layout.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    controller.destroy();
  });

  it("throws when there are no panes", () => {
    document.body.innerHTML = `<div data-slot="resizable" id="root"></div>`;
    const root = document.getElementById("root")!;
    expect(() => createResizable(root)).toThrow();
  });

  it("throws when handle count does not match pane count", () => {
    document.body.innerHTML = `
      <div data-slot="resizable" id="root">
        <div data-slot="resizable-panel">A</div>
        <div data-slot="resizable-panel">B</div>
      </div>
    `;
    const root = document.getElementById("root")!;
    expect(() => createResizable(root)).toThrow();
  });

  it("cleans up listeners and global styles on destroy", () => {
    const { root, handles, controller } = setup();
    mockGroupSize(root as HTMLElement, 1000, true);
    handles[0].dispatchEvent(new MouseEvent("mousedown", { clientX: 500, bubbles: true }));
    controller.destroy();
    // After destroy, body mousemove should not move anything (no controller).
    document.body.dispatchEvent(new MouseEvent("mousemove", { clientX: 800, bubbles: true }));
    expect(document.head.querySelector("style")).toBeNull();
  });

  describe("data attributes", () => {
    it("reads data-direction from the root", () => {
      const { root, controller } = setup({ direction: "vertical" });
      expect(root.getAttribute("data-direction")).toBe("vertical");
      controller.destroy();
    });

    it("JS direction option overrides data-direction", () => {
      const root = markup({ direction: "vertical" });
      const controller = createResizable(root, { direction: "horizontal" });
      expect((root as HTMLElement).style.flexDirection).toBe("row");
      controller.destroy();
    });

    it("reads data-keyboard-resize-by", () => {
      const root = markup({
        panes: [{ "data-default-size": "50" }, { "data-default-size": "50" }],
      });
      root.setAttribute("data-keyboard-resize-by", "25");
      const controller = createResizable(root);
      const handle = root.querySelector('[data-slot="resizable-handle"]')!;
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(controller.layout[0]).toBeCloseTo(75);
      controller.destroy();
    });
  });

  describe("root binding", () => {
    it("reuses the existing controller for duplicate direct binds", () => {
      const { root, controller } = setup();
      expect(createResizable(root)).toBe(controller);
      controller.destroy();
    });

    it("reuses a controller bound by another module copy", () => {
      const { root, controller } = setup();
      controller.destroy();

      const foreign = { destroy() {} } as ReturnType<typeof createResizable>;
      setRootBinding(root, ROOT_BINDING_KEY, foreign);
      expect(createResizable(root)).toBe(foreign);
      clearRootBinding(root, ROOT_BINDING_KEY, foreign);
    });

    it("create() skips roots bound by another module copy", () => {
      const { root, controller } = setup();
      controller.destroy();

      const foreign = { destroy() {} } as ReturnType<typeof createResizable>;
      setRootBinding(root, ROOT_BINDING_KEY, foreign);
      expect(create()).toHaveLength(0);
      clearRootBinding(root, ROOT_BINDING_KEY, foreign);
    });

    it("allows rebinding after destroy", () => {
      const { root, controller } = setup();
      controller.destroy();
      const rebound = createResizable(root);
      expect(rebound).not.toBe(controller);
      rebound.destroy();
    });
  });

  describe("create()", () => {
    it("binds all resizable groups and returns controllers", () => {
      document.body.innerHTML = `
        <div data-slot="resizable">
          <div data-slot="resizable-panel" data-default-size="50">A</div>
          <div data-slot="resizable-handle"></div>
          <div data-slot="resizable-panel" data-default-size="50">B</div>
        </div>
        <div data-slot="resizable">
          <div data-slot="resizable-panel" data-default-size="50">C</div>
          <div data-slot="resizable-handle"></div>
          <div data-slot="resizable-panel" data-default-size="50">D</div>
        </div>
      `;
      const controllers = create();
      expect(controllers).toHaveLength(2);
      controllers.forEach((c) => c.destroy());
    });

    it("allows re-initialization after destroy", () => {
      document.body.innerHTML = `
        <div data-slot="resizable">
          <div data-slot="resizable-panel" data-default-size="50">A</div>
          <div data-slot="resizable-handle"></div>
          <div data-slot="resizable-panel" data-default-size="50">B</div>
        </div>
      `;
      const first = create();
      expect(first).toHaveLength(1);
      first[0]?.destroy();
      const second = create();
      expect(second).toHaveLength(1);
      second[0]?.destroy();
    });
  });
});
