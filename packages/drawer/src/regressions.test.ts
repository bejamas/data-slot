import { afterEach, expect, it } from 'bun:test';
import { createDialog } from '@data-slot/dialog';
import { createDrawer, type DrawerChangeDetails } from './index';

const controllers: Array<{ destroy(): void }> = [];
const tick = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  controllers.splice(0).reverse().forEach((controller) => controller.destroy());
  document.body.innerHTML = '';
});

function setup(options: Parameters<typeof createDrawer>[1] = {}) {
  document.body.innerHTML = `<main id="outside"></main><div data-slot="drawer-provider">
    <div data-slot="drawer-indent"></div><div data-slot="drawer" id="drawer">
      <div data-slot="drawer-portal"><div data-slot="drawer-backdrop"></div>
        <div data-slot="drawer-viewport"><section data-slot="drawer-popup"><button>Action</button></section></div>
      </div>
    </div></div>`;
  const root = document.getElementById('drawer')!;
  const popup = root.querySelector<HTMLElement>('[data-slot="drawer-popup"]')!;
  const backdrop = root.querySelector<HTMLElement>('[data-slot="drawer-backdrop"]')!;
  const viewport = root.querySelector<HTMLElement>('[data-slot="drawer-viewport"]')!;
  const indent = document.querySelector<HTMLElement>('[data-slot="drawer-indent"]')!;
  popup.getBoundingClientRect = () => new DOMRect(0, 0, 400, 800);
  const drawer = createDrawer(root, options);
  controllers.push(drawer);
  return { drawer, popup, backdrop, viewport, indent };
}

it('keeps a newer dialog usable and returns focus and isolation to the drawer', async () => {
  const { drawer, popup } = setup();
  const root = document.createElement('div');
  root.innerHTML = `<div data-slot="dialog-portal"><div data-slot="dialog-overlay"></div>
    <section data-slot="dialog-content"><button>Dialog action</button></section></div>`;
  document.body.append(root);
  const dialogPopup = root.querySelector<HTMLElement>('[data-slot="dialog-content"]')!;
  const button = dialogPopup.querySelector('button')!;
  const dialog = createDialog(root);
  controllers.push(dialog);
  drawer.open();
  await tick();
  dialog.open();
  expect(dialogPopup.closest('[inert]')).toBeNull();
  expect(dialogPopup.closest('[aria-hidden="true"]')).toBeNull();
  document.body.append(document.createElement('div'));
  await tick();
  expect(dialogPopup.closest('[inert]')).toBeNull();
  expect(document.activeElement).toBe(button);
  expect(popup.closest('[inert]')).not.toBeNull();
  expect(drawer.isOpen).toBe(true);
  dialog.close();
  await tick();
  expect(popup.closest('[inert]')).toBeNull();
  expect(document.activeElement).toBe(popup);
  expect(document.getElementById('outside')!.hasAttribute('inert')).toBe(true);
  drawer.close();
  expect(document.getElementById('outside')!.hasAttribute('inert')).toBe(false);
});

it('preserves active swipe visuals through resize and resets every part on cancellation', () => {
  const { drawer, popup, backdrop, viewport, indent } = setup();
  drawer.open();
  popup.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientY: 0 }));
  document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 200, cancelable: true }));
  window.dispatchEvent(new Event('resize'));
  for (const part of [popup, backdrop, viewport, indent]) {
    expect(part.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.25');
  }
  for (const part of [popup, backdrop, viewport]) expect(part.hasAttribute('data-swiping')).toBe(true);
  expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('200px');
  document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
  expect(drawer.isOpen).toBe(true);
  for (const part of [popup, backdrop, viewport, indent]) {
    expect(part.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
  }
  for (const part of [popup, backdrop, viewport]) expect(part.hasAttribute('data-swiping')).toBe(false);
  expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
});

for (const previous of ['escape', 'right-click'] as const) {
  it(`reports iframe dismissal independently of an earlier ${previous}`, async () => {
    const details: DrawerChangeDetails[] = [];
    const { drawer, popup } = setup({
      modal: false, closeOnEscape: false,
      onOpenChange(open, detail) {
        // Simulate the iframe path handled by window blur, independently of focusin.
        if (detail.originalEvent?.type === 'focusin') detail.cancel();
        else if (!open) details.push(detail);
      },
    });
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    drawer.open();
    await tick();
    popup.dispatchEvent(previous === 'escape'
      ? new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
      : new PointerEvent('pointerdown', { bubbles: true, button: 2 }));
    expect(drawer.isOpen).toBe(true);
    iframe.focus();
    const blur = new FocusEvent('blur');
    window.dispatchEvent(blur);
    await tick();
    expect(drawer.isOpen).toBe(false);
    expect(details).toHaveLength(1);
    expect(details[0]?.reason).toBe('focus-out');
    expect(details[0]?.originalEvent).toBe(blur);
    expect(document.activeElement).toBe(iframe);
  });
}
