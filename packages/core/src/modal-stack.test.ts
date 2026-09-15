import { afterEach, expect, it } from 'bun:test';
import { createModalStackItem, createPortalLifecycle, type ModalStackItemController } from './index';

const items: ModalStackItemController[] = [];
afterEach(() => {
  items.splice(0).reverse().forEach((item) => item.destroy());
  document.body.innerHTML = '';
});
function stack(content: HTMLElement, isolateOutside = true) {
  const item = createModalStackItem({ content, isolateOutside, cssVarPrefix: 'test' });
  items.push(item);
  return item;
}

it('follows the topmost surface and restores isolation across close, reopen and destroy', async () => {
  document.body.innerHTML = '<main aria-hidden="false"></main><aside inert aria-hidden="true"></aside><section id="drawer"></section><section id="dialog"></section>';
  const drawerPopup = document.getElementById('drawer')!;
  const dialogPopup = document.getElementById('dialog')!;
  const drawer = stack(drawerPopup);
  const dialog = stack(dialogPopup, false);
  drawer.open();
  expect(drawer.isTopmost).toBe(true);
  expect(dialogPopup.hasAttribute('inert')).toBe(true);
  dialog.open();
  expect(drawer.isTopmost).toBe(false);
  expect(dialog.isTopmost).toBe(true);
  expect(dialogPopup.hasAttribute('inert')).toBe(false);
  expect(dialogPopup.hasAttribute('aria-hidden')).toBe(false);
  expect(drawerPopup.hasAttribute('inert')).toBe(true);
  const background = document.createElement('button');
  document.body.append(background);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(dialogPopup.hasAttribute('inert')).toBe(false);
  expect(background.hasAttribute('inert')).toBe(true);
  dialog.close();
  expect(drawer.isTopmost).toBe(true);
  expect(drawerPopup.hasAttribute('inert')).toBe(false);
  dialog.open();
  // Removing a lower item must release its isolation without losing the top item.
  drawer.destroy();
  expect(dialog.isTopmost).toBe(true);
  expect(background.hasAttribute('inert')).toBe(false);
  expect(document.querySelector('main')!.getAttribute('aria-hidden')).toBe('false');
  expect(document.querySelector('aside')!.hasAttribute('inert')).toBe(true);
  dialog.close();
  expect(dialog.isTopmost).toBe(false);
  dialog.open();
  expect(dialog.isTopmost).toBe(true);
  expect(background.hasAttribute('inert')).toBe(false);
});

it('isolates dynamically added background content and restores authored attributes', async () => {
  document.body.innerHTML = '<main aria-hidden="false"></main><section id="popup"></section>';
  const popup = document.getElementById('popup')!;
  const main = document.querySelector('main')!;
  const item = stack(popup);
  item.open();
  const button = document.createElement('button');
  document.body.append(button);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(button.hasAttribute('inert')).toBe(true);
  item.close();
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
  const outerItem = stack(outer);
  outerItem.open();
  expect(portal.hasAttribute('inert')).toBe(false);
  const innerItem = stack(inner);
  innerItem.open();
  expect(outer.hasAttribute('inert')).toBe(true);
  expect(portal.hasAttribute('inert')).toBe(false);
  innerItem.close();
  expect(outer.hasAttribute('inert')).toBe(false);
  expect(document.querySelector('main')!.hasAttribute('inert')).toBe(true);
  outerItem.close();
  lifecycle.cleanup();
});
