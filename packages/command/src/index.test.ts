import { beforeEach, describe, expect, it } from "bun:test";
import { create, createCommand } from "./index";
import { createDialog } from "../../dialog/src/index";

const waitForMutation = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 0);
  });
  await Promise.resolve();
};

describe("Command", () => {
  const setup = (options: Parameters<typeof createCommand>[1] = {}, html?: string) => {
    document.body.innerHTML =
      html ??
      `
        <label for="command-input">Actions</label>
        <div data-slot="command" id="root" data-label="Command Menu">
          <div data-slot="command-input-wrapper">
            <input data-slot="command-input" id="command-input" placeholder="Search..." />
          </div>
          <div data-slot="command-list">
            <div data-slot="command-empty" hidden>No results.</div>
            <div data-slot="command-group">
              <div data-slot="command-group-heading">Letters</div>
              <div data-slot="command-item" data-keywords="alpha">A</div>
              <div data-slot="command-item">B</div>
            </div>
            <div data-slot="command-separator"></div>
            <div data-slot="command-group">
              <div data-slot="command-group-heading">Fruits</div>
              <div data-slot="command-item" data-value="apple" data-keywords="fruit,macintosh">Apple</div>
              <div data-slot="command-item">Banana</div>
            </div>
            <div data-slot="command-item" data-disabled>Disabled</div>
          </div>
        </div>
      `;

    const root = document.getElementById("root") as HTMLElement;
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const list = root.querySelector('[data-slot="command-list"]') as HTMLElement;
    const empty = root.querySelector('[data-slot="command-empty"]') as HTMLElement;
    const controller = createCommand(root, options);

    return { root, input, list, empty, controller };
  };

  const getDirectSlotOrder = (container: HTMLElement, slot: string) =>
    Array.from(container.children)
      .filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.getAttribute("data-slot") === slot
      )
      .map((child) => child.getAttribute("data-value") ?? child.textContent?.replace(/\s+/g, " ").trim() ?? "");

  const getTopLevelRankableOrder = (list: HTMLElement) =>
    Array.from(list.children)
      .filter((child): child is HTMLElement => {
        if (!(child instanceof HTMLElement)) return false;
        const slot = child.getAttribute("data-slot");
        return slot === "command-item" || slot === "command-group";
      })
      .map((child) => child.getAttribute("data-value") ?? child.textContent?.replace(/\s+/g, " ").trim() ?? "");

  const rect = (top: number, height: number) =>
    ({
      x: 0,
      y: top,
      top,
      left: 0,
      width: 200,
      height,
      right: 200,
      bottom: top + height,
      toJSON: () => ({}),
    }) as DOMRect;

  const mockScrollableList = (list: HTMLElement, items: HTMLElement[], itemHeight = 40, clientHeight = 120) => {
    Object.defineProperty(list, "clientHeight", { configurable: true, value: clientHeight });
    Object.defineProperty(list, "scrollHeight", {
      configurable: true,
      value: Math.max(items.length * itemHeight + clientHeight, clientHeight),
    });
    list.getBoundingClientRect = () => rect(0, clientHeight);
    items.forEach((item, index) => {
      item.getBoundingClientRect = () => rect((index * itemHeight) - list.scrollTop, itemHeight);
    });
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("initializes with ARIA wiring and selects the first enabled item", () => {
    const { root, input, list, controller } = setup();
    const firstItem = root.querySelector('[data-slot="command-item"]') as HTMLElement;

    expect(root.tabIndex).toBe(-1);
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-controls")).toBe(list.id);
    expect(list.getAttribute("role")).toBe("listbox");
    expect(firstItem.getAttribute("aria-selected")).toBe("true");
    expect(controller.value).toBe("A");
    expect(root.getAttribute("data-value")).toBe("A");
    expect(list.style.getPropertyValue("--command-list-height")).toEndWith("px");

    controller.destroy();
  });

  it("uses a native label when present", () => {
    const { input, list, controller } = setup();

    expect(input.getAttribute("aria-labelledby")).toBeTruthy();
    expect(list.getAttribute("aria-labelledby")).toBeTruthy();

    controller.destroy();
  });

  it("prefers explicit item values and infers values from text without shortcuts", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" data-value="xxx">Value</div>
          <div data-slot="command-item">
            Project Search
            <span data-slot="command-shortcut">⌘P</span>
          </div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const items = root.querySelectorAll('[data-slot="command-item"]') as NodeListOf<HTMLElement>;

    expect(items[0]?.getAttribute("data-value")).toBe("xxx");
    expect(items[1]?.getAttribute("data-value")).toBe("Project Search");

    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    input.value = "⌘P";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const empty = root.querySelector('[data-slot="command-empty"]') as HTMLElement | null;
    expect(empty?.hidden ?? false).toBe(false);

    controller.destroy();
  });

  it("filters by inferred value and keywords", () => {
    const { root, input, empty, controller } = setup();
    const items = root.querySelectorAll('[data-slot="command-item"]') as NodeListOf<HTMLElement>;

    input.value = "alpha";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(items[0]?.hidden).toBe(false);
    expect(items[1]?.hidden).toBe(true);
    expect(empty.hidden).toBe(true);

    input.value = "mac";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(items[2]?.hidden).toBe(false);
    expect(items[0]?.hidden).toBe(true);

    controller.destroy();
  });

  it("supports numeric filtering", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-empty" hidden>No results.</div>
          <div data-slot="command-item">removed</div>
          <div data-slot="command-item">foo.bar112.value</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const items = root.querySelectorAll('[data-slot="command-item"]') as NodeListOf<HTMLElement>;

    input.value = "112";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(items[0]?.hidden).toBe(true);
    expect(items[1]?.hidden).toBe(false);

    controller.destroy();
  });

  it("shows and hides groups based on matching children", () => {
    const { root, input, controller } = setup();
    const groups = root.querySelectorAll('[data-slot="command-group"]') as NodeListOf<HTMLElement>;

    input.value = "banana";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(groups[0]?.hidden).toBe(true);
    expect(groups[1]?.hidden).toBe(false);

    controller.destroy();
  });

  it("keeps force-mounted items rendered without suppressing the empty state", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-empty" hidden>No results.</div>
          <div data-slot="command-item" data-force-mount>Alpha</div>
          <div data-slot="command-item">Beta</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const empty = root.querySelector('[data-slot="command-empty"]') as HTMLElement;
    const items = root.querySelectorAll('[data-slot="command-item"]') as NodeListOf<HTMLElement>;

    input.value = "zzz";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(items[0]?.hidden).toBe(false);
    expect(items[1]?.hidden).toBe(true);
    expect(empty.hidden).toBe(false);

    controller.destroy();
  });

  it("keeps force-mounted groups rendered during search", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-empty" hidden>No results.</div>
          <div data-slot="command-group" data-force-mount>
            <div data-slot="command-group-heading">Letters</div>
            <div data-slot="command-item">A</div>
          </div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const group = root.querySelector('[data-slot="command-group"]') as HTMLElement;
    const item = root.querySelector('[data-slot="command-item"]') as HTMLElement;
    const empty = root.querySelector('[data-slot="command-empty"]') as HTMLElement;

    input.value = "zzz";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(group.hidden).toBe(false);
    expect(item.hidden).toBe(false);
    expect(empty.hidden).toBe(false);

    controller.destroy();
  });

  it("hides separators while searching unless alwaysRender is enabled", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item">Alpha</div>
          <div data-slot="command-separator"></div>
          <div data-slot="command-separator" data-always-render></div>
          <div data-slot="command-item">Beta</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const separators = root.querySelectorAll('[data-slot="command-separator"]') as NodeListOf<HTMLElement>;

    input.value = "a";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(separators[0]?.hidden).toBe(true);
    expect(separators[1]?.hidden).toBe(false);

    controller.destroy();
  });

  it("supports shouldFilter=false", () => {
    const { root, input, controller } = setup({ shouldFilter: false });
    const items = root.querySelectorAll('[data-slot="command-item"]') as NodeListOf<HTMLElement>;

    input.value = "zzz";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(Array.from(items).every((item) => !item.hidden)).toBe(true);
    expect(controller.value).toBe("A");

    controller.destroy();
  });

  it("supports a custom filter function", () => {
    const { root, input, controller } = setup({
      filter: (value, search) => (value.endsWith(search) ? 1 : 0),
    });
    const items = root.querySelectorAll('[data-slot="command-item"]') as NodeListOf<HTMLElement>;

    input.value = "ana";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(items[3]?.hidden).toBe(false);
    expect(items[2]?.hidden).toBe(true);

    controller.destroy();
  });

  it("reconciles selection when a selected inferred item mutates in place", async () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" id="selected-item">Alpha</div>
          <div data-slot="command-item">Beta</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const selectedItem = document.getElementById("selected-item") as HTMLElement;
    const changeValues: Array<string | null> = [];

    root.addEventListener("command:change", (event) => {
      changeValues.push((event as CustomEvent<{ value: string | null }>).detail.value);
    });

    selectedItem.textContent = "Zulu";
    await waitForMutation();

    expect(controller.value).toBe("Zulu");
    expect(root.getAttribute("data-value")).toBe("Zulu");
    expect(selectedItem.getAttribute("data-value")).toBe("Zulu");
    expect(changeValues).toContain("Zulu");

    controller.destroy();
  });

  it("re-infers item values when authored data-value is removed", async () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" id="settings-item" data-value="settings">Open Settings</div>
          <div data-slot="command-item">Billing</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const settingsItem = document.getElementById("settings-item") as HTMLElement;

    controller.select("settings");
    settingsItem.removeAttribute("data-value");
    await waitForMutation();

    expect(settingsItem.getAttribute("data-value")).toBe("Open Settings");
    expect(controller.value).toBe("Open Settings");

    input.value = "settings";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(settingsItem.hidden).toBe(false);

    controller.destroy();
  });

  it("ranks groups and top-level items together and restores authored order after clearing search", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" data-value="one">One</div>
          <div data-slot="command-group">
            <div data-slot="command-group-heading">Actions</div>
            <div data-slot="command-item" data-value="project">Open Project</div>
            <div data-slot="command-item" data-value="settings">Open Settings</div>
          </div>
          <div data-slot="command-item" data-value="beta">Beta</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const list = root.querySelector('[data-slot="command-list"]') as HTMLElement;
    const group = root.querySelector('[data-slot="command-group"]') as HTMLElement;
    const controller = createCommand(root, {
      filter: (value, search) => {
        if (!search) return 1;
        return {
          one: 1,
          project: 5,
          settings: 10,
          beta: 2,
        }[value] ?? 0;
      },
    });

    input.value = "rank";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(getTopLevelRankableOrder(list)).toEqual(["Actions", "beta", "one"]);
    expect(getDirectSlotOrder(group, "command-item")).toEqual(["settings", "project"]);

    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(getTopLevelRankableOrder(list)).toEqual(["one", "Actions", "beta"]);
    expect(getDirectSlotOrder(group, "command-item")).toEqual(["project", "settings"]);

    controller.destroy();
  });

  it("scrolls selected items into view during downward keyboard navigation", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" data-value="item-1">Item 1</div>
          <div data-slot="command-item" data-value="item-2">Item 2</div>
          <div data-slot="command-item" data-value="item-3">Item 3</div>
          <div data-slot="command-item" data-value="item-4">Item 4</div>
          <div data-slot="command-item" data-value="item-5">Item 5</div>
          <div data-slot="command-item" data-value="item-6">Item 6</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const list = root.querySelector('[data-slot="command-list"]') as HTMLElement;
    const items = Array.from(root.querySelectorAll('[data-slot="command-item"]')) as HTMLElement[];

    mockScrollableList(list, items);

    const controller = createCommand(root);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));

    expect(controller.value).toBe("item-6");
    expect(list.scrollTop).toBe(124);

    controller.destroy();
  });

  it("scrolls selected items into view during upward keyboard navigation", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" data-value="item-1">Item 1</div>
          <div data-slot="command-item" data-value="item-2">Item 2</div>
          <div data-slot="command-item" data-value="item-3">Item 3</div>
          <div data-slot="command-item" data-value="item-4">Item 4</div>
          <div data-slot="command-item" data-value="item-5">Item 5</div>
          <div data-slot="command-item" data-value="item-6">Item 6</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const list = root.querySelector('[data-slot="command-list"]') as HTMLElement;
    const items = Array.from(root.querySelectorAll('[data-slot="command-item"]')) as HTMLElement[];

    mockScrollableList(list, items);
    list.scrollTop = 124;

    const controller = createCommand(root, { defaultValue: "item-6" });

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

    expect(controller.value).toBe("item-1");
    expect(list.scrollTop).toBe(0);

    controller.destroy();
  });

  it("scrolls auto-selected search results into view", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" data-value="item-1">Item 1</div>
          <div data-slot="command-item" data-value="item-2">Item 2</div>
          <div data-slot="command-item" data-value="item-3">Item 3</div>
          <div data-slot="command-item" data-value="item-4">Item 4</div>
          <div data-slot="command-item" data-value="item-5">Item 5</div>
          <div data-slot="command-item" data-value="item-6" data-keywords="omega">Item 6</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const list = root.querySelector('[data-slot="command-list"]') as HTMLElement;
    const items = Array.from(root.querySelectorAll('[data-slot="command-item"]')) as HTMLElement[];

    mockScrollableList(list, items);

    const controller = createCommand(root);

    input.value = "omega";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(controller.value).toBe("item-6");
    expect(list.scrollTop).toBe(124);

    controller.destroy();
  });

  it("does not scroll on initial default-search selection below the fold", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" data-value="item-1">Item 1</div>
          <div data-slot="command-item" data-value="item-2">Item 2</div>
          <div data-slot="command-item" data-value="item-3">Item 3</div>
          <div data-slot="command-item" data-value="item-4">Item 4</div>
          <div data-slot="command-item" data-value="item-5">Item 5</div>
          <div data-slot="command-item" data-value="item-6" data-keywords="omega">Item 6</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const list = root.querySelector('[data-slot="command-list"]') as HTMLElement;
    const items = Array.from(root.querySelectorAll('[data-slot="command-item"]')) as HTMLElement[];

    mockScrollableList(list, items);

    const controller = createCommand(root, { defaultSearch: "omega" });

    expect(controller.value).toBe("item-6");
    expect(list.scrollTop).toBe(0);

    controller.destroy();
  });

  it("updates selection with keyboard navigation, looping, and group jumps", () => {
    const { input, controller } = setup({ loop: true });

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(controller.value).toBe("B");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(controller.value).toBe("Banana");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(controller.value).toBe("A");

    controller.select("B");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true })
    );
    expect(controller.value).toBe("apple");

    controller.destroy();
  });

  it("keeps keyboard navigation working from root focus without auto-focusing on focus", () => {
    const { root, input, controller } = setup();
    const separator = root.querySelector('[data-slot="command-separator"]') as HTMLElement;

    root.focus();
    expect(document.activeElement).toBe(root);

    const separatorMouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    separator.dispatchEvent(separatorMouseDown);
    expect(separatorMouseDown.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(root);

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(controller.value).toBe("B");
    expect(document.activeElement).toBe(input);

    (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true })
    );
    expect(controller.value).toBe("Banana");

    controller.destroy();
  });

  it("supports vim bindings and disabling them", () => {
    const first = setup();
    first.input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true })
    );
    expect(first.controller.value).toBe("B");
    first.controller.destroy();

    const second = setup({ vimBindings: false });
    second.input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true })
    );
    expect(second.controller.value).toBe("A");
    second.controller.destroy();
  });

  it("selects items on pointer move and click, unless pointer selection is disabled", () => {
    const first = setup();
    const items = first.root.querySelectorAll('[data-slot="command-item"]') as NodeListOf<HTMLElement>;
    items[2]?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
    expect(first.controller.value).toBe("apple");
    first.input.focus();
    items[2]?.click();
    expect(first.root.getAttribute("data-value")).toBe("apple");
    expect(document.activeElement).toBe(first.input);
    first.input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(first.controller.value).toBe("Banana");
    first.controller.destroy();

    const second = setup({ disablePointerSelection: true });
    const otherItems = second.root.querySelectorAll('[data-slot="command-item"]') as NodeListOf<HTMLElement>;
    otherItems[2]?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
    expect(second.controller.value).toBe("A");
    second.controller.destroy();
  });

  it("does not hijack nested interactive descendants", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item" data-value="alpha">
            Alpha
            <button type="button" id="nested-action">Action</button>
          </div>
          <div data-slot="command-item" data-value="beta">Beta</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const button = document.getElementById("nested-action") as HTMLButtonElement;

    controller.select("beta");
    const buttonMouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    button.dispatchEvent(buttonMouseDown);
    expect(buttonMouseDown.defaultPrevented).toBe(false);
    button.click();
    expect(controller.value).toBe("beta");

    controller.select("alpha");
    button.focus();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(controller.value).toBe("alpha");

    controller.destroy();
  });

  it("emits selection and change events", () => {
    const { root, input, controller } = setup();
    const changeValues: Array<string | null> = [];
    const selectValues: string[] = [];

    root.addEventListener("command:change", (event) => {
      changeValues.push((event as CustomEvent<{ value: string | null }>).detail.value);
    });
    root.addEventListener("command:select", (event) => {
      selectValues.push((event as CustomEvent<{ value: string }>).detail.value);
    });

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(changeValues).toContain("B");
    expect(selectValues).toEqual(["B"]);

    controller.destroy();
  });

  it("supports controller methods and inbound command:set events", () => {
    const { root, controller } = setup();

    controller.select("apple");
    expect(controller.value).toBe("apple");

    controller.setSearch("ban");
    expect(controller.search).toBe("ban");
    expect(controller.value).toBe("Banana");

    root.dispatchEvent(
      new CustomEvent("command:set", {
        detail: { search: "app", value: "apple" },
        bubbles: true,
      })
    );

    expect(controller.search).toBe("app");
    expect(controller.value).toBe("apple");

    controller.destroy();
  });

  it("updates from DOM mutations", async () => {
    document.body.innerHTML = `
      <div data-slot="command" id="root">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-empty" hidden>No results.</div>
          <div data-slot="command-item" id="item-a">A</div>
        </div>
      </div>
    `;

    const root = document.getElementById("root") as HTMLElement;
    const controller = createCommand(root);
    const input = root.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    const list = root.querySelector('[data-slot="command-list"]') as HTMLElement;
    const itemA = document.getElementById("item-a") as HTMLElement;

    const itemB = document.createElement("div");
    itemB.setAttribute("data-slot", "command-item");
    itemB.textContent = "B";
    list.appendChild(itemB);
    await waitForMutation();

    itemB.click();
    expect(controller.value).toBe("B");

    itemA.remove();
    await waitForMutation();
    expect(controller.value).toBe("B");

    input.value = "c";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(controller.value).toBe(null);

    itemB.textContent = "C";
    await waitForMutation();
    expect(controller.value).toBe("C");
    expect(itemB.hidden).toBe(false);

    controller.destroy();
  });

  it("resolves defaultSearch to the first visible match on init", () => {
    const { controller } = setup({ defaultSearch: "ban" });

    expect(controller.search).toBe("ban");
    expect(controller.value).toBe("Banana");

    controller.destroy();
  });

  it("works inside dialog content", () => {
    document.body.innerHTML = `
      <div data-slot="dialog" id="dialog-root">
        <button data-slot="dialog-trigger">Open</button>
        <div data-slot="dialog-overlay" hidden></div>
        <div data-slot="dialog-content" hidden>
          <div data-slot="command" id="command-root">
            <input data-slot="command-input" />
            <div data-slot="command-list">
              <div data-slot="command-item">Alpha</div>
              <div data-slot="command-item">Beta</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const dialogRoot = document.getElementById("dialog-root") as HTMLElement;
    const commandRoot = document.getElementById("command-root") as HTMLElement;
    const dialog = createDialog(dialogRoot);
    const command = createCommand(commandRoot);

    dialog.open();
    expect(command.value).toBe("Alpha");

    const input = commandRoot.querySelector('[data-slot="command-input"]') as HTMLInputElement;
    commandRoot.focus();
    expect(document.activeElement).toBe(commandRoot);

    const list = commandRoot.querySelector('[data-slot="command-list"]') as HTMLElement;
    const listMouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    list.dispatchEvent(listMouseDown);
    expect(listMouseDown.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(commandRoot);

    commandRoot.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(command.value).toBe("Beta");
    expect(document.activeElement).toBe(input);

    command.destroy();
    dialog.destroy();
  });

  it("create() binds all command roots and duplicate binds reuse the same controller", () => {
    document.body.innerHTML = `
      <div data-slot="command" id="one">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item">One</div>
        </div>
      </div>
      <div data-slot="command" id="two">
        <input data-slot="command-input" />
        <div data-slot="command-list">
          <div data-slot="command-item">Two</div>
        </div>
      </div>
    `;

    const controllers = create();
    expect(controllers).toHaveLength(2);

    const root = document.getElementById("one") as HTMLElement;
    const first = createCommand(root);
    const second = createCommand(root);
    expect(first).toBe(second);

    controllers.forEach((controller) => controller.destroy());
  });
});
