import {
  getRoots, getDataBool, getDataString, reuseRootBinding, hasRootBinding, setRootBinding, clearRootBinding,
  ensureId, setAria, linkLabelledBy, on, emit, lockScroll, unlockScroll, createPortalLifecycle,
  createModalStackItem, createDismissLayer, createPresenceLifecycle, focusElement, getAutofocusOrFirstFocusable,
  getTabbables, containsWithPortals,
} from '@data-slot/core';
import { createSwipeGesture, parseSnapPoint, snapPixels, type DrawerSnapPoint, type DrawerSwipeDirection } from './gestures';
import { isolateOutside, registerVisuals, trackKeyboard } from './environment';
export type { DrawerSnapPoint, DrawerSwipeDirection } from './gestures';

export type DrawerChangeReason = 'trigger-press' | 'close-press' | 'outside-press' | 'escape-key' | 'focus-out' | 'imperative-action' | 'swipe' | 'none';
export interface DrawerChangeDetails {
  open: boolean;
  reason: DrawerChangeReason;
  trigger: HTMLElement | null;
  payload: unknown;
  originalEvent?: Event;
  cancel(): void;
  preventUnmountOnClose(): void;
}
export interface DrawerSnapChangeDetails {
  snapPoint: DrawerSnapPoint | null;
  reason: DrawerChangeReason;
  originalEvent?: Event;
  cancel(): void;
}
export interface DrawerOptions {
  open?: boolean;
  defaultOpen?: boolean;
  modal?: boolean | 'trap-focus';
  disablePointerDismissal?: boolean;
  closeOnEscape?: boolean;
  swipeDirection?: DrawerSwipeDirection;
  snapPoints?: DrawerSnapPoint[];
  snapPoint?: DrawerSnapPoint | null;
  defaultSnapPoint?: DrawerSnapPoint | null;
  snapToSequentialPoints?: boolean;
  triggerId?: string | null;
  defaultTriggerId?: string | null;
  initialFocus?: boolean | string | HTMLElement;
  finalFocus?: boolean | string | HTMLElement;
  keepMounted?: boolean;
  container?: string | HTMLElement;
  onOpenChange?: (open: boolean, details: DrawerChangeDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  onSnapPointChange?: (snapPoint: DrawerSnapPoint | null, details: DrawerSnapChangeDetails) => void;
}
export interface DrawerController {
  open(triggerId?: string): void;
  close(): void;
  toggle(): void;
  setSnapPoint(point: DrawerSnapPoint | null): void;
  /** Finish a close held by preventUnmountOnClose(). Does not close an open drawer. */
  unmount(): void;
  readonly isOpen: boolean;
  readonly snapPoint: DrawerSnapPoint | null;
  readonly triggerId: string | null;
  destroy(): void;
}
const KEY = '@data-slot/drawer';
const disabled = (element: Element) => element.matches(':disabled') || getDataBool(element, 'disabled') === true || element.getAttribute('aria-disabled') === 'true';
const ownParts = (root: Element, name: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-slot="drawer-${name}"]`)).filter((part) => part.closest('[data-slot="drawer"]') === root);
const selector = (scope: ParentNode, value: string) => { try { return scope.querySelector<HTMLElement>(value); } catch { return null; } };
const focusOption = (element: Element, name: string) => {
  const value = getDataString(element, name);
  return value === 'false' ? false : value === 'true' || value === '' ? true : value;
};
const parsePayload = (element: HTMLElement | null): unknown => {
  const value = element?.getAttribute('data-payload');
  if (value == null) return undefined;
  try { return JSON.parse(value); } catch { return value; }
};

/** Bind serializable drawer markup. Function-valued React props map to cancellable DOM events. */
export function createDrawer(root: Element, options: DrawerOptions = {}): DrawerController {
  const existing = reuseRootBinding<DrawerController>(root, KEY, '[@data-slot/drawer] Drawer already initialized; returning its controller.');
  if (existing) return existing;
  const popup = ownParts(root, 'popup')[0];
  if (!popup) throw new Error('Drawer requires drawer-popup slot');
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const portal = ownParts(root, 'portal')[0];
  const backdrop = ownParts(root, 'backdrop')[0];
  const viewport = ownParts(root, 'viewport')[0];
  const title = ownParts(root, 'title')[0];
  const description = ownParts(root, 'description')[0];
  const triggers = ownParts(root, 'trigger');
  const swipeAreas = ownParts(root, 'swipe-area');
  if (root.id) {
    for (const element of doc.querySelectorAll<HTMLElement>('[data-drawer-target]')) {
      if (element.getAttribute('data-drawer-target')?.replace(/^#/, '') !== root.id) continue;
      if (element.dataset.slot === 'drawer-trigger' && !triggers.includes(element)) triggers.push(element);
      if (element.dataset.slot === 'drawer-swipe-area' && !swipeAreas.includes(element)) swipeAreas.push(element);
    }
  }
  const modalAttribute = getDataString(root, 'modal');
  const modal = options.modal ?? (modalAttribute === 'trap-focus' ? 'trap-focus' : modalAttribute !== 'false');
  const pointerDismissal = !(options.disablePointerDismissal ?? getDataBool(root, 'disablePointerDismissal') ?? false);
  const closeOnEscape = options.closeOnEscape ?? getDataBool(root, 'closeOnEscape') ?? true;
  const directionValue = options.swipeDirection ?? getDataString(root, 'swipeDirection');
  const direction: DrawerSwipeDirection = ['up', 'down', 'left', 'right'].includes(directionValue ?? '') ? directionValue as DrawerSwipeDirection : 'down';
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  let rawPoints: unknown = options.snapPoints;
  if (rawPoints === undefined) {
    try { rawPoints = JSON.parse(getDataString(root, 'snapPoints') ?? '[]'); } catch { rawPoints = []; }
  }
  const points = Array.isArray(rawPoints) ? rawPoints.map(parseSnapPoint).filter((point): point is DrawerSnapPoint => point !== null) : [];
  const defaultSnap = options.defaultSnapPoint !== undefined ? options.defaultSnapPoint : parseSnapPoint(getDataString(root, 'defaultSnapPoint')) ?? points[0] ?? null;
  let currentSnap = options.snapPoint !== undefined ? options.snapPoint : defaultSnap;
  if (currentSnap !== null && !points.includes(currentSnap)) currentSnap = points[0] ?? null;
  const sequential = options.snapToSequentialPoints ?? getDataBool(root, 'snapToSequentialPoints') ?? false;
  const initialFocus = options.initialFocus ?? focusOption(popup, 'initialFocus');
  const finalFocus = options.finalFocus ?? focusOption(popup, 'finalFocus');
  const keepMounted = options.keepMounted ?? (portal ? getDataBool(portal, 'keepMounted') : undefined) ?? false;
  const containerValue = options.container ?? (portal ? getDataString(portal, 'container') : undefined);
  const container = typeof containerValue === 'string' ? selector(doc, containerValue) : containerValue;
  const mountElement = portal ?? viewport ?? popup;
  const portalLifecycle = createPortalLifecycle({ content: mountElement, root });
  const cleanups: Array<() => void> = [];
  let opened = false;
  let destroyed = false;
  let mounted = false;
  let locked = false;
  let held = false;
  let isolation: (() => void) | undefined;
  let keyboardCleanup: (() => void) | undefined;
  const keyboardAware = viewport && (root.closest('[data-slot="drawer-virtual-keyboard-provider"]') || ownParts(root, 'virtual-keyboard-provider').length);
  let previousFocus: HTMLElement | null = null;
  const initialTrigger = options.triggerId ?? options.defaultTriggerId ?? getDataString(root, 'triggerId') ?? getDataString(root, 'defaultTriggerId');
  let activeTrigger = triggers.find((trigger) => trigger.id === initialTrigger) ?? null;
  let epoch = 0;
  let activeSwipeArea: HTMLElement | null = null;
  let completedOpenEpoch = -1;
  let pending = 0;
  const rafs = new Set<number>();
  const frame = (callback: () => void) => { const id = win.requestAnimationFrame(() => { rafs.delete(id); if (!destroyed) callback(); }); rafs.add(id); };
  const parts = [root, portal, backdrop, viewport, popup].filter((part): part is HTMLElement => !!part) as Element[];
  const originalTabindex = popup.getAttribute('tabindex');
  if (originalTabindex === null) popup.tabIndex = -1;
  popup.setAttribute('role', 'dialog');
  if (modal === true) setAria(popup, 'modal', true); else popup.removeAttribute('aria-modal');
  ensureId(popup, 'drawer-popup');
  linkLabelledBy(popup, title ?? null, description ?? null);
  if (backdrop) { backdrop.setAttribute('aria-hidden', 'true'); backdrop.setAttribute('role', 'presentation'); }
  for (const button of [...triggers, ...ownParts(root, 'close')]) {
    if (button.tagName === 'BUTTON' && !button.hasAttribute('type')) button.setAttribute('type', 'button');
  }
  for (const trigger of triggers) {
    ensureId(trigger, 'drawer-trigger');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', popup.id);
    setAria(trigger, 'expanded', false);
  }
  const visuals = registerVisuals(root, popup);
  const setState = () => {
    for (const part of parts) {
      part.setAttribute('data-state', opened ? 'open' : 'closed');
      part.toggleAttribute('data-open', opened);
      part.toggleAttribute('data-closed', !opened);
      part.setAttribute('data-swipe-direction', direction);
    }
    for (const trigger of triggers) {
      setAria(trigger, 'expanded', opened && trigger === activeTrigger);
      trigger.toggleAttribute('data-popup-open', opened && trigger === activeTrigger);
    }
    for (const area of swipeAreas) { area.toggleAttribute('data-open', opened); area.toggleAttribute('data-closed', !opened); }
    visuals.update(opened);
  };
  const size = () => horizontal ? popup.getBoundingClientRect().width || win.innerWidth : popup.getBoundingClientRect().height || win.innerHeight;
  const pointSize = (point: DrawerSnapPoint) => Math.min(size(), snapPixels(point, horizontal ? viewport?.clientWidth || doc.documentElement.clientWidth || win.innerWidth : viewport?.clientHeight || doc.documentElement.clientHeight || win.innerHeight, parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16));
  const offset = () => currentSnap === null ? 0 : Math.max(0, size() - pointSize(currentSnap));
  const measure = () => {
    const rect = popup.getBoundingClientRect();
    popup.style.setProperty('--drawer-height', `${rect.height}px`);
    popup.style.setProperty('--drawer-width', `${rect.width}px`);
    popup.style.setProperty('--drawer-snap-point-offset', `${offset() * sign}px`);
    if (currentSnap === null) root.removeAttribute('data-snap-point'); else root.setAttribute('data-snap-point', String(currentSnap));
    visuals.update(opened);
  };
  const topmost = () => !visuals.hasOpenChild() && !Array.from(doc.querySelectorAll<HTMLElement>('[data-stack-index]')).some((element) => Number(element.dataset.stackIndex) > Number(popup.dataset.stackIndex ?? -1));
  const inside = (target: Node | null) => containsWithPortals(popup, target);
  const resolveFocus = (value: DrawerOptions['initialFocus']) => typeof value === 'string' ? selector(doc, value) : typeof value === 'object' ? value : null;
  const focusInitial = () => {
    if (!opened || activeSwipeArea || !topmost() || initialFocus === false) return;
    focusElement(resolveFocus(initialFocus) ?? (initialFocus === true ? getAutofocusOrFirstFocusable(popup) : null) ?? popup);
  };
  const restoreFocus = () => {
    const target = resolveFocus(finalFocus) ?? activeTrigger ?? previousFocus;
    previousFocus = null;
    if (finalFocus !== false && target?.isConnected) focusElement(target);
  };
  const complete = (open: boolean) => { emit(root, 'drawer:change-complete', { open }); options.onOpenChangeComplete?.(open); };
  const completeOpening = (token: number) => {
    if (!opened || activeSwipeArea || epoch !== token || completedOpenEpoch === token) return;
    const animations = animated.flatMap((element) => typeof element.getAnimations === 'function' ? element.getAnimations() : []);
    const finish = () => {
      if (!destroyed && opened && !activeSwipeArea && epoch === token && completedOpenEpoch !== token) {
        completedOpenEpoch = token; complete(true);
      }
    };
    if (animations.length) Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
    else finish();
  };
  const hide = () => {
    if (opened || held || destroyed) return;
    popup.hidden = true;
    if (backdrop) backdrop.hidden = true;
    if (viewport) viewport.hidden = true;
    if (portal) portal.hidden = true;
    if (!keepMounted) { portalLifecycle.restore(); mounted = false; }
  };
  const finishExit = () => {
    if (opened || destroyed || --pending > 0) return;
    hide();
    complete(false);
  };
  const animated = [popup, backdrop].filter((element): element is HTMLElement => !!element);
  const presence = animated.map((element) => createPresenceLifecycle({ element, win, onExitComplete: finishExit }));
  const setSnap = (point: DrawerSnapPoint | null, reason: DrawerChangeReason = 'imperative-action', originalEvent?: Event) => {
    if (destroyed || point === currentSnap || (point !== null && !points.includes(point))) return;
    let canceled = false;
    const detail: DrawerSnapChangeDetails = { snapPoint: point, reason, originalEvent, cancel: () => { canceled = true; } };
    const event = new CustomEvent('drawer:beforesnapchange', { bubbles: true, cancelable: true, detail });
    root.dispatchEvent(event);
    if (event.defaultPrevented || canceled) return;
    options.onSnapPointChange?.(point, detail);
    if (canceled) return;
    currentSnap = point;
    measure();
    emit(root, 'drawer:snapchange', detail);
  };
  const stack = createModalStackItem({ content: popup, overlay: backdrop, cssVarPrefix: 'drawer', onTabKeydown: (event) => {
    if (modal === false || !opened) return;
    const tabbables = getTabbables(popup);
    const active = doc.activeElement as HTMLElement;
    // Nested popup widgets own their portaled tab sequence.
    if (inside(active) && !popup.contains(active)) return;
    if (!tabbables.length) { event.preventDefault(); focusElement(popup); return; }
    const first = tabbables[0]!;
    const last = tabbables.at(-1)!;
    if (!tabbables.includes(active) || (!event.shiftKey && active === last) || (event.shiftKey && active === first)) {
      event.preventDefault(); focusElement(event.shiftKey ? last : first);
    }
  } });
  const update = (next: boolean, reason: DrawerChangeReason = 'imperative-action', originalEvent?: Event, trigger = activeTrigger) => {
    if (destroyed) return;
    const changingTrigger = opened && next && trigger !== activeTrigger;
    if (opened === next && !changingTrigger) return;
    let canceled = false;
    let preventUnmount = false;
    const detail: DrawerChangeDetails = {
      open: next, reason, trigger, payload: parsePayload(trigger), originalEvent,
      cancel: () => { canceled = true; }, preventUnmountOnClose: () => { preventUnmount = true; },
    };
    const before = new CustomEvent('drawer:beforechange', { bubbles: true, cancelable: true, detail });
    root.dispatchEvent(before);
    if (before.defaultPrevented || canceled || destroyed) return;
    options.onOpenChange?.(next, detail);
    if (canceled || destroyed) return;
    if (changingTrigger) {
      activeTrigger = trigger;
      setState();
      emit(root, 'drawer:change', detail);
      return;
    }
    const token = ++epoch;
    activeTrigger = trigger;
    opened = next;
    held = !next && preventUnmount;
    if (next) {
      previousFocus = doc.activeElement as HTMLElement;
      if (!mounted) { portalLifecycle.mount(); if (container) container.appendChild(mountElement); mounted = true; }
      for (const element of [portal, viewport, backdrop, popup]) if (element) element.hidden = false;
      stack.open();
      if (modal === true) {
        isolation = isolateOutside(popup, [popup, ...(backdrop ? [backdrop] : []), ...(activeSwipeArea ? [activeSwipeArea] : [])]);
        lockScroll(); locked = true;
      }
      if (keyboardAware && viewport) keyboardCleanup = trackKeyboard(viewport);
      setState(); measure();
      presence.forEach((part) => part.enter());
      frame(focusInitial);
      frame(() => frame(() => completeOpening(token)));
    } else {
      stack.close(); isolation?.(); isolation = undefined; keyboardCleanup?.(); keyboardCleanup = undefined;
      if (locked) { unlockScroll(); locked = false; }
      setState();
      pending = presence.length;
      presence.forEach((part) => part.exit());
      const outsideTarget = originalEvent?.target as Element | null;
      const preserveOutsideFocus = finalFocus === undefined && (reason === 'focus-out' || (reason === 'outside-press' && modal === false && outsideTarget?.closest?.('button,input,textarea,select,a[href],[tabindex]')));
      if (preserveOutsideFocus) previousFocus = null; else restoreFocus();
      setSnap(defaultSnap, reason, originalEvent);
    }
    emit(root, 'drawer:change', detail);
  };
  let dismissEvent: Event | undefined;
  cleanups.push(on(doc, 'keydown', (event) => { if (event.key === 'Escape') dismissEvent = event; }, { capture: true }));
  cleanups.push(on(doc, 'pointerdown', (event) => { dismissEvent = event; }, { capture: true }));
  cleanups.push(on(doc, 'click', (event) => { dismissEvent = event; }, { capture: true }));
  cleanups.push(createDismissLayer({ root, isOpen: () => opened, closeOnEscape, closeOnClickOutside: pointerDismissal,
    isInside: (target) => inside(target) || !!activeSwipeArea?.contains(target) || triggers.some((trigger) => trigger.contains(target)),
    onDismiss: () => {
      if (dismissEvent && 'button' in dismissEvent && (dismissEvent as MouseEvent).button !== 0) return;
      update(false, dismissEvent?.type === 'keydown' ? 'escape-key' : 'outside-press', dismissEvent);
    },
  }));
  for (const trigger of triggers) cleanups.push(on(trigger, 'click', (event) => {
    if (event.defaultPrevented || disabled(trigger)) return;
    update(!opened || activeTrigger !== trigger, 'trigger-press', event, trigger);
  }));
  // Query close parts before portals move so nested drawers retain ownership.
  for (const close of ownParts(root, 'close')) cleanups.push(on(close, 'click', (event) => {
    if (!event.defaultPrevented && !disabled(close)) update(false, 'close-press', event);
  }));
  cleanups.push(on(doc, 'focusin', (event) => {
    if (!opened || !topmost() || inside(event.target as Node)) return;
    if (modal !== false) focusElement(getAutofocusOrFirstFocusable(popup) ?? popup);
    else if (pointerDismissal && !triggers.includes(event.target as HTMLElement)) update(false, 'focus-out', event);
  }));
  const resetSwipe = () => {
    for (const element of [popup, backdrop, viewport]) {
      element?.removeAttribute('data-swiping');
      element?.style.setProperty('--drawer-swipe-progress', '0');
    }
    popup.style.setProperty('--drawer-swipe-movement-x', '0px');
    popup.style.setProperty('--drawer-swipe-movement-y', '0px');
    visuals.update(opened);
  };
  const moveSwipe = (distance: number) => {
    const movement = Math.max(-offset(), Math.min(size() - offset(), distance));
    const progress = Math.min(1, Math.max(0, movement / Math.max(1, size() - offset())));
    for (const element of [popup, backdrop, viewport]) element?.setAttribute('data-swiping', '');
    popup.style.setProperty(horizontal ? '--drawer-swipe-movement-x' : '--drawer-swipe-movement-y', `${movement * sign}px`);
    for (const element of [popup, backdrop]) element?.style.setProperty('--drawer-swipe-progress', String(progress));
    visuals.update(opened, progress, true);
  };
  const releaseSwipe = (distance: number, velocity: number, event: Event) => {
    popup.style.setProperty('--drawer-swipe-strength', String(Math.max(0.1, Math.min(1, 1 / Math.max(1, Math.abs(velocity))))));
    if (!points.length) {
      if (distance > size() * 0.35 || (velocity > 0.5 && distance > 12)) update(false, 'swipe', event);
      return;
    }
    const snaps = [{ point: null as DrawerSnapPoint | null, visible: 0 }, ...points.map((point) => ({ point, visible: pointSize(point) }))].sort((a, b) => a.visible - b.visible);
    const projected = size() - offset() - distance - (sequential ? 0 : velocity * 180);
    const closest = snaps.reduce((best, snap) => Math.abs(snap.visible - projected) < Math.abs(best.visible - projected) ? snap : best);
    if (closest.point === null) update(false, 'swipe', event); else setSnap(closest.point, 'swipe', event);
  };
  cleanups.push(createSwipeGesture({ element: popup, popup, direction, enabled: () => opened && topmost(), size, offset, move: moveSwipe, release: releaseSwipe, reset: resetSwipe }));
  for (const area of swipeAreas) {
    const areaValue = getDataString(area, 'swipeDirection');
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
    const areaDirection = ['up', 'down', 'left', 'right'].includes(areaValue ?? '') ? areaValue as DrawerSwipeDirection : opposite[direction];
    area.setAttribute('data-swipe-direction', areaDirection);
    let openingGesture = false;
    let rejected = false;
    let lastEvent: Event | undefined;
    const finishArea = (commit: boolean, event = lastEvent) => {
      if (!openingGesture) return;
      openingGesture = false;
      activeSwipeArea = null;
      if (!commit) update(false, 'swipe', event);
      resetSwipe();
      // The edge surface is exempt from modal isolation only while it owns a drag.
      if (opened && modal === true) { isolation?.(); isolation = isolateOutside(popup, [popup, ...(backdrop ? [backdrop] : [])]); }
      if (opened) { focusInitial(); const token = epoch; frame(() => frame(() => completeOpening(token))); }
    };
    cleanups.push(createSwipeGesture({ element: area, popup, direction: opposite[areaDirection], opening: true,
      enabled: () => !rejected && !disabled(area) && (openingGesture ? opened : !opened), size, offset,
      move: (distance, event) => {
        lastEvent = event;
        if (!openingGesture) {
          activeSwipeArea = area;
          update(true, 'swipe', event);
          if (!opened) { activeSwipeArea = null; rejected = true; return; }
          openingGesture = true;
          presence.forEach((part) => part.cleanup());
        }
        area.setAttribute('data-swiping', '');
        moveSwipe(Math.max(0, size() - offset() + distance));
      },
      release: (distance, velocity, event) => finishArea(!disabled(area) && (-distance > 40 || (-velocity > 0.5 && -distance > 12)), event),
      reset: (event) => { finishArea(false, event); rejected = false; lastEvent = undefined; area.removeAttribute('data-swiping'); },
    }));
  }
  cleanups.push(on(win, 'resize', measure));
  if (typeof win.ResizeObserver !== 'undefined') {
    const observer = new win.ResizeObserver(measure); observer.observe(popup); cleanups.push(() => observer.disconnect());
  }
  const inbound = (name: string, handler: (event: CustomEvent) => void) => cleanups.push(on(root, name, (event) => { if (event.target === root) handler(event as CustomEvent); }));
  inbound('drawer:set', (event) => {
    const detail = event.detail;
    if (!detail || typeof detail !== 'object') return;
    const trigger = typeof detail.triggerId === 'string' ? triggers.find((item) => item.id === detail.triggerId) ?? activeTrigger : activeTrigger;
    if (typeof detail.open === 'boolean') update(detail.open, 'imperative-action', event, trigger);
    if ('snapPoint' in detail) setSnap(detail.snapPoint, 'imperative-action', event);
  });
  inbound('drawer:open', (event) => update(true, 'imperative-action', event));
  inbound('drawer:close', (event) => update(false, 'imperative-action', event));
  inbound('drawer:toggle', (event) => update(!opened, 'imperative-action', event));
  inbound('drawer:unmount', () => { held = false; hide(); });
  popup.style.setProperty('--drawer-swipe-strength', '1');
  setState(); measure(); resetSwipe(); hide();
  const controller: DrawerController = {
    open: (triggerId) => update(true, 'imperative-action', undefined, triggers.find((trigger) => trigger.id === triggerId) ?? activeTrigger),
    close: () => update(false), toggle: () => update(!opened), setSnapPoint: (point) => setSnap(point),
    unmount: () => { held = false; hide(); },
    get isOpen() { return opened; }, get snapPoint() { return currentSnap; }, get triggerId() { return activeTrigger?.id ?? null; },
    destroy() {
      if (destroyed) return;
      const hadFocus = opened && inside(doc.activeElement);
      destroyed = true; opened = false; epoch++;
      rafs.forEach((id) => win.cancelAnimationFrame(id)); rafs.clear();
      presence.forEach((part) => part.cleanup()); stack.destroy(); isolation?.(); keyboardCleanup?.();
      if (locked) { unlockScroll(); locked = false; }
      cleanups.forEach((cleanup) => cleanup());
      setState(); visuals.destroy();
      for (const element of [popup, backdrop, viewport, portal]) if (element) element.hidden = true;
      portalLifecycle.cleanup();
      if (originalTabindex === null) popup.removeAttribute('tabindex');
      if (hadFocus) restoreFocus();
      clearRootBinding(root, KEY, controller);
    },
  };
  setRootBinding(root, KEY, controller);
  if (options.open ?? options.defaultOpen ?? getDataBool(root, 'defaultOpen') ?? false) update(true, 'none');
  return controller;
}

export function create(scope: ParentNode = document): DrawerController[] {
  return getRoots(scope, 'drawer').filter((root) => !hasRootBinding(root, KEY)).map((root) => createDrawer(root));
}
