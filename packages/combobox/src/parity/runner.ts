import { createComboboxAssertions } from "./assertions";
import { mountComboboxFixture } from "./fixture";
import type { ComboboxParityActions, ComboboxParityContext, ComboboxParityScenario } from "./scenario-types";

const getOrCreateOutsideTarget = (): HTMLElement => {
  const existing = document.getElementById("combobox-parity-outside");
  if (existing instanceof HTMLElement) {
    return existing;
  }

  const outside = document.createElement("button");
  outside.id = "combobox-parity-outside";
  outside.type = "button";
  outside.textContent = "outside";
  document.body.appendChild(outside);
  return outside;
};

export async function runComboboxParityScenario(
  scenario: ComboboxParityScenario
): Promise<void> {
  const fixture = mountComboboxFixture({ options: scenario.fixtureOptions });

  const actions: ComboboxParityActions = {
    setInputValue(value) {
      fixture.input.value = value;
      fixture.input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    appendInputValue(suffix) {
      fixture.input.value += suffix;
      fixture.input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    focusInput() {
      fixture.input.focus();
      fixture.input.dispatchEvent(new Event("focus", { bubbles: true }));
    },
    pressKey(key) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      fixture.input.dispatchEvent(event);
      return event;
    },
    clickTrigger() {
      if (!fixture.triggerBtn) {
        throw new Error("Fixture has no combobox trigger");
      }
      fixture.triggerBtn.click();
    },
    clickItem(value) {
      const item = fixture.getItemByValue(value);
      if (!item) {
        throw new Error(`Fixture has no combobox item with data-value=\"${value}\"`);
      }
      item.click();
    },
    pointerDownOutside() {
      const outside = getOrCreateOutsideTarget();
      outside.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" })
      );
    },
    clickOutside() {
      const outside = getOrCreateOutsideTarget();
      outside.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    },
    open() {
      fixture.controller.open();
    },
    close() {
      fixture.controller.close();
    },
    waitForRaf() {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    },
    wait(ms) {
      return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });
    },
  };

  const context: ComboboxParityContext = {
    fixture,
    actions,
    assertions: createComboboxAssertions(fixture),
  };

  try {
    await scenario.run(context);
  } finally {
    fixture.destroy();
  }
}
