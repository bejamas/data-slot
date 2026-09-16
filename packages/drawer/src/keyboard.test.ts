import { afterEach, describe, expect, it } from 'bun:test';
import { trackKeyboard } from './environment';

describe('Drawer virtual keyboard', () => {
  const originalViewport = window.visualViewport;
  const originalHeight = window.innerHeight;
  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalViewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
    document.body.innerHTML = '';
  });
  function setup(scale = 1) {
    document.body.innerHTML = `<div id="viewport" style="--drawer-keyboard-inset:7px">
      <div id="scroller" style="overflow-y:auto;padding-bottom:4px;scroll-padding-bottom:3px;overflow-anchor:auto">
        <input aria-label="Destination" />
      </div>
    </div>`;
    const viewport = document.getElementById('viewport')!;
    const scroller = document.getElementById('scroller')!;
    const input = document.querySelector('input')!;
    const visual = Object.assign(new EventTarget(), { height: 500, offsetTop: 0, scale });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visual });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    scroller.getBoundingClientRect = () => new DOMRect(0, 0, 400, 800);
    input.getBoundingClientRect = () => new DOMRect(0, 740, 300, 40);
    input.focus();
    cleanup = trackKeyboard(viewport);
    return { viewport, scroller, visual };
  }
  it('exposes the Base UI inset and scrolls a focused field above the keyboard', () => {
    const { viewport, scroller } = setup();
    expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('300px');
    expect(viewport.hasAttribute('data-keyboard-open')).toBe(true);
    expect(scroller.scrollTop).toBe(296);
    expect(parseFloat(scroller.style.paddingBottom)).toBeGreaterThan(300);
    cleanup!();
    cleanup = undefined;
    expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('7px');
    expect(scroller.style.paddingBottom).toBe('4px');
    expect(scroller.style.scrollPaddingBottom).toBe('3px');
    expect(scroller.style.overflowAnchor).toBe('auto');
  });
  it('restores the scroll container when the keyboard closes', async () => {
    const { viewport, scroller, visual } = setup();
    visual.height = 800;
    visual.dispatchEvent(new Event('resize'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    expect(viewport.hasAttribute('data-keyboard-open')).toBe(false);
    expect(scroller.style.paddingBottom).toBe('4px');
  });
  it('does not treat pinch zoom as a software keyboard', () => {
    const { viewport, scroller } = setup(2);
    expect(viewport.style.getPropertyValue('--drawer-keyboard-inset')).toBe('0px');
    expect(scroller.scrollTop).toBe(0);
    expect(scroller.style.paddingBottom).toBe('4px');
  });
});
