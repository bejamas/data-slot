import {
  getPart,
  getRoots,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  getDataBool,
  getDataString,
  ensureId,
  setAria,
  on,
  emit,
  ensureItemVisibleInContainer,
} from "@data-slot/core";
import { commandScore } from "./command-score";

export type CommandFilter = (value: string, search: string, keywords?: string[]) => number;

export interface CommandOptions {
  /** Accessible label announced for the command input */
  label?: string;
  /** Initial active item value */
  defaultValue?: string;
  /** Initial search input value */
  defaultSearch?: string;
  /** Called whenever the active item value changes */
  onValueChange?: (value: string | null) => void;
  /** Called whenever the search query changes */
  onSearchChange?: (search: string) => void;
  /** Called when an item is selected via click or Enter */
  onSelect?: (value: string) => void;
  /** Disable built-in filtering and sorting */
  shouldFilter?: boolean;
  /** Custom ranking function. Return 0 to hide the item. */
  filter?: CommandFilter;
  /** Wrap arrow-key navigation */
  loop?: boolean;
  /** Disable pointer-move selection */
  disablePointerSelection?: boolean;
  /** Enable ctrl+j/k/n/p shortcuts @default true */
  vimBindings?: boolean;
}

export interface CommandController {
  /** Current active item value */
  readonly value: string | null;
  /** Current search query */
  readonly search: string;
  /** Set the active item value programmatically */
  select(value: string | null): void;
  /** Set the search query programmatically */
  setSearch(search: string): void;
  /** Cleanup all event listeners and observers */
  destroy(): void;
}

interface GroupMeta {
  el: HTMLElement;
  heading: HTMLElement | null;
  value: string;
  forceMount: boolean;
  maxRank: number;
}

interface ItemMeta {
  el: HTMLElement;
  value: string | null;
  keywords: string[];
  disabled: boolean;
  forceMount: boolean;
  rank: number;
  group: GroupMeta | null;
}

interface SetValueOptions {
  emit?: boolean;
  ensureVisible?: boolean;
}

const ROOT_BINDING_KEY = "@data-slot/command";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/command] createCommand() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

const ITEM_SELECTOR = '[data-slot="command-item"]';
const GROUP_SELECTOR = '[data-slot="command-group"]';
const GROUP_HEADING_SELECTOR = '[data-slot="command-group-heading"]';
const SEPARATOR_SELECTOR = '[data-slot="command-separator"]';
const AUTHORED_VALUE_SYMBOL = Symbol("data-slot.command.authored-value");
const INFERRED_VALUE_SYMBOL = Symbol("data-slot.command.inferred-value");
const DIRECT_MUTATION_ATTRIBUTES = [
  "data-slot",
  "data-value",
  "data-label",
  "data-keywords",
  "data-disabled",
  "disabled",
  "data-force-mount",
  "data-always-render",
] as const;
const INTERACTIVE_DESCENDANT_SELECTOR = [
  'input:not([type="hidden"])',
  "textarea",
  "select",
  "button",
  "a[href]",
  "summary",
  "audio[controls]",
  "video[controls]",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

const defaultFilter: CommandFilter = (value, search, keywords) => {
  if (!search.trim()) return 1;
  return commandScore(value, search, keywords ?? []);
};

const normalizeValue = (value: string | null | undefined): string | null =>
  value == null ? null : value.trim();

const parseKeywords = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const getDirectChildrenBySlot = <T extends HTMLElement>(parent: HTMLElement, slot: string): T[] =>
  Array.from(parent.children).filter(
    (child): child is T => child instanceof HTMLElement && child.getAttribute("data-slot") === slot
  );

const getDirectChildWithinContainer = (el: HTMLElement, container: HTMLElement): HTMLElement | null => {
  let current: HTMLElement | null = el;
  while (current && current.parentElement && current.parentElement !== container) {
    current = current.parentElement;
  }
  return current?.parentElement === container ? current : null;
};

const getOwnedElements = <T extends HTMLElement>(
  scope: ParentNode,
  selector: string,
  root: HTMLElement
): T[] =>
  Array.from(scope.querySelectorAll<T>(selector)).filter(
    (el) => el.closest('[data-slot="command"]') === root
  );

const getElementChildren = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.children).filter((child): child is HTMLElement => child instanceof HTMLElement);

const getItemText = (item: HTMLElement): string => {
  const collectText = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }
    if (!(node instanceof HTMLElement)) {
      return "";
    }
    const slot = node.getAttribute("data-slot");
    if (slot === "command-shortcut") {
      return "";
    }

    let text = "";
    for (const child of node.childNodes) {
      text += collectText(child);
    }
    return text;
  };

  return collectText(item).replace(/\s+/g, " ").trim();
};

const isItemDisabled = (el: HTMLElement): boolean =>
  el.hasAttribute("disabled") || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";

type CommandTaggedElement = HTMLElement & {
  [AUTHORED_VALUE_SYMBOL]?: boolean;
  [INFERRED_VALUE_SYMBOL]?: string | null;
};

const resolveValueSource = (
  el: HTMLElement,
  fallback: () => string | null
): { authored: boolean; value: string | null } => {
  const tagged = el as CommandTaggedElement;
  const hasDataValue = el.hasAttribute("data-value");

  if (tagged[AUTHORED_VALUE_SYMBOL] === undefined) {
    tagged[AUTHORED_VALUE_SYMBOL] = hasDataValue;
  }

  if (!hasDataValue) {
    tagged[AUTHORED_VALUE_SYMBOL] = false;
  } else if (!tagged[AUTHORED_VALUE_SYMBOL]) {
    const authoredOverride = normalizeValue(el.getAttribute("data-value")) !== tagged[INFERRED_VALUE_SYMBOL];
    if (authoredOverride) {
      tagged[AUTHORED_VALUE_SYMBOL] = true;
    }
  }

  if (tagged[AUTHORED_VALUE_SYMBOL]) {
    return {
      authored: true,
      value: normalizeValue(el.getAttribute("data-value")),
    };
  }

  const value = fallback();
  tagged[INFERRED_VALUE_SYMBOL] = value;
  if (value === null) {
    el.removeAttribute("data-value");
  } else {
    el.setAttribute("data-value", value);
  }

  return { authored: false, value };
};

export function createCommand(
  root: Element,
  options: CommandOptions = {}
): CommandController {
  const existingController = reuseRootBinding<CommandController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  const rootEl = root as HTMLElement;
  const input = getPart<HTMLInputElement>(root, "command-input");
  const list = getPart<HTMLElement>(root, "command-list");
  const empty = getPart<HTMLElement>(list ?? root, "command-empty");

  if (!input || !list) {
    throw new Error("Command requires command-input and command-list slots");
  }

  const label = options.label ?? getDataString(rootEl, "label") ?? "Command Menu";
  const shouldFilter = options.shouldFilter ?? getDataBool(rootEl, "shouldFilter") ?? true;
  const loop = options.loop ?? getDataBool(rootEl, "loop") ?? false;
  const disablePointerSelection =
    options.disablePointerSelection ?? getDataBool(rootEl, "disablePointerSelection") ?? false;
  const vimBindings = options.vimBindings ?? getDataBool(rootEl, "vimBindings") ?? true;
  const filter = options.filter ?? defaultFilter;
  const onValueChange = options.onValueChange;
  const onSearchChange = options.onSearchChange;
  const onSelect = options.onSelect;

  let currentValue = normalizeValue(options.defaultValue ?? getDataString(rootEl, "defaultValue"));
  let currentSearch = options.defaultSearch ?? getDataString(rootEl, "defaultSearch") ?? "";
  let itemMetas: ItemMeta[] = [];
  let groupMetas: GroupMeta[] = [];
  let itemMetaByElement = new Map<HTMLElement, ItemMeta>();
  let groupMetaByElement = new Map<HTMLElement, GroupMeta>();
  let filteredCount = 0;
  let cleanups: Array<() => void> = [];
  let mutationObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let mutationQueued = false;
  let isDestroyed = false;
  let addedRootTabIndex = false;
  let authoredListChildren: HTMLElement[] = [];
  let authoredGroupChildren = new Map<HTMLElement, HTMLElement[]>();
  let layoutIsRanked = false;

  const inputId = ensureId(input, "command-input");
  const listId = ensureId(list, "command-list");

  if (!rootEl.hasAttribute("tabindex")) {
    rootEl.tabIndex = -1;
    addedRootTabIndex = true;
  }

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-controls", listId);
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.spellcheck = false;

  list.setAttribute("role", "listbox");
  list.tabIndex = -1;

  const nativeLabel = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(inputId)}"]`);
  if (nativeLabel) {
    const labelId = ensureId(nativeLabel, "command-label");
    const existing = input.getAttribute("aria-labelledby");
    input.setAttribute("aria-labelledby", existing ? `${existing} ${labelId}` : labelId);
    list.setAttribute("aria-labelledby", labelId);
  } else if (!input.hasAttribute("aria-label") && !input.hasAttribute("aria-labelledby")) {
    input.setAttribute("aria-label", label);
    list.setAttribute("aria-label", "Suggestions");
  }

  const focusInput = () => {
    if (document.activeElement === input) return;
    input.focus({ preventScroll: true });
  };

  const getInteractiveDescendant = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof HTMLElement) || !rootEl.contains(target)) return null;
    const interactive = target.closest(INTERACTIVE_DESCENDANT_SELECTOR);
    return interactive instanceof HTMLElement && rootEl.contains(interactive) ? interactive : null;
  };

  const pauseMutationObserver = <T>(fn: () => T): T => {
    mutationObserver?.disconnect();
    try {
      return fn();
    } finally {
      observeMutations();
    }
  };

  const setListHeightVar = () => {
    list.style.setProperty("--command-list-height", `${list.scrollHeight.toFixed(1)}px`);
  };

  const syncResizeObserver = () => {
    if (typeof ResizeObserver === "undefined") {
      setListHeightVar();
      return;
    }

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        setListHeightVar();
      });
    }

    resizeObserver.disconnect();
    resizeObserver.observe(list);

    for (const el of getOwnedElements<HTMLElement>(
      list,
      `${ITEM_SELECTOR}, ${GROUP_SELECTOR}, ${SEPARATOR_SELECTOR}, [data-slot="command-empty"]`,
      rootEl
    )) {
      resizeObserver.observe(el);
    }

    setListHeightVar();
  };

  const mergeChildOrder = (snapshot: HTMLElement[], currentChildren: HTMLElement[]): HTMLElement[] => {
    const next = snapshot.filter((child) => currentChildren.includes(child));

    for (const child of currentChildren) {
      if (next.includes(child)) continue;

      const currentIndex = currentChildren.indexOf(child);
      let inserted = false;

      for (let index = currentIndex - 1; index >= 0; index -= 1) {
        const previousSibling = currentChildren[index];
        if (!previousSibling) continue;
        const snapshotIndex = next.indexOf(previousSibling);
        if (snapshotIndex !== -1) {
          next.splice(snapshotIndex + 1, 0, child);
          inserted = true;
          break;
        }
      }

      if (inserted) continue;

      for (let index = currentIndex + 1; index < currentChildren.length; index += 1) {
        const nextSibling = currentChildren[index];
        if (!nextSibling) continue;
        const snapshotIndex = next.indexOf(nextSibling);
        if (snapshotIndex !== -1) {
          next.splice(snapshotIndex, 0, child);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        next.push(child);
      }
    }

    return next;
  };

  const captureAuthoredStructure = () => {
    authoredListChildren = getElementChildren(list);
    authoredGroupChildren = new Map(
      groupMetas.map((group) => [group.el, getElementChildren(group.el)])
    );
  };

  const mergeAuthoredStructure = () => {
    const currentListChildren = getElementChildren(list);
    authoredListChildren =
      authoredListChildren.length === 0
        ? currentListChildren
        : mergeChildOrder(authoredListChildren, currentListChildren);

    const nextGroupChildren = new Map<HTMLElement, HTMLElement[]>();
    for (const group of groupMetas) {
      const currentChildren = getElementChildren(group.el);
      const existingSnapshot = authoredGroupChildren.get(group.el) ?? [];
      nextGroupChildren.set(
        group.el,
        existingSnapshot.length === 0
          ? currentChildren
          : mergeChildOrder(existingSnapshot, currentChildren)
      );
    }

    authoredGroupChildren = nextGroupChildren;
  };

  const applyChildOrder = (container: HTMLElement, orderedChildren: HTMLElement[]) => {
    const currentChildren = getElementChildren(container);
    const placedChildren = new Set<HTMLElement>();

    for (const child of orderedChildren) {
      if (child.parentElement !== container || placedChildren.has(child)) continue;
      placedChildren.add(child);
      container.appendChild(child);
    }

    for (const child of currentChildren) {
      if (placedChildren.has(child) || child.parentElement !== container) continue;
      container.appendChild(child);
    }
  };

  const getOrderIndexMap = (snapshot: HTMLElement[]) =>
    new Map(snapshot.map((el, index) => [el, index]));

  const restoreAuthoredOrder = () => {
    for (const group of groupMetas) {
      const groupChildren =
        authoredGroupChildren.get(group.el)?.filter((child) => child.parentElement === group.el) ?? [];
      applyChildOrder(group.el, groupChildren);
    }

    const listChildren = authoredListChildren.filter((child) => child.parentElement === list);
    applyChildOrder(list, listChildren);
  };

  const getSelectedVisibleItem = (): HTMLElement | null => {
    if (currentValue === null) return null;
    const items = getOwnedElements<HTMLElement>(list, ITEM_SELECTOR, rootEl);
    return (
      items.find((item) => {
        const meta = itemMetaByElement.get(item);
        return meta?.value === currentValue && !item.hidden && !(meta.group?.el.hidden ?? false);
      }) ?? null
    );
  };

  const syncSelectionState = () => {
    for (const meta of itemMetas) {
      const selected = meta.value === currentValue && currentValue !== null;
      setAria(meta.el, "selected", selected);
      if (selected) {
        meta.el.setAttribute("data-selected", "");
      } else {
        meta.el.removeAttribute("data-selected");
      }
    }

    const selectedVisible = getSelectedVisibleItem();
    if (selectedVisible) {
      input.setAttribute("aria-activedescendant", selectedVisible.id);
      list.setAttribute("aria-activedescendant", selectedVisible.id);
    } else {
      input.removeAttribute("aria-activedescendant");
      list.removeAttribute("aria-activedescendant");
    }
  };

  const syncRootState = () => {
    if (currentValue !== null) {
      rootEl.setAttribute("data-value", currentValue);
    } else {
      rootEl.removeAttribute("data-value");
    }

    if (currentSearch) {
      rootEl.setAttribute("data-search", currentSearch);
    } else {
      rootEl.removeAttribute("data-search");
    }
  };

  const getAllVisibleItemsInDomOrder = (): ItemMeta[] =>
    getOwnedElements<HTMLElement>(list, ITEM_SELECTOR, rootEl)
      .map((el) => itemMetaByElement.get(el) ?? null)
      .filter(
        (meta): meta is ItemMeta =>
          meta !== null && !meta.el.hidden && !(meta.group?.el.hidden ?? false)
      );

  const getEnabledVisibleItemsInDomOrder = (): ItemMeta[] =>
    getAllVisibleItemsInDomOrder().filter((meta) => !meta.disabled);

  const emitValueIfChanged = (previousValue: string | null, nextValue: string | null, shouldEmit: boolean) => {
    if (!shouldEmit || previousValue === nextValue) return;
    emit(rootEl, "command:change", { value: nextValue });
    onValueChange?.(nextValue);
  };

  const scrollSelectedItemIntoView = () => {
    const selectedVisible = getSelectedVisibleItem();
    if (!selectedVisible) return;
    ensureItemVisibleInContainer(selectedVisible, list);
  };

  const setValue = (nextValue: string | null, options: SetValueOptions = {}): boolean => {
    const normalized = normalizeValue(nextValue);
    const previousValue = currentValue;
    const shouldEmit = options.emit ?? true;
    const shouldEnsureVisible = options.ensureVisible ?? false;
    currentValue = normalized;
    syncSelectionState();
    syncRootState();
    if (shouldEnsureVisible) {
      scrollSelectedItemIntoView();
    }
    if (document.activeElement === input || document.activeElement === rootEl) {
      focusInput();
    }
    emitValueIfChanged(previousValue, currentValue, shouldEmit);
    return previousValue !== currentValue;
  };

  const rescanStructure = () => {
    itemMetas = [];
    groupMetas = [];
    itemMetaByElement = new Map();
    groupMetaByElement = new Map();

    for (const groupEl of getOwnedElements<HTMLElement>(list, GROUP_SELECTOR, rootEl)) {
      const heading = getDirectChildrenBySlot<HTMLElement>(groupEl, "command-group-heading")[0] ?? null;
      const resolved = resolveValueSource(
        groupEl,
        () => normalizeValue(heading?.textContent) ?? ensureId(groupEl, "command-group")
      );
      const meta: GroupMeta = {
        el: groupEl,
        heading,
        value: resolved.value ?? ensureId(groupEl, "command-group"),
        forceMount: getDataBool(groupEl, "forceMount") ?? false,
        maxRank: 0,
      };

      groupMetaByElement.set(groupEl, meta);
      groupMetas.push(meta);

      groupEl.setAttribute("role", "group");
      if (heading) {
        const headingId = ensureId(heading, "command-group-heading");
        groupEl.setAttribute("aria-labelledby", headingId);
      } else {
        groupEl.removeAttribute("aria-labelledby");
      }
    }

    for (const itemEl of getOwnedElements<HTMLElement>(list, ITEM_SELECTOR, rootEl)) {
      const groupEl = itemEl.closest(GROUP_SELECTOR);
      const group =
        groupEl instanceof HTMLElement && groupEl.closest('[data-slot="command"]') === rootEl
          ? groupMetaByElement.get(groupEl) ?? null
          : null;
      const resolved = resolveValueSource(
        itemEl,
        () => normalizeValue(itemEl.getAttribute("data-label")) ?? normalizeValue(getItemText(itemEl))
      );
      const meta: ItemMeta = {
        el: itemEl,
        value: resolved.value,
        keywords: parseKeywords(itemEl.getAttribute("data-keywords") ?? undefined),
        disabled: isItemDisabled(itemEl),
        forceMount: getDataBool(itemEl, "forceMount") ?? false,
        rank: 0,
        group,
      };

      itemMetaByElement.set(itemEl, meta);
      itemMetas.push(meta);

      ensureId(itemEl, "command-item");
      itemEl.setAttribute("role", "option");
      if (meta.disabled) {
        itemEl.setAttribute("aria-disabled", "true");
      } else {
        itemEl.removeAttribute("aria-disabled");
      }
    }
  };

  const applyVisibilityState = () => {
    const hasSearch = currentSearch.length > 0;
    filteredCount = 0;

    for (const group of groupMetas) {
      group.maxRank = 0;
    }

    for (const meta of itemMetas) {
      meta.rank =
        shouldFilter && hasSearch && meta.value !== null ? filter(meta.value, currentSearch, meta.keywords) : 1;

      if (shouldFilter && hasSearch && meta.rank > 0) {
        filteredCount += 1;
      }

      const visible =
        !hasSearch ||
        !shouldFilter ||
        meta.forceMount ||
        meta.group?.forceMount ||
        meta.rank > 0;

      meta.el.hidden = !visible;

      if (meta.group && meta.rank > meta.group.maxRank) {
        meta.group.maxRank = meta.rank;
      }
    }

    if (!shouldFilter || !hasSearch) {
      filteredCount = itemMetas.length;
    }

    for (const group of groupMetas) {
      const visible =
        !hasSearch ||
        !shouldFilter ||
        group.forceMount ||
        itemMetas.some((meta) => meta.group === group && meta.rank > 0);
      group.el.hidden = !visible;
    }

    for (const separator of getOwnedElements<HTMLElement>(list, SEPARATOR_SELECTOR, rootEl)) {
      const alwaysRender = getDataBool(separator, "alwaysRender") ?? false;
      separator.hidden = hasSearch && !alwaysRender;
      separator.setAttribute("role", "separator");
    }

    if (empty) {
      empty.hidden = filteredCount > 0;
    }
  };

  const sortVisibleBlocks = () => {
    if (!shouldFilter || !currentSearch) return;

    const authoredListSnapshot = authoredListChildren.filter((child) => child.parentElement === list);
    const listOrderIndex = getOrderIndexMap(authoredListSnapshot);

    const topLevelItemBlocks = new Map<HTMLElement, number>();
    const topLevelVisibleItemBlocks = new Map<HTMLElement, number>();

    for (const meta of itemMetas) {
      if (meta.group !== null) continue;
      const block = getDirectChildWithinContainer(meta.el, list);
      if (!block) continue;

      topLevelItemBlocks.set(block, Math.max(topLevelItemBlocks.get(block) ?? 0, meta.rank));
      if (!meta.el.hidden) {
        topLevelVisibleItemBlocks.set(block, Math.max(topLevelVisibleItemBlocks.get(block) ?? 0, meta.rank));
      }
    }

    const allTopLevelBlocks = new Set<HTMLElement>([
      ...topLevelItemBlocks.keys(),
      ...groupMetas.map((group) => group.el),
    ]);

    const visibleTopLevelBlocks = [
      ...Array.from(topLevelVisibleItemBlocks, ([el, rank]) => ({ el, rank })),
      ...groupMetas
        .filter((group) => !group.el.hidden)
        .map((group) => ({ el: group.el, rank: group.maxRank })),
    ].sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return (listOrderIndex.get(a.el) ?? Number.MAX_SAFE_INTEGER) - (listOrderIndex.get(b.el) ?? Number.MAX_SAFE_INTEGER);
    });

    const visibleTopLevelSet = new Set(visibleTopLevelBlocks.map((block) => block.el));
    const hiddenTopLevelBlocks = authoredListSnapshot.filter(
      (child) => allTopLevelBlocks.has(child) && !visibleTopLevelSet.has(child)
    );
    const rankedTopLevelBlocks = [
      ...visibleTopLevelBlocks.map((block) => block.el),
      ...hiddenTopLevelBlocks,
    ];

    let topLevelBlockIndex = 0;
    const nextListOrder = authoredListSnapshot.map((child) =>
      allTopLevelBlocks.has(child) ? rankedTopLevelBlocks[topLevelBlockIndex++] ?? child : child
    );
    applyChildOrder(list, nextListOrder);

    for (const group of groupMetas) {
      const authoredGroupSnapshot =
        authoredGroupChildren.get(group.el)?.filter((child) => child.parentElement === group.el) ?? [];
      const groupOrderIndex = getOrderIndexMap(authoredGroupSnapshot);
      const allGroupItemBlocks = new Set<HTMLElement>();
      const visibleGroupBlocks = new Map<HTMLElement, number>();

      for (const meta of itemMetas) {
        if (meta.group !== group) continue;
        const block = getDirectChildWithinContainer(meta.el, group.el);
        if (!block) continue;

        allGroupItemBlocks.add(block);
        if (!meta.el.hidden) {
          visibleGroupBlocks.set(block, Math.max(visibleGroupBlocks.get(block) ?? 0, meta.rank));
        }
      }

      const rankedVisibleGroupBlocks = Array.from(visibleGroupBlocks, ([el, rank]) => ({ el, rank })).sort(
        (a, b) => {
          if (b.rank !== a.rank) return b.rank - a.rank;
          return (groupOrderIndex.get(a.el) ?? Number.MAX_SAFE_INTEGER) - (groupOrderIndex.get(b.el) ?? Number.MAX_SAFE_INTEGER);
        }
      );

      const visibleGroupSet = new Set(rankedVisibleGroupBlocks.map((block) => block.el));
      const hiddenGroupBlocks = authoredGroupSnapshot.filter(
        (child) => allGroupItemBlocks.has(child) && !visibleGroupSet.has(child)
      );
      const rankedGroupBlocks = [
        ...rankedVisibleGroupBlocks.map((block) => block.el),
        ...hiddenGroupBlocks,
      ];

      let groupBlockIndex = 0;
      const nextGroupOrder = authoredGroupSnapshot.map((child) =>
        allGroupItemBlocks.has(child) ? rankedGroupBlocks[groupBlockIndex++] ?? child : child
      );
      applyChildOrder(group.el, nextGroupOrder);
    }
  };

  const refreshDisplay = () => {
    pauseMutationObserver(() => {
      rescanStructure();
      if (shouldFilter && currentSearch) {
        mergeAuthoredStructure();
        applyVisibilityState();
        sortVisibleBlocks();
        layoutIsRanked = true;
      } else {
        if (layoutIsRanked) {
          restoreAuthoredOrder();
        }
        captureAuthoredStructure();
        applyVisibilityState();
        layoutIsRanked = false;
      }
      syncSelectionState();
      syncRootState();
    });
    observeMutations();
    syncResizeObserver();
  };

  const selectFirstVisibleItem = (shouldEmit = true, ensureVisible = false) => {
    const nextValue = getEnabledVisibleItemsInDomOrder()[0]?.value ?? null;
    setValue(nextValue, { emit: shouldEmit, ensureVisible });
  };

  const setSearchValue = (nextSearch: string, shouldEmit = true, syncFirstVisible = true) => {
    if (currentSearch === nextSearch) return;
    currentSearch = nextSearch;
    input.value = nextSearch;
    refreshDisplay();
    if (syncFirstVisible) {
      selectFirstVisibleItem(shouldEmit, true);
    }
    if (shouldEmit) {
      emit(rootEl, "command:search-change", { search: currentSearch });
      onSearchChange?.(currentSearch);
    }
  };

  const triggerSelection = (meta: ItemMeta) => {
    if (meta.value === null || meta.disabled) return;
    setValue(meta.value, { emit: true });
    emit(rootEl, "command:select", { value: meta.value });
    onSelect?.(meta.value);
  };

  const getLiveItemMeta = (item: HTMLElement): ItemMeta | null => {
    let meta = itemMetaByElement.get(item) ?? null;
    if (meta) return meta;
    refreshDisplay();
    meta = itemMetaByElement.get(item) ?? null;
    return meta;
  };

  const moveSelectionToIndex = (index: number) => {
    const items = getEnabledVisibleItemsInDomOrder();
    const meta = items[index];
    if (meta) {
      setValue(meta.value, { emit: true, ensureVisible: true });
    }
  };

  const moveSelectionByItem = (change: 1 | -1) => {
    const items = getEnabledVisibleItemsInDomOrder();
    if (items.length === 0) return;

    const currentIndex = items.findIndex((meta) => meta.value === currentValue);
    let nextMeta = items[currentIndex + change];

    if (loop) {
      nextMeta =
        currentIndex + change < 0
          ? items[items.length - 1]
          : currentIndex + change === items.length
          ? items[0]
          : items[currentIndex + change];
    }

    if (nextMeta) {
      setValue(nextMeta.value, { emit: true, ensureVisible: true });
    }
  };

  const moveSelectionByGroup = (change: 1 | -1) => {
    const selected = getSelectedVisibleItem();
    let group = selected?.closest(GROUP_SELECTOR) as HTMLElement | null;

    while (group) {
      let sibling = change > 0 ? group.nextElementSibling : group.previousElementSibling;
      let nextGroup: HTMLElement | null = null;
      while (sibling) {
        if (sibling instanceof HTMLElement && sibling.getAttribute("data-slot") === "command-group" && !sibling.hidden) {
          nextGroup = sibling;
          break;
        }
        sibling = change > 0 ? sibling.nextElementSibling : sibling.previousElementSibling;
      }

      if (!nextGroup) break;

      const nextMeta = getOwnedElements<HTMLElement>(nextGroup, ITEM_SELECTOR, rootEl)
        .map((el) => itemMetaByElement.get(el) ?? null)
        .find((meta): meta is ItemMeta => meta !== null && !meta.disabled && !meta.el.hidden);

      if (nextMeta) {
        setValue(nextMeta.value, { emit: true, ensureVisible: true });
        return;
      }

      group = nextGroup;
    }

    moveSelectionByItem(change);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    const interactiveTarget = getInteractiveDescendant(event.target);
    if (interactiveTarget && interactiveTarget !== input) return;

    const key = event.key.toLowerCase();
    const isComposing = event.isComposing || (event as KeyboardEvent & { keyCode?: number }).keyCode === 229;
    if (isComposing) return;

    const next = () => {
      event.preventDefault();
      if (event.metaKey) {
        moveSelectionToIndex(getEnabledVisibleItemsInDomOrder().length - 1);
      } else if (event.altKey) {
        moveSelectionByGroup(1);
      } else {
        moveSelectionByItem(1);
      }
    };

    const prev = () => {
      event.preventDefault();
      if (event.metaKey) {
        moveSelectionToIndex(0);
      } else if (event.altKey) {
        moveSelectionByGroup(-1);
      } else {
        moveSelectionByItem(-1);
      }
    };

    switch (key) {
      case "arrowdown":
        next();
        break;
      case "arrowup":
        prev();
        break;
      case "home":
        event.preventDefault();
        moveSelectionToIndex(0);
        break;
      case "end":
        event.preventDefault();
        moveSelectionToIndex(getEnabledVisibleItemsInDomOrder().length - 1);
        break;
      case "enter": {
        const selected = getSelectedVisibleItem();
        const meta = selected ? itemMetaByElement.get(selected) : null;
        if (!meta || meta.value === null) return;
        event.preventDefault();
        triggerSelection(meta);
        break;
      }
      case "j":
      case "n":
        if (vimBindings && event.ctrlKey) {
          next();
        }
        break;
      case "k":
      case "p":
        if (vimBindings && event.ctrlKey) {
          prev();
        }
        break;
    }
  };

  const scheduleMutationRefresh = () => {
    if (mutationQueued || isDestroyed) return;
    mutationQueued = true;
    queueMicrotask(() => {
      mutationQueued = false;
      if (isDestroyed) return;
      const selectedBefore = getSelectedVisibleItem();
      refreshDisplay();
      const nextSelectedMeta = selectedBefore ? itemMetaByElement.get(selectedBefore) ?? null : null;
      if (
        nextSelectedMeta &&
        nextSelectedMeta.value !== null &&
        !nextSelectedMeta.disabled &&
        !nextSelectedMeta.el.hidden &&
        !(nextSelectedMeta.group?.el.hidden ?? false)
      ) {
        setValue(nextSelectedMeta.value, { emit: true });
        return;
      }

      if (currentValue !== null) {
        const currentMatch = getEnabledVisibleItemsInDomOrder().find((meta) => meta.value === currentValue) ?? null;
        if (currentMatch) {
          setValue(currentMatch.value, { emit: true });
          return;
        }
      }

      setValue(getEnabledVisibleItemsInDomOrder()[0]?.value ?? null, { emit: true });
    });
  };

  const observeMutations = () => {
    if (!mutationObserver) return;
    mutationObserver.observe(list, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...DIRECT_MUTATION_ATTRIBUTES],
    });
  };

  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(() => {
      scheduleMutationRefresh();
    });
    observeMutations();
  }

  input.value = currentSearch;
  refreshDisplay();
  if (currentSearch || currentValue === null) {
    selectFirstVisibleItem(false);
  }

  cleanups.push(
    on(input, "input", () => {
      setSearchValue(input.value, true, true);
    })
  );

  cleanups.push(
    on(rootEl, "keydown", (event) => {
      handleKeydown(event as KeyboardEvent);
    })
  );

  cleanups.push(
    on(list, "pointermove", (event) => {
      if (disablePointerSelection) return;
      const target = event.target as Node | null;
      const item = target instanceof HTMLElement ? target.closest(ITEM_SELECTOR) : null;
      if (!(item instanceof HTMLElement)) return;
      const meta = getLiveItemMeta(item);
      if (!meta || meta.disabled || item.hidden || meta.group?.el.hidden) return;
      setValue(meta.value, { emit: true });
    })
  );

  cleanups.push(
    on(list, "click", (event) => {
      const target = event.target as HTMLElement | null;
      const interactiveTarget = getInteractiveDescendant(target);
      const item = target instanceof HTMLElement ? target.closest(ITEM_SELECTOR) : null;
      if (interactiveTarget && interactiveTarget !== item) return;
      if (!(item instanceof HTMLElement)) return;
      const meta = getLiveItemMeta(item);
      if (!meta || meta.disabled || meta.value === null || item.hidden || meta.group?.el.hidden) return;
      triggerSelection(meta);
    })
  );

  cleanups.push(
    on(rootEl, "command:set", (event) => {
      const detail = (event as CustomEvent<{ value?: string | null; search?: string }>).detail;
      if (!detail) return;

      if (detail.search !== undefined) {
        setSearchValue(String(detail.search), true, detail.value === undefined);
      }
      if (detail.value !== undefined) {
        setValue(detail.value, { emit: true, ensureVisible: true });
      }
    })
  );

  const controller: CommandController = {
    get value() {
      return currentValue;
    },
    get search() {
      return currentSearch;
    },
    select(value: string | null) {
      setValue(value, { emit: true, ensureVisible: true });
    },
    setSearch(search: string) {
      setSearchValue(search, true, true);
    },
    destroy() {
      isDestroyed = true;
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      cleanups.forEach((fn) => fn());
      cleanups = [];
      if (addedRootTabIndex) {
        rootEl.removeAttribute("tabindex");
      }
      clearRootBinding(rootEl, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(rootEl, ROOT_BINDING_KEY, controller);
  return controller;
}

export function create(scope: ParentNode = document): CommandController[] {
  const controllers: CommandController[] = [];
  for (const root of getRoots(scope, "command")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createCommand(root));
  }
  return controllers;
}
