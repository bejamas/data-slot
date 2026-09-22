import { afterEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { createResizable, type ResizableController } from "./index";

const controllers: ResizableController[] = [];
const roots: HTMLElement[] = [];
const setup = (attributes = ['', ''], doc = document) => {
  const root = doc.createElement('div');
  root.dataset.slot = 'resizable';
  root.innerHTML = attributes.map((attrs, i) =>
    `<div data-slot="resizable-panel" ${attrs}></div>${i < attributes.length - 1 ? '<div data-slot="resizable-handle"></div>' : ''}`,
  ).join('');
  doc.body.append(root);
  roots.push(root);
  root.getBoundingClientRect = () => ({ width: 500, height: 500 } as DOMRect);
  const controller = createResizable(root);
  controllers.push(controller);
  const handle = root.querySelector<HTMLElement>('[data-slot="resizable-handle"]')!;
  const events: boolean[] = [];
  root.addEventListener('resizable:dragging', event => events.push((event as CustomEvent<{ dragging: boolean }>).detail.dragging));
  return { root, controller, handle, events };
};
const press = (handle: HTMLElement, position = 250) => handle.dispatchEvent(new MouseEvent('mousedown', { clientX: position, bubbles: true }));
const move = (position: number, doc = document) => doc.body.dispatchEvent(new MouseEvent('mousemove', { clientX: position, bubbles: true }));
const enter = (handle: HTMLElement) => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
const collapsible = 'data-min-size="20" data-collapsible="true"';

afterEach(() => {
  controllers.splice(0).reverse().forEach(controller => controller.destroy());
  roots.splice(0).forEach(root => root.remove());
});

describe('Resizable drag ownership', () => {
  it('emits exactly one end event and ignores unrelated mouse releases', () => {
    const first = setup();
    const second = setup();
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(first.events).toEqual([]);
    expect(second.events).toEqual([]);
    press(first.handle);
    move(300);
    first.handle.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    first.controller.destroy();
    first.controller.destroy();
    expect(first.events).toEqual([true, false]);
    expect(second.events).toEqual([]);
    expect(first.handle.hasAttribute('data-active')).toBe(false);
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('does not let an idle group destroy the active cursor', () => {
    const first = setup();
    const second = setup();
    press(first.handle);
    move(300);
    const cursor = document.head.querySelector('style');
    expect(cursor?.textContent).toContain('ew-resize');
    second.controller.destroy();
    expect(cursor?.isConnected).toBe(true);
    expect(first.events).toEqual([true]);
    move(350);
    expect(first.controller.layout).toEqual([70, 30]);
    first.controller.destroy();
    expect(cursor?.isConnected).toBe(false);
  });

  it('ends the previous session when another group starts dragging', () => {
    const first = setup();
    const second = setup();
    press(first.handle);
    move(300);
    press(second.handle);
    expect(first.events).toEqual([true, false]);
    expect(first.handle.hasAttribute('data-active')).toBe(false);
    move(350);
    expect(first.controller.layout).toEqual([60, 40]);
    expect(second.controller.layout).toEqual([70, 30]);
    expect(document.head.querySelectorAll('style')).toHaveLength(1);
  });

  it('keeps active sessions and cursors independent across documents', () => {
    const otherWindow = new Window();
    try {
      const first = setup();
      const second = setup(['', ''], otherWindow.document as unknown as Document);
      press(first.handle);
      press(second.handle);
      move(300);
      move(350, second.root.ownerDocument);
      expect(first.controller.layout).toEqual([60, 40]);
      expect(second.controller.layout).toEqual([70, 30]);
      expect(document.head.querySelector('style')).not.toBeNull();
      expect(second.root.ownerDocument.head.querySelector('style')).not.toBeNull();
      second.controller.destroy();
      expect(document.head.querySelector('style')).not.toBeNull();
      expect(second.root.ownerDocument.head.querySelector('style')).toBeNull();
    } finally {
      otherWindow.happyDOM.abort();
    }
  });

  it('ends dragging on window blur and removes movement listeners', () => {
    const { root, handle, controller, events } = setup();
    press(handle);
    move(300);
    window.dispatchEvent(new Event('blur'));
    move(350);
    expect(controller.layout).toEqual([60, 40]);
    expect(events).toEqual([true, false]);
    expect(root.querySelector<HTMLElement>('[data-slot="resizable-panel"]')!.style.pointerEvents).toBe('');
  });

  it('tracks only the initiating touch and stops once on touch cancellation', () => {
    const { handle, controller, events } = setup();
    const touch = (identifier: number, clientX: number) => new Touch({ identifier, target: handle, clientX });
    handle.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1, 250)], bubbles: true }));
    document.body.dispatchEvent(new TouchEvent('touchmove', { touches: [touch(2, 100), touch(1, 350)], bubbles: true }));
    expect(controller.layout).toEqual([70, 30]);
    window.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(2, 100)] }));
    expect(events).toEqual([true]);
    window.dispatchEvent(new TouchEvent('touchcancel', { changedTouches: [touch(1, 350)] }));
    move(400);
    expect(events).toEqual([true, false]);
    expect(handle.hasAttribute('data-active')).toBe(false);
    expect(document.head.querySelector('style')).toBeNull();
  });
});

describe('Resizable input transitions', () => {
  it('applies keyboard steps to the current layout and ends the pointer session', () => {
    const { handle, controller, events } = setup();
    handle.focus();
    press(handle);
    move(350);
    expect(controller.layout).toEqual([70, 30]);
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(controller.layout).toEqual([80, 20]);
    move(250);
    expect(controller.layout).toEqual([80, 20]);
    expect(events).toEqual([true, false]);
    expect(document.activeElement).toBe(handle);
    expect(handle.getAttribute('data-active')).toBe('keyboard');
  });

  it.each(['setLayout', 'resizePane', 'inbound event'])("ends the drag before applying %s", method => {
    const { root, handle, controller, events } = setup();
    press(handle);
    move(350);
    if (method === 'setLayout') controller.setLayout([30, 70]);
    else if (method === 'resizePane') controller.resizePane(0, 30);
    else root.dispatchEvent(new CustomEvent('resizable:set', { detail: { layout: [30, 70] } }));
    move(400);
    expect(controller.layout).toEqual([30, 70]);
    expect(events).toEqual([true, false]);
  });

  it('leaves an active drag intact when an API update is invalid', () => {
    const { handle, controller, events } = setup();
    press(handle);
    expect(() => controller.setLayout([NaN, 50])).toThrow();
    expect(() => controller.resizePane(0, NaN)).toThrow();
    move(350);
    expect(controller.layout).toEqual([70, 30]);
    expect(events).toEqual([true]);
  });

  it.each(['keyboard', 'resizePane', 'setLayout', 'drag'])("restores the most recent size after collapsing via %s", method => {
    const { handle, controller } = setup([collapsible, '']);
    controller.collapse(0);
    controller.expand(0);
    controller.resizePane(0, 35);
    if (method === 'keyboard') enter(handle);
    else if (method === 'resizePane') controller.resizePane(0, 0);
    else if (method === 'setLayout') controller.setLayout([0, 100]);
    else {
      press(handle);
      move(75);
      window.dispatchEvent(new MouseEvent('mouseup'));
    }
    expect(controller.isCollapsed(0)).toBe(true);
    controller.expand(0);
    expect(controller.layout).toEqual([35, 65]);
  });

  it('uses the same remembered size when toggling twice with Enter', () => {
    const { handle, controller } = setup([collapsible, '']);
    controller.resizePane(0, 35);
    enter(handle);
    enter(handle);
    expect(controller.layout).toEqual([35, 65]);
  });

  it('resolves feasible collapse gaps at initialization and through setLayout', () => {
    const { handle, controller } = setup(['data-min-size="60" data-collapsible="true"', 'data-min-size="60" data-collapsible="true"']);
    expect(controller.layout).toEqual([100, 0]);
    controller.setLayout([0, 100]);
    controller.setLayout([50, 50]);
    expect(controller.layout).toEqual([100, 0]);
    expect(handle.getAttribute('aria-valuemax')).toBe('100');
    expect(handle.getAttribute('aria-valuemin')).toBe('0');
  });
});
