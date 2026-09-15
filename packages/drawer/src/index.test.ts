import { afterEach, describe, expect, it } from 'bun:test';
import { create, createDrawer, type DrawerController } from './index';

const controllers: DrawerController[] = [];
afterEach(() => { controllers.splice(0).reverse().forEach((controller) => controller.destroy()); document.body.innerHTML = ''; });
const tick = () => new Promise((resolve) => setTimeout(resolve, 50));
const markup = (attrs = '', inner = '') => `<div data-slot="drawer" id="drawer" ${attrs}>
  <button data-slot="drawer-trigger">Open</button>
  <div data-slot="drawer-portal"><div data-slot="drawer-backdrop"></div><div data-slot="drawer-viewport">
    <div data-slot="drawer-popup"><h2 data-slot="drawer-title">Title</h2><p data-slot="drawer-description">Description</p>
    <div data-slot="drawer-content"><button data-slot="drawer-close">Close</button><input aria-label="Field"></div>${inner}</div>
  </div></div></div>`;
function setup(attrs = '', options: Parameters<typeof createDrawer>[1] = {}) {
  document.body.innerHTML = `<main id="outside"><button>Outside</button></main>${markup(attrs)}`;
  const root = document.querySelector('[data-slot="drawer"]')!;
  const popup = root.querySelector<HTMLElement>('[data-slot="drawer-popup"]')!;
  const trigger = root.querySelector<HTMLButtonElement>('[data-slot="drawer-trigger"]')!;
  const close = root.querySelector<HTMLButtonElement>('[data-slot="drawer-close"]')!;
  const portal = root.querySelector<HTMLElement>('[data-slot="drawer-portal"]')!;
  const controller = createDrawer(root, options); controllers.push(controller);
  return { root, popup, trigger, close, portal, controller };
}
function drag(element: HTMLElement, x: number, y: number, canceled = false, duration = 1) {
  const down = new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true, pointerId: 1, clientX: 100, clientY: 100 });
  Object.defineProperty(down, 'timeStamp', { value: 0 });
  element.dispatchEvent(down);
  document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, clientX: 100 + x, clientY: 100 + y }));
  const up = new PointerEvent(canceled ? 'pointercancel' : 'pointerup', { bubbles: true, pointerId: 1, clientX: 100 + x, clientY: 100 + y });
  Object.defineProperty(up, 'timeStamp', { value: duration });
  document.dispatchEvent(up);
}

describe('Drawer', () => {
  it('establishes entry styles before measuring a newly visible drawer', async () => {
    const { popup, portal, controller } = setup();
    const backdrop = portal.querySelector<HTMLElement>('[data-slot="drawer-backdrop"]')!;
    const measure = popup.getBoundingClientRect.bind(popup);
    const visibleMeasurements: boolean[] = [];
    const recordMeasurement = () => {
      if (!popup.hidden) {
        visibleMeasurements.push(
          popup.hasAttribute('data-starting-style') && backdrop.hasAttribute('data-starting-style'),
        );
      }
      return measure();
    };

    for (let cycle = 0; cycle < 2; cycle++) {
      visibleMeasurements.length = 0;
      popup.getBoundingClientRect = recordMeasurement;
      controller.open();
      expect(visibleMeasurements.length).toBeGreaterThan(0);
      expect(visibleMeasurements.every(Boolean)).toBe(true);
      // Only inspect synchronous opening measurements, before the entry frames run.
      popup.getBoundingClientRect = measure;
      await tick();
      expect(popup.hasAttribute('data-starting-style')).toBe(false);
      expect(backdrop.hasAttribute('data-starting-style')).toBe(false);
      controller.close();
      await tick();
      expect(popup.hidden).toBe(true);
    }
  });

  it('announces only the active trigger and allows canceling payload changes while open', () => {
    document.body.innerHTML = markup('data-modal="false"');
    const root = document.getElementById('drawer')!;
    const first = root.querySelector<HTMLButtonElement>('[data-slot="drawer-trigger"]')!;
    first.id = 'first';
    first.dataset.payload = 'first payload';
    const second = first.cloneNode(true) as HTMLButtonElement;
    second.id = 'second';
    second.dataset.payload = 'second payload';
    root.append(second);
    const controller = createDrawer(root); controllers.push(controller);
    const payloads: unknown[] = [];
    root.addEventListener('drawer:change', (event) => payloads.push((event as CustomEvent).detail.payload));
    first.click();
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(second.getAttribute('aria-expanded')).toBe('false');
    root.addEventListener('drawer:beforechange', (event) => event.preventDefault(), { once: true });
    second.click();
    expect(controller.triggerId).toBe('first');
    second.click();
    expect(controller.triggerId).toBe('second');
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(second.getAttribute('aria-expanded')).toBe('true');
    expect(payloads).toEqual(['first payload', 'second payload']);
  });
  it('sets accessible relationships and focuses popup by default, restoring trigger on close', async () => {
    const { popup, trigger, close, controller } = setup();
    expect(popup.hidden).toBe(true);
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(popup.getAttribute('aria-labelledby')!)?.textContent).toBe('Title');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id);
    expect(close.type).toBe('button');
    trigger.focus(); trigger.click(); await tick();
    expect(document.activeElement).toBe(popup);
    expect(document.getElementById('outside')!.hasAttribute('inert')).toBe(true);
    close.click(); await tick();
    expect(controller.isOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(popup.hidden).toBe(true);
    expect(document.getElementById('outside')!.hasAttribute('inert')).toBe(false);
  });
  it('honors canceled changes without mutating focus or visibility', () => {
    const { root, popup, controller } = setup();
    controller.open();
    popup.focus();
    root.addEventListener('drawer:beforechange', (event) => event.preventDefault());
    controller.close();
    expect(controller.isOpen).toBe(true); expect(document.activeElement).toBe(popup); expect(popup.hidden).toBe(false);
  });
  it('exposes reason, original event, payload and callback cancellation', () => {
    const { root, trigger, controller } = setup('', { onOpenChange: (_open, detail) => detail.cancel() });
    trigger.dataset.payload = '{"id":42}';
    let detail: any;
    root.addEventListener('drawer:beforechange', (event) => { detail = (event as CustomEvent).detail; });
    trigger.click();
    expect(detail.reason).toBe('trigger-press'); expect(detail.payload).toEqual({ id: 42 });
    expect(detail.originalEvent.type).toBe('click'); expect(controller.isOpen).toBe(false);
  });
  it('uses completion events and permits manually holding closed content', async () => {
    const { root, popup, controller } = setup();
    const completed: boolean[] = [];
    root.addEventListener('drawer:change-complete', (event) => completed.push((event as CustomEvent).detail.open));
    root.addEventListener('drawer:beforechange', (event) => { if (!(event as CustomEvent).detail.open) (event as CustomEvent).detail.preventUnmountOnClose(); });
    controller.open(); await tick(); controller.close(); await tick();
    expect(completed).toEqual([true, false]); expect(popup.hidden).toBe(false);
    controller.unmount(); expect(popup.hidden).toBe(true);
  });
  it('traps keyboard focus without isolating or locking scroll in trap-focus mode', async () => {
    const { popup, controller } = setup('data-modal="trap-focus"');
    controller.open(); await tick();
    expect(document.getElementById('outside')!.hasAttribute('inert')).toBe(false);
    expect(popup.hasAttribute('aria-modal')).toBe(false);
    const input = popup.querySelector('input')!; input.focus();
    const key = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); input.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true); expect(document.activeElement).toBe(popup.querySelector('button'));
  });
  it('supports nonmodal focus-out and disablePointerDismissal', async () => {
    const { controller } = setup('data-modal="false"'); controller.open(); await tick();
    document.querySelector<HTMLButtonElement>('#outside button')!.focus(); expect(controller.isOpen).toBe(false);
    controller.destroy();
    const locked = setup('data-modal="false" data-disable-pointer-dismissal'); locked.controller.open(); await tick();
    document.querySelector<HTMLButtonElement>('#outside button')!.focus(); expect(locked.controller.isOpen).toBe(true);
  });
  it('supports explicit focus targets and false finalFocus', async () => {
    const { popup, controller } = setup('', { initialFocus: 'input', finalFocus: false });
    controller.open(); await tick(); expect(document.activeElement).toBe(popup.querySelector('input'));
    controller.close(); expect(document.activeElement).not.toBe(document.querySelector('[data-slot="drawer-trigger"]'));
  });
  it('ignores disabled and prevented triggers', () => {
    const { trigger, controller } = setup(); trigger.dataset.disabled = ''; trigger.click(); expect(controller.isOpen).toBe(false);
    delete trigger.dataset.disabled; trigger.setAttribute('aria-disabled', 'true'); trigger.click(); expect(controller.isOpen).toBe(false);
    trigger.removeAttribute('aria-disabled'); trigger.addEventListener('click', (event) => event.preventDefault(), true); trigger.click(); expect(controller.isOpen).toBe(false);
  });
  it('restores portals and preserves keepMounted until destruction', async () => {
    const { root, portal, controller } = setup('', { keepMounted: true }); controller.open(); expect(portal.parentElement).toBe(document.body);
    controller.close(); await tick(); expect(portal.parentElement).toBe(document.body); expect(portal.hidden).toBe(true);
    controller.destroy(); expect(portal.parentElement === root).toBe(true);
  });
  it('binds once, destroys pending focus work, and allows rebinding', async () => {
    const { root, controller } = setup(); expect(create()).toEqual([]);
    controller.open(); controller.destroy(); await tick();
    expect(root.querySelector('[data-slot="drawer-popup"]')).not.toBeNull();
    const rebound = createDrawer(root); controllers.push(rebound); expect(rebound).not.toBe(controller); expect(rebound.isOpen).toBe(false);
  });
  it('supports detached triggers and inbound events', () => {
    document.body.innerHTML = `<button id="detached" data-slot="drawer-trigger" data-drawer-target="drawer">Detached</button>${markup()}`;
    const root = document.getElementById('drawer')!;
    const controller = createDrawer(root); controllers.push(controller);
    document.getElementById('detached')!.click(); expect(controller.triggerId).toBe('detached');
    root.dispatchEvent(new CustomEvent('drawer:set', { detail: { open: false } })); expect(controller.isOpen).toBe(false);
  });
  for (const [direction, x, y] of [['down', 0, 500], ['up', 0, -500], ['left', -600, 0], ['right', 600, 0]] as const) {
    it(`dismisses by ${direction} swipe`, () => { const { popup, controller } = setup(`data-swipe-direction="${direction}"`); controller.open(); drag(popup, x, y); expect(controller.isOpen).toBe(false); });
    it(`returns short ${direction} drags to open and dismisses longer drags using the popup size`, () => {
      const { popup, controller } = setup(`data-swipe-direction="${direction}"`);
      Object.defineProperty(popup, 'getBoundingClientRect', { value: () => ({ height: 400, width: 400 }) });
      controller.open();
      const dx = Math.sign(x);
      const dy = Math.sign(y);
      drag(popup, dx * 100, dy * 100, false, 1000);
      expect(controller.isOpen).toBe(true);
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('0px');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
      expect(popup.hasAttribute('data-swiping')).toBe(false);
      drag(popup, dx * 160, dy * 160, false, 1000);
      expect(controller.isOpen).toBe(false);
    });
  }
  it('returns to open when swipe dismissal is canceled', () => {
    const { root, popup, controller } = setup();
    controller.open();
    root.addEventListener('drawer:beforechange', (event) => event.preventDefault());
    drag(popup, 0, 700);
    expect(controller.isOpen).toBe(true);
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(popup.hasAttribute('data-swiping')).toBe(false);
  });
  it('ignores cross-axis, interactive descendants and pointer cancellation', () => {
    const { popup, controller } = setup(); controller.open(); drag(popup, 600, 2); expect(controller.isOpen).toBe(true);
    drag(popup.querySelector('input')!, 0, 700); expect(controller.isOpen).toBe(true);
    drag(popup, 0, 700, true); expect(controller.isOpen).toBe(true); expect(popup.hasAttribute('data-swiping')).toBe(false);
  });
  it('closes only the nested drawer on Escape and isolates its parent', async () => {
    document.body.innerHTML = markup('', markup().replace('id="drawer"', 'id="nested"'));
    const bound = create(); controllers.push(...bound);
    bound[0]!.open(); bound[1]!.open(); await tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(bound[1]!.isOpen).toBe(false); expect(bound[0]!.isOpen).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); expect(bound[0]!.isOpen).toBe(false);
  });
});

it('preserves native scrolling and claims boundary touch drags only', () => {
  const { popup, controller } = setup();
  const content = popup.querySelector<HTMLElement>('[data-slot="drawer-content"]')!;
  content.style.overflowY = 'auto';
  Object.defineProperty(content, 'scrollHeight', { configurable: true, value: 1000 });
  Object.defineProperty(content, 'clientHeight', { configurable: true, value: 300 });
  content.scrollTop = 100;
  controller.open();
  const touch = (type: string, y: number, target: HTMLElement) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 7, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
    target.dispatchEvent(event); return event;
  };
  touch('touchstart', 100, content);
  expect(touch('touchmove', 500, content).defaultPrevented).toBe(false);
  touch('touchend', 500, content); expect(controller.isOpen).toBe(true);
  content.scrollTop = 0;
  touch('touchstart', 100, content);
  expect(touch('touchmove', 600, content).defaultPrevented).toBe(true);
  touch('touchend', 600, content); expect(controller.isOpen).toBe(false);
});

it('opens from a detached edge swipe surface and ignores disabled swipe areas', () => {
  document.body.innerHTML = `<div data-slot="drawer-swipe-area" data-drawer-target="drawer" id="edge"></div>${markup()}`;
  const controller = createDrawer(document.getElementById('drawer')!); controllers.push(controller);
  const area = document.getElementById('edge')!;
  area.dataset.disabled = ''; drag(area, 0, -100); expect(controller.isOpen).toBe(false);
  delete area.dataset.disabled; drag(area, 0, -100); expect(controller.isOpen).toBe(true);
});

it('allows a fresh close-button click immediately after an opening swipe', () => {
  document.body.innerHTML = `<div data-slot="drawer-swipe-area" data-drawer-target="drawer" id="edge"></div>${markup()}`;
  const controller = createDrawer(document.getElementById('drawer')!); controllers.push(controller);
  drag(document.getElementById('edge')!, 0, -100);
  expect(controller.isOpen).toBe(true);
  const close = document.querySelector('[data-slot="drawer-close"]')!;
  close.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 2 }));
  close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  expect(controller.isOpen).toBe(false);
});

it('preserves outside focus when leaving a nonmodal drawer', async () => {
  const { controller } = setup('data-modal="false"'); controller.open(); await tick();
  const outside = document.querySelector<HTMLButtonElement>('#outside button')!; outside.focus();
  expect(controller.isOpen).toBe(false); expect(document.activeElement === outside).toBe(true);
});

it('interprets swipe-area direction as the actual opening direction', () => {
  document.body.innerHTML = `<div data-slot="drawer-swipe-area" data-drawer-target="drawer" data-swipe-direction="up" id="edge"></div>${markup()}`;
  const controller = createDrawer(document.getElementById('drawer')!); controllers.push(controller);
  const area = document.getElementById('edge')!;
  drag(area, 0, 100); expect(controller.isOpen).toBe(false);
  area.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true, pointerId: 2, clientX: 100, clientY: 100 }));
  document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 2, clientX: 100, clientY: 20 }));
  expect(area.hasAttribute('data-swiping')).toBe(true);
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 100, clientY: 20 }));
  expect(controller.isOpen).toBe(true); expect(area.hasAttribute('data-swiping')).toBe(false);
});

it('passes the real touch event to change listeners', () => {
  const { root, popup, controller } = setup(); controller.open();
  let original: Event | undefined;
  root.addEventListener('drawer:beforechange', (event) => { original = (event as CustomEvent).detail.originalEvent; });
  const touch = (type: string, y: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 9, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
    popup.dispatchEvent(event); return event;
  };
  touch('touchstart', 100); touch('touchmove', 700); const end = touch('touchend', 700);
  expect(original === end).toBe(true); expect(original?.type).toBe('touchend');
});

it('tracks opening swipe position live, defers completion and rolls back cancellation', async () => {
  document.body.innerHTML = `<div data-slot="drawer-swipe-area" data-drawer-target="drawer" id="edge"></div>${markup()}`;
  const root = document.getElementById('drawer')!;
  const controller = createDrawer(root); controllers.push(controller);
  const area = document.getElementById('edge')!;
  const popup = document.querySelector<HTMLElement>('[data-slot="drawer-popup"]')!;
  const completions: boolean[] = [];
  root.addEventListener('drawer:change-complete', (event) => completions.push((event as CustomEvent).detail.open));
  const pointer = (type: string, y: number) => area.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, isPrimary: true, pointerId: 21, clientX: 100, clientY: y }));
  pointer('pointerdown', 500); pointer('pointermove', 450);
  expect(controller.isOpen).toBe(true); expect(popup.hidden).toBe(false);
  const first = parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-y'));
  pointer('pointermove', 350);
  expect(parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-y'))).toBeLessThan(first);
  expect(area.hasAttribute('inert')).toBe(false);
  await tick(); expect(completions).toEqual([]);
  pointer('pointercancel', 350); await tick();
  expect(controller.isOpen).toBe(false); expect(popup.hidden).toBe(true); expect(completions).toEqual([false]);
  pointer('pointerdown', 500); pointer('pointermove', 350); pointer('pointerup', 350); await tick();
  expect(controller.isOpen).toBe(true); expect(completions).toEqual([false, true]);
  expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
});

it('honors canceled live swipe opening and disabling an active edge gesture', () => {
  document.body.innerHTML = `<div data-slot="drawer-swipe-area" data-drawer-target="drawer" id="edge"></div>${markup()}`;
  const root = document.getElementById('drawer')!;
  const controller = createDrawer(root); controllers.push(controller);
  const area = document.getElementById('edge')!;
  const prevent = (event: Event) => event.preventDefault();
  root.addEventListener('drawer:beforechange', prevent);
  drag(area, 0, -100); expect(controller.isOpen).toBe(false);
  root.removeEventListener('drawer:beforechange', prevent);
  area.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true, pointerId: 22, clientY: 300 }));
  document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 22, clientY: 200 }));
  expect(controller.isOpen).toBe(true);
  area.dataset.disabled = '';
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 22, clientY: 200 }));
  expect(controller.isOpen).toBe(false); expect(area.hasAttribute('data-swiping')).toBe(false);
});


describe('single drawer snap point', () => {
  it('supports fractions, pixels, rem, zero and clearing the point', () => {
    const { root, popup, controller } = setup('data-snap-point="0.5"');
    const viewport = popup.parentElement!;
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 800 });
    Object.defineProperty(popup, 'getBoundingClientRect', { value: () => ({ height: 800, width: 600 }) });
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    controller.open();
    expect(controller.snapPoint).toBe(0.5);
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('400px');
    for (const [point, visible] of [[148, 148], ['148px', 148], ['10rem', 10 * rem], [0, 0], [1, 800], [1000, 800], [null, 800]] as const) {
      controller.setSnapPoint(point);
      expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe(`${800 - visible}px`);
      expect(controller.snapPoint).toBe(point);
    }
    expect(root.hasAttribute('data-snap-point')).toBe(false);
  });

  it('recalculates a fractional point when the viewport resizes', () => {
    const { popup, controller } = setup('', { snapPoint: 0.5 });
    const viewport = popup.parentElement!;
    let viewportHeight = 800;
    Object.defineProperty(viewport, 'clientHeight', { get: () => viewportHeight });
    Object.defineProperty(popup, 'getBoundingClientRect', { value: () => ({ height: 800, width: 600 }) });
    controller.open();
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('400px');
    viewportHeight = 600;
    window.dispatchEvent(new Event('resize'));
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('500px');
  });

  it('opens from an edge using the visible height of the single point', () => {
    document.body.innerHTML = `<div data-slot="drawer-swipe-area" data-drawer-target="drawer" id="edge"></div>${markup('data-snap-point="200px"')}`;
    const root = document.getElementById('drawer')!;
    const popup = root.querySelector<HTMLElement>('[data-slot="drawer-popup"]')!;
    Object.defineProperty(popup, 'getBoundingClientRect', { value: () => ({ height: 800, width: 600 }) });
    const controller = createDrawer(root); controllers.push(controller);
    const area = document.getElementById('edge')!;
    const pointer = (type: string, y: number) => area.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, isPrimary: true, pointerId: 31, clientX: 100, clientY: y }));
    pointer('pointerdown', 500); pointer('pointermove', 450);
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('600px');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('150px');
    pointer('pointerup', 450);
    expect(controller.isOpen).toBe(true);
    expect(controller.snapPoint).toBe('200px');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
  });

  it('uses defaults and gives JavaScript options precedence over HTML', () => {
    for (const [attrs, options, expected] of [
      ['data-default-snap-point="0.4"', {}, 0.4],
      ['data-default-snap-point="0.4" data-snap-point="0.6"', {}, 0.6],
      ['data-snap-point="0.6"', { defaultSnapPoint: 0.3 }, 0.3],
      ['data-snap-point="0.6"', { snapPoint: null, defaultSnapPoint: 0.3 }, null],
    ] as const) {
      const { controller } = setup(attrs, options);
      expect(controller.snapPoint).toBe(expected);
      controller.destroy();
    }
  });

  it('replaces the point through inbound events and retains it across reopen', () => {
    const { root, controller } = setup('', { defaultSnapPoint: 0.5 });
    const changes: unknown[] = [];
    root.addEventListener('drawer:snapchange', (event) => changes.push((event as CustomEvent).detail));
    const event = new CustomEvent('drawer:set', { detail: { open: true, snapPoint: '320px' } });
    root.dispatchEvent(event);
    expect(controller.isOpen).toBe(true);
    expect(controller.snapPoint).toBe('320px');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ snapPoint: '320px', reason: 'imperative-action', originalEvent: event });
    controller.close(); controller.open();
    expect(controller.snapPoint).toBe('320px');
  });

  it('honors event and callback cancellation without changing the point or offset', () => {
    const { root, popup, controller } = setup('', { snapPoint: 0.5, onSnapPointChange: (_point, detail) => detail.cancel() });
    const offset = popup.style.getPropertyValue('--drawer-snap-point-offset');
    let changes = 0;
    root.addEventListener('drawer:snapchange', () => changes++);
    root.addEventListener('drawer:beforesnapchange', (event) => event.preventDefault(), { once: true });
    controller.setSnapPoint('320px');
    controller.setSnapPoint(1);
    expect(controller.snapPoint).toBe(0.5);
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe(offset);
    expect(changes).toBe(0);
  });

  it('ignores invalid replacements and does not read multiple snap points', () => {
    const { root, controller } = setup('data-snap-points="[0.5,1]" data-snap-to-sequential-points');
    expect(controller.snapPoint).toBeNull();
    controller.setSnapPoint(0.5);
    for (const value of [[0.5, 1], -1, NaN, Infinity, '', 'bad', '20%', undefined]) {
      root.dispatchEvent(new CustomEvent('drawer:set', { detail: { snapPoint: value } }));
      expect(controller.snapPoint).toBe(0.5);
    }
  });

  for (const [direction, dx, dy, sign] of [['down', 0, 1, 1], ['up', 0, -1, -1], ['left', -1, 0, -1], ['right', 1, 0, 1]] as const) {
    it(`returns to the single ${direction} position and dismisses relative to its visible size`, () => {
      const { popup, controller } = setup(`data-swipe-direction="${direction}"`, { snapPoint: '200px' });
      Object.defineProperty(popup, 'getBoundingClientRect', { value: () => ({ height: 800, width: 800 }) });
      controller.open();
      expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe(`${600 * sign}px`);
      drag(popup, dx * 40, dy * 40, false, 1000);
      expect(controller.isOpen).toBe(true);
      expect(controller.snapPoint).toBe('200px');
      drag(popup, -dx * 300, -dy * 300, false, 1000);
      expect(controller.isOpen).toBe(true);
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('0px');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
      expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe(`${600 * sign}px`);
      drag(popup, dx * 80, dy * 80, false, 1000);
      expect(controller.isOpen).toBe(false);
      controller.open();
      expect(controller.snapPoint).toBe('200px');
    });
  }
});
