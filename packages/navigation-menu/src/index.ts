import { getPart, getParts, getRoots } from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

export interface NavigationMenuOptions {
  /** Delay before opening on hover (ms) */
  delayOpen?: number;
  /** Delay before closing on mouse leave (ms) */
  delayClose?: number;
  /** Whether focusing a trigger opens its content (default: true) */
  openOnFocus?: boolean;
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
  const {
    delayOpen = 200,
    delayClose = 150,
    openOnFocus = true,
    onValueChange,
  } = options;

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

  const cleanups: Array<() => void> = [];

  // ResizeObserver for active panel - handles fonts/images/content changes after open
  let activeRO: ResizeObserver | null = null;
  const observeActiveContent = (el: HTMLElement | null) => {
    activeRO?.disconnect();
    activeRO = null;
    if (!viewport || !el) return;
    activeRO = new ResizeObserver(() => updateViewportSize(el));
    activeRO.observe(el);
  };
  cleanups.push(() => activeRO?.disconnect());

  // Build a map of items with their triggers and content
  const itemMap = new Map<
    string,
    {
      item: HTMLElement;
      trigger: HTMLElement;
      content: HTMLElement;
      index: number;
    }
  >();

  let validIndex = 0;
  items.forEach((item) => {
    const value = item.dataset["value"];
    if (!value) return;

    const trigger = getPart<HTMLElement>(item, "navigation-menu-trigger");
    const content = getPart<HTMLElement>(item, "navigation-menu-content");

    if (trigger && content) {
      itemMap.set(value, { item, trigger, content, index: validIndex++ });

      // Setup ARIA - link trigger to content bidirectionally
      const safe = safeId(value);
      const triggerId = ensureId(trigger, `nav-menu-trigger-${safe}`);
      const contentId = ensureId(content, `nav-menu-content-${safe}`);
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-controls", contentId);
      content.setAttribute("role", "region");
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

  const getOrCreateHoverBridge = (): HTMLElement => {
    if (!hoverBridge) {
      hoverBridge = document.createElement("div");
      hoverBridge.setAttribute("data-slot", "navigation-menu-bridge");
      hoverBridge.style.cssText =
        "position: absolute; left: 0; right: 0; top: 0; pointer-events: auto; z-index: -1;";
      // Insert bridge at the start of viewport
      if (viewport) {
        viewport.insertBefore(hoverBridge, viewport.firstChild);
      }
      // Bridge keeps menu open when hovered
      cleanups.push(
        on(hoverBridge, "pointerenter", () => {
          clearTimers();
        })
      );
    }
    return hoverBridge;
  };

  const updateViewportSize = (content: HTMLElement) => {
    if (!viewport) return;

    // Measure after content is visible using rAF + getBoundingClientRect for abs/transform panels
    requestAnimationFrame(() => {
      const rect = content.getBoundingClientRect();
      const contentStyle = getComputedStyle(content);
      const contentMarginTop = parseFloat(contentStyle.marginTop) || 0;

      // Account for viewport margins in height calculation
      const viewportStyle = getComputedStyle(viewport);
      const viewportMarginTop = parseFloat(viewportStyle.marginTop) || 0;
      const viewportMarginBottom = parseFloat(viewportStyle.marginBottom) || 0;

      viewport.style.setProperty("--viewport-width", `${rect.width}px`);
      viewport.style.setProperty(
        "--viewport-height",
        `${rect.height + viewportMarginTop + viewportMarginBottom}px`
      );

      // If content has margin-top, create/update hover bridge to cover the gap
      const totalGap = contentMarginTop + viewportMarginTop;
      if (totalGap > 0) {
        const bridge = getOrCreateHoverBridge();
        bridge.style.height = `${totalGap}px`;
        bridge.style.transform = `translateY(-${totalGap}px)`;
      } else if (hoverBridge) {
        hoverBridge.style.height = "0";
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
    indicator.style.setProperty(
      "--indicator-height",
      `${triggerRect.height}px`
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
      if (value === null && active && root.contains(active)) {
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
          content.setAttribute("data-state", "inactive");
          content.setAttribute("aria-hidden", "true");
          setInert(content, true);
          content.hidden = true;

          // Set exit motion on the previous content (only when switching)
          if (wasActive && direction) {
            const exitDirection =
              direction === "right" ? "to-left" : "to-right";
            content.setAttribute("data-motion", exitDirection);
          } else {
            content.removeAttribute("data-motion");
          }
        }
      });

      // Update new active content
      if (newData) {
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
        previousIndex = newData.index;

        updateViewportSize(newData.content);
        observeActiveContent(newData.content);
        updateIndicator(newData.trigger); // Indicator follows active trigger
      } else {
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
    on(root, "pointerleave", () => {
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
        if (data) updateViewportSize(data.content);
      })
    );
  }

  // Track when pointer enters content areas to prevent closing
  itemMap.forEach(({ content }) => {
    cleanups.push(
      on(content, "pointerenter", () => {
        clearTimers();
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
    root.contains(document.activeElement) || isRootHovered || clickLocked;

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
      if (!root.contains(e.target as Node)) {
        clickLocked = false;
        updateState(null, true);
        updateIndicator(null);
      }
    })
  );

  // Close on click outside (only if this menu is active)
  cleanups.push(
    on(document, "pointerdown", (e) => {
      if (currentValue === null) return;
      if (!isMenuActive()) return;
      if (!root.contains(e.target as Node)) {
        clickLocked = false;
        updateState(null, true);
        updateIndicator(null);
      }
    })
  );

  // Close on Escape (only if this menu is active)
  cleanups.push(
    on(document, "keydown", (e) => {
      if (e.key !== "Escape" || currentValue === null) return;
      if (!isMenuActive()) return;
      clickLocked = false;
      updateState(null, true);
      updateIndicator(null);
    })
  );

  // Recompute indicator position on window resize or list scroll
  cleanups.push(
    on(window, "resize", () => {
      if (hoveredTrigger)
        requestAnimationFrame(() => updateIndicator(hoveredTrigger));
    }),
    on(list, "scroll", () => {
      if (hoveredTrigger)
        requestAnimationFrame(() => updateIndicator(hoveredTrigger));
    })
  );

  const controller: NavigationMenuController = {
    get value() {
      return currentValue;
    },
    open: (value: string) => updateState(value, true),
    close: () => updateState(null, true),
    destroy: () => {
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
