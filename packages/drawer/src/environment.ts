import { on } from '@data-slot/core';

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
