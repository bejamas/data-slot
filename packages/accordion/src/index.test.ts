import { describe, expect, it } from "bun:test";
import { createAccordion, create } from "./index";
import { clearRootBinding, setRootBinding } from "../../core/src/index";

describe("Accordion", () => {
  const ROOT_BINDING_KEY = "@data-slot/accordion";

  const setup = ({
    options = {},
    rootAttrs = "",
    itemAttrs = ["", "", ""],
  }: {
    options?: Parameters<typeof createAccordion>[1];
    rootAttrs?: string;
    itemAttrs?: string[];
  } = {}) => {
    document.body.innerHTML = `
      <div data-slot="accordion" id="root" ${rootAttrs}>
        <div data-slot="accordion-item" data-value="one" ${itemAttrs[0] ?? ""}>
          <button data-slot="accordion-trigger">Item One</button>
          <div data-slot="accordion-content">Content One</div>
        </div>
        <div data-slot="accordion-item" data-value="two" ${itemAttrs[1] ?? ""}>
          <button data-slot="accordion-trigger">Item Two</button>
          <div data-slot="accordion-content">Content Two</div>
        </div>
        <div data-slot="accordion-item" data-value="three" ${itemAttrs[2] ?? ""}>
          <button data-slot="accordion-trigger">Item Three</button>
          <div data-slot="accordion-content">Content Three</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const items = Array.from(
      root.querySelectorAll('[data-slot="accordion-item"]')
    ) as HTMLElement[];
    const triggers = Array.from(
      root.querySelectorAll('[data-slot="accordion-trigger"]')
    ) as HTMLElement[];
    const contents = Array.from(
      root.querySelectorAll('[data-slot="accordion-content"]')
    ) as HTMLElement[];
    const controller = createAccordion(root, options);

    return { root, items, triggers, contents, controller };
  };

  const waitForRaf = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const waitForExit = async () => {
    await waitForRaf();
    await waitForRaf();
  };

  const waitForTimeout = () =>
    new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 0);
    });

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(() => resolve(), ms);
    });

  const mockScrollSize = (element: HTMLElement, initialHeight: number, initialWidth: number) => {
    let height = initialHeight;
    let width = initialWidth;

    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      get: () => height,
    });

    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      get: () => width,
    });

    return (nextHeight: number, nextWidth: number) => {
      height = nextHeight;
      width = nextWidth;
    };
  };

  it("initializes with Base UI-style root, item, trigger, and content attrs", () => {
    const { root, items, triggers, contents, controller } = setup();

    expect(root.hasAttribute("role")).toBe(false);
    expect(root.getAttribute("data-orientation")).toBe("vertical");
    expect(root.hasAttribute("data-disabled")).toBe(false);

    expect(items[0]?.getAttribute("data-state")).toBe("closed");
    expect(items[0]?.hasAttribute("data-closed")).toBe(true);
    expect(items[0]?.hasAttribute("data-open")).toBe(false);
    expect(items[0]?.getAttribute("data-index")).toBe("0");

    expect(triggers[0]?.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[0]?.getAttribute("data-state")).toBe("closed");
    expect(triggers[0]?.hasAttribute("data-panel-open")).toBe(false);

    expect(contents[0]?.hidden).toBe(true);
    expect(contents[0]?.getAttribute("data-state")).toBe("closed");
    expect(contents[0]?.hasAttribute("data-closed")).toBe(true);
    expect(contents[0]?.hasAttribute("data-open")).toBe(false);
    expect(contents[0]?.getAttribute("data-index")).toBe("0");
    expect(contents[0]?.getAttribute("data-orientation")).toBe("vertical");
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-height")).toBe("0px");
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-width")).toBe("0px");
    expect(contents[0]?.style.getPropertyValue("--radix-accordion-content-height")).toBe("0px");
    expect(contents[0]?.style.getPropertyValue("--radix-accordion-content-width")).toBe("0px");

    controller.destroy();
  });

  it("initializes with defaultValue expanded", () => {
    const { contents, triggers, controller } = setup({ options: { defaultValue: "two" } });

    expect(contents[0]?.hidden).toBe(true);
    expect(contents[1]?.hidden).toBe(false);
    expect(contents[1]?.hasAttribute("data-open")).toBe(true);
    expect(triggers[1]?.hasAttribute("data-panel-open")).toBe(true);
    expect(controller.value).toEqual(["two"]);

    controller.destroy();
  });

  it("expands and collapses items on trigger click", async () => {
    const { triggers, contents, controller } = setup();

    triggers[0]?.click();
    expect(contents[0]?.hidden).toBe(false);
    expect(contents[0]?.hasAttribute("data-open")).toBe(true);
    expect(controller.value).toEqual(["one"]);

    triggers[0]?.click();
    expect(contents[0]?.hasAttribute("data-ending-style")).toBe(true);
    expect(controller.value).toEqual([]);

    await waitForExit();
    expect(contents[0]?.hidden).toBe(true);

    controller.destroy();
  });

  it("collapses other items in single mode", async () => {
    const { triggers, contents, controller } = setup({ options: { defaultValue: "one" } });

    triggers[1]?.click();

    expect(contents[0]?.getAttribute("data-state")).toBe("closed");
    expect(contents[1]?.hidden).toBe(false);
    expect(controller.value).toEqual(["two"]);

    await waitForExit();
    expect(contents[0]?.hidden).toBe(true);

    controller.destroy();
  });

  it("allows multiple items in multiple mode", () => {
    const { triggers, contents, controller } = setup({ options: { multiple: true } });

    triggers[0]?.click();
    triggers[1]?.click();

    expect(contents[0]?.hidden).toBe(false);
    expect(contents[1]?.hidden).toBe(false);
    expect(controller.value).toEqual(["one", "two"]);

    controller.destroy();
  });

  it("keeps deprecated collapsible=false compatibility in single mode", () => {
    const { triggers, contents, controller } = setup({
      options: {
        defaultValue: "one",
        collapsible: false,
      },
    });

    triggers[0]?.click();

    expect(contents[0]?.hidden).toBe(false);
    expect(controller.value).toEqual(["one"]);

    controller.destroy();
  });

  it("emits accordion:change when values change", () => {
    const { root, controller } = setup();

    let lastValue: string[] = [];
    root.addEventListener("accordion:change", (event) => {
      lastValue = (event as CustomEvent).detail.value;
    });

    controller.expand("one");
    expect(lastValue).toEqual(["one"]);

    controller.collapse("one");
    expect(lastValue).toEqual([]);

    controller.destroy();
  });

  it("controller methods ignore invalid values and work correctly", () => {
    const { controller } = setup({ options: { multiple: true } });

    controller.expand("one");
    expect(controller.value).toEqual(["one"]);

    controller.expand("two");
    expect(controller.value).toEqual(["one", "two"]);

    controller.expand("missing");
    expect(controller.value).toEqual(["one", "two"]);

    controller.collapse("one");
    expect(controller.value).toEqual(["two"]);

    controller.toggle("two");
    expect(controller.value).toEqual([]);

    controller.toggle("three");
    expect(controller.value).toEqual(["three"]);

    controller.destroy();
  });

  it("supports accordion:set while respecting valid values", () => {
    const { root, controller } = setup({ options: { multiple: true } });

    root.dispatchEvent(
      new CustomEvent("accordion:set", {
        detail: { value: ["one", "missing", "two"] },
      })
    );

    expect(controller.value).toEqual(["one", "two"]);

    controller.destroy();
  });

  it("uses canonical disabled behavior on the root but still allows programmatic control", () => {
    const { root, items, triggers, contents, controller } = setup({
      options: { disabled: true, defaultValue: "one" },
    });

    expect(root.hasAttribute("data-disabled")).toBe(true);
    expect(items[0]?.hasAttribute("data-disabled")).toBe(true);
    expect(triggers[0]?.hasAttribute("data-disabled")).toBe(true);
    expect(triggers[0]?.getAttribute("aria-disabled")).toBe("true");
    expect(contents[0]?.hasAttribute("data-disabled")).toBe(true);

    triggers[1]?.click();
    expect(controller.value).toEqual(["one"]);

    controller.expand("two");
    expect(controller.value).toEqual(["two"]);

    root.dispatchEvent(
      new CustomEvent("accordion:set", {
        detail: { value: "three" },
      })
    );
    expect(controller.value).toEqual(["three"]);

    controller.destroy();
  });

  it("respects per-item disabled state and skips disabled items during roving focus", () => {
    const { triggers, contents, controller } = setup({
      itemAttrs: ["", "data-disabled", ""],
    });
    const triggerOne = triggers[0]!;
    const triggerTwo = triggers[1]!;
    const triggerThree = triggers[2]!;

    expect(triggerTwo.hasAttribute("data-disabled")).toBe(true);
    expect(triggerTwo.getAttribute("aria-disabled")).toBe("true");

    triggerTwo.click();
    expect(contents[1]?.hidden).toBe(true);
    expect(controller.value).toEqual([]);

    triggerOne.focus();
    triggerOne.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerThree);

    controller.destroy();
  });

  it("supports hiddenUntilFound and reopens on beforematch", async () => {
    const { contents, controller } = setup({
      options: { hiddenUntilFound: true },
    });

    expect(contents[0]?.getAttribute("hidden")).toBe("until-found");

    contents[1]?.dispatchEvent(new Event("beforematch", { bubbles: true }));

    expect(controller.value).toEqual(["two"]);
    expect(contents[1]?.hasAttribute("hidden")).toBe(false);

    controller.collapse("two");
    await waitForExit();
    expect(contents[1]?.getAttribute("hidden")).toBe("until-found");

    controller.destroy();
  });

  it("supports horizontal orientation", () => {
    const { root, triggers, contents, controller } = setup({
      options: { orientation: "horizontal" },
    });
    const triggerOne = triggers[0]!;
    const triggerTwo = triggers[1]!;

    expect(root.getAttribute("data-orientation")).toBe("horizontal");
    expect(contents[0]?.getAttribute("data-orientation")).toBe("horizontal");

    triggerOne.focus();
    triggerOne.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerTwo);

    triggerTwo.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerOne);

    controller.destroy();
  });

  it("reverses ArrowLeft and ArrowRight in RTL horizontal orientation", () => {
    const { triggers, controller } = setup({
      options: { orientation: "horizontal" },
      rootAttrs: 'dir="rtl"',
    });
    const triggerOne = triggers[0]!;
    const triggerTwo = triggers[1]!;

    triggerOne.focus();
    triggerOne.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerTwo);

    triggerTwo.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerOne);

    controller.destroy();
  });

  it("honors loopFocus=false", () => {
    const { triggers, controller } = setup({
      options: { loopFocus: false },
    });
    const triggerOne = triggers[0]!;
    const triggerThree = triggers[2]!;

    triggerThree.focus();
    triggerThree.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerThree);

    triggerOne.focus();
    triggerOne.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerOne);

    controller.destroy();
  });

  it("opens on Space keydown and suppresses the synthesized click toggle", async () => {
    const { triggers, contents, controller } = setup();

    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true })
    );
    expect(controller.value).toEqual(["one"]);
    expect(contents[0]?.hidden).toBe(false);

    triggers[0]?.click();
    expect(controller.value).toEqual(["one"]);

    await waitForTimeout();
    triggers[0]?.click();
    expect(controller.value).toEqual([]);

    controller.destroy();
  });

  it("opens on Enter keydown and suppresses the synthesized click toggle", async () => {
    const { triggers, controller } = setup();

    triggers[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    expect(controller.value).toEqual(["one"]);

    triggers[0]?.click();
    expect(controller.value).toEqual(["one"]);

    await waitForTimeout();
    triggers[0]?.click();
    expect(controller.value).toEqual([]);

    controller.destroy();
  });

  it("sets data-starting-style on open and settles panel size vars to auto", async () => {
    const { contents, controller } = setup();
    mockScrollSize(contents[0]!, 120, 240);

    controller.expand("one");

    expect(contents[0]?.hasAttribute("data-starting-style")).toBe(true);
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-height")).toBe("120px");
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-width")).toBe("240px");
    expect(contents[0]?.style.getPropertyValue("--radix-accordion-content-height")).toBe("120px");
    expect(contents[0]?.style.getPropertyValue("--radix-accordion-content-width")).toBe("240px");

    await waitForRaf();
    expect(contents[0]?.hasAttribute("data-starting-style")).toBe(true);
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-width")).toBe("auto");
    expect(contents[0]?.style.getPropertyValue("--radix-accordion-content-height")).toBe("auto");
    expect(contents[0]?.style.getPropertyValue("--radix-accordion-content-width")).toBe("auto");

    await waitForRaf();
    expect(contents[0]?.hasAttribute("data-starting-style")).toBe(false);

    controller.destroy();
  });

  it("does not settle panel size vars early when a shorter non-size transition ends first", async () => {
    const { contents, controller } = setup();
    const content = contents[0]!;
    mockScrollSize(content, 120, 240);
    content.style.transitionProperty = "height, opacity";
    content.style.transitionDuration = "30ms, 15ms";
    content.style.transitionDelay = "0ms, 0ms";

    controller.expand("one");

    const opacityEnd = new Event("transitionend");
    Object.defineProperty(opacityEnd, "propertyName", {
      configurable: true,
      value: "opacity",
    });
    content.dispatchEvent(opacityEnd);

    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("120px");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("240px");
    expect(content.style.getPropertyValue("--radix-accordion-content-height")).toBe("120px");

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 90);
    });

    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("auto");
    expect(content.style.getPropertyValue("--radix-accordion-content-height")).toBe("auto");

    controller.destroy();
  });

  it("supports keyframe-based panel animations without zeroing panel vars before exit completes", async () => {
    const { contents, controller } = setup();
    const content = contents[0]!;
    const setSize = mockScrollSize(content, 120, 240);

    content.style.animationName = "accordion-open";
    content.style.animationDuration = "30ms";
    content.style.animationDelay = "0ms";
    content.style.transitionDuration = "0s";

    controller.expand("one");

    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("120px");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("240px");

    await wait(40);
    content.dispatchEvent(new Event("animationend"));

    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("auto");

    setSize(96, 180);
    controller.collapse("one");

    expect(content.hasAttribute("data-ending-style")).toBe(true);
    expect(content.hidden).toBe(false);
    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("96px");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("180px");

    await waitForRaf();
    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("96px");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("180px");

    await wait(40);
    content.dispatchEvent(new Event("animationend"));

    expect(content.hasAttribute("data-ending-style")).toBe(false);
    expect(content.hidden).toBe(true);
    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("0px");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("0px");

    controller.destroy();
  });

  it("freezes settled keyframe panels until their state changes again", async () => {
    document.body.innerHTML = `
      <div data-slot="accordion" id="root">
        <div data-slot="accordion-item" data-value="one">
          <button data-slot="accordion-trigger">Item One</button>
          <div data-slot="accordion-content">Content One</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const content = root.querySelector('[data-slot="accordion-content"]') as HTMLElement;
    const setSize = mockScrollSize(content, 120, 240);

    content.style.animationName = "accordion-open";
    content.style.animationDuration = "30ms";
    content.style.animationDelay = "0ms";
    content.style.transitionDuration = "0s";

    const controller = createAccordion(root, { defaultValue: "one" });

    await wait(40);
    content.dispatchEvent(new Event("animationend"));

    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("auto");
    expect(content.style.animationName).toBe("none");

    setSize(96, 180);
    controller.collapse("one");

    expect(content.style.animationName).toBe("accordion-open");
    expect(content.hasAttribute("data-ending-style")).toBe(true);
    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("96px");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("180px");

    await wait(40);
    content.dispatchEvent(new Event("animationend"));

    expect(content.hidden).toBe(true);
    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("0px");

    setSize(88, 160);
    controller.expand("one");

    expect(content.style.animationName).toBe("accordion-open");
    expect(content.hasAttribute("data-starting-style")).toBe(true);
    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("88px");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("160px");

    await wait(40);
    content.dispatchEvent(new Event("animationend"));

    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("auto");
    expect(content.style.animationName).toBe("none");

    controller.destroy();
  });

  it("measures panel size correctly when descendants consume --accordion-panel-height", () => {
    const { contents, controller } = setup();
    const content = contents[0]!;

    content.style.animationName = "accordion-open";
    content.style.animationDuration = "30ms";
    content.style.animationDelay = "0ms";
    content.style.transitionDuration = "0s";

    Object.defineProperty(content, "scrollHeight", {
      configurable: true,
      get: () => {
        const height = content.style.getPropertyValue("--accordion-panel-height").trim();
        return height === "auto" ? 120 : Number.parseFloat(height) || 0;
      },
    });

    Object.defineProperty(content, "scrollWidth", {
      configurable: true,
      get: () => {
        const width = content.style.getPropertyValue("--accordion-panel-width").trim();
        return width === "auto" ? 240 : Number.parseFloat(width) || 0;
      },
    });

    controller.expand("one");

    expect(content.style.getPropertyValue("--accordion-panel-height")).toBe("120px");
    expect(content.style.getPropertyValue("--accordion-panel-width")).toBe("240px");

    controller.destroy();
  });

  it("does not remeasure a settled keyframe panel when another item opens in multiple mode", async () => {
    const { contents, controller } = setup({ options: { multiple: true } });
    const firstContent = contents[0]!;
    const secondContent = contents[1]!;
    mockScrollSize(firstContent, 120, 240);
    mockScrollSize(secondContent, 96, 180);

    firstContent.style.animationName = "accordion-open";
    firstContent.style.animationDuration = "30ms";
    firstContent.style.animationDelay = "0ms";
    firstContent.style.transitionDuration = "0s";

    secondContent.style.animationName = "accordion-open";
    secondContent.style.animationDuration = "30ms";
    secondContent.style.animationDelay = "0ms";
    secondContent.style.transitionDuration = "0s";

    controller.expand("one");
    await wait(40);
    firstContent.dispatchEvent(new Event("animationend"));

    expect(firstContent.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
    expect(firstContent.style.getPropertyValue("--accordion-panel-width")).toBe("auto");

    controller.expand("two");

    expect(firstContent.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
    expect(firstContent.style.getPropertyValue("--accordion-panel-width")).toBe("auto");
    expect(firstContent.hasAttribute("data-starting-style")).toBe(false);
    expect(firstContent.hasAttribute("data-ending-style")).toBe(false);

    controller.destroy();
  });

  it("sets data-ending-style on close, transitions panel size vars to 0px, and hides after exit", async () => {
    const { contents, controller } = setup();
    const setSize = mockScrollSize(contents[0]!, 80, 160);

    controller.expand("one");
    await waitForRaf();

    expect(contents[0]?.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-width")).toBe("auto");

    setSize(96, 180);
    controller.collapse("one");

    expect(contents[0]?.hasAttribute("data-ending-style")).toBe(true);
    expect(contents[0]?.hidden).toBe(false);
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-height")).toBe("96px");
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-width")).toBe("180px");

    await waitForRaf();
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-height")).toBe("0px");
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-width")).toBe("0px");

    await waitForExit();
    expect(contents[0]?.hasAttribute("data-ending-style")).toBe(false);
    expect(contents[0]?.hidden).toBe(true);

    controller.destroy();
  });

  it("cancels pending exit markers when a panel is reopened before exit completes", async () => {
    const { contents, controller } = setup();
    mockScrollSize(contents[0]!, 100, 200);

    controller.expand("one");
    controller.collapse("one");
    expect(contents[0]?.hasAttribute("data-ending-style")).toBe(true);

    controller.expand("one");
    expect(controller.value).toEqual(["one"]);
    expect(contents[0]?.hasAttribute("data-ending-style")).toBe(false);
    expect(contents[0]?.hidden).toBe(false);

    await waitForRaf();
    expect(contents[0]?.style.getPropertyValue("--accordion-panel-height")).toBe("auto");

    controller.destroy();
  });

  it("reads Base UI-style root data attributes", () => {
    const { root, triggers, controller } = setup({
      rootAttrs:
        'data-orientation="horizontal" data-loop-focus="false" data-hidden-until-found data-default-value="two"',
    });
    const triggerThree = triggers[2]!;

    expect(root.getAttribute("data-orientation")).toBe("horizontal");
    expect(controller.value).toEqual(["two"]);

    triggerThree.focus();
    triggerThree.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerThree);

    controller.destroy();
  });

  it("reads data-disabled from the root", () => {
    const { root, triggers, controller } = setup({
      rootAttrs: "data-disabled",
    });

    expect(root.hasAttribute("data-disabled")).toBe(true);

    triggers[0]?.click();
    expect(controller.value).toEqual([]);

    controller.destroy();
  });

  it("data-multiple allows multiple items open", () => {
    const { triggers, controller } = setup({
      rootAttrs: "data-multiple",
    });

    triggers[0]?.click();
    triggers[1]?.click();

    expect(controller.value).toEqual(["one", "two"]);

    controller.destroy();
  });

  it("data-collapsible='false' prevents collapsing the last item", () => {
    const { triggers, controller } = setup({
      rootAttrs: 'data-collapsible="false"',
    });

    triggers[0]?.click();
    expect(controller.value).toEqual(["one"]);

    triggers[0]?.click();
    expect(controller.value).toEqual(["one"]);

    controller.destroy();
  });

  it("data-default-value expands the initial item", () => {
    const { controller } = setup({
      rootAttrs: 'data-default-value="two"',
    });

    expect(controller.value).toEqual(["two"]);

    controller.destroy();
  });

  it("data-default-value JSON array expands multiple initial items in multiple mode", () => {
    const { controller } = setup({
      rootAttrs: `data-multiple data-default-value='["one","three"]'`,
    });

    expect(controller.value).toEqual(["one", "three"]);

    controller.destroy();
  });

  it("data-default-value JSON array resolves to the first valid item in single mode", () => {
    const { controller } = setup({
      rootAttrs: `data-default-value='["two","one"]'`,
    });

    expect(controller.value).toEqual(["two"]);

    controller.destroy();
  });

  it("data-default-value JSON array ignores non-string entries", () => {
    const { controller } = setup({
      rootAttrs: `data-multiple data-default-value='["one",2,false,"three"]'`,
    });

    expect(controller.value).toEqual(["one", "three"]);

    controller.destroy();
  });

  it("falls back to the raw data-default-value string when JSON array parsing fails", () => {
    document.body.innerHTML = `
      <div data-slot="accordion" id="root" data-default-value="[two]">
        <div data-slot="accordion-item" data-value="[two]">
          <button data-slot="accordion-trigger">Item Two</button>
          <div data-slot="accordion-content">Content Two</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root")!;
    const controller = createAccordion(root);

    expect(controller.value).toEqual(["[two]"]);

    controller.destroy();
  });

  it("JS options override data attributes", () => {
    const { triggers, controller } = setup({
      options: { multiple: false, orientation: "vertical" },
      rootAttrs: 'data-multiple data-orientation="horizontal"',
    });
    const triggerOne = triggers[0]!;
    const triggerTwo = triggers[1]!;

    triggerOne.click();
    triggerTwo.click();
    expect(controller.value).toEqual(["two"]);

    triggerTwo.focus();
    triggerTwo.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    expect(document.activeElement).toBe(triggerTwo);

    controller.destroy();
  });

  it("create binds all accordion roots and returns controllers", () => {
    document.body.innerHTML = `
      <div data-slot="accordion">
        <div data-slot="accordion-item" data-value="a">
          <button data-slot="accordion-trigger">A</button>
          <div data-slot="accordion-content">A Content</div>
        </div>
        <div data-slot="accordion-item" data-value="b">
          <button data-slot="accordion-trigger">B</button>
          <div data-slot="accordion-content">B Content</div>
        </div>
      </div>
    `;

    const controllers = create();
    const triggers = document.querySelectorAll('[data-slot="accordion-trigger"]');
    const contents = document.querySelectorAll('[data-slot="accordion-content"]');

    expect(controllers).toHaveLength(1);
    expect((contents[0] as HTMLElement).hidden).toBe(true);

    (triggers[0] as HTMLElement).click();
    expect((contents[0] as HTMLElement).hidden).toBe(false);

    controllers[0]?.expand("b");
    expect((contents[1] as HTMLElement).hidden).toBe(false);

    controllers.forEach((controller) => controller.destroy());
  });

  describe("root binding", () => {
    it("reuses the existing controller for duplicate direct binds", () => {
      const { root, controller } = setup();

      expect(createAccordion(root)).toBe(controller);

      controller.destroy();
    });

    it("reuses a controller bound by another module copy", () => {
      const { root, controller } = setup();
      controller.destroy();

      const foreignController = { destroy() {} } as ReturnType<typeof createAccordion>;
      setRootBinding(root, ROOT_BINDING_KEY, foreignController);

      expect(createAccordion(root)).toBe(foreignController);

      clearRootBinding(root, ROOT_BINDING_KEY, foreignController);
    });

    it("create() skips roots bound by another module copy", () => {
      const { root, controller } = setup();
      controller.destroy();

      const foreignController = { destroy() {} } as ReturnType<typeof createAccordion>;
      setRootBinding(root, ROOT_BINDING_KEY, foreignController);

      expect(create()).toHaveLength(0);

      clearRootBinding(root, ROOT_BINDING_KEY, foreignController);
    });

    it("allows rebinding after destroy", () => {
      const { root, controller } = setup();
      controller.destroy();

      const rebound = createAccordion(root);
      expect(rebound).not.toBe(controller);

      rebound.destroy();
    });
  });
});
