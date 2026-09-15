import { expect, it } from 'bun:test';
import { createPortalLifecycle } from '@data-slot/core';
import { registerVisuals } from './environment';

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
