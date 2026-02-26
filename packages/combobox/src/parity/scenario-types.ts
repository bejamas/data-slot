import type { ComboboxController, ComboboxOptions } from "../index";

export type ComboboxParityScenarioId =
  | "tab-close-after-enter-then-retype"
  | "auto-highlight-on-typing"
  | "activedescendant-follows-filtering"
  | "no-initial-highlight-without-auto-highlight"
  | "highlight-first-on-arrowdown-with-auto-highlight"
  | "escape-closes-open-popup"
  | "tab-closes-and-restores-committed-label"
  | "disabled-prevents-open"
  | "outside-pointerdown-dismisses"
  | "filtering-empty-state-toggle"
  | "enter-selects-highlighted-item"
  | "required-validation-empty-vs-selected";

export interface BaseUiCaseRef {
  file: string;
  caseTitle: string;
}

export interface MountComboboxFixtureOptions {
  options?: ComboboxOptions;
  html?: string;
}

export interface ComboboxParityFixture {
  root: HTMLElement;
  input: HTMLInputElement;
  triggerBtn: HTMLElement | null;
  content: HTMLElement;
  list: HTMLElement;
  emptySlot: HTMLElement | null;
  controller: ComboboxController;
  getItems(): HTMLElement[];
  getItemByValue(value: string): HTMLElement | null;
  destroy(): void;
}

export interface ComboboxParityActions {
  setInputValue(value: string): void;
  appendInputValue(suffix: string): void;
  focusInput(): void;
  pressKey(key: string): KeyboardEvent;
  clickTrigger(): void;
  clickItem(value: string): void;
  pointerDownOutside(): void;
  clickOutside(): void;
  open(): void;
  close(): void;
  waitForRaf(): Promise<void>;
  wait(ms: number): Promise<void>;
}

export interface ComboboxParityAssertions {
  expectOpen(expected: boolean): void;
  expectValue(expected: string | null): void;
  expectInputValue(expected: string): void;
  expectHighlightedValue(expected: string | null): void;
  expectActivedescendantFor(value: string): void;
  expectVisibleValues(expectedValues: string[]): void;
  expectEmptyVisible(expectedVisible: boolean): void;
  expectInputDisabled(expectedDisabled: boolean): void;
  expectInputRequired(expectedRequired: boolean): void;
  expectInputValid(expectedValid: boolean): void;
}

export interface ComboboxParityContext {
  fixture: ComboboxParityFixture;
  actions: ComboboxParityActions;
  assertions: ComboboxParityAssertions;
}

export interface ComboboxParityScenario {
  id: ComboboxParityScenarioId;
  description: string;
  source: BaseUiCaseRef;
  fixtureOptions?: ComboboxOptions;
  run: (context: ComboboxParityContext) => void | Promise<void>;
}
