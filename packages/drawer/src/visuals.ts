import { containsWithPortals } from '@data-slot/core';

interface SwipeState { progress: number; x: number; y: number }
interface VisualParts { backdrop?: HTMLElement; viewport?: HTMLElement }
interface VisualEntry {
  root: Element;
  popup: HTMLElement;
  parts: VisualParts;
  parent: Element | null;
  ancestors: VisualEntry[];
  descendants: VisualEntry[];
  provider: VisualProvider | null;
  open: boolean;
  swipe: SwipeState | null;
  order: number;
  height: number;
  front: VisualEntry | null;
}
interface VisualProvider {
  element: Element;
  entries: Set<VisualEntry>;
  indents: HTMLElement[];
  front: VisualEntry | null;
}
interface VisualStore {
  entries: Map<Element, VisualEntry>;
  providers: Map<Element, VisualProvider>;
  openOrder: number;
}
const stores = new WeakMap<Document, VisualStore>();

function frontmost(entries: Iterable<VisualEntry>): VisualEntry | null {
  let front: VisualEntry | null = null;
  for (const entry of entries) {
    if (entry.open && (!front || entry.order > front.order)) front = entry;
  }
  return front;
}

function renderSwipe(entry: VisualEntry) {
  const { popup, swipe } = entry;
  const front = entry.front ?? entry;
  popup.toggleAttribute('data-nested-swiping', entry.descendants.some((child) => child.open && child.swipe !== null));
  for (const element of [popup, entry.parts.backdrop, entry.parts.viewport]) {
    if (!element) continue;
    element.toggleAttribute('data-swiping', swipe !== null);
    element.style.setProperty('--drawer-swipe-progress', String((element === popup ? front.swipe : swipe)?.progress ?? 0));
  }
  popup.style.setProperty('--drawer-swipe-amount-x', `${swipe?.x ?? 0}px`);
  popup.style.setProperty('--drawer-swipe-amount-y', `${swipe?.y ?? 0}px`);
}

function renderEntry(entry: VisualEntry) {
  entry.popup.toggleAttribute('data-nested', !!entry.parent);
  entry.popup.toggleAttribute('data-nested-drawer-open', entry.front !== null);
  entry.popup.style.setProperty('--nested-drawers', String(entry.descendants.filter((child) => child.open).length));
  entry.popup.style.setProperty('--drawer-front-height', `${(entry.front ?? entry).height}px`);
  renderSwipe(entry);
}

function renderProvider(provider: VisualProvider) {
  const { front } = provider;
  for (const indent of provider.indents) {
    indent.toggleAttribute('data-active', !!front);
    indent.toggleAttribute('data-inactive', !front);
    indent.style.setProperty('--drawer-swipe-progress', String(front?.swipe?.progress ?? 0));
    indent.style.setProperty('--drawer-height', `${front?.height ?? 0}px`);
  }
}

function updateProvider(provider: VisualProvider) {
  provider.front = frontmost(provider.entries);
  provider.indents = Array.from(provider.element.querySelectorAll<HTMLElement>('[data-slot="drawer-indent"],[data-slot="drawer-indent-background"]'))
    .filter((indent) => indent.closest('[data-slot="drawer-provider"]') === provider.element);
  renderProvider(provider);
}

// Registration and destruction change topology. Gestures never discover ancestry.
function rebuildTopology(store: VisualStore) {
  for (const entry of store.entries.values()) {
    entry.ancestors = [];
    entry.descendants = [];
  }
  for (const entry of store.entries.values()) {
    for (let parent = entry.parent && store.entries.get(entry.parent); parent; parent = parent.parent && store.entries.get(parent.parent)) {
      entry.ancestors.push(parent);
      parent.descendants.push(entry);
    }
  }
  for (const entry of store.entries.values()) {
    entry.front = frontmost(entry.descendants);
    renderEntry(entry);
  }
  for (const [element, provider] of store.providers) {
    updateProvider(provider);
    if (!provider.entries.size) store.providers.delete(element);
  }
}

export function registerVisuals(root: Element, popup: HTMLElement, parts: VisualParts = {}) {
  const doc = root.ownerDocument;
  let store = stores.get(doc);
  if (!store) {
    store = { entries: new Map(), providers: new Map(), openOrder: 0 };
    stores.set(doc, store);
  }
  // Portaled roots may have several logical ancestors. Prefer the deepest one,
  // regardless of which ancestor was registered last.
  let owner: VisualEntry | null = null;
  for (const candidate of store.entries.values()) {
    if (containsWithPortals(candidate.popup, root) && (!owner || containsWithPortals(owner.popup, candidate.root))) owner = candidate;
  }
  const providerElement = root.closest('[data-slot="drawer-provider"]') ?? owner?.provider?.element;
  let provider: VisualProvider | null = null;
  if (providerElement) {
    provider = store.providers.get(providerElement) ?? { element: providerElement, entries: new Set(), indents: [], front: null };
    store.providers.set(providerElement, provider);
  }
  const entry: VisualEntry = {
    root, popup, parts, parent: root.parentElement?.closest('[data-slot="drawer"]') ?? owner?.root ?? null,
    ancestors: [], descendants: [], provider, open: false, swipe: null, order: 0,
    height: popup.getBoundingClientRect().height, front: null,
  };
  store.entries.set(root, entry);
  provider?.entries.add(entry);
  rebuildTopology(store);
  const renderDrawers = () => {
    renderEntry(entry);
    entry.ancestors.forEach(renderEntry);
  };
  let destroyed = false;
  return {
    get parent() { return entry.parent; },
    setOpen(open: boolean) {
      if (destroyed || open === entry.open) return;
      if (open) entry.order = ++store.openOrder;
      entry.open = open;
      if (!open) entry.swipe = null;
      for (const ancestor of entry.ancestors) ancestor.front = frontmost(ancestor.descendants);
      renderDrawers();
      if (provider) updateProvider(provider);
    },
    setSwipe(swipe: SwipeState | null) {
      if (destroyed) return;
      entry.swipe = swipe;
      renderSwipe(entry);
      entry.ancestors.forEach(renderSwipe);
      if (provider?.front === entry) {
        for (const indent of provider.indents) indent.style.setProperty('--drawer-swipe-progress', String(swipe?.progress ?? 0));
      }
    },
    refresh(height: number) {
      if (destroyed || entry.height === height) return;
      entry.height = height;
      renderDrawers();
      if (provider?.front === entry) renderProvider(provider);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      store.entries.delete(root);
      provider?.entries.delete(entry);
      rebuildTopology(store);
      if (!store.entries.size) stores.delete(doc);
    },
  };
}
