import {
  getPart,
  getParts,
  getRoots,
  getDataBool,
  getDataNumber,
  getDataEnum,
  containsWithPortals,
  computeFloatingPosition,
  createPortalLifecycle,
  createPresenceLifecycle,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";
import { createDismissLayer } from "@data-slot/core";

/** Alignment of the viewport relative to the trigger */
export type Align = "start" | "center" | "end";
const ALIGNS = ["start", "center", "end"] as const;
const SIDES = ["top", "right", "bottom", "left"] as const;
type Side = (typeof SIDES)[number];

interface PlacementConfig {
  side: Side;
  align: Align;
  sideOffset: number;
  alignOffset: number;
}

export interface NavigationMenuOptions {
  /** Delay before opening on hover (ms) */
  delayOpen?: number;
  /** Delay before closing on mouse leave (ms) */
  delayClose?: number;
  /** Whether focusing a trigger opens its content (default: true) */
  openOnFocus?: boolean;
  /** Preferred side of viewport relative to trigger */
  side?: Side;
  /** Alignment of viewport relative to trigger */
  align?: Align;
  /** Distance from trigger to viewport (px) */
  sideOffset?: number;
  /** Offset along alignment axis (px) */
  alignOffset?: number;
  /** Callback when active item changes */
  onValueChange?: (value: string | null) => void;
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

/**
 * Create a navigation menu controller for a root element
 *
 * Expected markup:
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
 *   <div data-slot="navigation-menu-viewport"></div>
 * </nav>
 * ```
 */
export function createNavigationMenu(
  root: Element,
  options: NavigationMenuOptions = {}
): NavigationMenuController {
  // Resolve options with explicit precedence: JS > data-* > default
  const delayOpen = options.delayOpen ?? getDataNumber(root, "delayOpen") ?? 200;
  const delayClose = options.delayClose ?? getDataNumber(root, "delayClose") ?? 150;
  const openOnFocus = options.openOnFocus ?? getDataBool(root, "openOnFocus") ?? true;
  const rootSide = options.side ?? getDataEnum(root, "side", SIDES) ?? "bottom";
  const rootAlign = options.align ?? getDataEnum(root, "align", ALIGNS) ?? "start";
  const rootSideOffset = options.sideOffset ?? getDataNumber(root, "sideOffset") ?? 0;
  const rootAlignOffset = options.alignOffset ?? getDataNumber(root, "alignOffset") ?? 0;
  const onValueChange = options.onValueChange;

  // Sanitize value for use in IDs (spaces/slashes -> dashes)
  const safeId = (s: string) => s.replace(/[^a-z0-9\-_:.]/gi, "-");

  // Safe inert setter (fallback for older browsers)
  const setInert = (el: HTMLElement, inert: boolean) => {
    if ("inert" in el) (el as any).inert = inert;
  };

  const list = getPart<HTMLElement>(root, "navigation-menu-list");
  const items = getParts<HTMLElement>(root, "navigation-menu-item");
  const viewport = getPart<HTMLElement>(root, "navigation-menu-viewport");
  const indicator = getPart<HTMLElement>(root, "navigation-menu-indicator");
  const findSlotAncestor = (el: HTMLElement, slot: string): HTMLElement | null => {
    let current: HTMLElement | null = el.parentElement;
    while (current && current !== root) {
      if (current.getAttribute("data-slot") === slot) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  if (!list || items.length === 0) {
    throw new Error(
      "NavigationMenu requires navigation-menu-list and at least one navigation-menu-item"
    );
  }

  let currentValue: string | null = null;
  let pendingValue: string | null = null; // Track value being opened (during delay)
  let previousIndex: number = -1;
  let openTimeout: ReturnType<typeof setTimeout> | null = null;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;
  let hoveredTrigger: HTMLElement | null = null;
  let clickLocked: boolean = false; // When true, menu stays open until click outside or toggle
  let isPointerDown: boolean = false; // Track if we're in a click sequence (pointerdown fired)
  let isRootHovered: boolean = false; // Track if pointer is over root
  let isDestroyed = false;

  const cleanups: Array<() => void> = [];
  const contentPresence = new Map<HTMLElement, ReturnType<typeof createPresenceLifecycle>>();
  const contentPlacement = new Map<
    HTMLElement,
    {
      originalParent: ParentNode | null;
      originalNextSibling: ChildNode | null;
      mountedInViewport: boolean;
    }
  >();
  const authoredViewportPositioner = viewport
    ? findSlotAncestor(viewport, "navigation-menu-viewport-positioner")
    : null;
  const authoredLegacyViewportPositioner = viewport
    ? findSlotAncestor(viewport, "navigation-menu-positioner")
    : null;
  const authoredAnyViewportPositioner = authoredViewportPositioner ?? authoredLegacyViewportPositioner;
  const authoredViewportPortal = authoredAnyViewportPositioner
    ? findSlotAncestor(authoredAnyViewportPositioner, "navigation-menu-portal")
    : null;
  const viewportPortal = viewport
    ? createPortalLifecycle({
        content: viewport,
        root,
        enabled: true,
        wrapperSlot: authoredAnyViewportPositioner ? undefined : "navigation-menu-viewport-positioner",
        container: authoredAnyViewportPositioner ?? undefined,
        mountTarget: authoredAnyViewportPositioner
          ? authoredViewportPortal ?? authoredAnyViewportPositioner
          : undefined,
      })
    : null;
  const viewportPresence = viewport
    ? createPresenceLifecycle({
        element: viewport,
        onExitComplete: () => {
          if (isDestroyed) return;
          viewportPortal?.restore();
          viewport.hidden = true;
          viewport.style.pointerEvents = "none";
        },
      })
    : null;

  const mountContentInViewport = (content: HTMLElement) => {
    if (!viewport) return;
    const existing = contentPlacement.get(content) ?? {
      originalParent: null,
      originalNextSibling: null,
      mountedInViewport: false,
    };

    if (!existing.mountedInViewport) {
      existing.originalParent = content.parentNode;
      existing.originalNextSibling = content.nextSibling;
      existing.mountedInViewport = true;
      contentPlacement.set(content, existing);
    }

    if (content.parentNode !== viewport) {
      viewport.appendChild(content);
    }
  };

  const restoreContentPlacement = (content: HTMLElement) => {
    const existing = contentPlacement.get(content);
    if (!existing || !existing.mountedInViewport) return;

    const parent = existing.originalParent;
    const sibling = existing.originalNextSibling;
    if (parent && (parent as Node).isConnected) {
      if (sibling && sibling.parentNode === parent) {
        parent.insertBefore(content, sibling);
      } else {
        parent.appendChild(content);
      }
    } else {
      content.remove();
    }

    existing.mountedInViewport = false;
    existing.originalParent = null;
    existing.originalNextSibling = null;
  };

  const updateViewportPositioner = () => {
    if (!viewport || !viewportPortal) return;
    const positioner = viewportPortal.container as HTMLElement;
    const win = root.ownerDocument.defaultView ?? window;
    const rootRect = (root as HTMLElement).getBoundingClientRect();

    positioner.style.position = "absolute";
    positioner.style.top = "0px";
    positioner.style.left = "0px";
    positioner.style.transform = `translate3d(${rootRect.left + win.scrollX}px, ${rootRect.top + win.scrollY}px, 0)`;
    positioner.style.width = `${rootRect.width}px`;
    positioner.style.height = `${rootRect.height}px`;
    positioner.style.margin = "0";
    positioner.style.willChange = "transform";
    positioner.style.pointerEvents = "none";
  };

  // ResizeObserver for active panel - handles fonts/images/content changes after open
  let activeRO: ResizeObserver | null = null;
  const observeActiveContent = (
    data: {
      item: HTMLElement;
      content: HTMLElement;
      trigger: HTMLElement;
      contentPositioner: HTMLElement | null;
    } | null
  ) => {
    activeRO?.disconnect();
    activeRO = null;
    if (!viewport || !data) return;
    activeRO = new ResizeObserver(() => {
      const placement = resolvePlacement(data.item, data.content, data.contentPositioner);
      updateViewportSize(data.content, data.trigger, placement);
    });
    activeRO.observe(data.content);
  };
  cleanups.push(() => activeRO?.disconnect());
  cleanups.push(() => {
    contentPresence.forEach((presence) => presence.cleanup());
    contentPresence.clear();
    contentPlacement.forEach((_state, content) => {
      restoreContentPlacement(content);
      content.hidden = true;
      content.style.pointerEvents = "none";
    });
    contentPlacement.clear();
    viewportPresence?.cleanup();
    viewportPortal?.cleanup();
  });

  // Build a map of items with their triggers and content
  const itemMap = new Map<
    string,
    {
      item: HTMLElement;
      trigger: HTMLElement;
      content: HTMLElement;
      contentPositioner: HTMLElement | null;
      index: number;
    }
  >();

  const resolvePlacement = (
    item: HTMLElement,
    content: HTMLElement,
    contentPositioner: HTMLElement | null
  ): PlacementConfig => {
    const livePositioner =
      viewportPortal?.container instanceof HTMLElement && viewportPortal.container !== viewport
        ? (viewportPortal.container as HTMLElement)
        : null;
    const positionerSources = [
      livePositioner,
      authoredAnyViewportPositioner,
      contentPositioner,
    ] as const;
    const readPositionerEnum = <T extends string>(
      key: string,
      values: readonly T[]
    ): T | null => {
      for (const source of positionerSources) {
        if (!source) continue;
        const value = getDataEnum(source, key, values);
        if (value !== null && value !== undefined) return value;
      }
      return null;
    };
    const readPositionerNumber = (key: string): number | null => {
      for (const source of positionerSources) {
        if (!source) continue;
        const value = getDataNumber(source, key);
        if (value !== null && value !== undefined) return value;
      }
      return null;
    };

    const positionerSide = readPositionerEnum("side", SIDES);
    const positionerAlign = readPositionerEnum("align", ALIGNS);
    const positionerSideOffset = readPositionerNumber("sideOffset");
    const positionerAlignOffset = readPositionerNumber("alignOffset");

    return {
      side:
        options.side ??
        positionerSide ??
        getDataEnum(content, "side", SIDES) ??
        getDataEnum(item, "side", SIDES) ??
        rootSide,
      align:
        options.align ??
        positionerAlign ??
        getDataEnum(content, "align", ALIGNS) ??
        getDataEnum(item, "align", ALIGNS) ??
        rootAlign,
      sideOffset:
        options.sideOffset ??
        positionerSideOffset ??
        getDataNumber(content, "sideOffset") ??
        getDataNumber(item, "sideOffset") ??
        rootSideOffset,
      alignOffset:
        options.alignOffset ??
        positionerAlignOffset ??
        getDataNumber(content, "alignOffset") ??
        getDataNumber(item, "alignOffset") ??
        rootAlignOffset,
    };
  };

  let validIndex = 0;
  items.forEach((item) => {
    const value = item.dataset["value"];
    if (!value) return;

    const trigger = getPart<HTMLElement>(item, "navigation-menu-trigger");
    const content = getPart<HTMLElement>(item, "navigation-menu-content");

    if (trigger && content) {
      const contentPositioner = findSlotAncestor(content, "navigation-menu-positioner");
      itemMap.set(value, {
        item,
        trigger,
        content,
        contentPositioner,
        index: validIndex++,
      });
      contentPresence.set(
        content,
        createPresenceLifecycle({
          element: content,
          onExitComplete: () => {
            if (isDestroyed) return;
            restoreContentPlacement(content);
            content.hidden = true;
            content.style.pointerEvents = "none";
          },
        })
      );

      // Setup ARIA - link trigger to content bidirectionally
      const safe = safeId(value);
      const triggerId = ensureId(trigger, `nav-menu-trigger-${safe}`);
      const contentId = ensureId(content, `nav-menu-content-${safe}`);
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-controls", contentId);
      content.setAttribute("aria-labelledby", triggerId);
    }
  });

  // Get all triggers for keyboard navigation
  const triggers = Array.from(itemMap.values()).map((v) => v.trigger);

  // Reverse map for O(1) trigger -> value lookup
  const valueByTrigger = new Map<HTMLElement, string>();
  for (const [value, data] of itemMap) valueByTrigger.set(data.trigger, value);

  // Focusable elements selector for content navigation
  const focusableSelector =
    'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // Get focusable elements in a content panel
  const getFocusableElements = (content: HTMLElement): HTMLElement[] => {
    return Array.from(
      content.querySelectorAll<HTMLElement>(focusableSelector)
    ).filter((el) => !el.hidden && !el.closest("[hidden]"));
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

  // Create hover bridge element for covering margin gaps
  let hoverBridge: HTMLElement | null = null;
  const getBridgeHost = (): HTMLElement | null => {
    if (!viewport) return null;
    const container = viewportPortal?.container;
    if (container instanceof HTMLElement) return container;
    return viewport.parentElement instanceof HTMLElement ? viewport.parentElement : viewport;
  };

  const getOrCreateHoverBridge = (): HTMLElement => {
    const host = getBridgeHost();
    if (!hoverBridge) {
      hoverBridge = document.createElement("div");
      hoverBridge.setAttribute("data-slot", "navigation-menu-bridge");
      hoverBridge.style.cssText = "position: absolute; pointer-events: auto; z-index: 0;";
      // Bridge keeps menu open when hovered
      cleanups.push(
        on(hoverBridge, "pointerenter", () => {
          clearTimers();
        })
      );
    }
    if (host && hoverBridge.parentElement !== host) {
      host.insertBefore(hoverBridge, host.firstChild);
    }
    return hoverBridge;
  };

  const updateViewportSize = (
    content: HTMLElement,
    trigger: HTMLElement,
    placement: PlacementConfig
  ) => {
    if (!viewport) return;

    // Measure after content is visible using rAF + getBoundingClientRect for abs/transform panels
    requestAnimationFrame(() => {
      // Measure the first child inside content to capture its margin
      // (margins aren't included in parent's getBoundingClientRect)
      const firstChild = content.firstElementChild as HTMLElement | null;
      const childRect = firstChild?.getBoundingClientRect();
      const childStyle = firstChild ? getComputedStyle(firstChild) : null;
      const childMarginTop = childStyle ? parseFloat(childStyle.marginTop) || 0 : 0;
      const childMarginBottom = childStyle ? parseFloat(childStyle.marginBottom) || 0 : 0;

      // Use child measurements if available, otherwise fall back to content
      const rect = childRect ?? content.getBoundingClientRect();
      const contentHeight = rect.height + childMarginTop + childMarginBottom;

      // Get viewport margin-top for hover bridge calculation
      const viewportStyle = getComputedStyle(viewport);
      const viewportMarginTop = parseFloat(viewportStyle.marginTop) || 0;

      // Use content's rect for width (may differ from child)
      const contentRect = content.getBoundingClientRect();
      viewport.style.setProperty("--viewport-width", `${contentRect.width}px`);
      // Viewport height is just the content height - margins are outside the box
      viewport.style.setProperty("--viewport-height", `${contentHeight}px`);

      const rootRect = (root as HTMLElement).getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const pos = computeFloatingPosition({
        anchorRect: triggerRect,
        contentRect: rect,
        side: placement.side,
        align: placement.align,
        sideOffset: placement.sideOffset,
        alignOffset: placement.alignOffset,
        avoidCollisions: false,
        collisionPadding: 0,
        allowedSides: SIDES,
      });
      const left = pos.x - rootRect.left;
      const top = pos.y - rootRect.top;

      viewport.style.setProperty("--viewport-top", `${top}px`);
      viewport.style.setProperty("--viewport-left", `${left}px`);
      // Set position directly on viewport (in case CSS variables are not read)
      viewport.style.top = `${top}px`;
      viewport.style.left = `${left}px`;
      // Active content is mounted inside viewport.
      content.style.top = "0px";
      content.style.left = "0px";
      viewport.setAttribute("data-side", pos.side);
      viewport.setAttribute("data-align", pos.align);
      content.setAttribute("data-side", pos.side);
      content.setAttribute("data-align", pos.align);
      const positioner = viewportPortal?.container as HTMLElement | undefined;
      if (positioner && positioner !== viewport) {
        positioner.setAttribute("data-side", pos.side);
        positioner.setAttribute("data-align", pos.align);
      }
      updateViewportPositioner();

      // Cover pointer gaps between root and viewport (e.g. side-offset), plus legacy margin gaps.
      const viewportRect = viewport.getBoundingClientRect();
      const rootBottomGap = Math.max(0, viewportRect.top - rootRect.bottom); // viewport below
      const rootTopGap = Math.max(0, rootRect.top - viewportRect.bottom); // viewport above
      const rootRightGap = Math.max(0, viewportRect.left - rootRect.right); // viewport right
      const rootLeftGap = Math.max(0, rootRect.left - viewportRect.right); // viewport left
      const marginGap = Math.max(0, childMarginTop + viewportMarginTop);
      const verticalGap = Math.max(rootBottomGap, rootTopGap, marginGap);
      const horizontalGap = Math.max(rootRightGap, rootLeftGap);
      const totalGap = Math.max(verticalGap, horizontalGap);
      if (totalGap > 0) {
        const bridge = getOrCreateHoverBridge();
        bridge.style.transform = "none";
        bridge.style.bottom = "auto";
        bridge.style.right = "auto";
        if (verticalGap >= horizontalGap) {
          const gap = Math.max(rootBottomGap, rootTopGap, marginGap);
          bridge.style.width = `${contentRect.width}px`;
          bridge.style.height = `${gap}px`;
          bridge.style.left = `${left}px`;

          if (rootTopGap > rootBottomGap && rootTopGap >= marginGap) {
            // Viewport is above root (top side): extend bridge downward.
            bridge.style.top = `${top + contentHeight}px`;
          } else {
            // Viewport is below root (bottom side) or margin-based gap: extend bridge upward.
            bridge.style.top = `${top - gap}px`;
          }
        } else {
          const gap = Math.max(rootRightGap, rootLeftGap);
          bridge.style.height = `${contentHeight}px`;
          bridge.style.width = `${gap}px`;
          bridge.style.top = `${top}px`;

          if (rootLeftGap > rootRightGap) {
            // Viewport is left of root: extend bridge rightward.
            bridge.style.left = `${left + contentRect.width}px`;
          } else {
            // Viewport is right of root: extend bridge leftward.
            bridge.style.left = `${left - gap}px`;
          }
        }
      } else if (hoverBridge) {
        hoverBridge.style.height = "0";
        hoverBridge.style.width = "0";
        hoverBridge.style.top = "0px";
        hoverBridge.style.left = "0px";
        hoverBridge.style.right = "0px";
        hoverBridge.style.bottom = "auto";
        hoverBridge.style.transform = "none";
      }
    });
  };

  const getMotionDirection = (newIndex: number): "left" | "right" => {
    if (previousIndex === -1) return "right";
    return newIndex > previousIndex ? "right" : "left";
  };

  // Update hover indicator position
  const updateIndicator = (trigger: HTMLElement | null) => {
    if (!indicator) return;

    hoveredTrigger = trigger;

    if (!trigger) {
      // Hide indicator when not hovering any trigger
      indicator.setAttribute("data-state", "hidden");
      return;
    }

    const listRect = list.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    indicator.style.setProperty(
      "--indicator-left",
      `${triggerRect.left - listRect.left}px`
    );
    indicator.style.setProperty("--indicator-width", `${triggerRect.width}px`);
    indicator.style.setProperty(
      "--indicator-top",
      `${triggerRect.top - listRect.top}px`
    );

    // Get viewport's margin-top to determine if there's visual separation
    const viewportMarginTop = viewport
      ? parseFloat(getComputedStyle(viewport).marginTop) || 0
      : 0;

    // If viewport has no margin, its 1px box-shadow border needs visual clearance
    const borderOverlap = viewportMarginTop < 1 ? 1 : 0;

    indicator.style.setProperty(
      "--indicator-height",
      `${triggerRect.height - borderOverlap}px`
    );
    indicator.setAttribute("data-state", "visible");
  };

  const updateState = (value: string | null, immediate = false) => {
    // Skip if value hasn't changed
    if (value === currentValue) {
      clearTimers();
      return;
    }
    // Skip if we're already in the process of opening this specific value
    if (value !== null && value === pendingValue) {
      clearTimers();
      return;
    }

    clearTimers();
    if (value === null) pendingValue = null;
    else pendingValue = value;

    const doUpdate = () => {
      const prevValue = currentValue;
      const newData = value ? itemMap.get(value) : null;

      // Only animate direction when switching between different items
      const isSwitching =
        prevValue !== null && value !== null && prevValue !== value;

      // Determine motion direction (only when switching)
      const direction =
        isSwitching && newData ? getMotionDirection(newData.index) : null;

      // If closing and focus is inside content, move focus to last trigger first
      const active = document.activeElement as HTMLElement | null;
      if (value === null && active && containsWithPortals(root, active)) {
        const lastTrigger = prevValue ? itemMap.get(prevValue)?.trigger : null;
        if (lastTrigger) lastTrigger.focus();
      }

      // Update all items
      itemMap.forEach(({ trigger, content, item }, key) => {
        const isActive = key === value;
        const wasActive = key === prevValue;

        setAria(trigger, "expanded", isActive);
        trigger.setAttribute("data-state", isActive ? "open" : "closed");
        // Roving tabindex: active trigger or last active (on close) gets 0
        if (isActive) trigger.tabIndex = 0;
        else if (wasActive && value === null) trigger.tabIndex = 0;
        else trigger.tabIndex = -1;
        item.setAttribute("data-state", isActive ? "open" : "closed");

        if (!isActive) {
          const presence = contentPresence.get(content);
          content.setAttribute("data-state", "inactive");
          content.setAttribute("aria-hidden", "true");
          setInert(content, true);
          content.style.pointerEvents = "none";

          // Set exit motion on the previous content (only when switching)
          if (wasActive && direction) {
            const exitDirection =
              direction === "right" ? "to-left" : "to-right";
            content.setAttribute("data-motion", exitDirection);
          } else if (wasActive) {
            content.removeAttribute("data-motion");
          }

          if (wasActive) {
            presence?.exit();
          } else if (!presence?.isExiting) {
            content.removeAttribute("data-motion");
            restoreContentPlacement(content);
            content.hidden = true;
          } else {
            // Preserve current exit motion while this panel is finishing an exit animation.
          }
        }
      });

      // Update new active content
      if (newData) {
        viewportPortal?.mount();
        if (viewport) {
          viewport.hidden = false;
        }
        if (prevValue === null) {
          viewportPresence?.enter();
        }
        mountContentInViewport(newData.content);
        const presence = contentPresence.get(newData.content);
        presence?.enter();

        if (direction) {
          const enterDirection =
            direction === "right" ? "from-right" : "from-left";
          newData.content.setAttribute("data-motion", enterDirection);
        } else {
          newData.content.removeAttribute("data-motion");
        }
        newData.content.setAttribute("data-state", "active");
        newData.content.removeAttribute("aria-hidden");
        setInert(newData.content, false);
        newData.content.hidden = false;
        newData.content.style.pointerEvents = "auto";
        previousIndex = newData.index;

        const placement = resolvePlacement(
          newData.item,
          newData.content,
          newData.contentPositioner
        );
        updateViewportSize(newData.content, newData.trigger, placement);
        observeActiveContent(newData);
        updateIndicator(newData.trigger); // Indicator follows active trigger
      } else {
        viewportPresence?.exit();
        observeActiveContent(null);
      }

      // Update root state
      const isOpen = value !== null;
      root.setAttribute("data-state", isOpen ? "open" : "closed");
      if (direction) {
        root.setAttribute(
          "data-motion",
          direction === "right" ? "from-right" : "from-left"
        );
      } else {
        root.removeAttribute("data-motion");
      }

      // Update viewport state
      if (viewport) {
        viewport.setAttribute("data-state", isOpen ? "open" : "closed");
        viewport.style.pointerEvents = isOpen ? "auto" : "none";

        // Set data-instant on initial open to skip size animation
        if (isOpen && !isSwitching) {
          viewport.setAttribute("data-instant", "");
        } else if (isSwitching) {
          viewport.removeAttribute("data-instant");
        }

        if (direction) {
          viewport.style.setProperty(
            "--motion-direction",
            direction === "right" ? "1" : "-1"
          );
        }
      }

      currentValue = value;
      pendingValue = null; // Clear pending since we've completed the update
      if (value === null) updateIndicator(null); // Clear indicator on close
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
  root.setAttribute("data-state", "closed");
  if (viewport) {
    viewport.setAttribute("data-state", "closed");
    viewport.hidden = true;
    viewport.style.pointerEvents = "none";
  }
  if (indicator) {
    indicator.setAttribute("data-state", "hidden");
  }

  itemMap.forEach(({ trigger, content, item }) => {
    if (trigger.tagName === "BUTTON" && !trigger.hasAttribute("type"))
      (trigger as HTMLButtonElement).type = "button";
    setAria(trigger, "expanded", false);
    trigger.setAttribute("data-state", "closed");
    // First trigger gets tabIndex 0, rest get -1 (roving tabindex)
    trigger.tabIndex = trigger === triggers[0] ? 0 : -1;
    item.setAttribute("data-state", "closed");
    content.setAttribute("data-state", "inactive");
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
      on(trigger, "pointerenter", () => {
        if (!clickLocked) {
          updateIndicator(trigger);
        }
      })
    );

    // Pointer enter on item - update state (content will trigger this too)
    // Skip if click-locked to keep the locked item's content visible
    cleanups.push(
      on(item, "pointerenter", () => {
        if (!clickLocked) {
          updateState(value);
        }
      })
    );

    // Pointer leave on item - cancel pending open if leaving before delay
    cleanups.push(
      on(item, "pointerleave", () => {
        if (pendingValue === value && currentValue === null) {
          clearTimers();
          pendingValue = null;
        }
      })
    );

    // Focus on trigger - update state unless focus is from a pointer click
    cleanups.push(
      on(trigger, "focus", () => {
        if (!isPointerDown) {
          if (openOnFocus) updateState(value, true);
          updateIndicator(trigger);
        }
      })
    );

    // Track pointer down to coordinate with focus events
    cleanups.push(
      on(trigger, "pointerdown", () => {
        isPointerDown = true;
      })
    );

    // Click on trigger - toggles and locks open state
    cleanups.push(
      on(trigger, "click", () => {
        clearTimers(); // Cancel any pending open/close timers

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
        } else {
          // Opening a new/different item -> switch and lock
          clickLocked = true;
          updateState(value, true);
          updateIndicator(trigger);
        }

        isPointerDown = false;
      })
    );
  });

  // Track pointer enter/leave on root for scoping document handlers
  // Cancel hover timers on any pointerdown inside root
  cleanups.push(
    on(root, "pointerenter", () => {
      isRootHovered = true;
    }),
    on(root, "pointerleave", (e) => {
      const next = (e as PointerEvent).relatedTarget as Node | null;
      if (containsWithPortals(root, next)) return;
      isRootHovered = false;
      if (!clickLocked) {
        updateState(null);
        updateIndicator(null);
      }
    }),
    on(root, "pointerdown", clearTimers)
  );

  // Handle viewport hover to keep menu open + recompute size after transitions
  if (viewport) {
    cleanups.push(
      on(viewport, "pointerenter", () => {
        clearTimers();
      }),
      on(viewport, "transitionend", (e) => {
        if (e.target !== viewport) return; // Ignore bubbling from children
        const data = currentValue ? itemMap.get(currentValue) : null;
        if (data) {
          const placement = resolvePlacement(
            data.item,
            data.content,
            data.contentPositioner
          );
          updateViewportSize(data.content, data.trigger, placement);
        }
      })
    );
  }

  // Track when pointer enters content areas to prevent closing
  itemMap.forEach(({ content }) => {
    cleanups.push(
      on(content, "pointerenter", () => {
        clearTimers();
      }),
      on(content, "pointerleave", (e) => {
        if (clickLocked) return;
        const next = (e as PointerEvent).relatedTarget as Node | null;
        if (!containsWithPortals(root, next)) {
          updateState(null);
          updateIndicator(null);
        }
      })
    );
  });

  // Keyboard navigation within the list
  cleanups.push(
    on(list, "keydown", (e) => {
      const target = e.target as HTMLElement;
      const currentTriggerIndex = triggers.indexOf(target);
      if (currentTriggerIndex === -1) return;

      const triggerValue = valueByTrigger.get(target) ?? null;
      let nextIndex = currentTriggerIndex;

      switch (e.key) {
        case "ArrowLeft":
          nextIndex = currentTriggerIndex - 1;
          if (nextIndex < 0) nextIndex = triggers.length - 1;
          break;
        case "ArrowRight":
          nextIndex = currentTriggerIndex + 1;
          if (nextIndex >= triggers.length) nextIndex = 0;
          break;
        case "ArrowDown": {
          e.preventDefault();
          // Open content for this trigger and move focus into it
          if (triggerValue) {
            clickLocked = true; // Lock so pointerleave doesn't close
            updateState(triggerValue, true);
            requestAnimationFrame(() => {
              const data = itemMap.get(triggerValue);
              if (!data) return;
              const focusables = getFocusableElements(data.content);
              const first = focusables[0];
              if (first) first.focus();
              else data.content.focus(); // content has tabIndex=-1
            });
          }
          return;
        }
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = triggers.length - 1;
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
      const nextTrigger = triggers[nextIndex];
      if (nextTrigger) {
        triggers.forEach((t) => (t.tabIndex = t === nextTrigger ? 0 : -1));
        nextTrigger.focus();
        updateIndicator(nextTrigger);
      }
    })
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
      })
    );
  });

  // Helper to check if this menu instance is active (focused, hovered, or locked)
  const isMenuActive = () =>
    containsWithPortals(root, document.activeElement) || isRootHovered || clickLocked;

  const closeMenuAndUnlock = () => {
    clickLocked = false;
    updateState(null, true);
    updateIndicator(null);
  };

  // Reset isPointerDown on document pointerup/pointercancel (capture phase)
  cleanups.push(
    on(
      document,
      "pointerup",
      () => {
        isPointerDown = false;
      },
      { capture: true }
    ),
    on(
      document,
      "pointercancel",
      () => {
        isPointerDown = false;
      },
      { capture: true }
    )
  );

  // Close when focus leaves root (and unlock clickLocked)
  cleanups.push(
    on(document, "focusin", (e) => {
      if (currentValue === null) return;
      if (!containsWithPortals(root, e.target as Node)) {
        closeMenuAndUnlock();
      }
    })
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
    })
  );

  // Recompute indicator position on window resize or list scroll
  cleanups.push(
    on(window, "resize", () => {
      if (currentValue) {
        requestAnimationFrame(() => updateViewportPositioner());
      }
      if (hoveredTrigger)
        requestAnimationFrame(() => updateIndicator(hoveredTrigger));
    }),
    on(list, "scroll", () => {
      if (hoveredTrigger)
        requestAnimationFrame(() => updateIndicator(hoveredTrigger));
    })
  );

  // Inbound event
  cleanups.push(
    on(root, "navigation-menu:set", (e) => {
      const detail = (e as CustomEvent).detail as { value?: string | null } | null;
      if (detail?.value === undefined) return;

      if (detail.value === null) {
        closeMenuAndUnlock();
      } else if (itemMap.has(detail.value)) {
        clickLocked = true;
        updateState(detail.value, true);
        const data = itemMap.get(detail.value);
        if (data) updateIndicator(data.trigger);
      }
    })
  );

  const controller: NavigationMenuController = {
    get value() {
      return currentValue;
    },
    open: (value: string) => updateState(value, true),
    close: () => updateState(null, true),
    destroy: () => {
      isDestroyed = true;
      clearTimers();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all navigation menu components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(
  scope: ParentNode = document
): NavigationMenuController[] {
  const controllers: NavigationMenuController[] = [];

  for (const root of getRoots(scope, "navigation-menu")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createNavigationMenu(root));
  }

  return controllers;
}
