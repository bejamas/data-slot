import {
  getRoots, getDataBool, getDataString, reuseRootBinding, hasRootBinding, setRootBinding, clearRootBinding,
  ensureId, setAria, linkLabelledBy, on, emit, lockScroll, unlockScroll, createPortalLifecycle,
  createModalStackItem, createDismissLayer, createPresenceLifecycle, focusElement, getAutofocusOrFirstFocusable,
  getTabbables, containsWithPortals,
} from '@data-slot/core';
import { createDrawerSwipe, parseSnapPoint, snapPixels, type DrawerSnapPoint, type DrawerSwipeDirection } from './gestures';
import { trackKeyboard } from './environment';
import { registerVisuals } from './visuals';
export type { DrawerSnapPoint, DrawerSwipeDirection } from './gestures';

/** Source of a state change. Initial opening uses `none`; controller methods use `imperative-action`. */
export type DrawerChangeReason = 'trigger-press' | 'close-press' | 'outside-press' | 'escape-key' | 'focus-out' | 'imperative-action' | 'swipe' | 'none';

/** Details shared by `onOpenChange`, `drawer:beforechange`, and `drawer:change`. */
export interface DrawerChangeDetails {
  /** Requested open state; available before the controller commits the change. */
  open: boolean;
  /** Interaction or API call that requested the change. */
  reason: DrawerChangeReason;
  /** Trigger associated with this request, or `null` when none has been selected. */
  trigger: HTMLElement | null;
  /** Trigger's `data-payload`, parsed as JSON when valid, otherwise a string; absent values are `undefined`. */
  payload: unknown;
  /** DOM event that initiated the request, if any. */
  originalEvent?: Event;
  /** Cancel synchronously in `drawer:beforechange` or `onOpenChange`; has no effect after commit. */
  cancel(): void;
  /**
   * Keep the closing content mounted and unhidden until `controller.unmount()`.
   * Call synchronously in `drawer:beforechange` or `onOpenChange` for a close request.
   * The drawer still closes logically and releases its modal effects and focus.
   */
  preventUnmountOnClose(): void;
}

/** Details shared by `onSnapPointChange`, `drawer:beforesnapchange`, and `drawer:snapchange`. */
export interface DrawerSnapChangeDetails {
  /** Requested open position, or `null` to use the popup's full CSS size. */
  snapPoint: DrawerSnapPoint | null;
  /** Source of the snap-point request. */
  reason: DrawerChangeReason;
  /** DOM event that initiated the request, if any. */
  originalEvent?: Event;
  /** Cancel synchronously in `drawer:beforesnapchange` or `onSnapPointChange`; has no effect after commit. */
  cancel(): void;
}

/** Initialization options. JavaScript values take precedence over corresponding data attributes. */
export interface DrawerOptions {
  /** Initial open state, overriding `defaultOpen`. Read once; use the controller for later changes. */
  open?: boolean;
  /** Initial open state when `open` is omitted (default: `data-default-open`, then `false`). */
  defaultOpen?: boolean;
  /**
   * `true` traps focus, makes outside content inert, and locks scrolling (default).
   * `"trap-focus"` traps focus without inertness or scroll locking; `false` is non-modal.
   * Also configurable with root `data-modal`.
   */
  modal?: boolean | 'trap-focus';
  /** Ignore outside pointer presses and non-modal focus-out dismissal (default: `false`). */
  disablePointerDismissal?: boolean;
  /** Allow Escape to dismiss the drawer (default: `true`). */
  closeOnEscape?: boolean;
  /** Direction of the dismissal swipe (default: `"down"`). */
  swipeDirection?: DrawerSwipeDirection;
  /** Initial single open position, overriding `defaultSnapPoint`; `null` uses the full CSS size. */
  snapPoint?: DrawerSnapPoint | null;
  /** Fallback initial position, before root snap-point attributes (default: `null`). Read once. */
  defaultSnapPoint?: DrawerSnapPoint | null;
  /** Initial associated trigger ID, taking precedence over `defaultTriggerId` when non-null. */
  triggerId?: string | null;
  /** Fallback initial trigger ID, before root trigger-ID attributes. Defaults to no associated trigger. */
  defaultTriggerId?: string | null;
  /**
   * Focus target on open: an element or document selector, `true` for autofocus/first
   * focusable content, or `false` to skip initial focus. Defaults to the popup itself.
   * Also configurable with popup `data-initial-focus`.
   */
  initialFocus?: boolean | string | HTMLElement;
  /**
   * Focus target on close: an element or document selector, `true` for the associated
   * trigger/previous focus, or `false` to skip restoration. When omitted, defaults to
   * trigger/previous focus but preserves outside focus after focus-out dismissal or
   * a non-modal outside press on a focusable control. Also uses popup `data-final-focus`.
   */
  finalFocus?: boolean | string | HTMLElement;
  /** Keep content at its portal destination while closed and hidden (default: `false`; portal `data-keep-mounted`). */
  keepMounted?: boolean;
  /** Portal destination element or document selector (default: `document.body`; portal `data-container`). */
  container?: string | HTMLElement;
  /**
   * Called before committing an open-state or active-trigger change, after an uncanceled
   * `drawer:beforechange`. Call `details.cancel()` to stop the change.
   */
  onOpenChange?: (open: boolean, details: DrawerChangeDetails) => void;
  /** Called after the opening/closing transition finishes; also emits `drawer:change-complete`. */
  onOpenChangeComplete?: (open: boolean) => void;
  /** Called before replacing the snap point, after an uncanceled `drawer:beforesnapchange`; cancel with `details.cancel()`. */
  onSnapPointChange?: (snapPoint: DrawerSnapPoint | null, details: DrawerSnapChangeDetails) => void;
}

/** Imperative drawer state and lifecycle controls. State-change requests can be canceled by listeners. */
export interface DrawerController {
  /** Open or switch the active trigger. An omitted or unknown trigger ID retains the current trigger. */
  open(triggerId?: string): void;
  /** Request closing; content stays visible until its exit transition finishes. */
  close(): void;
  /** Toggle the open state while retaining the associated trigger. */
  toggle(): void;
  /** Replace the single open position across close/open cycles; `null` restores full CSS size. Invalid values are ignored. */
  setSnapPoint(point: DrawerSnapPoint | null): void;
  /** Finish a close held by `preventUnmountOnClose()`. Honors `keepMounted` and does not close an open drawer. */
  unmount(): void;
  /** Current committed open state, independent of enter/exit animation progress. */
  readonly isOpen: boolean;
  /** Current normalized snap point, or `null` for the popup's full CSS size. */
  readonly snapPoint: DrawerSnapPoint | null;
  /** Associated trigger ID, retained after close, or `null` when none is selected. */
  readonly triggerId: string | null;
  /** Remove listeners and observers, release modal effects, hide content, and restore portal placement. Allows rebinding. */
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

/**
 * Create a drawer controller for a root element.
 *
 * Canonical markup (supply CSS for positioning, sizing, and transitions):
 * ```html
 * <div id="filters-drawer" data-slot="drawer" data-swipe-direction="down">
 *   <button data-slot="drawer-trigger">Edit filters</button>
 *   <div data-slot="drawer-portal">
 *     <div data-slot="drawer-backdrop" hidden></div>
 *     <div data-slot="drawer-viewport" hidden>
 *       <div data-slot="drawer-popup" hidden>
 *         <h2 data-slot="drawer-title">Filters</h2>
 *         <p data-slot="drawer-description">Narrow the results.</p>
 *         <button data-slot="drawer-close">Apply filters</button>
 *       </div>
 *     </div>
 *   </div>
 * </div>
 * ```
 *
 * Only `drawer-popup` is required inside the root. Optional title and description
 * slots supply accessible labels. Detached triggers use `data-drawer-target` with
 * the root's ID; parts inside nested drawer roots belong to their own controllers.
 *
 * Options and data attributes are read at initialization. Use controller methods
 * or `drawer:set` events to update live state. Open and snap changes emit cancellable
 * `drawer:beforechange` / `drawer:beforesnapchange` events before their callbacks,
 * followed by `drawer:change` / `drawer:snapchange` after commit.
 *
 * @param root - Element containing this drawer's slots.
 * @param options - Initial configuration, overriding corresponding data attributes.
 * @returns A drawer controller, reusing the existing one if already bound. Destroy it before rebinding with new options.
 * @throws If the root has no `drawer-popup` belonging to this drawer.
 *
 * @example
 * ```ts
 * const root = document.getElementById('filters-drawer')!;
 * const drawer = createDrawer(root, { snapPoint: 0.6 });
 * drawer.open();
 * drawer.setSnapPoint('320px');
 * ```
 */
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
  if (root.id) {
    for (const element of doc.querySelectorAll<HTMLElement>('[data-drawer-target]')) {
      if (element.getAttribute('data-drawer-target')?.replace(/^#/, '') !== root.id) continue;
      if (element.dataset.slot === 'drawer-trigger' && !triggers.includes(element)) triggers.push(element);
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
  const initialSnap = options.snapPoint !== undefined ? options.snapPoint : options.defaultSnapPoint !== undefined ? options.defaultSnapPoint : getDataString(root, 'snapPoint') ?? getDataString(root, 'defaultSnapPoint');
  let currentSnap = parseSnapPoint(initialSnap);
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
  let keyboardCleanup: (() => void) | undefined;
  const keyboardAware = viewport && (root.closest('[data-slot="drawer-virtual-keyboard-provider"]') || ownParts(root, 'virtual-keyboard-provider').length);
  let previousFocus: HTMLElement | null = null;
  const initialTrigger = options.triggerId ?? options.defaultTriggerId ?? getDataString(root, 'triggerId') ?? getDataString(root, 'defaultTriggerId');
  let activeTrigger = triggers.find((trigger) => trigger.id === initialTrigger) ?? null;
  let epoch = 0;
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
  const visuals = registerVisuals(root, popup, { backdrop, viewport });
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
    visuals.setOpen(opened);
  };
  const size = () => horizontal ? popup.getBoundingClientRect().width || win.innerWidth : popup.getBoundingClientRect().height || win.innerHeight;
  const visibleSize = () => currentSnap === null ? size() : Math.min(size(), snapPixels(currentSnap,
    horizontal ? viewport?.clientWidth || doc.documentElement.clientWidth || win.innerWidth : viewport?.clientHeight || doc.documentElement.clientHeight || win.innerHeight,
    parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16));
  const offset = () => Math.max(0, size() - visibleSize());
  const measure = () => {
    const rect = popup.getBoundingClientRect();
    popup.style.setProperty('--drawer-height', `${rect.height}px`);
    popup.style.setProperty('--drawer-width', `${rect.width}px`);
    popup.style.setProperty('--drawer-snap-point-offset', `${offset() * sign}px`);
    if (currentSnap === null) root.removeAttribute('data-snap-point'); else root.setAttribute('data-snap-point', String(currentSnap));
    visuals.refresh(rect.height);
  };

  const inside = (target: Node | null) => containsWithPortals(popup, target);
  const resolveFocus = (value: DrawerOptions['initialFocus']) => typeof value === 'string' ? selector(doc, value) : typeof value === 'object' ? value : null;
  const focusInitial = () => {
    if (!opened || !stack.isTopmost || initialFocus === false) return;
    focusElement(resolveFocus(initialFocus) ?? (initialFocus === true ? getAutofocusOrFirstFocusable(popup) : null) ?? popup);
  };
  const restoreFocus = () => {
    const target = resolveFocus(finalFocus) ?? activeTrigger ?? previousFocus;
    previousFocus = null;
    if (finalFocus !== false && target?.isConnected) focusElement(target);
  };
  const complete = (open: boolean) => { emit(root, 'drawer:change-complete', { open }); options.onOpenChangeComplete?.(open); };
  const completeOpening = (token: number) => {
    if (!opened || epoch !== token || completedOpenEpoch === token) return;
    const animations = animated.flatMap((element) => typeof element.getAnimations === 'function' ? element.getAnimations() : []);
    const finish = () => {
      if (!destroyed && opened && epoch === token && completedOpenEpoch !== token) {
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
  const setSnap = (value: DrawerSnapPoint | null, reason: DrawerChangeReason = 'imperative-action', originalEvent?: Event) => {
    const point = parseSnapPoint(value);
    if (destroyed || (value !== null && point === null) || point === currentSnap) return;
    let canceled = false;
    const detail: DrawerSnapChangeDetails = { snapPoint: point, reason, originalEvent, cancel: () => { canceled = true; } };
    const event = new CustomEvent('drawer:beforesnapchange', { bubbles: true, cancelable: true, detail });
    root.dispatchEvent(event);
    if (event.defaultPrevented || canceled || destroyed) return;
    options.onSnapPointChange?.(point, detail);
    if (canceled || destroyed) return;
    currentSnap = point;
    measure();
    emit(root, 'drawer:snapchange', detail);
  };
  const stack = createModalStackItem({ content: popup, overlay: backdrop, cssVarPrefix: 'drawer', isolateOutside: modal === true, onTabKeydown: (event) => {
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
  const commitOpen = ({ next, reason, originalEvent, trigger }: OpenRequest) => {
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
      // Establish the off-screen styles before mounting or measuring can flush
      // layout, otherwise the browser starts a transition from the open position.
      presence.forEach((part) => part.enter());
      if (!mounted) { portalLifecycle.mount(); if (container) container.appendChild(mountElement); mounted = true; }
      for (const element of [portal, viewport, backdrop, popup]) if (element) element.hidden = false;
      stack.open();
      if (modal === true) {
        lockScroll(); locked = true;
      }
      if (keyboardAware && viewport) keyboardCleanup = trackKeyboard(viewport);
      setState(); measure();
      frame(focusInitial);
      frame(() => frame(() => completeOpening(token)));
    } else {
      stack.close(); keyboardCleanup?.(); keyboardCleanup = undefined;
      if (locked) { unlockScroll(); locked = false; }
      setState();
      pending = presence.length;
      presence.forEach((part) => part.exit());
      const outsideTarget = originalEvent?.target as Element | null;
      const preserveOutsideFocus = finalFocus === undefined && (reason === 'focus-out' || (reason === 'outside-press' && modal === false && outsideTarget?.closest?.('button,input,textarea,select,a[href],[tabindex]')));
      if (preserveOutsideFocus) previousFocus = null; else restoreFocus();
    }
    emit(root, 'drawer:change', detail);
  };
  interface OpenRequest {
    next: boolean;
    reason: DrawerChangeReason;
    originalEvent?: Event;
    trigger: HTMLElement | null;
  }
  let applyingOpen: OpenRequest | null = null;
  let queuedOpen: OpenRequest | null = null;
  const update = (next: boolean, reason: DrawerChangeReason = 'imperative-action', originalEvent?: Event, trigger = activeTrigger) => {
    if (destroyed) return;
    // Reaffirming the in-flight state must not repeat its cancellable callbacks.
    if (applyingOpen?.next === next && applyingOpen.trigger === trigger) {
      queuedOpen = null;
      return;
    }
    queuedOpen = { next, reason, originalEvent, trigger };
    if (applyingOpen) return;
    try {
      // Finish each commit before applying the latest request made by its callbacks.
      while (queuedOpen && !destroyed) {
        applyingOpen = queuedOpen;
        queuedOpen = null;
        commitOpen(applyingOpen);
      }
    } finally {
      applyingOpen = null;
      queuedOpen = null;
    }
  };
  cleanups.push(createDismissLayer({ root, isOpen: () => opened, closeOnEscape, closeOnClickOutside: pointerDismissal,
    isInside: (target) => inside(target) || triggers.some((trigger) => trigger.contains(target)),
    onDismiss: ({ reason, originalEvent }) => {
      if (reason === 'outside-press' && originalEvent.button !== 0) return;
      update(false, reason, originalEvent);
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
    if (!opened || !stack.isTopmost || inside(event.target as Node)) return;
    if (modal !== false) focusElement(getAutofocusOrFirstFocusable(popup) ?? popup);
    else if (pointerDismissal && !triggers.includes(event.target as HTMLElement)) update(false, 'focus-out', event);
  }));
  const resetSwipe = () => visuals.setSwipe(null);
  const moveSwipe = (distance: number) => {
    const movement = Math.max(-offset(), Math.min(visibleSize(), distance));
    const progress = Math.min(1, Math.max(0, movement / Math.max(1, visibleSize())));
    visuals.setSwipe({ progress, x: horizontal ? movement * sign : 0, y: horizontal ? 0 : movement * sign });
  };
  const releaseSwipe = (distance: number, velocity: number, event: Event) => {
    popup.style.setProperty('--drawer-swipe-strength', String(Math.max(0.1, Math.min(1, 1 / Math.max(1, Math.abs(velocity))))));
    if (distance > visibleSize() * 0.35 || (velocity > 0.5 && distance > 12)) update(false, 'swipe', event);
  };
  cleanups.push(createDrawerSwipe({ popup, direction, enabled: () => opened && stack.isTopmost, move: moveSwipe, release: releaseSwipe, reset: resetSwipe }));
  cleanups.push(on(win, 'resize', measure));
  if (typeof win.ResizeObserver !== 'undefined') {
    const observer = new win.ResizeObserver(measure); observer.observe(popup); cleanups.push(() => observer.disconnect());
  }
  const inbound = (name: string, handler: (event: CustomEvent) => void) => cleanups.push(on(root, name, (event) => { if (event.target === root) handler(event as CustomEvent); }));
  inbound('drawer:set', (event) => {
    const detail = event.detail;
    if (!detail || typeof detail !== 'object') return;
    const trigger = typeof detail.triggerId === 'string' ? triggers.find((item) => item.id === detail.triggerId) ?? activeTrigger : activeTrigger;
    if ('snapPoint' in detail) setSnap(detail.snapPoint, 'imperative-action', event);
    if (typeof detail.open === 'boolean') update(detail.open, 'imperative-action', event, trigger);
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
      presence.forEach((part) => part.cleanup()); stack.destroy(); keyboardCleanup?.();
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

/**
 * Bind uninitialized `[data-slot="drawer"]` descendants of a scope.
 * The scope itself and already-bound roots are excluded.
 *
 * @param scope - DOM subtree to scan (default: `document`).
 * @returns Controllers created by this call.
 * @example
 * ```ts
 * import { create } from '@data-slot/drawer';
 * const drawers = create();
 * ```
 */
export function create(scope: ParentNode = document): DrawerController[] {
  return getRoots(scope, 'drawer').filter((root) => !hasRootBinding(root, KEY)).map((root) => createDrawer(root));
}
