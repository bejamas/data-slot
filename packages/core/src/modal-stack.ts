import { on } from "./events.ts";
import { containsWithPortals } from "./parts.ts";

export interface ModalStackItemOptions {
  content: HTMLElement;
  overlay?: HTMLElement | null;
  onTabKeydown?: (event: KeyboardEvent) => void;
  cssVarPrefix: string;
  /** Keep outside content inert while this item is open, following the topmost stack item. */
  isolateOutside?: boolean;
}

export interface ModalStackItemController {
  open(): void;
  close(): void;
  destroy(): void;
  readonly isTopmost: boolean;
}

interface ModalStackEntry extends ModalStackItemOptions {}

interface ModalStackStore {
  entries: ModalStackEntry[];
  cleanup: () => void;
  updateIsolation(): void;
}

const modalStackStores = new WeakMap<Document, ModalStackStore>();

const applyStackMetadata = (
  entry: ModalStackEntry,
  index: number
): void => {
  const stackIndex = String(index);

  if (entry.overlay) {
    entry.overlay.setAttribute("data-stack-index", stackIndex);
    entry.overlay.style.setProperty(`--${entry.cssVarPrefix}-stack-index`, stackIndex);
    entry.overlay.style.setProperty(
      `--${entry.cssVarPrefix}-overlay-stack-index`,
      stackIndex
    );
  }

  entry.content.setAttribute("data-stack-index", stackIndex);
  entry.content.style.setProperty(`--${entry.cssVarPrefix}-stack-index`, stackIndex);
  entry.content.style.setProperty(
    `--${entry.cssVarPrefix}-content-stack-index`,
    stackIndex
  );
};

const clearStackMetadata = (entry: ModalStackEntry): void => {
  if (entry.overlay) {
    entry.overlay.removeAttribute("data-stack-index");
    entry.overlay.style.removeProperty(`--${entry.cssVarPrefix}-stack-index`);
    entry.overlay.style.removeProperty(`--${entry.cssVarPrefix}-overlay-stack-index`);
  }

  entry.content.removeAttribute("data-stack-index");
  entry.content.style.removeProperty(`--${entry.cssVarPrefix}-stack-index`);
  entry.content.style.removeProperty(`--${entry.cssVarPrefix}-content-stack-index`);
};

const reindexModalStack = (store: ModalStackStore): void => {
  store.entries.forEach((entry, index) => applyStackMetadata(entry, index));
  store.updateIsolation();
};

const createModalStackStore = (doc: Document): ModalStackStore => {
  const win = doc.defaultView!;
  const changed = new Map<Element, { inert: boolean; aria: string | null }>();
  let observer: MutationObserver | undefined;
  const restoreIsolation = () => {
    for (const [element, state] of changed) {
      element.toggleAttribute("inert", state.inert);
      if (state.aria === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", state.aria);
    }
    changed.clear();
  };
  const store: ModalStackStore = {
    entries: [],
    cleanup: () => {},
    updateIsolation() {
      restoreIsolation();
      const active = store.entries.at(-1);
      if (!active || !store.entries.some((entry) => entry.isolateOutside)) {
        observer?.disconnect();
        observer = undefined;
        return;
      }
      if (!observer) {
        observer = new win.MutationObserver(() => store.updateIsolation());
        observer.observe(doc.body, { childList: true, subtree: true });
      }
      // Owned portals remain usable even when mounted outside the active surface.
      const permitted = new Set<Element>([active.content]);
      if (active.overlay) permitted.add(active.overlay);
      for (const element of doc.body.querySelectorAll("*")) {
        if (containsWithPortals(active.content, element)) permitted.add(element);
      }
      const ancestors = new Set<Element>();
      for (const element of permitted) {
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          if (ancestors.has(parent)) break;
          ancestors.add(parent);
        }
      }
      const visit = (parent: Element) => {
        for (const child of parent.children) {
          if (permitted.has(child)) continue;
          if (ancestors.has(child)) { visit(child); continue; }
          changed.set(child, { inert: child.hasAttribute("inert"), aria: child.getAttribute("aria-hidden") });
          child.setAttribute("inert", "");
          child.setAttribute("aria-hidden", "true");
        }
      };
      visit(doc.body);
    },
  };

  const keydownCleanup = on(doc, "keydown", (event) => {
    if (event.key !== "Tab") return;

    const topmost = store.entries[store.entries.length - 1];
    if (!topmost) return;

    topmost.onTabKeydown?.(event);
  });

  store.cleanup = () => {
    keydownCleanup();
    observer?.disconnect();
    restoreIsolation();
    store.entries.length = 0;
  };

  return store;
};

const getModalStackStore = (doc: Document): ModalStackStore => {
  const existing = modalStackStores.get(doc);
  if (existing) return existing;

  const created = createModalStackStore(doc);
  modalStackStores.set(doc, created);
  return created;
};

export function createModalStackItem(
  options: ModalStackItemOptions
): ModalStackItemController {
  const doc = options.content.ownerDocument ?? document;
  const entry: ModalStackEntry = {
    content: options.content,
    overlay: options.overlay ?? null,
    onTabKeydown: options.onTabKeydown,
    cssVarPrefix: options.cssVarPrefix,
    isolateOutside: options.isolateOutside,
  };
  let destroyed = false;
  const close = () => {
    const store = modalStackStores.get(doc);
    if (!store) return;

    const index = store.entries.indexOf(entry);
    if (index === -1) return;

    store.entries.splice(index, 1);
    clearStackMetadata(entry);
    reindexModalStack(store);

    if (store.entries.length === 0) {
      store.cleanup();
      modalStackStores.delete(doc);
    }
  };

  return {
    open: () => {
      if (destroyed) return;
      const store = getModalStackStore(doc);
      if (store.entries.includes(entry)) return;
      store.entries.push(entry);
      reindexModalStack(store);
    },
    close,
    get isTopmost() { return modalStackStores.get(doc)?.entries.at(-1) === entry; },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      close();
    },
  };
}
