import { afterEach, describe, expect, it } from "bun:test";
import { createHoverCard, create } from "./index";

const controllers: ReturnType<typeof createHoverCard>[] = [];
const wait = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));
const setup = (options: Parameters<typeof createHoverCard>[1] = {}, attributes = "") => {
  document.body.innerHTML = `<div data-slot="hover-card" ${attributes}>
    <button data-slot="hover-card-trigger" aria-label="Preview">Preview</button>
    <div data-slot="hover-card-content"><span>Details</span></div>
    <button id="outside">Outside</button>
  </div>`;
  const root = document.body.firstElementChild!;
  const trigger = root.querySelector("button")!;
  const content = root.querySelector<HTMLElement>('[data-slot="hover-card-content"]')!;
  const controller = createHoverCard(root, options);
  controllers.push(controller);
  return { root, trigger, content, controller };
};
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  document.body.innerHTML = "";
});

describe("hover-card mounting", () => {
  it("detaches initially and reuses the same nodes over repeated openings", async () => {
    const { root, content, controller } = setup();
    const child = content.firstElementChild;
    expect(document.querySelector('[data-slot="hover-card-content"]')).toBeNull();
    for (let i = 0; i < 2; i++) {
      controller.open();
      expect(document.querySelector('[data-slot="hover-card-content"]')).toBe(content);
      expect(content.firstElementChild).toBe(child);
      controller.close();
      await wait();
      expect(content.isConnected).toBe(false);
    }
    controller.destroy();
    expect(content.parentNode).toBe(root);
    const rebound = createHoverCard(root);
    controllers.push(rebound);
    rebound.open();
    expect(content.isConnected).toBe(true);
  });

  it("supports eager markup and an overriding JavaScript option", async () => {
    const eager = setup({}, 'data-mount-strategy="eager"');
    expect(eager.content.isConnected).toBe(true);
    eager.controller.open();
    eager.controller.close();
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
    controller.open();
    controller.close();
    expect(content.isConnected).toBe(true);
    expect(content.hasAttribute("data-ending-style")).toBe(true);
    controller.open();
    await wait(110);
    expect(content.isConnected).toBe(true);
    expect(content.hidden).toBe(false);
    controller.close();
    await wait(110);
    expect(content.isConnected).toBe(false);
  });

  it("mounts inline when portaling is disabled and restores after destroy during exit", async () => {
    const { root, content, controller } = setup({ portal: false });
    controller.open();
    expect(content.parentNode).toBe(root);
    content.style.transitionDuration = "50ms";
    controller.close();
    controller.destroy();
    await wait(110);
    expect(content.parentNode).toBe(root);
    expect(content.hidden).toBe(true);
    controller.open();
    expect(content.hidden).toBe(true);
  });

  it("cleans up an open portal after its root is removed", async () => {
    const { root, content, controller } = setup();
    controller.open();
    root.remove();
    controller.destroy();
    await wait();
    expect(document.querySelector('[data-slot="hover-card-positioner"]')).toBeNull();
    expect(content.parentNode).toBe(root);
    expect(content.isConnected).toBe(false);
  });

  it("discovers instances in detached content without rebinding existing roots", () => {
    const { content } = setup();
    content.innerHTML = `<div data-slot="hover-card"><button data-slot="hover-card-trigger">Nested</button><div data-slot="hover-card-content">Nested details</div></div>`;
    const nested = create();
    controllers.push(...nested);
    expect(nested.length).toBe(1);
    expect(create().length).toBe(0);
  });
});

it("keeps default-open and controlled cards mounted with valid controls", () => {
  const first = setup({ defaultOpen: true });
  expect(first.content.isConnected).toBe(true);
  expect(document.getElementById(first.trigger.getAttribute("aria-controls")!)).toBe(first.content);
  first.controller.destroy();
  const controlled = setup({ open: false, delay: 0 });
  controlled.controller.open();
  expect(controlled.content.isConnected).toBe(false);
  controlled.controller.setOpen(true);
  expect(controlled.content.isConnected).toBe(true);
});

it("restores focus from closing content without reopening or stealing outside focus", async () => {
  const { content, trigger, controller } = setup({ delay: 0 });
  content.innerHTML = '<button>Card action</button>';
  controller.open();
  content.querySelector("button")!.focus();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await wait();
  expect(document.activeElement).toBe(trigger);
  expect(content.isConnected).toBe(false);
  expect(trigger.hasAttribute("aria-controls")).toBe(false);
  controller.open();
  const outside = document.getElementById("outside")!;
  outside.focus();
  controller.close();
  await wait();
  expect(document.activeElement).toBe(outside);
});
