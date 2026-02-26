import { createCombobox } from "../index";
import type { ComboboxParityFixture, MountComboboxFixtureOptions } from "./scenario-types";

const DEFAULT_FIXTURE_HTML = `
  <div data-slot="combobox" id="root">
    <input data-slot="combobox-input" />
    <button data-slot="combobox-trigger">▼</button>
    <button data-slot="combobox-clear">Clear</button>
    <div data-slot="combobox-content" hidden>
      <div data-slot="combobox-list">
        <div data-slot="combobox-empty" hidden>No results found</div>
        <div data-slot="combobox-group">
          <div data-slot="combobox-label">Fruits</div>
          <div data-slot="combobox-item" data-value="apple">Apple</div>
          <div data-slot="combobox-item" data-value="banana">Banana</div>
        </div>
        <div data-slot="combobox-separator"></div>
        <div data-slot="combobox-item" data-value="other">Other</div>
        <div data-slot="combobox-item" data-value="disabled" data-disabled>Disabled</div>
      </div>
    </div>
  </div>
`;

const requiredElement = <T extends Element>(root: ParentNode, selector: string): T => {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required combobox fixture element: ${selector}`);
  }
  return element as T;
};

export function mountComboboxFixture(
  options: MountComboboxFixtureOptions = {}
): ComboboxParityFixture {
  document.body.innerHTML = options.html ?? DEFAULT_FIXTURE_HTML;

  const root = requiredElement<HTMLElement>(document, "#root");
  const input = requiredElement<HTMLInputElement>(root, '[data-slot="combobox-input"]');
  const content = requiredElement<HTMLElement>(root, '[data-slot="combobox-content"]');
  const list = requiredElement<HTMLElement>(root, '[data-slot="combobox-list"]');
  const emptySlot = root.querySelector<HTMLElement>('[data-slot="combobox-empty"]');
  const triggerBtn = root.querySelector<HTMLElement>('[data-slot="combobox-trigger"]');
  const clearBtn = root.querySelector<HTMLElement>('[data-slot="combobox-clear"]');

  const controller = createCombobox(root, options.options ?? {});

  const getItems = (): HTMLElement[] =>
    Array.from(content.querySelectorAll('[data-slot="combobox-item"]')) as HTMLElement[];

  const getItemByValue = (value: string): HTMLElement | null =>
    getItems().find((item) => item.getAttribute("data-value") === value) ?? null;

  return {
    root,
    input,
    triggerBtn,
    clearBtn,
    content,
    list,
    emptySlot,
    controller,
    getItems,
    getItemByValue,
    destroy: () => {
      controller.destroy();
      document.body.innerHTML = "";
    },
  };
}
