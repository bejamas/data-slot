import { afterEach, describe, expect, it } from "bun:test";
import { create, createSelect } from "./index";
import { createHoverCard } from "../../hover-card/src/index";
import { resetScrollLock } from "../../core/src/scroll";

const cleanups: Array<() => void> = [];
const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const closeSettled = async () => { await frame(); await frame(); };

function setup(options: Parameters<typeof createSelect>[1] = {}, attrs = "", wrappers = false) {
  document.body.innerHTML = `<form>
    <label for="fruit-trigger">Fruit</label>
    <div data-slot="select" ${attrs}>
      <button id="fruit-trigger" data-slot="select-trigger"><span data-slot="select-value"></span></button>
      ${wrappers ? '<div data-slot="select-portal"><div data-slot="select-positioner">' : ''}
      <div data-slot="select-content" hidden><div data-slot="select-viewport">
        <div data-slot="select-group"><div data-slot="select-label">Fruit choices</div>
          <div data-slot="select-item" data-value="apple"><span data-slot="select-item-text">Apple</span></div>
          <div data-slot="select-item" data-value="banana" data-label="Banana label">Banana</div>
          <div data-slot="select-item" data-value="disabled" data-disabled>Disabled</div>
          <div data-slot="select-item" data-value="cherry">Cherry</div>
        </div>
      </div></div>
      ${wrappers ? '</div></div>' : ''}
    </div>
    <button id="after" type="button">After</button>
  </form>`;
  const form = document.querySelector("form")!;
  const root = form.querySelector<HTMLElement>('[data-slot="select"]')!;
  const trigger = root.querySelector<HTMLButtonElement>('[data-slot="select-trigger"]')!;
  const content = root.querySelector<HTMLElement>('[data-slot="select-content"]')!;
  const items = [...content.querySelectorAll<HTMLElement>('[data-slot="select-item"]')];
  const portal = root.querySelector<HTMLElement>('[data-slot="select-portal"]');
  const valueSlot = root.querySelector<HTMLElement>('[data-slot="select-value"]')!;
  const controller = createSelect(root, { name: "fruit", ...options });
  cleanups.push(() => controller.destroy());
  return { root, trigger, content, items, portal, valueSlot, controller, form };
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.innerHTML = "";
  resetScrollLock();
});

for (const position of ["item-aligned", "popper"] as const) {
  describe(`${position} lazy mounting`, () => {
    it("keeps trigger, selected label and submission connected while detaching all popup descendants", () => {
      const { root, trigger, content, valueSlot, form, controller } = setup({ position, defaultValue: "banana" });
      expect(content.isConnected).toBe(false);
      expect(document.querySelectorAll('[data-slot="select-item"]').length).toBe(0);
      expect(trigger.isConnected).toBe(true);
      expect(valueSlot.textContent).toBe("Banana label");
      expect(root.querySelector('[data-form-field-generated]')?.isConnected).toBe(true);
      expect(new FormData(form).getAll("fruit")).toEqual(["banana"]);
      expect(trigger.hasAttribute("aria-controls")).toBe(false);
      controller.open();
      expect(document.getElementById(trigger.getAttribute("aria-controls")!) === content).toBe(true);
      expect(content.hidden).toBe(false);
      expect(content.dataset.position).toBe(position);
    });

    it("updates labels, selection and form values while closed, including event-driven clearing", async () => {
      const { root, content, items, valueSlot, form, controller } = setup({ position, defaultValue: "apple", placeholder: "Choose fruit" });
      controller.select("banana");
      expect(content.isConnected).toBe(false);
      expect(valueSlot.textContent).toBe("Banana label");
      expect(items[1]!.getAttribute("aria-selected")).toBe("true");
      expect(new FormData(form).get("fruit")).toBe("banana");
      root.dispatchEvent(new CustomEvent("select:set", { detail: { value: null } }));
      expect(valueSlot.textContent).toBe("Choose fruit");
      expect(new FormData(form).get("fruit")).toBe("");
      form.reset();
      await wait();
      expect(controller.value).toBe("apple");
      expect(valueSlot.textContent).toBe("Apple");
      expect(new FormData(form).getAll("fruit")).toEqual(["apple"]);
      expect(content.isConnected).toBe(false);
    });

    it("reuses item nodes and listeners across keyboard and pointer selection", async () => {
      const { trigger, content, items, form, controller } = setup({ position });
      let clicks = 0;
      items[1]!.addEventListener("click", () => clicks++);
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      content.dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true }));
      expect(document.activeElement === items[1]).toBe(true);
      content.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(controller.value).toBe("banana");
      expect(content.isConnected).toBe(false);
      await closeSettled();
      expect(document.activeElement === trigger).toBe(true);
      controller.open();
      expect(content.querySelectorAll('[data-slot="select-item"]')[1] === items[1]).toBe(true);
      items[1]!.click();
      expect(clicks).toBe(1);
      expect(new FormData(form).getAll("fruit")).toEqual(["banana"]);
    });
  });
}

it("supports eager mode and JavaScript precedence over root attributes", async () => {
  const eager = setup({}, 'data-mount-strategy="eager"');
  expect(eager.content.isConnected).toBe(true);
  eager.controller.open();
  eager.controller.close();
  await closeSettled();
  expect(eager.content.isConnected).toBe(true);
  expect(eager.content.hidden).toBe(true);
  eager.controller.destroy();
  const lazy = setup({ mountStrategy: "lazy" }, 'data-mount-strategy="eager"');
  expect(lazy.content.isConnected).toBe(false);
  lazy.controller.destroy();
  expect(setup({ mountStrategy: "eager" }).content.isConnected).toBe(true);
});

it("keeps default-open content mounted but leaves a disabled default-open select detached", () => {
  const open = setup({ defaultOpen: true });
  expect(open.controller.isOpen).toBe(true);
  expect(open.content.isConnected).toBe(true);
  expect(open.trigger.getAttribute("aria-controls")).toBe(open.content.id);
  open.controller.destroy();
  const disabled = setup({ defaultOpen: true, disabled: true, defaultValue: "apple" });
  expect(disabled.content.isConnected).toBe(false);
  expect(disabled.trigger.disabled).toBe(true);
  // Happy DOM includes disabled controls in FormData; verify omission in-browser.
  expect(disabled.root.querySelector<HTMLInputElement>('[data-form-field-generated]')?.disabled).toBe(true);
  disabled.controller.select("banana");
  expect(disabled.valueSlot.textContent).toBe("Banana label");
});

it("keeps required validation and reset working without opening", async () => {
  const { form, trigger, content, controller } = setup({ required: true });
  expect(form.checkValidity()).toBe(false);
  expect(form.reportValidity()).toBe(false);
  expect(document.activeElement === trigger).toBe(true);
  expect(content.isConnected).toBe(false);
  controller.select("apple");
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).getAll("fruit")).toEqual(["apple"]);
  form.reset();
  await wait();
  expect(form.checkValidity()).toBe(false);
  expect(content.isConnected).toBe(false);
});

it("waits for exit, cancels removal on reopen, and detaches authored wrappers", async () => {
  const { content, portal, controller, trigger } = setup({}, "", true);
  expect(portal!.isConnected).toBe(false);
  content.style.transitionProperty = "opacity";
  content.style.transitionDuration = "60ms";
  trigger.focus();
  controller.open();
  controller.close();
  expect(content.isConnected).toBe(true);
  expect(trigger.hasAttribute("aria-controls")).toBe(false);
  controller.open();
  await wait(140);
  expect(content.isConnected).toBe(true);
  expect(document.activeElement === content).toBe(true);
  controller.close();
  await wait(140);
  await closeSettled();
  expect(portal!.isConnected).toBe(false);
  expect(content.isConnected).toBe(false);
  expect(document.activeElement === trigger).toBe(true);
});

it("does not let a queued selection focus restoration steal focus after reopening", async () => {
  const { trigger, content, items, controller } = setup();
  trigger.focus();
  controller.open();
  items[0]!.click();
  controller.open();
  await closeSettled();
  expect(controller.isOpen).toBe(true);
  expect(document.activeElement === content).toBe(true);
  controller.close();
  await closeSettled();
  expect(document.activeElement === trigger).toBe(true);
});

it("preserves Tab focus while closing and detaching", async () => {
  const { content, controller } = setup();
  controller.open();
  content.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  const after = document.getElementById("after")!;
  after.focus();
  await closeSettled();
  expect(content.isConnected).toBe(false);
  expect(document.activeElement === after).toBe(true);
});

it("restores authored markup on destroy during exit and supports rebinding", async () => {
  const { root, content, controller } = setup();
  content.style.transitionDuration = "60ms";
  controller.open();
  controller.close();
  controller.destroy();
  expect(content.parentNode === root).toBe(true);
  const rebound = createSelect(root, { defaultValue: "banana" });
  cleanups.push(() => rebound.destroy());
  rebound.open();
  await wait(140);
  expect(content.isConnected).toBe(true);
  expect(content.hidden).toBe(false);
  expect(rebound.value).toBe("banana");
});

it("cleans up after removing an open root without leaving a body portal", () => {
  const { root, content, controller } = setup();
  controller.open();
  root.remove();
  controller.destroy();
  expect(document.querySelector('[data-slot="select-positioner"]')).toBeNull();
  expect(content.isConnected).toBe(false);
  expect(content.parentNode === root).toBe(true);
});

it("discovers a select inside a closed hover card before that card is opened", () => {
  const { root, controller, trigger, form } = setup({ defaultValue: "apple" });
  controller.destroy();
  const card = document.createElement("div");
  card.dataset.slot = "hover-card";
  card.innerHTML = '<button data-slot="hover-card-trigger">Preview</button><div data-slot="hover-card-content"></div>';
  const cardContent = card.lastElementChild!;
  form.appendChild(card);
  cardContent.appendChild(root);
  const hoverCard = createHoverCard(card);
  cleanups.push(() => hoverCard.destroy());
  expect(trigger.isConnected).toBe(false);
  const nested = create();
  cleanups.push(() => nested.forEach(select => select.destroy()));
  expect(nested.length).toBe(1);
  expect(create().length).toBe(0);
  hoverCard.open();
  nested[0]!.open();
  expect(trigger.getAttribute("aria-controls")).not.toBeNull();
  expect(document.querySelector('[data-slot="select-content"]')).not.toBeNull();
});
