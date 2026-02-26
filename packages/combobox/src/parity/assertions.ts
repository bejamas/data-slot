import { expect } from "bun:test";
import type { ComboboxParityAssertions, ComboboxParityFixture } from "./scenario-types";

export function createComboboxAssertions(
  fixture: ComboboxParityFixture
): ComboboxParityAssertions {
  return {
    expectOpen(expected) {
      expect(fixture.controller.isOpen).toBe(expected);
      expect(fixture.input.getAttribute("aria-expanded")).toBe(expected ? "true" : "false");
    },
    expectValue(expected) {
      expect(fixture.controller.value).toBe(expected);
    },
    expectInputValue(expected) {
      expect(fixture.input.value).toBe(expected);
    },
    expectHighlightedValue(expected) {
      const highlighted = fixture.getItems().find((item) => item.hasAttribute("data-highlighted"));

      if (expected === null) {
        expect(highlighted).toBeUndefined();
        expect(fixture.input.hasAttribute("aria-activedescendant")).toBe(false);
        return;
      }

      expect(highlighted).toBeDefined();
      expect(highlighted?.getAttribute("data-value")).toBe(expected);
      expect(fixture.input.getAttribute("aria-activedescendant")).toBe(highlighted?.id);
    },
    expectActivedescendantFor(value) {
      const item = fixture.getItemByValue(value);
      expect(item).toBeDefined();
      expect(fixture.input.getAttribute("aria-activedescendant")).toBe(item?.id);
    },
    expectVisibleValues(expectedValues) {
      const actualValues = fixture
        .getItems()
        .filter((item) => !item.hidden)
        .map((item) => item.getAttribute("data-value"))
        .filter((value): value is string => typeof value === "string");

      expect(actualValues).toEqual(expectedValues);
    },
    expectEmptyVisible(expectedVisible) {
      if (!fixture.emptySlot) {
        throw new Error("Combobox empty slot is missing in fixture");
      }
      expect(fixture.emptySlot.hidden).toBe(!expectedVisible);
      expect(fixture.content.hasAttribute("data-empty")).toBe(expectedVisible);
    },
    expectInputDisabled(expectedDisabled) {
      expect(fixture.input.disabled).toBe(expectedDisabled);
      expect(fixture.input.getAttribute("aria-disabled")).toBe(expectedDisabled ? "true" : null);
    },
    expectInputRequired(expectedRequired) {
      expect(fixture.input.required).toBe(expectedRequired);
      expect(fixture.input.getAttribute("aria-required")).toBe(expectedRequired ? "true" : null);
    },
    expectInputValid(expectedValid) {
      expect(fixture.input.validity.valid).toBe(expectedValid);
    },
  };
}
