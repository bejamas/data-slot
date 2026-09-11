import { containsWithPortals, on } from '@data-slot/core';

interface IsolationSession { popup: HTMLElement; allowed: HTMLElement[] }
interface IsolationStore {
  sessions: IsolationSession[];
  changed: Map<Element, { inert: boolean; aria: string | null }>;
  observer: MutationObserver;
  update(): void;
}
const isolationStores = new WeakMap<Document, IsolationStore>();
/** Recompute the frontmost modal's isolation as nested portals mount or disappear. */
export function isolateOutside(popup: HTMLElement, allowed: HTMLElement[]): () => void {
  const doc = popup.ownerDocument;
  const win = doc.defaultView!;
  let store = isolationStores.get(doc);
  if (!store) {
    const created: IsolationStore = {
      sessions: [], changed: new Map(),
      observer: new win.MutationObserver(() => created.update()),
      update() {
        for (const [element, state] of created.changed) {
          if (!state.inert) element.removeAttribute('inert');
          if (state.aria === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', state.aria);
        }
        created.changed.clear();
        const active = created.sessions.at(-1);
        if (!active) return;
        const permitted = [...active.allowed, ...Array.from(doc.body.querySelectorAll<HTMLElement>('*')).filter((element) => containsWithPortals(active.popup, element))];
        const visit = (parent: Element) => {
          for (const child of Array.from(parent.children)) {
            if (permitted.includes(child as HTMLElement)) continue;
            if (permitted.some((element) => child.contains(element))) { visit(child); continue; }
            created.changed.set(child, { inert: child.hasAttribute('inert'), aria: child.getAttribute('aria-hidden') });
            child.setAttribute('inert', '');
            child.setAttribute('aria-hidden', 'true');
          }
        };
        visit(doc.body);
      },
    };
    created.observer.observe(doc.body, { childList: true, subtree: true });
    isolationStores.set(doc, created);
    store = created;
  }
  const session = { popup, allowed };
  store.sessions.push(session);
  store.update();
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    store.sessions.splice(store.sessions.indexOf(session), 1);
    store.update();
    if (!store.sessions.length) { store.observer.disconnect(); isolationStores.delete(doc); }
  };
}

interface VisualEntry { root: Element; popup: HTMLElement; parent: Element | null; provider: Element | null; open: boolean; progress: number; swiping: boolean; order: number }
const entries = new Set<VisualEntry>();
let openOrder = 0;
export function registerVisuals(root: Element, popup: HTMLElement) {
  // An initially open ancestor may already have moved this root into a portal.
  const owner = [...entries].filter((item) => containsWithPortals(item.popup, root)).at(-1);
  const entry: VisualEntry = { root, popup, parent: root.parentElement?.closest('[data-slot="drawer"]') ?? owner?.root ?? null, provider: root.closest('[data-slot="drawer-provider"]') ?? owner?.provider ?? null, open: false, progress: 0, swiping: false, order: 0 };
  entries.add(entry);
  const update = () => {
    for (const item of entries) {
      const descendants = [...entries].filter((candidate) => {
        if (!candidate.open || candidate === item) return false;
        let parent = candidate.parent;
        while (parent) {
          if (parent === item.root) return true;
          parent = [...entries].find((value) => value.root === parent)?.parent ?? null;
        }
        return false;
      });
      item.popup.toggleAttribute('data-nested', !!item.parent);
      item.popup.toggleAttribute('data-nested-drawer-open', descendants.length > 0);
      item.popup.toggleAttribute('data-nested-swiping', descendants.some((child) => child.swiping));
      item.popup.style.setProperty('--nested-drawers', String(descendants.length));
      const front = descendants.sort((a, b) => a.order - b.order).at(-1) ?? item;
      item.popup.style.setProperty('--drawer-frontmost-height', `${front.popup.getBoundingClientRect().height}px`);
      if (front !== item) item.popup.style.setProperty('--drawer-swipe-progress', String(front.progress));
    }
    const providers = new Set([...entries].map((item) => item.provider).filter(Boolean));
    if (entry.provider) providers.add(entry.provider);
    for (const provider of providers) {
      const front = [...entries].filter((item) => item.provider === provider && item.open).sort((a, b) => a.order - b.order).at(-1);
      for (const indent of provider!.querySelectorAll<HTMLElement>('[data-slot="drawer-indent"],[data-slot="drawer-indent-background"]')) {
        if (indent.closest('[data-slot="drawer-provider"]') !== provider) continue;
        indent.toggleAttribute('data-active', !!front);
        indent.toggleAttribute('data-inactive', !front);
        indent.style.setProperty('--drawer-swipe-progress', String(front?.progress ?? 0));
        indent.style.setProperty('--drawer-height', `${front?.popup.getBoundingClientRect().height ?? 0}px`);
      }
    }
  };
  update();
  return {
    parent: entry.parent,
    update(open: boolean, progress = 0, swiping = false) { if (open && !entry.open) entry.order = ++openOrder; entry.open = open; entry.progress = progress; entry.swiping = swiping; update(); },
    hasOpenChild: () => [...entries].some((item) => item.parent === root && item.open),
    destroy() { entries.delete(entry); update(); },
  };
}

export function trackKeyboard(viewport: HTMLElement): () => void {
  const doc = viewport.ownerDocument;
  const win = doc.defaultView!;
  const visual = win.visualViewport;
  const originalInset = viewport.style.getPropertyValue('--drawer-keyboard-inset');
  const originalKeyboardOpen = viewport.hasAttribute('data-keyboard-open');
  let frame = 0;
  let adjustment: {
    element: HTMLElement;
    paddingBottom: string;
    scrollPaddingBottom: string;
    overflowAnchor: string;
    basePadding: number;
  } | null = null;
  const restoreScroll = () => {
    if (!adjustment) return;
    const { element, paddingBottom, scrollPaddingBottom, overflowAnchor } = adjustment;
    Object.assign(element.style, { paddingBottom, scrollPaddingBottom, overflowAnchor });
    adjustment = null;
  };
  const update = () => {
    frame = 0;
    const field = doc.activeElement as HTMLElement | null;
    const isKeyboardField = field?.matches('textarea, input:not([type]), input[type="text"], input[type="email"], input[type="number"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], [contenteditable]:not([contenteditable="false"])');
    const keyboardOpen = !!visual && (visual.scale === undefined || visual.scale === 1) &&
      win.innerHeight - visual.height > 60 && !!isKeyboardField && viewport.contains(field);
    const bottom = visual ? Math.min(win.innerHeight, visual.height + visual.offsetTop) : win.innerHeight;
    viewport.style.setProperty('--drawer-keyboard-inset', `${keyboardOpen ? Math.max(0, win.innerHeight - bottom) : 0}px`);
    viewport.toggleAttribute('data-keyboard-open', keyboardOpen);
    if (!keyboardOpen || !field) { restoreScroll(); return; }

    // Reveal the field by scrolling its containing drawer body, never the field's
    // own text or the document behind the modal. Include containers that only
    // become scrollable after adding room above the software keyboard.
    let scroller = field.parentElement;
    while (scroller && viewport.contains(scroller)) {
      if (/(auto|scroll)/.test(win.getComputedStyle(scroller).overflowY)) break;
      scroller = scroller.parentElement;
    }
    if (!scroller || !viewport.contains(scroller)) { restoreScroll(); return; }
    if (adjustment?.element !== scroller) restoreScroll();
    const fieldRect = field.getBoundingClientRect();
    const scrollRect = scroller.getBoundingClientRect();
    const visibleBottom = Math.min(bottom, scrollRect.bottom) - 16;
    const visibleTop = Math.max(visual?.offsetTop ?? 0, scrollRect.top) + 16;
    const overlap = fieldRect.bottom - visibleBottom;
    if (overlap > 0) {
      if (!adjustment) {
        adjustment = {
          element: scroller,
          paddingBottom: scroller.style.paddingBottom,
          scrollPaddingBottom: scroller.style.scrollPaddingBottom,
          overflowAnchor: scroller.style.overflowAnchor,
          basePadding: parseFloat(win.getComputedStyle(scroller).paddingBottom) || 0,
        };
      }
      scroller.style.overflowAnchor = 'none';
      scroller.style.paddingBottom = `${adjustment.basePadding + Math.max(0, scrollRect.bottom - bottom) + fieldRect.height + 48}px`;
      scroller.style.scrollPaddingBottom = '16px';
      scroller.scrollTop += overlap;
    } else if (fieldRect.top < visibleTop) {
      scroller.scrollTop -= visibleTop - fieldRect.top;
    }
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(update);
  };
  update();
  const cleanups = [on(doc, 'focusin', schedule), on(doc, 'focusout', schedule), on(win, 'resize', schedule)];
  if (visual) cleanups.push(on(visual, 'resize', schedule), on(visual, 'scroll', schedule));
  return () => {
    cleanups.forEach((fn) => fn());
    win.cancelAnimationFrame(frame);
    restoreScroll();
    if (originalInset) viewport.style.setProperty('--drawer-keyboard-inset', originalInset);
    else viewport.style.removeProperty('--drawer-keyboard-inset');
    viewport.toggleAttribute('data-keyboard-open', originalKeyboardOpen);
  };
}
