import { getPart, getParts, getRoots } from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

export interface NavigationMenuOptions {
  /** Delay before opening on hover (ms) */
  delayOpen?: number;
  /** Delay before closing on mouse leave (ms) */
  delayClose?: number;
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
  const { delayOpen = 200, delayClose = 150, onValueChange } = options;

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
  let isPointerDown: boolean = false; // Track if we're in a click sequence (mousedown fired)

  const cleanups: Array<() => void> = [];

  // Build a map of items with their triggers and content
  const itemMap = new Map<
    string,
    { item: HTMLElement; trigger: HTMLElement; content: HTMLElement; index: number }
  >();

  items.forEach((item, index) => {
    const value = item.dataset["value"];
    if (!value) return;

    const trigger = getPart<HTMLElement>(item, "navigation-menu-trigger");
    const content = getPart<HTMLElement>(item, "navigation-menu-content");

    if (trigger && content) {
      itemMap.set(value, { item, trigger, content, index });

      // Setup ARIA
      trigger.setAttribute("aria-haspopup", "true");
      const contentId = ensureId(content, "nav-menu-content");
      trigger.setAttribute("aria-controls", contentId);
    }
  });

  // Get all triggers for keyboard navigation
  const triggers = Array.from(itemMap.values()).map((v) => v.trigger);

  // Focusable elements selector for content navigation
  const focusableSelector = 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // Get focusable elements in a content panel
  const getFocusableElements = (content: HTMLElement): HTMLElement[] => {
    return Array.from(content.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((el) => !el.hidden && el.offsetParent !== null);
  };

  // Get current value's trigger for returning from content
  const getCurrentTrigger = (): HTMLElement | null => {
    if (!currentValue) return null;
    return itemMap.get(currentValue)?.trigger ?? null;
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
        on(hoverBridge, "mouseenter", () => {
          clearTimers();
        })
      );
    }
    return hoverBridge;
  };

  const updateViewportSize = (content: HTMLElement) => {
    if (!viewport) return;

    // Temporarily make content visible to measure
    const wasHidden = content.hidden;
    content.hidden = false;
    content.style.visibility = "hidden";
    content.style.position = "absolute";

    const rect = content.getBoundingClientRect();
    const contentStyle = getComputedStyle(content);
    const contentMarginTop = parseFloat(contentStyle.marginTop) || 0;

    // Restore
    content.style.visibility = "";
    content.style.position = "";
    content.hidden = wasHidden;

    // Account for viewport margins in height calculation
    const viewportStyle = getComputedStyle(viewport);
    const viewportMarginTop = parseFloat(viewportStyle.marginTop) || 0;
    const viewportMarginBottom = parseFloat(viewportStyle.marginBottom) || 0;

    viewport.style.setProperty("--viewport-width", `${rect.width}px`);
    viewport.style.setProperty("--viewport-height", `${rect.height + viewportMarginTop + viewportMarginBottom}px`);

    // If content has margin-top, create/update hover bridge to cover the gap
    // This allows users to use margin for spacing without breaking hover behavior
    const totalGap = contentMarginTop + viewportMarginTop;
    if (totalGap > 0) {
      const bridge = getOrCreateHoverBridge();
      // Position bridge above the viewport to cover the margin gap
      bridge.style.height = `${totalGap}px`;
      bridge.style.transform = `translateY(-${totalGap}px)`;
    } else if (hoverBridge) {
      hoverBridge.style.height = "0";
    }
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
    indicator.style.setProperty("--indicator-height", `${triggerRect.height}px`);
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
    pendingValue = value; // Track what we're opening

    const doUpdate = () => {
      const prevValue = currentValue;
      const prevData = prevValue ? itemMap.get(prevValue) : null;
      const newData = value ? itemMap.get(value) : null;

      // Only animate direction when switching between different items
      const isSwitching = prevValue !== null && value !== null && prevValue !== value;

      // Determine motion direction (only when switching)
      const direction = isSwitching && newData
        ? getMotionDirection(newData.index)
        : null;

      // Update all items
      itemMap.forEach(({ trigger, content, item }, key) => {
        const isActive = key === value;
        const wasActive = key === prevValue;

        setAria(trigger, "expanded", isActive);
        trigger.setAttribute("data-state", isActive ? "open" : "closed");
        item.setAttribute("data-state", isActive ? "open" : "closed");

        if (!isActive) {
          content.setAttribute("data-state", "inactive");
          content.hidden = true;
          
          // Set exit motion on the previous content (only when switching)
          if (wasActive && direction) {
            const exitDirection = direction === "right" ? "to-left" : "to-right";
            content.setAttribute("data-motion", exitDirection);
          } else {
            // Clear motion attribute for non-transitioning items
            content.removeAttribute("data-motion");
          }
        }
      });

      // Update new active content
      if (newData) {
        if (direction) {
          // Only set motion when switching
          const enterDirection = direction === "right" ? "from-right" : "from-left";
          newData.content.setAttribute("data-motion", enterDirection);
        } else {
          // Initial open - no motion animation
          newData.content.removeAttribute("data-motion");
        }
        newData.content.setAttribute("data-state", "active");
        newData.content.hidden = false;
        previousIndex = newData.index;

        // Update viewport size
        updateViewportSize(newData.content);
      }

      // Update root state
      const isOpen = value !== null;
      root.setAttribute("data-state", isOpen ? "open" : "closed");
      if (direction) {
        root.setAttribute("data-motion", direction === "right" ? "from-right" : "from-left");
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
          viewport.style.setProperty("--motion-direction", direction === "right" ? "1" : "-1");
        }
      }

      currentValue = value;
      pendingValue = null; // Clear pending since we've completed the update
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
    setAria(trigger, "expanded", false);
    trigger.setAttribute("data-state", "closed");
    item.setAttribute("data-state", "closed");
    content.setAttribute("data-state", "inactive");
    content.hidden = true;
  });

  // Hover handlers for items
  itemMap.forEach(({ item, trigger }, value) => {
    // Mouse enter on trigger - update indicator (skip if click-locked)
    cleanups.push(
      on(trigger, "mouseenter", () => {
        if (!clickLocked) {
          updateIndicator(trigger);
        }
      })
    );

    // Mouse enter on item - update state (content will trigger this too)
    // Skip if click-locked to keep the locked item's content visible
    cleanups.push(
      on(item, "mouseenter", () => {
        if (!clickLocked) {
          updateState(value);
        }
      })
    );

    // Focus on trigger - update state unless focus is from a pointer click
    // (let click handler manage state during click to avoid race conditions)
    cleanups.push(
      on(trigger, "focus", () => {
        if (!isPointerDown) {
          updateState(value, true);
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

  // Mouse leave from the entire menu (only close if not click-locked)
  cleanups.push(
    on(root, "mouseleave", () => {
      if (!clickLocked) {
        updateState(null);
        updateIndicator(null);
      }
    })
  );

  // Handle viewport hover to keep menu open
  if (viewport) {
    cleanups.push(
      on(viewport, "mouseenter", () => {
        clearTimers();
      })
    );
  }

  // Track when mouse enters content areas to prevent closing
  itemMap.forEach(({ content }) => {
    cleanups.push(
      on(content, "mouseenter", () => {
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
        case "ArrowDown":
          // If content is open, move focus into content
          if (currentValue) {
            const data = itemMap.get(currentValue);
            if (data) {
              const focusables = getFocusableElements(data.content);
              if (focusables.length > 0) {
                e.preventDefault();
                focusables[0]?.focus();
                return;
              }
            }
          }
          return;
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
        nextTrigger.focus();
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

  // Close on click outside (also unlocks click-locked state)
  cleanups.push(
    on(document, "pointerdown", (e) => {
      if (currentValue === null) return;
      const target = e.target as Node;
      if (!root.contains(target)) {
        clickLocked = false;
        updateState(null, true);
        updateIndicator(null);
      }
    })
  );

  // Close on Escape (also unlocks click-locked state)
  cleanups.push(
    on(document, "keydown", (e) => {
      if (e.key === "Escape" && currentValue !== null) {
        clickLocked = false;
        updateState(null, true);
        updateIndicator(null);
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
export function create(scope: ParentNode = document): NavigationMenuController[] {
  const controllers: NavigationMenuController[] = [];

  for (const root of getRoots(scope, "navigation-menu")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createNavigationMenu(root));
  }

  return controllers;
}

