import { containsWithPortals, on } from '@data-slot/core';

interface SwipeState { progress: number; x: number; y: number }
interface VisualParts { backdrop?: HTMLElement; viewport?: HTMLElement }
interface VisualEntry {
  root: Element;
  popup: HTMLElement;
  parts: VisualParts;
  parent: Element | null;
  provider: Element | null;
  open: boolean;
  swipe: SwipeState | null;
  order: number;
}
const entries = new Set<VisualEntry>();
let openOrder = 0;
export function registerVisuals(root: Element, popup: HTMLElement, parts: VisualParts = {}) {
  // An initially open ancestor may already have moved this root into a portal.
  const owner = [...entries].filter((item) => containsWithPortals(item.popup, root)).at(-1);
  const entry: VisualEntry = { root, popup, parts, parent: root.parentElement?.closest('[data-slot="drawer"]') ?? owner?.root ?? null, provider: root.closest('[data-slot="drawer-provider"]') ?? owner?.provider ?? null, open: false, swipe: null, order: 0 };
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
      item.popup.toggleAttribute('data-nested-swiping', descendants.some((child) => child.swipe !== null));
      item.popup.style.setProperty('--nested-drawers', String(descendants.length));
      const front = descendants.sort((a, b) => a.order - b.order).at(-1) ?? item;
      item.popup.style.setProperty('--drawer-frontmost-height', `${front.popup.getBoundingClientRect().height}px`);
      for (const element of [item.popup, item.parts.backdrop, item.parts.viewport]) {
        if (!element) continue;
        element.toggleAttribute('data-swiping', item.swipe !== null);
        const swipe = element === item.popup ? front.swipe : item.swipe;
        element.style.setProperty('--drawer-swipe-progress', String(swipe?.progress ?? 0));
      }
      item.popup.style.setProperty('--drawer-swipe-movement-x', `${item.swipe?.x ?? 0}px`);
      item.popup.style.setProperty('--drawer-swipe-movement-y', `${item.swipe?.y ?? 0}px`);
    }
    const providers = new Set([...entries].map((item) => item.provider).filter(Boolean));
    if (entry.provider) providers.add(entry.provider);
    for (const provider of providers) {
      const front = [...entries].filter((item) => item.provider === provider && item.open).sort((a, b) => a.order - b.order).at(-1);
      for (const indent of provider!.querySelectorAll<HTMLElement>('[data-slot="drawer-indent"],[data-slot="drawer-indent-background"]')) {
        if (indent.closest('[data-slot="drawer-provider"]') !== provider) continue;
        indent.toggleAttribute('data-active', !!front);
        indent.toggleAttribute('data-inactive', !front);
        indent.style.setProperty('--drawer-swipe-progress', String(front?.swipe?.progress ?? 0));
        indent.style.setProperty('--drawer-height', `${front?.popup.getBoundingClientRect().height ?? 0}px`);
      }
    }
  };
  update();
  return {
    parent: entry.parent,
    setOpen(open: boolean) {
      if (open && !entry.open) entry.order = ++openOrder;
      entry.open = open;
      if (!open) entry.swipe = null;
      update();
    },
    setSwipe(swipe: SwipeState | null) { entry.swipe = swipe; update(); },
    refresh: update,
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
