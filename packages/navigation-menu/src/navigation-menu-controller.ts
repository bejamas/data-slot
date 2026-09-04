import {
  getPart,
  getParts,
  getRoots,
  getDataBool,
  getDataNumber,
  containsWithPortals,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
} from "@data-slot/core";
import { createPresenceLifecycle, setAria } from "@data-slot/core";
import { on, emit } from "@data-slot/core";
import { createDismissLayer } from "@data-slot/core";
import { createNavigationMenuIndicator } from "./navigation-menu-indicator";
import { createNavigationMenuItems } from "./navigation-menu-items";
import { createNavigationMenuPopupStack } from "./navigation-menu-popup-stack";
import { createNavigationMenuHoverSafety } from "./navigation-menu-hover-safety";
import {
  createNavigationMenuLayout,
  type Align,
  type LayoutSnapshot,
  type PositionMethod,
  type Side,
} from "./navigation-menu-layout";

export type { Align, PositionMethod } from "./navigation-menu-layout";

import type { TopLevelNavigable } from "./navigation-menu-items";

export interface NavigationMenuOptions {
  /** Delay before opening on hover (ms) */
  delayOpen?: number;
  /** Delay before closing on mouse leave (ms) */
  delayClose?: number;
  /** Whether focusing a trigger opens its content (default: false) */
  openOnFocus?: boolean;
  /** Preferred side of viewport relative to trigger */
  side?: Side;
  /** Alignment of viewport relative to trigger */
  align?: Align;
  /** Distance from trigger to viewport (px) */
  sideOffset?: number;
  /** Offset along alignment axis (px) */
  alignOffset?: number;
  /** Positioning strategy for the shared viewport positioner */
  positionMethod?: PositionMethod;
  /** Enable hover safe-triangle behavior (opt-in) */
  safeTriangle?: boolean;
  /** Callback when active item changes */
  onValueChange?: (value: string | null) => void;
  /** Debug hover safe-triangle polygon */
  debugSafeTriangle?: boolean;
}

export interface NavigationMenuController {
  /** Currently active item value */
  readonly value: string | null;
  /** Open a specific item */
  open(value: string): void;
  /** Close the menu */
  close(): void;
  /** Cleanup all event listeners */
  destroy(): void;
}

const ROOT_BINDING_KEY = "@data-slot/navigation-menu";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/navigation-menu] createNavigationMenu() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

/**
 * Create a navigation menu controller for a root element
 *
 * Canonical popup-stack markup:
 * ```html
 * <nav data-slot="navigation-menu">
 *   <ul data-slot="navigation-menu-list">
 *     <li data-slot="navigation-menu-item" data-value="products">
 *       <button data-slot="navigation-menu-trigger">Products</button>
 *       <div data-slot="navigation-menu-content">...</div>
 *     </li>
 *     <!-- Optional hover indicator -->
 *     <div data-slot="navigation-menu-indicator"></div>
 *   </ul>
 *   <div data-slot="navigation-menu-portal">
 *     <div data-slot="navigation-menu-positioner">
 *       <div data-slot="navigation-menu-popup">
 *         <div data-slot="navigation-menu-viewport"></div>
 *       </div>
 *     </div>
 *   </div>
 * </nav>
 * ```
 *
 * Minimal markup that only authors `navigation-menu-viewport` still works; the
 * popup stack is synthesized while open and restored on close.
 */
export function createNavigationMenu(
  root: Element,
  options: NavigationMenuOptions = {},
): NavigationMenuController {
  const existingController = reuseRootBinding<NavigationMenuController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING,
  );
  if (existingController) return existingController;

  // Resolve options with explicit precedence: JS > data-* > default
  const delayOpen = options.delayOpen ?? getDataNumber(root, "delayOpen") ?? 0;
  const delayClose =
    options.delayClose ?? getDataNumber(root, "delayClose") ?? 0;
  const openOnFocus =
    options.openOnFocus ?? getDataBool(root, "openOnFocus") ?? false;
  const onValueChange = options.onValueChange;

  // Safe inert setter (fallback for older browsers)
  const setInert = (el: HTMLElement, inert: boolean) => {
    if ("inert" in el) (el as any).inert = inert;
  };

  const list = getPart<HTMLElement>(root, "navigation-menu-list");
  const items = getParts<HTMLElement>(root, "navigation-menu-item");
  const viewport = getPart<HTMLElement>(root, "navigation-menu-viewport");
  const indicator = getPart<HTMLElement>(root, "navigation-menu-indicator");
  if (!list || items.length === 0) {
    throw new Error(
      "NavigationMenu requires navigation-menu-list and at least one navigation-menu-item",
    );
  }

  let currentValue: string | null = null;
  let pendingValue: string | null = null; // Track value being opened (during delay)
  let previousIndex: number = -1;
  let openTimeout: ReturnType<typeof setTimeout> | null = null;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;
  let hoveredTrigger: HTMLElement | null = null;
  let clickLocked: boolean = false; // When true, menu stays open until click outside or toggle
  let suppressFocusOpenForTrigger: HTMLElement | null = null;
  let pointerActivationTrigger: HTMLElement | null = null;
  let isRootHovered: boolean = false; // Track if pointer is over root
  let isDestroyed = false;

  const cleanups: Array<() => void> = [];
  const presences = new Map<
    HTMLElement,
    ReturnType<typeof createPresenceLifecycle>
  >();
  const setOpenClosedAttrs = (el: Element | null, open: boolean) => {
    if (!el) return;
    if (open) {
      el.setAttribute("data-open", "");
      el.removeAttribute("data-closed");
    } else {
      el.setAttribute("data-closed", "");
      el.removeAttribute("data-open");
    }
  };
  const setOpenSurfaceState = (el: Element | null, open: boolean) => {
    if (!el) return;
    el.setAttribute("data-state", open ? "open" : "closed");
    setOpenClosedAttrs(el, open);
  };
  const setContentSurfaceState = (content: HTMLElement, active: boolean) => {
    content.setAttribute("data-state", active ? "active" : "inactive");
    setOpenClosedAttrs(content, active);
  };
  const setContentActivationDirection = (
    content: HTMLElement,
    direction: "left" | "right" | null,
  ) => {
    if (direction) content.setAttribute("data-activation-direction", direction);
    else content.removeAttribute("data-activation-direction");
  };
  let resetLayout = () => {};
  const popupStackController = createNavigationMenuPopupStack({
    root,
    viewport,
    isDestroyed: () => isDestroyed,
    beforeRestore: () => resetLayout(),
  });
  const getCurrentPopup = () => popupStackController.popup;
  const getCurrentPositioner = () => popupStackController.positioner;

  const discoveredItems = createNavigationMenuItems(list, items);
  const {
    allItems,
    itemMap,
    navigables: topLevelNavigables,
    navigableByTarget,
  } = discoveredItems;
  for (const { content } of allItems) {
    presences.set(
      content,
      createPresenceLifecycle({
        element: content,
        onExitComplete: () => {
          if (isDestroyed) return;
          setContentSurfaceState(content, false);
          setContentActivationDirection(content, null);
          content.removeAttribute("data-motion");
          layout.setAbsolute(content, false);
          layout.restore(content);
          content.hidden = true;
          content.style.pointerEvents = "none";
        },
      }),
    );
  }

  // Get all triggers for keyboard navigation
  const triggers = Array.from(itemMap.values()).map((v) => v.trigger);
  const getNavigableByTarget = navigableByTarget;

  const getPlainNavigableByTarget = (
    target: EventTarget | null,
  ): Extract<TopLevelNavigable, { kind: "plain" }> | null => {
    const navigable = getNavigableByTarget(target);
    return navigable?.kind === "plain" ? navigable : null;
  };

  const getSubmenuNavigableByTarget = (
    target: EventTarget | null,
  ): Extract<TopLevelNavigable, { kind: "submenu" }> | null => {
    const navigable = getNavigableByTarget(target);
    return navigable?.kind === "submenu" ? navigable : null;
  };

  const supportsHoverInteractions = (): boolean => {
    const view = root.ownerDocument.defaultView;
    if (!view?.matchMedia) return true;

    try {
      return view.matchMedia("(any-hover: hover)").matches;
    } catch {
      return true;
    }
  };

  const matchesHover = (element: Element): boolean => {
    try {
      return element.matches(":hover");
    } catch {
      return false;
    }
  };

  const getInitiallyHoveredNavigable = (): TopLevelNavigable | null => {
    for (const navigable of topLevelNavigables) {
      if (navigable.kind === "submenu") {
        if (matchesHover(navigable.item) || matchesHover(navigable.trigger)) {
          return navigable;
        }
        continue;
      }

      if (matchesHover(navigable.element)) return navigable;
    }

    return null;
  };

  interface TopLevelFocusOptions {
    preserveOpenOnPlain?: boolean;
  }

  const focusTopLevelNavigable = (
    navigable: TopLevelNavigable,
    options: TopLevelFocusOptions = {},
  ): boolean => {
    const doc = root.ownerDocument;
    const preserveOpenOnPlain = options.preserveOpenOnPlain ?? false;

    if (navigable.kind === "submenu") {
      navigable.trigger.focus();
      if (doc.activeElement !== navigable.trigger) return false;
      syncIndicator(navigable.trigger);
      return true;
    }

    if (currentValue !== null && !preserveOpenOnPlain) {
      closeMenuAndUnlock();
    }
    navigable.element.focus();
    if (doc.activeElement !== navigable.element) return false;
    if (currentValue !== null && preserveOpenOnPlain) {
      syncIndicator();
    } else {
      updateIndicator(navigable.element);
    }
    return true;
  };

  const focusAdjacentTopLevelFromIndex = (
    currentIndex: number,
    direction: 1 | -1,
    options: TopLevelFocusOptions = {},
  ): boolean => {
    for (
      let nextIndex = currentIndex + direction;
      nextIndex >= 0 && nextIndex < topLevelNavigables.length;
      nextIndex += direction
    ) {
      const nextNavigable = topLevelNavigables[nextIndex];
      if (!nextNavigable) continue;
      if (focusTopLevelNavigable(nextNavigable, options)) return true;
    }
    return false;
  };

  const focusAdjacentTopLevelFromNavigable = (
    navigable: TopLevelNavigable,
    direction: 1 | -1,
    options: TopLevelFocusOptions = {},
  ): boolean => {
    const currentIndex = topLevelNavigables.indexOf(navigable);
    if (currentIndex === -1) return false;
    return focusAdjacentTopLevelFromIndex(currentIndex, direction, options);
  };

  const focusAdjacentTopLevelFromTrigger = (
    trigger: HTMLElement,
    direction: 1 | -1,
    options: TopLevelFocusOptions = {},
  ): boolean => {
    const currentIndex = topLevelNavigables.findIndex(
      (entry) => entry.kind === "submenu" && entry.trigger === trigger,
    );
    if (currentIndex === -1) return false;
    return focusAdjacentTopLevelFromIndex(currentIndex, direction, options);
  };

  const isNonSubmenuListTarget = (target: EventTarget | null): boolean => {
    return discoveredItems.isNonSubmenuListTarget(target);
  };

  // Focusable elements selector for content navigation
  const focusableSelector =
    'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // Get focusable elements in a content panel
  const getFocusableElements = (content: HTMLElement): HTMLElement[] => {
    return Array.from(
      content.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((el) => !el.hidden && !el.closest("[hidden]"));
  };

  const isElementActuallyFocusable = (el: HTMLElement): boolean => {
    if (!el.isConnected) return false;
    if (el.hidden || el.closest("[hidden]")) return false;
    if ("disabled" in el && (el as HTMLButtonElement).disabled) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.getAttribute("tabindex") === "-1") return false;
    if (el.matches(focusableSelector)) return true;
    return el.tabIndex >= 0;
  };

  const isWithinThisMenu = (candidate: HTMLElement): boolean => {
    if (root.contains(candidate)) return true;
    if (viewport?.contains(candidate)) return true;

    const popup = getCurrentPopup();
    if (popup?.contains(candidate)) return true;

    const positioner = getCurrentPositioner();
    if (positioner?.contains(candidate)) {
      return true;
    }

    for (const { content } of itemMap.values()) {
      if (content.contains(candidate)) return true;
    }

    return false;
  };

  const focusNextFocusableAfterRoot = (): boolean => {
    const doc = root.ownerDocument;
    const candidates = Array.from(doc.querySelectorAll<HTMLElement>("*"));
    for (const candidate of candidates) {
      if (!isElementActuallyFocusable(candidate)) continue;
      if (isWithinThisMenu(candidate)) continue;
      if (
        ((root as Node).compareDocumentPosition(candidate) &
          Node.DOCUMENT_POSITION_FOLLOWING) ===
        0
      ) {
        continue;
      }

      candidate.focus();
      if (doc.activeElement === candidate) return true;
    }
    return false;
  };

  const focusContentForValue = (value: string): void => {
    requestAnimationFrame(() => {
      if (currentValue !== value) return;
      const data = itemMap.get(value);
      if (!data) return;
      const focusables = getFocusableElements(data.content);
      const first = focusables[0];
      if (first) first.focus();
      else data.content.focus(); // content has tabIndex=-1
    });
  };

  const clearTimers = () => {
    if (openTimeout) {
      clearTimeout(openTimeout);
      openTimeout = null;
    }
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
  };

  const resetPendingInteraction = () => {
    clearTimers();
    pendingValue = null;
  };

  const resetPointerIntent = () => {
    suppressFocusOpenForTrigger = null;
    pointerActivationTrigger = null;
  };

  const getActiveData = () =>
    currentValue ? (itemMap.get(currentValue) ?? null) : null;
  const safety = createNavigationMenuHoverSafety({
    root,
    viewport,
    popup: popupStackController,
    safeTriangle: options.safeTriangle,
    debugSafeTriangle: options.debugSafeTriangle,
    activePanel: getActiveData,
    onBridgeEnter: clearTimers,
    onBridgeLeave: (next) => {
      if (clickLocked || currentValue === null) return;
      if (safety.contains(next)) return;
      if (next && containsWithPortals(root, next)) return;
      updateState(null);
      updateIndicator(null);
    },
  });
  cleanups.push(() => safety.destroy());
  const updateHoverShield = (snapshot: LayoutSnapshot) =>
    safety.update(snapshot);

  const getMotionDirection = (newIndex: number): "left" | "right" => {
    if (previousIndex === -1) return "right";
    return newIndex > previousIndex ? "right" : "left";
  };

  const navigationIndicator = createNavigationMenuIndicator(
    indicator,
    list,
    viewport,
    () => (currentValue ? (itemMap.get(currentValue)?.trigger ?? null) : null),
  );
  cleanups.push(() => navigationIndicator.destroy());

  // Update hover indicator position
  const updateIndicator = (trigger: HTMLElement | null) => {
    hoveredTrigger = trigger;
    navigationIndicator.show(trigger);
  };

  const syncIndicator = (preferred: HTMLElement | null = null) => {
    navigationIndicator.sync(preferred);
    hoveredTrigger = navigationIndicator.hovered;
  };
  const layout = createNavigationMenuLayout({
    root,
    viewport,
    triggers,
    popup: popupStackController,
    placement: options,
    readSelection: () => ({
      open: currentValue !== null,
      panel: getActiveData(),
    }),
    onLayout: updateHoverShield,
  });
  resetLayout = layout.reset;
  cleanups.push(() => {
    layout.dispose();
    presences.forEach((presence) => presence.cleanup());
    presences.clear();
    layout.destroy();
    popupStackController.destroy();
  });

  const updateState = (value: string | null, immediate = false) => {
    safety.clear();
    // Skip if value hasn't changed
    if (value === currentValue) {
      if (value === null) {
        resetPendingInteraction();
      } else {
        clearTimers();
      }
      return;
    }
    // The state owner coalesces repeated delayed opens; this must happen
    // before scheduling so a pointer jitter cannot restart the delay.
    if (!immediate && value !== null && value === pendingValue) {
      return;
    }

    clearTimers();
    if (value === null) pendingValue = null;
    else pendingValue = value;

    const doUpdate = () => {
      const prevValue = currentValue;
      const newData = value ? itemMap.get(value) : null;
      const popupSizeBaseline = popupStackController.baseline();
      const isOpen = value !== null;
      const isInitialOpen = prevValue === null && isOpen;

      // Only animate direction when switching between different items
      const isSwitching =
        prevValue !== null && value !== null && prevValue !== value;

      // Determine motion direction (only when switching)
      const direction =
        isSwitching && newData ? getMotionDirection(newData.index) : null;

      // If closing while focus is inside the active content panel, restore focus to its trigger.
      const active = document.activeElement as HTMLElement | null;
      if (value === null && active && prevValue) {
        const previousData = itemMap.get(prevValue);
        if (previousData && containsWithPortals(previousData.content, active)) {
          previousData.trigger.focus();
        }
      }

      // Update all items
      itemMap.forEach(({ trigger, content, item }, key) => {
        const isActive = key === value;
        const wasActive = key === prevValue;

        setAria(trigger, "expanded", isActive);
        trigger.setAttribute("data-state", isActive ? "open" : "closed");
        item.setAttribute("data-state", isActive ? "open" : "closed");

        if (!isActive) {
          const presence = presences.get(content);
          setContentSurfaceState(content, false);
          content.setAttribute("aria-hidden", "true");
          setInert(content, true);
          content.style.pointerEvents = "none";

          if (value === null) {
            if (wasActive) {
              setContentActivationDirection(content, null);
              content.removeAttribute("data-motion");
            }
          } else if (wasActive && direction) {
            // Set exit motion on the previous content only while switching panels.
            setContentActivationDirection(content, direction);
            // TODO(next-major): remove legacy `data-motion` switching output.
            const exitDirection =
              direction === "right" ? "to-left" : "to-right";
            content.setAttribute("data-motion", exitDirection);
          } else if (wasActive) {
            setContentActivationDirection(content, null);
            content.removeAttribute("data-motion");
          }

          if (wasActive) {
            layout.setAbsolute(content, true);
            presence?.exit();
          } else if (!presence?.isExiting) {
            setContentActivationDirection(content, null);
            content.removeAttribute("data-motion");
            layout.setAbsolute(content, false);
            layout.restore(content);
            content.hidden = true;
          } else {
            // Preserve current exit motion while this panel is finishing an exit animation.
          }
        }
      });

      // Update new active content
      if (newData) {
        popupStackController.prepareOpen();
        if (viewport && isInitialOpen) {
          setOpenSurfaceState(root, true);
          setOpenSurfaceState(getCurrentPositioner(), true);
          setOpenSurfaceState(getCurrentPopup(), true);
          setOpenSurfaceState(viewport, true);
          viewport.style.pointerEvents = "auto";
          layout.beginInitialOpen();
        }
        popupStackController.reveal(prevValue === null);
        layout.mount(newData.content);
        const presence = presences.get(newData.content);
        presence?.enter();
        layout.start();

        if (direction) {
          setContentActivationDirection(newData.content, direction);
          // TODO(next-major): remove legacy `data-motion` switching output.
          const enterDirection =
            direction === "right" ? "from-right" : "from-left";
          newData.content.setAttribute("data-motion", enterDirection);
        } else {
          setContentActivationDirection(newData.content, null);
          newData.content.removeAttribute("data-motion");
        }
        setContentSurfaceState(newData.content, true);
        layout.setAbsolute(newData.content, false);
        newData.content.removeAttribute("aria-hidden");
        setInert(newData.content, false);
        newData.content.hidden = false;
        newData.content.style.pointerEvents = "auto";
        previousIndex = newData.index;

        if (isSwitching) {
          layout.clearInstant();
        }

        layout.sync(newData, {
          defer: isInitialOpen || isSwitching ? false : undefined,
          mode: isInitialOpen ? "initial-open" : "measure-target",
        });
        layout.observe(newData);
        updateIndicator(newData.trigger); // Indicator follows active trigger
      } else {
        layout.stop();
        safety.hideBridge();
        safety.clear();
        popupStackController.close(popupSizeBaseline);
        layout.observe(null);
      }

      // Update root state
      setOpenSurfaceState(root, isOpen);
      if (direction) {
        // TODO(next-major): remove legacy root `data-motion` output.
        root.setAttribute(
          "data-motion",
          direction === "right" ? "from-right" : "from-left",
        );
      } else {
        root.removeAttribute("data-motion");
      }

      // Update viewport state
      if (viewport) {
        const popup = getCurrentPopup();
        const positioner = getCurrentPositioner();
        setOpenSurfaceState(positioner, isOpen);
        setOpenSurfaceState(popup, isOpen);
        setOpenSurfaceState(viewport, isOpen);
        viewport.style.pointerEvents = isOpen ? "auto" : "none";
        layout.commitInstant({
          open: isOpen,
          initial: isInitialOpen,
          switching: isSwitching,
        });

        if (direction) {
          // TODO(next-major): remove legacy viewport motion-direction output.
          viewport.style.setProperty(
            "--motion-direction",
            direction === "right" ? "1" : "-1",
          );
        } else {
          viewport.style.removeProperty("--motion-direction");
        }
      }

      currentValue = value;
      pendingValue = null; // Clear pending since we've completed the update
      if (value === null) updateIndicator(null); // Clear indicator on close
      safety.refreshDebug();
      emit(root, "navigation-menu:change", { value });
      onValueChange?.(value);
    };

    if (immediate) {
      doUpdate();
    } else if (value !== null && currentValue === null) {
      // Opening - use delay
      openTimeout = setTimeout(doUpdate, delayOpen);
    } else if (value !== null && currentValue !== null) {
      // Switching between items - instant
      doUpdate();
    } else {
      // Closing - use delay
      closeTimeout = setTimeout(doUpdate, delayClose);
    }
  };

  // Initialize all as closed
  const initialPopupStack = {
    popup: popupStackController.popup,
    positioner: popupStackController.positioner,
  };
  setOpenSurfaceState(root, false);
  if (viewport) {
    setOpenSurfaceState(initialPopupStack.positioner, false);
    setOpenSurfaceState(initialPopupStack.popup, false);
    setOpenSurfaceState(viewport, false);
    viewport.hidden = true;
    viewport.style.pointerEvents = "none";
    if (initialPopupStack.popup) {
      initialPopupStack.popup.hidden = true;
      initialPopupStack.popup.style.pointerEvents = "none";
    }
  }
  if (indicator) {
    indicator.setAttribute("data-state", "hidden");
  }

  itemMap.forEach(({ trigger, content, item }) => {
    if (trigger.tagName === "BUTTON" && !trigger.hasAttribute("type"))
      (trigger as HTMLButtonElement).type = "button";
    setAria(trigger, "expanded", false);
    trigger.setAttribute("data-state", "closed");
    // Keep all top-level triggers tabbable for natural Tab/Shift+Tab traversal.
    trigger.tabIndex = 0;
    item.setAttribute("data-state", "closed");
    setContentSurfaceState(content, false);
    content.setAttribute("aria-hidden", "true");
    content.tabIndex = -1; // Make focusable for ArrowDown fallback
    setInert(content, true);
    content.hidden = true;
    content.style.pointerEvents = "none";
  });

  // Pointer handlers for items
  itemMap.forEach(({ item, trigger }, value) => {
    // Pointer enter on trigger - update indicator (skip if click-locked)
    cleanups.push(
      on(trigger, "pointerenter", (e) => {
        if (!clickLocked) {
          if (currentValue !== value && safety.inCorridor(e as PointerEvent)) {
            return;
          }
          updateIndicator(trigger);
        }
      }),
    );

    // Pointer enter on item - update state (content will trigger this too)
    // Skip if click-locked to keep the locked item's content visible
    cleanups.push(
      on(item, "pointerenter", (e) => {
        if (!clickLocked) {
          if (currentValue !== value && safety.inCorridor(e as PointerEvent)) {
            return;
          }
          updateState(value);
        }
      }),
    );

    // Pointer leave on item - cancel pending open and close when leaving active item to outside.
    cleanups.push(
      on(item, "pointerleave", (e) => {
        if (pendingValue === value && currentValue === null) {
          resetPendingInteraction();
        }
        if (currentValue === value && !clickLocked) {
          const next = (e as PointerEvent).relatedTarget as Node | null;
          if (safety.contains(next)) return;
          if (!next || !containsWithPortals(root, next)) {
            updateState(null);
            updateIndicator(null);
          }
        }
      }),
    );

    // Focus on trigger - skip one focus-open after pointerdown so click owns tap behavior.
    cleanups.push(
      on(trigger, "focus", () => {
        if (suppressFocusOpenForTrigger === trigger) {
          suppressFocusOpenForTrigger = null;
          return;
        }
        if (openOnFocus) updateState(value, true);
        syncIndicator(trigger);
      }),
    );

    // Pointer taps can move focus before click on some touch browsers.
    cleanups.push(
      on(trigger, "pointerdown", () => {
        suppressFocusOpenForTrigger = trigger;
        pointerActivationTrigger = trigger;
      }),
      on(trigger, "keydown", () => {
        // Prevent stale pointer origin from affecting keyboard activation.
        pointerActivationTrigger = null;
      }),
    );

    // Click on trigger - toggles and locks open state
    cleanups.push(
      on(trigger, "click", () => {
        const isPointerActivation = pointerActivationTrigger === trigger;
        pointerActivationTrigger = null;
        suppressFocusOpenForTrigger = null;
        resetPendingInteraction(); // Cancel any pending open/close timers

        // Check against the ACTUAL current value, not what focus might have changed
        if (currentValue === value && clickLocked) {
          // Clicking same trigger when already LOCKED -> close and unlock
          clickLocked = false;
          updateState(null, true);
          updateIndicator(null);
        } else if (currentValue === value && !clickLocked) {
          // Menu open via hover, click to LOCK it open
          clickLocked = true;
          updateIndicator(trigger);
          if (!isPointerActivation) {
            focusContentForValue(value);
          }
        } else {
          // Opening a new/different item -> switch and lock
          clickLocked = true;
          updateState(value, true);
          updateIndicator(trigger);
          if (!isPointerActivation) {
            focusContentForValue(value);
          }
        }
      }),
    );
  });

  // Close open submenu when interacting with non-submenu list targets (plain links/items).
  cleanups.push(
    on(list, "pointerover", (e) => {
      const event = e as PointerEvent;
      if (event.pointerType === "touch") return;
      const submenuNavigable = getSubmenuNavigableByTarget(event.target);
      if (submenuNavigable) {
        isRootHovered = true;
        if (clickLocked) return;
        if (
          currentValue !== submenuNavigable.value &&
          safety.inCorridor(event)
        ) {
          return;
        }
        updateIndicator(submenuNavigable.trigger);
        updateState(submenuNavigable.value);
        return;
      }

      const plainNavigable = getPlainNavigableByTarget(event.target);
      if (plainNavigable) {
        isRootHovered = true;
        if (currentValue !== null) {
          if (clickLocked) return;
          closeMenuAndUnlock();
        }
        updateIndicator(plainNavigable.element);
        return;
      }

      if (currentValue === null) return;
      if (clickLocked) return;
      if (!isNonSubmenuListTarget(event.target)) return;
      closeMenuAndUnlock();
    }),
    on(list, "click", (e) => {
      if (currentValue === null) return;
      if (!isNonSubmenuListTarget(e.target)) return;
      closeMenuAndUnlock();
    }),
  );

  // Track pointer enter/leave on root for scoping document handlers
  // Cancel hover timers on any pointerdown inside root
  cleanups.push(
    on(list, "focusin", (e) => {
      const plainNavigable = getPlainNavigableByTarget(e.target);
      if (!plainNavigable) return;
      if (currentValue !== null) {
        syncIndicator();
        return;
      }
      updateIndicator(plainNavigable.element);
    }),
    on(root, "pointerenter", () => {
      isRootHovered = true;
    }),
    on(root, "pointerleave", (e) => {
      const next = (e as PointerEvent).relatedTarget as Node | null;
      if (safety.contains(next)) return;
      isRootHovered = false;
      if (!clickLocked) {
        if (safety.inCorridor(e as PointerEvent)) {
          clearTimers();
          return;
        }
        updateState(null);
        updateIndicator(null);
      }
    }),
    on(root, "pointerdown", () => {
      safety.clear();
      resetPendingInteraction();
    }),
  );

  const syncInitialHoverState = () => {
    if (!supportsHoverInteractions()) return;
    if (currentValue !== null || pendingValue !== null || clickLocked) return;

    const hoveredNavigable = getInitiallyHoveredNavigable();
    isRootHovered =
      hoveredNavigable !== null ||
      (root instanceof HTMLElement && matchesHover(root));

    if (!hoveredNavigable) return;

    if (hoveredNavigable.kind === "submenu") {
      updateState(hoveredNavigable.value, true);
      return;
    }

    updateIndicator(hoveredNavigable.element);
  };

  // Handle viewport hover to keep menu open + recompute size after transitions
  if (viewport) {
    cleanups.push(
      on(viewport, "pointerenter", () => {
        safety.clear();
        clearTimers();
      }),
      on(viewport, "transitionend", (e) => {
        if (e.target !== viewport) return; // Ignore bubbling from children
        const data = currentValue ? itemMap.get(currentValue) : null;
        if (data) {
          layout.sync(data, {
            defer: false,
            mode: "sync-current",
          });
        }
      }),
    );
  }

  // Track when pointer enters content areas to prevent closing
  itemMap.forEach(({ content }) => {
    cleanups.push(
      on(content, "pointerenter", () => {
        safety.clear();
        clearTimers();
      }),
      on(content, "pointerleave", (e) => {
        if (clickLocked) return;
        const next = (e as PointerEvent).relatedTarget as Node | null;
        if (safety.contains(next)) return;
        if (!containsWithPortals(root, next)) {
          updateState(null);
          updateIndicator(null);
        }
      }),
    );
  });

  // Keyboard navigation within the list
  cleanups.push(
    on(list, "keydown", (e) => {
      const currentNavigable = getNavigableByTarget(e.target);
      if (!currentNavigable) return;

      const currentNavigableIndex =
        topLevelNavigables.indexOf(currentNavigable);
      if (currentNavigableIndex === -1) return;

      let nextIndex = currentNavigableIndex;

      switch (e.key) {
        case "Tab": {
          // Keep forward Tab traversal linear while a submenu is open.
          if (e.shiftKey || currentValue === null) return;
          if (
            focusAdjacentTopLevelFromNavigable(currentNavigable, 1, {
              preserveOpenOnPlain: true,
            }) ||
            focusNextFocusableAfterRoot()
          ) {
            e.preventDefault();
          }
          return;
        }
        case "ArrowLeft":
          nextIndex = currentNavigableIndex - 1;
          if (nextIndex < 0) nextIndex = topLevelNavigables.length - 1;
          break;
        case "ArrowRight":
          nextIndex = currentNavigableIndex + 1;
          if (nextIndex >= topLevelNavigables.length) nextIndex = 0;
          break;
        case "ArrowDown": {
          // Open content only when focused item has submenu content.
          if (currentNavigable.kind === "submenu") {
            e.preventDefault();
            const triggerValue = currentNavigable.value;
            clickLocked = true; // Lock so pointerleave doesn't close
            updateState(triggerValue, true);
            focusContentForValue(triggerValue);
          }
          return;
        }
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = topLevelNavigables.length - 1;
          break;
        case "Escape":
          clickLocked = false;
          updateState(null, true);
          updateIndicator(null);
          return;
        default:
          return;
      }

      e.preventDefault();
      const nextNavigable = topLevelNavigables[nextIndex];
      if (!nextNavigable) return;
      focusTopLevelNavigable(nextNavigable, {
        preserveOpenOnPlain: true,
      });
    }),
  );

  // Keyboard navigation within content panels
  itemMap.forEach(({ content, trigger }) => {
    cleanups.push(
      on(content, "keydown", (e) => {
        const target = e.target as HTMLElement;
        const focusables = getFocusableElements(content);
        const currentIndex = focusables.indexOf(target);

        // Only handle if target is a focusable element in this content
        if (currentIndex === -1) return;

        switch (e.key) {
          case "Tab": {
            if (!e.shiftKey && currentIndex === focusables.length - 1) {
              if (
                focusAdjacentTopLevelFromTrigger(trigger, 1, {
                  preserveOpenOnPlain: true,
                }) ||
                focusNextFocusableAfterRoot()
              ) {
                e.preventDefault();
              }
              return;
            }

            if (e.shiftKey && currentIndex === 0) {
              e.preventDefault();
              trigger.focus();
              return;
            }

            return;
          }
          case "ArrowDown":
          case "ArrowRight": {
            e.preventDefault();
            const nextIndex = currentIndex + 1;
            if (nextIndex < focusables.length) {
              focusables[nextIndex]?.focus();
            }
            // At the end, stay on last item (don't wrap)
            break;
          }
          case "ArrowUp":
          case "ArrowLeft": {
            e.preventDefault();
            if (currentIndex === 0) {
              // At first element, return focus to trigger
              trigger.focus();
            } else {
              focusables[currentIndex - 1]?.focus();
            }
            break;
          }
          case "Escape": {
            e.preventDefault();
            clickLocked = false;
            updateState(null, true);
            updateIndicator(null);
            trigger.focus();
            break;
          }
        }
      }),
    );
  });

  // Helper to check if this menu instance is active (focused, hovered, or locked)
  const isMenuActive = () =>
    containsWithPortals(root, document.activeElement) ||
    isRootHovered ||
    clickLocked;

  const closeMenuAndUnlock = () => {
    safety.clear();
    resetPendingInteraction();
    resetPointerIntent();
    clickLocked = false;
    updateState(null, true);
    updateIndicator(null);
    safety.refreshDebug();
  };

  // Close when focus leaves root (and unlock clickLocked)
  cleanups.push(
    on(document, "focusin", (e) => {
      const target = e.target as Node;
      if (containsWithPortals(root, target)) return;

      if (currentValue !== null) {
        closeMenuAndUnlock();
        return;
      }

      updateIndicator(null);
    }),
  );

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => currentValue !== null && isMenuActive(),
      onDismiss: closeMenuAndUnlock,
      closeOnClickOutside: true,
      closeOnEscape: true,
      preventEscapeDefault: false,
      isInside: (target) => !!target && containsWithPortals(root, target),
    }),
  );

  // Recompute indicator position on window resize or list scroll
  cleanups.push(
    on(window, "resize", () => {
      if (currentValue || hoveredTrigger) {
        requestAnimationFrame(() => syncIndicator(hoveredTrigger));
      }
    }),
    on(list, "scroll", () => {
      if (currentValue || hoveredTrigger) {
        requestAnimationFrame(() => syncIndicator(hoveredTrigger));
      }
    }),
  );

  // Inbound event
  cleanups.push(
    on(root, "navigation-menu:set", (e) => {
      const detail = (e as CustomEvent).detail as {
        value?: string | null;
      } | null;
      if (detail?.value === undefined) return;

      if (detail.value === null) {
        closeMenuAndUnlock();
      } else if (itemMap.has(detail.value)) {
        clickLocked = true;
        updateState(detail.value, true);
        const data = itemMap.get(detail.value);
        if (data) updateIndicator(data.trigger);
      }
    }),
  );

  const controller: NavigationMenuController = {
    get value() {
      return currentValue;
    },
    open: (value: string) => updateState(value, true),
    close: () => closeMenuAndUnlock(),
    destroy: () => {
      isDestroyed = true;
      resetPendingInteraction();
      resetPointerIntent();
      for (const cleanup of cleanups.splice(0)) cleanup();
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  syncInitialHoverState();
  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all navigation menu components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(
  scope: ParentNode = document,
): NavigationMenuController[] {
  const controllers: NavigationMenuController[] = [];

  for (const root of getRoots(scope, "navigation-menu")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createNavigationMenu(root));
  }

  return controllers;
}
