import { afterEach, expect, it } from 'bun:test';
import { createDismissLayer, type DismissLayerDetails } from './index';

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; document.body.innerHTML = ''; });

it('reports the actual event and reason for every dismissal path', async () => {
  document.body.innerHTML = '<section id="popup"></section><button id="outside"></button><iframe></iframe>';
  const details: DismissLayerDetails[] = [];
  cleanup = createDismissLayer({
    root: document.getElementById('popup')!, isOpen: () => true,
    onDismiss: (detail) => details.push(detail),
  });
  const outside = document.getElementById('outside')!;
  const pointer = new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' });
  outside.dispatchEvent(pointer);
  expect(details.at(-1)).toEqual({ reason: 'outside-press', originalEvent: pointer });
  const touch = new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' });
  outside.dispatchEvent(touch);
  expect(details).toHaveLength(1);
  const click = new MouseEvent('click', { bubbles: true });
  outside.dispatchEvent(click);
  expect(details.at(-1)).toEqual({ reason: 'outside-press', originalEvent: click });
  const escape = new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' });
  outside.dispatchEvent(escape);
  expect(details.at(-1)).toEqual({ reason: 'escape-key', originalEvent: escape });
  document.querySelector('iframe')!.focus();
  const blur = new FocusEvent('blur');
  window.dispatchEvent(blur);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(details).toHaveLength(4);
  expect(details.at(-1)).toEqual({ reason: 'focus-out', originalEvent: blur });
});
