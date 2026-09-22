import { afterEach, describe, expect, it } from "bun:test";
import { createTooltip, create } from "./index";

const controllers: ReturnType<typeof createTooltip>[] = [];
const wait = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));
const setup = (options: Parameters<typeof createTooltip>[1] = {}, attributes = "") => {
  document.body.innerHTML = `<div data-slot="tooltip" ${attributes}>
    <button data-slot="tooltip-trigger" aria-label="Preview">Preview</button>
    <div data-slot="tooltip-content"><span>Details</span></div>
    <button id="outside">Outside</button>
  </div>`;
  const root = document.body.firstElementChild!;
  const trigger = root.querySelector("button")!;
  const content = root.querySelector<HTMLElement>('[data-slot="tooltip-content"]')!;
  const controller = createTooltip(root, options);
  controllers.push(controller);
  return { root, trigger, content, controller };
};
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  document.body.innerHTML = "";
});

describe("tooltip mounting", () => {
  it("detaches initially and reuses the same nodes over repeated openings", async () => {
    const { root, content, controller } = setup();
    const child = content.firstElementChild;
    expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();
    for (let i = 0; i < 2; i++) {
      controller.show();
      expect(document.querySelector('[data-slot="tooltip-content"]')).toBe(content);
      expect(content.firstElementChild).toBe(child);
      controller.hide();
      await wait();
      expect(content.isConnected).toBe(false);
    }
    controller.destroy();
    expect(content.parentNode).toBe(root);
    const rebound = createTooltip(root);
    controllers.push(rebound);
    rebound.show();
    expect(content.isConnected).toBe(true);
  });

  it("supports eager markup and an overriding JavaScript option", async () => {
    const eager = setup({}, 'data-mount-strategy="eager"');
    expect(eager.content.isConnected).toBe(true);
    eager.controller.show();
    eager.controller.hide();
    await wait();
    expect(eager.content.isConnected).toBe(true);
    expect(eager.content.hidden).toBe(true);
    eager.controller.destroy();
    const lazy = setup({ mountStrategy: "lazy" }, 'data-mount-strategy="eager"');
    expect(lazy.content.isConnected).toBe(false);
    lazy.controller.destroy();
    expect(setup({ mountStrategy: "eager" }).content.isConnected).toBe(true);
  });

  it("keeps exiting content connected and cancels removal on rapid reopen", async () => {
    const { content, controller } = setup();
    content.style.transitionProperty = "opacity";
    content.style.transitionDuration = "50ms";
    controller.show();
    controller.hide();
    expect(content.isConnected).toBe(true);
    expect(content.hasAttribute("data-ending-style")).toBe(true);
    controller.show();
    await wait(110);
    expect(content.isConnected).toBe(true);
    expect(content.hidden).toBe(false);
    controller.hide();
    await wait(110);
    expect(content.isConnected).toBe(false);
  });

  it("mounts inline when portaling is disabled and restores after destroy during exit", async () => {
    const { root, content, controller } = setup({ portal: false });
    controller.show();
    expect(content.parentNode).toBe(root);
    content.style.transitionDuration = "50ms";
    controller.hide();
    controller.destroy();
    await wait(110);
    expect(content.parentNode).toBe(root);
    expect(content.hidden).toBe(true);
    controller.show();
    expect(content.hidden).toBe(true);
  });

  it("cleans up an open portal after its root is removed", async () => {
    const { root, content, controller } = setup();
    controller.show();
    root.remove();
    controller.destroy();
    await wait();
    expect(document.querySelector('[data-slot="tooltip-positioner"]')).toBeNull();
    expect(content.parentNode).toBe(root);
    expect(content.isConnected).toBe(false);
  });

  it("discovers instances in detached content without rebinding existing roots", () => {
    const { content } = setup();
    content.innerHTML = `<div data-slot="tooltip"><button data-slot="tooltip-trigger">Nested</button><div data-slot="tooltip-content">Nested details</div></div>`;
    const nested = create();
    controllers.push(...nested);
    expect(nested.length).toBe(1);
    expect(create().length).toBe(0);
  });
});

it("mounts on keyboard focus and removes its description on Escape", async () => {
  const { content, trigger, controller } = setup({ delay: 0 });
  trigger.focus();
  expect(controller.isOpen).toBe(true);
  expect(document.getElementById(trigger.getAttribute("aria-describedby")!)).toBe(content);
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await wait();
  expect(content.isConnected).toBe(false);
  expect(trigger.hasAttribute("aria-describedby")).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it("suspends an authored description of lazy content and restores it on destroy", async () => {
  document.body.innerHTML = `<div data-slot="tooltip"><button data-slot="tooltip-trigger" aria-describedby="help tip">Preview</button><span id="help">Help</span><div id="tip" data-slot="tooltip-content">Tip</div></div>`;
  const root = document.body.firstElementChild!;
  const trigger = root.querySelector("button")!;
  const controller = createTooltip(root);
  controllers.push(controller);
  expect(trigger.getAttribute("aria-describedby")).toBe("help");
  controller.show();
  expect(trigger.getAttribute("aria-describedby")).toBe("help tip");
  controller.hide();
  await wait();
  expect(trigger.getAttribute("aria-describedby")).toBe("help");
  controller.destroy();
  expect(trigger.getAttribute("aria-describedby")).toBe("help tip");
  expect(document.getElementById("tip")).not.toBeNull();
});
