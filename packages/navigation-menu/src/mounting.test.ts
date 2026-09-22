import { afterEach, describe, expect, it } from "bun:test";
import { create, createNavigationMenu, type NavigationMenuOptions } from "./index";
import { create as createSelects } from "../../select/src/index";

const cleanups: Array<() => void> = [];
const wait = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));
const key = (target: HTMLElement, key: string, shiftKey = false) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));

function setup(shape: "inline" | "minimal" | "authored" = "minimal", options: NavigationMenuOptions = {}, attributes = "") {
  const viewportMarkup = '<div data-slot="navigation-menu-viewport"></div>';
  document.body.innerHTML = `<nav data-slot="navigation-menu" ${attributes}><ul data-slot="navigation-menu-list">
    ${["products", "company", "resources"].map(value => `<li data-slot="navigation-menu-item" data-value="${value}">
      <button data-slot="navigation-menu-trigger">${value}</button>
      <div data-slot="navigation-menu-content" hidden><a href="#${value}">${value} link</a><input aria-label="${value} search" value="original"></div>
      <span class="after-panel"></span></li>`).join("")}
    <li data-slot="navigation-menu-item"><a href="#pricing">Pricing</a></li>
  </ul>${shape === "inline" ? "" : shape === "minimal" ? viewportMarkup : `<div data-slot="navigation-menu-portal"><div data-slot="navigation-menu-positioner"><div data-slot="navigation-menu-popup">${viewportMarkup}</div></div></div>`}</nav><button id="outside">Outside</button>`;
  const root = document.querySelector<HTMLElement>("nav")!;
  const panels = [...root.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-content"]')];
  const triggers = [...root.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-trigger"]')];
  const parents = panels.map(panel => panel.parentNode);
  const siblings = panels.map(panel => panel.nextSibling);
  const viewport = root.querySelector<HTMLElement>('[data-slot="navigation-menu-viewport"]');
  const controller = createNavigationMenu(root, options);
  cleanups.push(() => controller.destroy());
  return { root, panels, triggers, parents, siblings, viewport, controller };
}

afterEach(() => {
  cleanups.splice(0).reverse().forEach(cleanup => cleanup());
  document.body.innerHTML = "";
});

for (const shape of ["inline", "minimal", "authored"] as const) {
  describe(`${shape} panel mounting`, () => {
    it("detaches closed descendants, mounts only the active panel, and preserves nodes and state", async () => {
      const { root, panels, triggers, controller } = setup(shape);
      expect(root.querySelectorAll('[data-slot="navigation-menu-content"]').length).toBe(0);
      expect(document.querySelectorAll("input").length).toBe(0);
      expect(triggers.every(trigger => trigger.isConnected && !trigger.hasAttribute("aria-controls"))).toBe(true);
      const input = panels[0]!.querySelector("input")!;
      let changes = 0;
      input.addEventListener("change", () => changes++);
      for (let i = 0; i < 2; i++) {
        controller.open("products");
        expect(document.querySelectorAll('[data-slot="navigation-menu-content"]').length).toBe(1);
        expect(document.getElementById(triggers[0]!.getAttribute("aria-controls")!) === panels[0]).toBe(true);
        expect(panels[0]!.querySelector("input") === input).toBe(true);
        input.value = "retained";
        input.dispatchEvent(new Event("change"));
        controller.close();
        expect(triggers[0]!.hasAttribute("aria-controls")).toBe(false);
        await wait();
        expect(panels.every(panel => !panel.isConnected)).toBe(true);
      }
      expect(input.value).toBe("retained");
      expect(changes).toBe(2);
    });

    it("restores exact authored placement on destroy and allows rebinding", async () => {
      const { root, panels, parents, siblings, controller } = setup(shape);
      controller.open("company");
      panels[1]!.style.transitionDuration = "70ms";
      controller.close();
      controller.destroy();
      controller.destroy();
      expect(panels.every((panel, i) => panel.parentNode === parents[i] && panel.nextSibling === siblings[i])).toBe(true);
      const rebound = createNavigationMenu(root);
      cleanups.push(() => rebound.destroy());
      rebound.open("company");
      await wait(140);
      expect(rebound.value).toBe("company");
      expect(panels[1]!.isConnected && !panels[1]!.hidden).toBe(true);
      expect(panels[0]!.isConnected).toBe(false);
    });
  });
}

it("supports eager mode from markup and JavaScript precedence", async () => {
  const eager = setup("minimal", {}, 'data-mount-strategy="eager"');
  expect(eager.panels.every(panel => panel.isConnected && panel.hidden)).toBe(true);
  eager.controller.open("products");
  eager.controller.close();
  await wait();
  expect(eager.panels.every(panel => panel.isConnected && panel.hidden)).toBe(true);
  eager.controller.destroy();
  const lazy = setup("minimal", { mountStrategy: "lazy" }, 'data-mount-strategy="eager"');
  expect(lazy.panels.every(panel => !panel.isConnected)).toBe(true);
  lazy.controller.destroy();
  expect(setup("minimal", { mountStrategy: "eager" }).panels.every(panel => panel.isConnected)).toBe(true);
});

it("retains outgoing panels through switching and cancels removal on rapid round trips", async () => {
  const { panels, triggers, viewport, controller } = setup();
  panels[0]!.style.transitionDuration = "70ms";
  controller.open("products");
  controller.open("company");
  expect(viewport!.children.length).toBe(2);
  expect(panels[0]!.getAttribute("aria-hidden")).toBe("true");
  expect(triggers[0]!.hasAttribute("aria-controls")).toBe(false);
  expect(triggers[1]!.getAttribute("aria-controls")).toBe(panels[1]!.id);
  expect(panels[0]!.dataset.activationDirection).toBe("right");
  controller.open("products");
  await wait(140);
  expect(viewport!.children.length).toBe(1);
  expect(panels[0]!.isConnected && !panels[0]!.hidden).toBe(true);
  expect(panels[1]!.isConnected).toBe(false);
  controller.open("company");
  await wait(140);
  expect(panels[0]!.isConnected).toBe(false);
  expect(panels[1]!.isConnected).toBe(true);
});

for (const longest of ["panel", "popup", "viewport"] as const) {
  it(`keeps the shared shell until the longest ${longest} exit finishes`, async () => {
    const { panels, viewport, controller } = setup("authored");
    const popup = viewport!.parentElement!;
    const portal = popup.parentElement!.parentElement!;
    controller.open("products");
    const target = longest === "panel" ? panels[0]! : longest === "popup" ? popup : viewport!;
    target.style.transitionDuration = "90ms";
    controller.close();
    await wait(40);
    expect(portal.parentElement === document.body).toBe(true);
    expect(viewport!.hidden).toBe(false);
    await wait(130);
    expect(panels[0]!.isConnected).toBe(false);
    expect(portal.parentElement === document.body).toBe(false);
    expect(viewport!.hidden).toBe(true);
  });
}

it("keeps an earlier outgoing panel alive when switching and immediately closing", async () => {
  const { panels, viewport, controller } = setup();
  panels[0]!.style.transitionDuration = "90ms";
  controller.open("products");
  controller.open("company");
  controller.close();
  await wait(40);
  expect(panels[0]!.isConnected && !viewport!.hidden).toBe(true);
  expect(panels[1]!.isConnected).toBe(false);
  controller.open("resources");
  await wait(130);
  expect(panels[0]!.isConnected).toBe(false);
  expect(panels[2]!.isConnected && !viewport!.hidden).toBe(true);
});

it("preserves keyboard entry, Shift+Tab, Escape focus, and outside dismissal", async () => {
  const { panels, triggers, controller } = setup();
  const link = panels[0]!.querySelector("a")!;
  triggers[0]!.focus();
  key(triggers[0]!, "ArrowDown");
  await wait();
  expect(document.activeElement === link).toBe(true);
  key(link, "Tab", true);
  expect(document.activeElement === triggers[0]).toBe(true);
  key(triggers[0]!, "ArrowDown");
  await wait();
  key(link, "Escape");
  expect(document.activeElement === triggers[0]).toBe(true);
  await wait();
  expect(panels[0]!.isConnected).toBe(false);
  controller.open("company");
  const outside = document.getElementById("outside")!;
  outside.focus();
  await wait();
  expect(controller.value).toBeNull();
  expect(panels[1]!.isConnected).toBe(false);
  expect(document.activeElement === outside).toBe(true);
});

it("mounts on delayed hover and detaches after pointer leave", async () => {
  const { panels, triggers, controller } = setup("minimal", { delayOpen: 30, delayClose: 20 });
  const item = triggers[0]!.parentElement!;
  item.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
  expect(panels[0]!.isConnected).toBe(false);
  await wait(50);
  expect(controller.value).toBe("products");
  expect(panels[0]!.isConnected).toBe(true);
  item.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
  await wait(50);
  expect(panels[0]!.isConnected).toBe(false);
});

for (const mountStrategy of ["lazy", "eager"] as const) {
  it(`restores a removed root on ${mountStrategy} destroy without leaving body portals`, async () => {
    const { root, panels, parents, viewport, controller } = setup("authored", { mountStrategy });
    controller.open("products");
    root.remove();
    controller.destroy();
    await wait();
    expect(document.querySelector('[data-slot="navigation-menu-portal"]')).toBeNull();
    expect(panels.every((panel, i) => panel.parentNode === parents[i] && !panel.isConnected)).toBe(true);
    expect(root.contains(viewport)).toBe(true);
  });
}

it("discovers nested selects retained in a closed panel", () => {
  const { root, panels, controller } = setup();
  controller.destroy();
  panels[0]!.innerHTML = '<div data-slot="select"><button data-slot="select-trigger">Fruit</button><div data-slot="select-content"><div data-slot="select-item" data-value="apple">Apple</div></div></div>';
  const menu = createNavigationMenu(root);
  cleanups.push(() => menu.destroy());
  const selects = createSelects();
  cleanups.push(() => selects.forEach(select => select.destroy()));
  expect(selects.length).toBe(1);
  expect(createSelects().length).toBe(0);
  expect(create().length).toBe(0);
  menu.open("products");
  selects[0]!.open();
  expect(document.querySelector('[data-slot="select-content"]')).not.toBeNull();
});
