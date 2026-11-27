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

type TestLayer = { open: boolean; dismissed: number; cleanup: () => void };

const layer = (
  id: string,
  options: Omit<Parameters<typeof createDismissLayer>[0], 'root' | 'isOpen' | 'onDismiss'> = {},
): TestLayer => {
  const state: TestLayer = { open: false, dismissed: 0, cleanup: () => {} };
  state.cleanup = createDismissLayer({
    root: document.getElementById(id)!,
    isOpen: () => state.open,
    onDismiss: () => { state.dismissed += 1; state.open = false; },
    ...options,
  });
  return state;
};

const withLayers = (layers: TestLayer[]) => {
  cleanup = () => { for (const entry of layers) entry.cleanup(); };
};

const escape = (target: EventTarget = document) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

const pointerdown = (target: EventTarget, pointerType = 'mouse') =>
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType }));

for (const [name, between] of [
  ['keydown', (el: HTMLElement) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))],
  ['focusin', (el: HTMLElement) => el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))],
  ['pointerdown', (el: HTMLElement) => pointerdown(el)],
] as const) {
  it(`orders layers by open time when a ${name} happens between opens`, () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"><button id="b-btn"></button></div>';
    // A registers first; B opens first, then A opens on top of it.
    const a = layer('a', { closeOnClickOutside: false });
    const b = layer('b', { closeOnClickOutside: false });
    withLayers([a, b]);

    b.open = true;
    between(document.getElementById('b-btn')!);
    a.open = true;

    escape();
    expect(a.dismissed).toBe(1);
    expect(b.dismissed).toBe(0);
    escape();
    expect(b.dismissed).toBe(1);
  });
}

it('puts a nested layer above its container when both open without an event in between', () => {
  document.body.innerHTML = '<div id="outer"><div id="inner"><button id="btn"></button></div></div>';
  // Inner registers before outer, so registration order is the wrong answer.
  const inner = layer('inner');
  const outer = layer('outer');
  withLayers([inner, outer]);

  outer.open = true;
  inner.open = true;

  escape(document.getElementById('btn')!);
  expect(inner.dismissed).toBe(1);
  expect(outer.dismissed).toBe(0);
});

it('lets outside presses pass through a transparent layer that ignores them', () => {
  document.body.innerHTML = '<div id="popover"></div><div id="tooltip"><button id="trigger"></button></div>';
  const popover = layer('popover');
  const tooltip = layer('tooltip', { closeOnClickOutside: false, transparent: true });
  withLayers([popover, tooltip]);

  popover.open = true;
  pointerdown(document.getElementById('popover')!);
  tooltip.open = true;

  pointerdown(document.getElementById('trigger')!);
  expect(popover.dismissed).toBe(1);
  expect(tooltip.dismissed).toBe(0);
});

it('lets deferred touch outside presses pass through a transparent layer', () => {
  document.body.innerHTML = '<div id="popover"></div><div id="tooltip"><button id="trigger"></button></div>';
  const popover = layer('popover');
  const tooltip = layer('tooltip', { closeOnClickOutside: false, transparent: true });
  withLayers([popover, tooltip]);

  popover.open = true;
  pointerdown(document.getElementById('popover')!);
  tooltip.open = true;

  const trigger = document.getElementById('trigger')!;
  pointerdown(trigger, 'touch');
  expect(popover.dismissed).toBe(0);
  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(popover.dismissed).toBe(1);
});

it('keeps a blocking non-dismissable layer protecting the layers beneath it', () => {
  document.body.innerHTML = '<div id="dialog"></div><div id="alert"></div><button id="outside"></button>';
  const dialog = layer('dialog');
  const alert = layer('alert', { closeOnClickOutside: false });
  withLayers([dialog, alert]);

  dialog.open = true;
  pointerdown(document.getElementById('dialog')!);
  alert.open = true;

  pointerdown(document.getElementById('outside')!);
  expect(dialog.dismissed).toBe(0);
  expect(alert.dismissed).toBe(0);
});

it('keeps a blocking non-dismissable layer protecting layers beneath it from iframe focus-out', async () => {
  document.body.innerHTML = '<div id="popover"></div><div id="dialog"><iframe></iframe></div>';
  const popover = layer('popover');
  const dialog = layer('dialog', { closeOnClickOutside: false });
  withLayers([popover, dialog]);

  popover.open = true;
  pointerdown(document.getElementById('popover')!);
  dialog.open = true;

  document.querySelector('iframe')!.focus();
  window.dispatchEvent(new FocusEvent('blur'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(popover.dismissed).toBe(0);
});

it('does nothing on Escape when the topmost layer does not close on Escape', () => {
  document.body.innerHTML = '<div id="dialog"></div><div id="alert"><button id="alert-btn"></button></div>';
  const dialog = layer('dialog', { closeOnClickOutside: false });
  const alert = layer('alert', { closeOnClickOutside: false, closeOnEscape: false });
  withLayers([dialog, alert]);

  dialog.open = true;
  pointerdown(document.getElementById('dialog')!);
  alert.open = true;

  expect(escape(document.getElementById('alert-btn')!)).toBe(true);
  expect(escape()).toBe(true);
  expect(dialog.dismissed).toBe(0);
  expect(alert.dismissed).toBe(0);
});

it('routes Escape past a transparent layer that does not close on Escape', () => {
  document.body.innerHTML = '<div id="popover"><button id="btn"></button></div><div id="card"></div>';
  const popover = layer('popover');
  const card = layer('card', { closeOnEscape: false, transparent: true });
  withLayers([popover, card]);

  popover.open = true;
  pointerdown(document.getElementById('btn')!);
  card.open = true;

  escape();
  expect(popover.dismissed).toBe(1);
  expect(card.dismissed).toBe(0);
});

it('closes a transparent layer on Escape before a non-escapable layer beneath it', () => {
  document.body.innerHTML = '<div id="alert"><div id="tooltip"><button id="trigger"></button></div></div>';
  const alert = layer('alert', { closeOnClickOutside: false, closeOnEscape: false });
  const tooltip = layer('tooltip', { closeOnClickOutside: false, transparent: true, preventEscapeDefault: false });
  withLayers([alert, tooltip]);

  alert.open = true;
  pointerdown(document.getElementById('trigger')!);
  tooltip.open = true;

  const trigger = document.getElementById('trigger')!;
  escape(trigger);
  expect(tooltip.dismissed).toBe(1);
  escape(trigger);
  expect(alert.dismissed).toBe(0);
});
