import { afterEach, describe, expect, it } from 'bun:test';
import { createSwipeGesture, type SwipeGestureController, type SwipeMove, type SwipeRelease } from './index';

describe('createSwipeGesture', () => {
  let controller: SwipeGestureController<string> | undefined;
  afterEach(() => { controller?.destroy(); controller = undefined; document.body.innerHTML = ''; });

  const setup = (overrides: Partial<Parameters<typeof createSwipeGesture<string>>[0]> = {}) => {
    document.body.innerHTML = '<section id="surface"><div id="card"><button id="button"></button></div></section>';
    const surface = document.getElementById('surface')!;
    const card = document.getElementById('card')!;
    const log: Array<[string, SwipeMove | SwipeRelease | Event | undefined]> = [];
    controller = createSwipeGesture<string>({
      element: surface,
      axes: ['x'],
      start: (_event, target) => (target.closest('button') ? null : 'card'),
      capture: () => card,
      move: (_target, move) => log.push(['move', move]),
      release: (_target, release) => log.push(['release', release]),
      reset: (_target, event) => log.push(['reset', event]),
      ...overrides,
    });
    return { surface, card, log, controller: controller! };
  };

  const pointer = (type: string, init: PointerEventInit & { timeStamp?: number } = {}) => {
    const event = new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, ...init });
    if (init.timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: init.timeStamp });
    return event;
  };

  it('reports movement only after the axis locks and releases with the last position', () => {
    const { card, log } = setup();
    const captured: number[] = [];
    card.setPointerCapture = (id) => captured.push(id);
    card.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100, timeStamp: 0 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 105, clientY: 102 }));
    expect(log).toEqual([]);
    const locking = pointer('pointermove', { clientX: 130, clientY: 105 });
    document.dispatchEvent(locking);
    expect(locking.defaultPrevented).toBe(true);
    expect(captured).toEqual([1]);
    expect(log.at(-1)).toEqual(['move', { axis: 'x', deltaX: 30, deltaY: 5, event: locking }]);
    document.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0, timeStamp: 250 }));
    const [, release] = log.at(-1)!;
    expect(release).toMatchObject({ axis: 'x', deltaX: 30, deltaY: 5, duration: 250 });
    expect(log.map(([name]) => name)).toEqual(['move', 'release']);
  });

  it('leaves cross-axis drags, refused locks, and ignored presses to the page', () => {
    const { card, log } = setup({ lock: (_target, move) => move.deltaX > 0 });
    card.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 105, clientY: 160 }));
    document.dispatchEvent(pointer('pointerup', { clientX: 105, clientY: 160 }));
    card.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    const refused = pointer('pointermove', { clientX: 40, clientY: 100 });
    document.dispatchEvent(refused);
    expect(refused.defaultPrevented).toBe(false);
    document.dispatchEvent(pointer('pointerup', { clientX: 40, clientY: 100 }));
    document.getElementById('button')!.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 200, clientY: 100 }));
    document.dispatchEvent(pointer('pointerup', { clientX: 200, clientY: 100 }));
    expect(log).toEqual([]);
  });

  it('resets on pointer cancellation, inactive targets, and controller cancel for the matching target', () => {
    let active = true;
    const { card, log, controller } = setup({ active: () => active });
    const released: number[] = [];
    card.releasePointerCapture = (id) => released.push(id);
    const swipe = () => {
      card.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
      document.dispatchEvent(pointer('pointermove', { clientX: 150, clientY: 100 }));
    };
    swipe();
    const cancelEvent = pointer('pointercancel');
    document.dispatchEvent(cancelEvent);
    expect(log.at(-1)).toEqual(['reset', cancelEvent]);
    swipe();
    active = false;
    document.dispatchEvent(pointer('pointermove', { clientX: 160, clientY: 100 }));
    expect(log.at(-1)?.[0]).toBe('reset');
    active = true;
    swipe();
    controller.cancel('other');
    expect(log.at(-1)?.[0]).toBe('move');
    controller.cancel('card');
    expect(log.at(-1)).toEqual(['reset', undefined]);
    document.dispatchEvent(pointer('pointerup', { clientX: 160, clientY: 100 }));
    expect(log.filter(([name]) => name === 'release')).toHaveLength(0);
    expect(released).toEqual([1, 1, 1]);
  });

  it('swallows the click that follows a released swipe', () => {
    const { card } = setup();
    let clicks = 0;
    card.addEventListener('click', () => { clicks += 1; });
    card.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 150, clientY: 100 }));
    document.dispatchEvent(pointer('pointerup', { clientX: 150, clientY: 100 }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(clicks).toBe(0);
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(clicks).toBe(1);
  });
});
