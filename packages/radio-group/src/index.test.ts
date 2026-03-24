import { beforeEach, describe, expect, it } from "bun:test";
import { createRadioGroup, create } from "./index";
import { clearRootBinding, setRootBinding } from "../../core/src/index";

describe("RadioGroup", () => {
  const ROOT_BINDING_KEY = "@data-slot/radio-group";

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const getHiddenInputs = () =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[type="radio"][data-radio-group-generated="input"]',
      ),
    );

  const setup = (attrs = "", itemAttrs: string[] = []) => {
    const items = ["starter", "pro", "enterprise"];
    document.body.innerHTML = `
      <div data-slot="radio-group" id="root" ${attrs}>
        ${items
          .map(
            (value, index) => `
              <label id="label-${value}">
                <span
                  data-slot="radio-group-item"
                  id="item-${value}"
                  data-value="${value}"
                  ${itemAttrs[index] || ""}
                >
                  <span data-slot="radio-group-indicator" id="indicator-${value}"></span>
                </span>
                ${value}
              </label>
            `,
          )
          .join("\n")}
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createRadioGroup(root);
    const radioItems = items.map(
      (value) => document.getElementById(`item-${value}`) as HTMLElement,
    );
    const indicators = items.map(
      (value) => document.getElementById(`indicator-${value}`) as HTMLElement,
    );

    return { root, controller, radioItems, indicators };
  };

  describe("initialization", () => {
    it("initializes unchecked by default and makes the first enabled item tabbable", () => {
      const { root, controller, radioItems, indicators } = setup();

      expect(controller.value).toBeNull();
      expect(root.getAttribute("role")).toBe("radiogroup");
      expect(root.hasAttribute("data-value")).toBe(false);
      expect(radioItems[0]?.tabIndex).toBe(0);
      expect(radioItems[1]?.tabIndex).toBe(-1);
      expect(radioItems[0]?.getAttribute("aria-checked")).toBe("false");
      expect(radioItems[0]?.hasAttribute("data-unchecked")).toBe(true);
      expect(indicators[0]?.hasAttribute("data-unchecked")).toBe(true);
      expect(getHiddenInputs()).toHaveLength(3);
    });

    it("reads data-default-value on initialization", () => {
      const { root, controller, radioItems, indicators } = setup(
        'data-default-value="pro"',
      );

      expect(controller.value).toBe("pro");
      expect(root.getAttribute("data-value")).toBe("pro");
      expect(radioItems[1]?.getAttribute("aria-checked")).toBe("true");
      expect(radioItems[1]?.hasAttribute("data-checked")).toBe(true);
      expect(indicators[1]?.hasAttribute("data-checked")).toBe(true);
      expect(getHiddenInputs()[1]?.checked).toBe(true);
    });

    it("prefers the JS defaultValue option over data attributes", () => {
      document.body.innerHTML = `
        <div data-slot="radio-group" id="root" data-default-value="starter">
          <span data-slot="radio-group-item" data-value="starter"></span>
          <span data-slot="radio-group-item" data-value="pro"></span>
        </div>
      `;
      const root = document.getElementById("root") as HTMLElement;
      const controller = createRadioGroup(root, { defaultValue: "pro" });

      expect(controller.value).toBe("pro");
    });

    it("makes items without a value non-interactive", () => {
      document.body.innerHTML = `
        <div data-slot="radio-group" id="root">
          <span data-slot="radio-group-item" data-value="starter">Starter</span>
          <span data-slot="radio-group-item" id="empty">Empty</span>
          <span data-slot="radio-group-item" data-value="pro">Pro</span>
        </div>
      `;

      const root = document.getElementById("root") as HTMLElement;
      const controller = createRadioGroup(root);
      const empty = document.getElementById("empty") as HTMLElement;

      expect(controller.value).toBeNull();
      expect(empty.tabIndex).toBe(-1);
      expect(empty.getAttribute("aria-disabled")).toBe("true");
      expect(getHiddenInputs()).toHaveLength(2);
    });

    it("throws when all items are missing values", () => {
      document.body.innerHTML = `
        <div data-slot="radio-group" id="root">
          <span data-slot="radio-group-item">One</span>
          <span data-slot="radio-group-item">Two</span>
        </div>
      `;

      const root = document.getElementById("root") as HTMLElement;
      expect(() => createRadioGroup(root)).toThrow(
        "RadioGroup requires at least one radio-group-item with a data-value attribute",
      );
    });
  });

  describe("labels", () => {
    it("supports wrapping labels and merges aria-labelledby", () => {
      const { controller, radioItems } = setup();
      const label = document.getElementById("label-starter") as HTMLLabelElement;

      label.click();

      expect(controller.value).toBe("starter");
      expect(radioItems[0]?.getAttribute("aria-labelledby")).toContain(label.id);
    });

    it("supports sibling label[for] associations without changing the item id", () => {
      document.body.innerHTML = `
        <div data-slot="radio-group" id="root">
          <label for="item-pro" id="label-pro">Pro</label>
          <span data-slot="radio-group-item" id="item-pro" data-value="pro">
            <span data-slot="radio-group-indicator"></span>
          </span>
        </div>
      `;

      const root = document.getElementById("root") as HTMLElement;
      const label = document.getElementById("label-pro") as HTMLLabelElement;
      const item = document.getElementById("item-pro") as HTMLElement;
      const controller = createRadioGroup(root);

      label.click();

      expect(item.id).toBe("item-pro");
      expect(item.getAttribute("aria-labelledby")).toContain(label.id);
      expect(controller.value).toBe("pro");
      expect(document.activeElement).toBe(item);
    });
  });

  describe("interaction", () => {
    it("selects on click and does not deselect on repeated click", () => {
      const { root, controller, radioItems } = setup();
      let changes = 0;
      root.addEventListener("radio-group:change", () => {
        changes += 1;
      });

      radioItems[1]?.click();
      expect(controller.value).toBe("pro");
      radioItems[1]?.click();
      expect(controller.value).toBe("pro");
      expect(changes).toBe(1);
    });

    it("controller methods select and clear programmatically", () => {
      const { root, controller } = setup();
      const changes: Array<string | null> = [];

      root.addEventListener("radio-group:change", (event) => {
        changes.push((event as CustomEvent).detail.value);
      });

      controller.select("enterprise");
      controller.clear();

      expect(controller.value).toBeNull();
      expect(changes).toEqual(["enterprise", null]);
    });

    it("emits radio-group:change only on real changes", () => {
      const { root, controller } = setup();
      const values: Array<string | null> = [];

      root.addEventListener("radio-group:change", (event) => {
        values.push((event as CustomEvent).detail.value);
      });

      controller.select("starter");
      controller.select("starter");
      controller.clear();
      controller.clear();

      expect(values).toEqual(["starter", null]);
    });

    it("keeps only one duplicate value item checked at a time", () => {
      document.body.innerHTML = `
        <div data-slot="radio-group" id="root" data-default-value="dup">
          <span data-slot="radio-group-item" id="first" data-value="dup"></span>
          <span data-slot="radio-group-item" id="second" data-value="dup"></span>
          <span data-slot="radio-group-item" id="third" data-value="other"></span>
        </div>
      `;

      const root = document.getElementById("root") as HTMLElement;
      const first = document.getElementById("first") as HTMLElement;
      const second = document.getElementById("second") as HTMLElement;
      const controller = createRadioGroup(root);

      expect(controller.value).toBe("dup");
      expect(first.getAttribute("aria-checked")).toBe("true");
      expect(second.getAttribute("aria-checked")).toBe("false");

      second.click();

      expect(controller.value).toBe("dup");
      expect(first.getAttribute("aria-checked")).toBe("false");
      expect(second.getAttribute("aria-checked")).toBe("true");
      expect(getHiddenInputs().filter((input) => input.checked)).toHaveLength(1);

      controller.select("dup");

      expect(first.getAttribute("aria-checked")).toBe("true");
      expect(second.getAttribute("aria-checked")).toBe("false");
      expect(getHiddenInputs().filter((input) => input.checked)).toHaveLength(1);
    });
  });

  describe("form integration", () => {
    it("creates one hidden radio per item and mirrors form-related attrs", () => {
      const { root, radioItems } = setup(
        'data-name="plan" data-required data-default-value="starter"',
      );
      const inputs = getHiddenInputs();

      expect(inputs).toHaveLength(3);
      expect(inputs.map((input) => input.name)).toEqual(["plan", "plan", "plan"]);
      expect(inputs.map((input) => input.value)).toEqual([
        "starter",
        "pro",
        "enterprise",
      ]);
      expect(inputs[0]?.checked).toBe(true);
      expect(inputs.every((input) => input.required)).toBe(true);
      expect(root.getAttribute("aria-required")).toBe("true");
      expect(radioItems[0]?.hasAttribute("data-required")).toBe(true);
    });

    it("restores the default selection on native form reset", async () => {
      document.body.innerHTML = `
        <form id="form">
          <div
            data-slot="radio-group"
            id="root"
            data-name="plan"
            data-default-value="starter"
          >
            <label>
              <span data-slot="radio-group-item" data-value="starter">Starter</span>
              Starter
            </label>
            <label>
              <span data-slot="radio-group-item" data-value="pro">Pro</span>
              Pro
            </label>
          </div>
        </form>
      `;

      const form = document.getElementById("form") as HTMLFormElement;
      const root = document.getElementById("root") as HTMLElement;
      const controller = createRadioGroup(root);

      controller.select("pro");
      expect(controller.value).toBe("pro");

      form.reset();
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(controller.value).toBe("starter");
      expect(getHiddenInputs()[0]?.checked).toBe(true);
    });
  });

  describe("keyboard navigation", () => {
    it("moves with arrows, Home, and End while skipping disabled items", () => {
      const { controller, radioItems } = setup("", ["", "data-disabled", ""]);

      radioItems[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(controller.value).toBe("enterprise");
      expect(radioItems[2]?.tabIndex).toBe(0);

      radioItems[2]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      );
      expect(controller.value).toBe("starter");

      radioItems[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true }),
      );
      expect(controller.value).toBe("enterprise");
    });
  });

  describe("disabled and readonly state", () => {
    it("blocks click and inbound events when disabled, but controller methods still work", () => {
      const { root, controller, radioItems } = setup('data-disabled');

      radioItems[1]?.click();
      root.dispatchEvent(
        new CustomEvent("radio-group:set", { detail: { value: "enterprise" } }),
      );

      expect(controller.value).toBeNull();
      expect(radioItems[0]?.getAttribute("data-disabled")).not.toBeNull();

      controller.select("enterprise");
      expect(controller.value).toBe("enterprise");
    });

    it("blocks user interaction when readonly, but allows controller methods", () => {
      const { controller, radioItems } = setup('data-read-only');

      radioItems[1]?.click();
      radioItems[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );

      expect(controller.value).toBeNull();

      controller.select("pro");
      expect(controller.value).toBe("pro");
    });
  });

  describe("lifecycle", () => {
    it("auto-discovers roots and skips already-bound instances", () => {
      document.body.innerHTML = `
        <div data-slot="radio-group" id="one">
          <span data-slot="radio-group-item" data-value="a"></span>
        </div>
        <div data-slot="radio-group" id="two">
          <span data-slot="radio-group-item" data-value="b"></span>
        </div>
      `;

      const controllers = create();
      expect(controllers).toHaveLength(2);
      expect(create()).toHaveLength(0);
    });

    it("reuses the existing controller when the root is already bound", () => {
      document.body.innerHTML = `
        <div data-slot="radio-group" id="root">
          <span data-slot="radio-group-item" data-value="a"></span>
        </div>
      `;

      const root = document.getElementById("root") as HTMLElement;
      const existing = {
        destroy() {},
        clear() {},
        select(_value: string) {},
        get value() {
          return null;
        },
      };
      setRootBinding(root, ROOT_BINDING_KEY, existing);

      expect(createRadioGroup(root) as unknown).toBe(existing);
      clearRootBinding(root, ROOT_BINDING_KEY, existing);
    });

    it("removes generated inputs and clears the root binding on destroy", () => {
      const { root, controller } = setup();

      expect(getHiddenInputs()).toHaveLength(3);

      controller.destroy();

      expect(getHiddenInputs()).toHaveLength(0);
      expect(clearRootBinding(root, ROOT_BINDING_KEY)).toBe(false);
    });
  });
});
