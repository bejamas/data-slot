import { expect, it, spyOn } from 'bun:test';
import { createPortalLifecycle } from '@data-slot/core';
import { registerVisuals } from './visuals';

for (const finish of ['close', 'destroy'] as const) {
  it(`restores the parent's swipe state after a child ${finish}`, () => {
    document.body.innerHTML = '<div data-slot="drawer" id="outer"><section id="outer-popup"><div data-slot="drawer" id="inner"><section id="inner-popup"></section></div></section></div>';
    const popup = document.getElementById('outer-popup')!;
    const outer = registerVisuals(document.getElementById('outer')!, popup);
    const inner = registerVisuals(document.getElementById('inner')!, document.getElementById('inner-popup')!);
    try {
      outer.setOpen(true);
      inner.setOpen(true);
      inner.setSwipe({ progress: 0.7, x: 0, y: 70 });
      expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.7');
      expect(popup.hasAttribute('data-nested-swiping')).toBe(true);
      if (finish === 'close') inner.setOpen(false);
      else inner.destroy();
      expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
      expect(popup.hasAttribute('data-nested-swiping')).toBe(false);
      expect(popup.hasAttribute('data-nested-drawer-open')).toBe(false);
    } finally {
      inner.destroy();
      outer.destroy();
    }
  });
}

it('chooses provider visuals by open order instead of binding order', () => {
  document.body.innerHTML = '<div data-slot="drawer-provider"><div data-slot="drawer-indent"></div><div id="a"><section></section></div><div id="b"><section></section></div></div>';
  const a = document.getElementById('a')!;
  const b = document.getElementById('b')!;
  const first = registerVisuals(a, a.querySelector('section')!);
  const second = registerVisuals(b, b.querySelector('section')!);
  second.setOpen(true);
  second.setSwipe({ progress: 0.2, x: 0, y: 20 });
  first.setOpen(true);
  first.setSwipe({ progress: 0.7, x: 0, y: 70 });
  expect(document.querySelector<HTMLElement>('[data-slot="drawer-indent"]')!.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.7');
  first.destroy();
  second.destroy();
});

it('retains nesting when an ancestor portal mounts before child registration', () => {
  document.body.innerHTML = '<div data-slot="drawer-provider"><div data-slot="drawer" id="outer"><section id="outer-popup"><div data-slot="drawer" id="inner"><section id="inner-popup"></section></div></section></div></div>';
  const outer = document.getElementById('outer')!;
  const popup = document.getElementById('outer-popup')!;
  const first = registerVisuals(outer, popup);
  const lifecycle = createPortalLifecycle({ root: outer, content: popup });
  lifecycle.mount();
  const second = registerVisuals(document.getElementById('inner')!, document.getElementById('inner-popup')!);
  second.setOpen(true);
  expect(second.parent).toBe(outer);
  expect(popup.getAttribute('data-nested-drawer-open')).toBe('');
  second.destroy();
  first.destroy();
  lifecycle.cleanup();
});

it('keeps swipe rendering local and reuses measured dimensions', () => {
  document.body.innerHTML = '<div data-slot="drawer-provider"><div data-slot="drawer-indent"></div><div data-slot="drawer" id="outer"><section id="outer-popup"><div data-slot="drawer" id="inner"><section id="inner-popup"></section></div></section></div></div>';
  const outerPopup = document.getElementById('outer-popup')!;
  const innerPopup = document.getElementById('inner-popup')!;
  innerPopup.getBoundingClientRect = () => new DOMRect(0, 0, 400, 800);
  const outer = registerVisuals(document.getElementById('outer')!, outerPopup);
  const inner = registerVisuals(document.getElementById('inner')!, innerPopup);
  const unrelated = Array.from({ length: 20 }, () => {
    const root = document.createElement('div');
    const popup = document.createElement('section');
    root.append(popup); document.body.append(root);
    return { popup, visuals: registerVisuals(root, popup) };
  });
  outer.setOpen(true); inner.setOpen(true);
  const reads = [outerPopup, innerPopup, ...unrelated.map((item) => item.popup)].map((popup) => spyOn(popup, 'getBoundingClientRect'));
  const writes = unrelated.map(({ popup }) => spyOn(popup.style, 'setProperty'));
  try {
    inner.setSwipe({ progress: 0.5, x: 0, y: 400 });
    reads.forEach((read) => expect(read).not.toHaveBeenCalled());
    writes.forEach((write) => expect(write).not.toHaveBeenCalled());
    expect(outerPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    expect(outerPopup.hasAttribute('data-nested-swiping')).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-slot="drawer-indent"]')!.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    inner.refresh(600);
    expect(outerPopup.style.getPropertyValue('--drawer-front-height')).toBe('600px');
    expect(document.querySelector<HTMLElement>('[data-slot="drawer-indent"]')!.style.getPropertyValue('--drawer-height')).toBe('600px');
    expect(innerPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
  } finally {
    [...reads, ...writes].forEach((mock) => mock.mockRestore());
    unrelated.forEach(({ visuals }) => visuals.destroy());
    inner.destroy(); outer.destroy();
  }
});

for (const order of ['outer-first', 'middle-first'] as const) {
  it(`resolves the nearest portaled ancestor with ${order} registration`, () => {
    document.body.innerHTML = '<div data-slot="drawer-provider"><div data-slot="drawer-indent"></div><div data-slot="drawer" id="outer"><section id="outer-popup"><div data-slot="drawer" id="middle"><section id="middle-popup"><div data-slot="drawer" id="inner"><section id="inner-popup"></section></div></section></div></section></div></div>';
    const outer = document.getElementById('outer')!;
    const middle = document.getElementById('middle')!;
    const outerPopup = document.getElementById('outer-popup')!;
    const middlePopup = document.getElementById('middle-popup')!;
    const roots = order === 'outer-first' ? [outer, middle] : [middle, outer];
    const bound = roots.map((root) => registerVisuals(root, root.querySelector('section')!));
    const outerPortal = createPortalLifecycle({ root: outer, content: outerPopup });
    const middlePortal = createPortalLifecycle({ root: middle, content: middlePopup });
    outerPortal.mount(); middlePortal.mount();
    bound.forEach((visuals) => visuals.setOpen(true));
    const inner = registerVisuals(document.getElementById('inner')!, document.getElementById('inner-popup')!);
    try {
      inner.setOpen(true);
      inner.setSwipe({ progress: 0.7, x: 0, y: 70 });
      expect(inner.parent).toBe(middle);
      expect(middlePopup.hasAttribute('data-nested-drawer-open')).toBe(true);
      expect(middlePopup.style.getPropertyValue('--nested-drawers')).toBe('1');
      expect(outerPopup.style.getPropertyValue('--nested-drawers')).toBe('2');
      expect(middlePopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.7');
      expect(outerPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.7');
    } finally {
      inner.destroy(); bound.reverse().forEach((visuals) => visuals.destroy());
      middlePortal.cleanup(); outerPortal.cleanup();
    }
  });
}
