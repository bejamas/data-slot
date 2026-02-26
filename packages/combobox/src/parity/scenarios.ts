import type { ComboboxParityScenario } from "./scenario-types";

const SOURCE_FILE = "packages/react/src/autocomplete/root/AutocompleteRoot.test.tsx";
const CLEAR_SOURCE_FILE = "packages/react/src/combobox/clear/ComboboxClear.test.tsx";

export const comboboxParityScenarios: ComboboxParityScenario[] = [
  {
    id: "tab-close-after-enter-then-retype",
    description: "Close on Tab after committing a highlighted option and typing again",
    source: {
      file: SOURCE_FILE,
      caseTitle: "closes popup on Tab after selecting with Enter and typing again",
    },
    fixtureOptions: { autoHighlight: true },
    run: ({ actions, assertions }) => {
      actions.setInputValue("ap");
      assertions.expectOpen(true);
      assertions.expectHighlightedValue("apple");

      actions.pressKey("Enter");
      assertions.expectValue("apple");
      assertions.expectInputValue("Apple");
      assertions.expectOpen(false);

      actions.setInputValue("a");
      assertions.expectOpen(true);

      actions.pressKey("Tab");
      assertions.expectOpen(false);
      assertions.expectValue("apple");
      assertions.expectInputValue("Apple");
    },
  },
  {
    id: "auto-highlight-on-typing",
    description: "Auto-highlight first visible option while typing",
    source: {
      file: SOURCE_FILE,
      caseTitle: "highlights the first item when typing and keeps it during filtering",
    },
    fixtureOptions: { autoHighlight: true },
    run: ({ actions, assertions }) => {
      actions.setInputValue("a");
      assertions.expectOpen(true);
      assertions.expectHighlightedValue("apple");
      assertions.expectActivedescendantFor("apple");

      actions.appendInputValue("p");
      assertions.expectVisibleValues(["apple"]);
      assertions.expectHighlightedValue("apple");
      assertions.expectActivedescendantFor("apple");
    },
  },
  {
    id: "activedescendant-follows-filtering",
    description: "aria-activedescendant tracks highlighted item after query changes",
    source: {
      file: SOURCE_FILE,
      caseTitle: "links aria-activedescendant to the highlighted item after filtering",
    },
    fixtureOptions: { autoHighlight: true },
    run: ({ actions, assertions }) => {
      actions.setInputValue("a");
      assertions.expectHighlightedValue("apple");
      assertions.expectActivedescendantFor("apple");

      actions.setInputValue("ba");
      assertions.expectVisibleValues(["banana"]);
      assertions.expectHighlightedValue("banana");
      assertions.expectActivedescendantFor("banana");
    },
  },
  {
    id: "no-initial-highlight-without-auto-highlight",
    description: "First arrow key opens popup but does not highlight without autoHighlight",
    source: {
      file: SOURCE_FILE,
      caseTitle: "does not highlight first/last item when pressing ArrowDown/ArrowUp initially",
    },
    run: ({ actions, assertions }) => {
      actions.pressKey("ArrowDown");
      assertions.expectOpen(true);
      assertions.expectHighlightedValue(null);

      actions.pressKey("ArrowDown");
      assertions.expectHighlightedValue("apple");

      actions.pressKey("Escape");
      assertions.expectOpen(false);

      actions.pressKey("ArrowUp");
      assertions.expectOpen(true);
      assertions.expectHighlightedValue(null);

      actions.pressKey("ArrowUp");
      assertions.expectHighlightedValue("other");
    },
  },
  {
    id: "highlight-first-on-arrowdown-with-auto-highlight",
    description: "ArrowDown opens and highlights first option when autoHighlight is enabled",
    source: {
      file: SOURCE_FILE,
      caseTitle: "highlights the first item when opening via ArrowDown",
    },
    fixtureOptions: { autoHighlight: true },
    run: ({ actions, assertions }) => {
      actions.pressKey("ArrowDown");
      assertions.expectOpen(true);
      assertions.expectHighlightedValue("apple");
      assertions.expectActivedescendantFor("apple");
    },
  },
  {
    id: "escape-closes-open-popup",
    description: "Escape closes popup while preserving committed value",
    source: {
      file: SOURCE_FILE,
      caseTitle: "does not highlight on open via click or when pressing arrow keys initially",
    },
    run: ({ actions, assertions }) => {
      actions.open();
      assertions.expectOpen(true);
      actions.pressKey("Escape");
      assertions.expectOpen(false);
    },
  },
  {
    id: "tab-closes-and-restores-committed-label",
    description: "Tab closes popup and restores committed label text",
    source: {
      file: SOURCE_FILE,
      caseTitle: "closes popup on Tab after selecting with Enter and typing again",
    },
    fixtureOptions: { defaultValue: "banana" },
    run: ({ actions, assertions }) => {
      actions.open();
      actions.setInputValue("ap");
      assertions.expectOpen(true);
      assertions.expectInputValue("ap");

      actions.pressKey("Tab");
      assertions.expectOpen(false);
      assertions.expectValue("banana");
      assertions.expectInputValue("Banana");
    },
  },
  {
    id: "clear-focuses-input-without-opening",
    description: "Clear button focuses input, clears value, and does not auto-open from closed state",
    source: {
      file: CLEAR_SOURCE_FILE,
      caseTitle: "click clears selected value and focuses input",
    },
    fixtureOptions: { defaultValue: "apple" },
    run: ({ actions, assertions, fixture }) => {
      assertions.expectOpen(false);
      assertions.expectValue("apple");

      actions.clickClear();
      assertions.expectValue(null);
      assertions.expectInputValue("");
      assertions.expectInputFocused(true);
      assertions.expectOpen(false);

      fixture.controller.select("banana");
      actions.open();
      assertions.expectOpen(true);
      actions.clickClear();
      assertions.expectValue(null);
      assertions.expectOpen(true);
      assertions.expectInputFocused(true);
    },
  },
  {
    id: "disabled-prevents-open",
    description: "Disabled combobox cannot open via focus, input, trigger, keyboard, or controller",
    source: {
      file: SOURCE_FILE,
      caseTitle: "behavioral equivalent: disabled interaction contract",
    },
    fixtureOptions: { disabled: true },
    run: ({ actions, assertions }) => {
      assertions.expectInputDisabled(true);

      actions.focusInput();
      assertions.expectOpen(false);

      actions.setInputValue("a");
      assertions.expectOpen(false);

      actions.pressKey("ArrowDown");
      assertions.expectOpen(false);

      actions.clickTrigger();
      assertions.expectOpen(false);

      actions.open();
      assertions.expectOpen(false);
    },
  },
  {
    id: "outside-pointerdown-dismisses",
    description: "Outside pointerdown dismisses popup on desktop-like environments",
    source: {
      file: SOURCE_FILE,
      caseTitle: "keeps the latest pointer highlight on outside blur when behavior is \"always\"",
    },
    run: ({ actions, assertions }) => {
      actions.open();
      assertions.expectOpen(true);
      actions.pointerDownOutside();
      assertions.expectOpen(false);
    },
  },
  {
    id: "filtering-empty-state-toggle",
    description: "Filtering toggles empty state and visible option set",
    source: {
      file: SOURCE_FILE,
      caseTitle: "highlights the first item when typing and keeps it during filtering",
    },
    run: ({ actions, assertions }) => {
      actions.open();
      actions.setInputValue("zzz");
      assertions.expectVisibleValues([]);
      assertions.expectEmptyVisible(true);

      actions.setInputValue("ap");
      assertions.expectVisibleValues(["apple"]);
      assertions.expectEmptyVisible(false);
    },
  },
  {
    id: "enter-selects-highlighted-item",
    description: "Enter commits highlighted option and closes popup",
    source: {
      file: SOURCE_FILE,
      caseTitle: "closes popup on Tab after selecting with Enter and typing again",
    },
    run: ({ actions, assertions }) => {
      actions.open();
      actions.pressKey("ArrowDown");
      assertions.expectHighlightedValue("apple");

      actions.pressKey("Enter");
      assertions.expectOpen(false);
      assertions.expectValue("apple");
      assertions.expectInputValue("Apple");
    },
  },
  {
    id: "required-validation-empty-vs-selected",
    description: "Required validation fails when empty and clears after selection",
    source: {
      file: SOURCE_FILE,
      caseTitle: "triggers native validation when required and empty",
    },
    fixtureOptions: { required: true },
    run: ({ actions, assertions, fixture }) => {
      assertions.expectInputRequired(true);
      assertions.expectInputValid(false);

      actions.open();
      actions.clickItem("apple");
      assertions.expectValue("apple");
      assertions.expectInputValid(true);

      fixture.controller.clear();
      assertions.expectValue(null);
      assertions.expectInputValid(false);
    },
  },
];
