import { expect, it } from 'bun:test';
import { createPortalLifecycle } from '@data-slot/core';
import { isolateOutside, registerVisuals } from './environment';

it('isolates dynamically added background content and restores authored attributes', async () => {
  document.body.innerHTML = '<main aria-hidden="false"></main><section id="popup"></section>';
  const popup = document.getElementById('popup')!;
  const main = document.querySelector('main')!;
  const cleanup = isolateOutside(popup, [popup]);
  const button = document.createElement('button');
  document.body.append(button);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(button.hasAttribute('inert')).toBe(true);
  cleanup();
  expect(main.getAttribute('aria-hidden')).toBe('false');
  expect(main.hasAttribute('inert')).toBe(false);
  expect(button.hasAttribute('inert')).toBe(false);
});

it('keeps owned portals usable and recomputes isolation for nested modals', () => {
  document.body.innerHTML = '<main></main><section id="outer"><div id="owner"><aside id="portal"><section id="inner"></section></aside></div></section>';
  const outer = document.getElementById('outer')!;
  const inner = document.getElementById('inner')!;
  const portal = document.getElementById('portal')!;
  const lifecycle = createPortalLifecycle({ root: document.getElementById('owner')!, content: portal });
  lifecycle.mount();
  const closeOuter = isolateOutside(outer, [outer]);
  expect(portal.hasAttribute('inert')).toBe(false);
  const closeInner = isolateOutside(inner, [inner]);
  expect(outer.hasAttribute('inert')).toBe(true);
  expect(portal.hasAttribute('inert')).toBe(false);
  closeInner();
  expect(outer.hasAttribute('inert')).toBe(false);
  expect(document.querySelector('main')!.hasAttribute('inert')).toBe(true);
  closeOuter();
  lifecycle.cleanup();
});

it('chooses provider visuals by open order instead of binding order', () => {
  document.body.innerHTML = '<div data-slot="drawer-provider"><div data-slot="drawer-indent"></div><div id="a"><section></section></div><div id="b"><section></section></div></div>';
  const a = document.getElementById('a')!;
  const b = document.getElementById('b')!;
  const first = registerVisuals(a, a.querySelector('section')!);
  const second = registerVisuals(b, b.querySelector('section')!);
  second.update(true, 0.2);
  first.update(true, 0.7);
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
  second.update(true);
  expect(second.parent).toBe(outer);
  expect(popup.getAttribute('data-nested-drawer-open')).toBe('');
  second.destroy();
  first.destroy();
  lifecycle.cleanup();
});
