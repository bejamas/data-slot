import {
  getParts,
  getRoots,
  getPart,
  getDataBool,
  getDataString,
  getDataEnum,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  createPresenceLifecycle,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

const ORIENTATIONS = ["horizontal", "vertical"] as const;
type AccordionOrientation = (typeof ORIENTATIONS)[number];
const SIZE_TRANSITION_PROPERTIES = new Set([
  "all",
  "height",
  "width",
  "block-size",
  "inline-size",
]);
const OPEN_SETTLE_EVENT_TOLERANCE_MS = 5;

const KEYBOARD_TOGGLE_KEYS = new Set(["Enter", " "]);

const isElementDisabled = (el: Element | null | undefined): boolean =>
  !!el &&
  (el.hasAttribute("disabled") ||
    el.hasAttribute("data-disabled") ||
    el.getAttribute("aria-disabled") === "true");

const setBoolAttr = (el: Element, name: string, value: boolean) => {
  if (value) {
    el.setAttribute(name, "");
  } else {
    el.removeAttribute(name);
  }
};

const setOpenClosedAttrs = (el: Element, open: boolean) => {
  el.setAttribute("data-state", open ? "open" : "closed");
  if (open) {
    el.setAttribute("data-open", "");
    el.removeAttribute("data-closed");
  } else {
    el.setAttribute("data-closed", "");
    el.removeAttribute("data-open");
  }
};

const parseTimingToMs = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (trimmed.endsWith("ms")) {
    return Number.parseFloat(trimmed.slice(0, -2)) || 0;
  }

  if (trimmed.endsWith("s")) {
    return (Number.parseFloat(trimmed.slice(0, -1)) || 0) * 1000;
  }

  return Number.parseFloat(trimmed) || 0;
};

const getMaxTimingMs = (durationsValue: string, delaysValue: string): number => {
  const durations = durationsValue.split(",");
  const delays = delaysValue.split(",");
  const len = Math.max(durations.length, delays.length);
  let max = 0;

  for (let i = 0; i < len; i += 1) {
    const duration = parseTimingToMs(durations[i] ?? durations[durations.length - 1] ?? "0");
    const delay = parseTimingToMs(delays[i] ?? delays[delays.length - 1] ?? "0");
    max = Math.max(max, duration + delay);
  }

  return max;
};

const getMaxPresenceDurationMs = (element: HTMLElement): number => {
  const style = getComputedStyle(element);
  const transitionMs = getMaxTimingMs(style.transitionDuration, style.transitionDelay);
  const animationMs = getMaxTimingMs(style.animationDuration, style.animationDelay);
  return Math.max(transitionMs, animationMs);
};

const getMaxTransitionTimingMsForProperties = (
  element: HTMLElement,
  shouldIncludeProperty: (property: string) => boolean
): number => {
  const style = getComputedStyle(element);
  const properties = style.transitionProperty.split(",").map((property) => property.trim());
  const durations = style.transitionDuration.split(",");
  const delays = style.transitionDelay.split(",");
  const len = Math.max(properties.length, durations.length, delays.length);
  let max = 0;

  for (let i = 0; i < len; i += 1) {
    const property = properties[i] ?? properties[properties.length - 1] ?? "all";
    if (!shouldIncludeProperty(property)) continue;

    const duration = parseTimingToMs(durations[i] ?? durations[durations.length - 1] ?? "0");
    const delay = parseTimingToMs(delays[i] ?? delays[delays.length - 1] ?? "0");
    max = Math.max(max, duration + delay);
  }

  return max;
};

const getMaxSizeTransitionMs = (element: HTMLElement): number =>
  getMaxTransitionTimingMsForProperties(element, (property) =>
    SIZE_TRANSITION_PROPERTIES.has(property)
  );

export interface AccordionOptions {
  /** Allow multiple items open at once */
  multiple?: boolean;
  /** Initially expanded item(s) */
  defaultValue?: string | string[];
  /** Callback when expanded items change */
  onValueChange?: (value: string[]) => void;
  /** Disable the entire accordion */
  disabled?: boolean;
  /** Accordion orientation for roving focus */
  orientation?: AccordionOrientation;
  /** Whether arrow-key focus wraps at the ends */
  loopFocus?: boolean;
  /** Use hidden="until-found" on closed panels */
  hiddenUntilFound?: boolean;
  /**
   * @deprecated Use the Base UI-style default collapsible behavior instead.
   * Kept for backward compatibility and planned for removal in the next major.
   */
  collapsible?: boolean;
}

export interface AccordionController {
  /** Expand an item by value */
  expand(value: string): void;
  /** Collapse an item by value */
  collapse(value: string): void;
  /** Toggle an item by value */
  toggle(value: string): void;
  /** Currently expanded values */
  readonly value: string[];
  /** Cleanup all event listeners */
  destroy(): void;
}

interface AccordionItemRecord {
  el: HTMLElement;
  value: string;
  index: number;
  disabled: boolean;
  trigger: HTMLElement;
  content: HTMLElement;
  presence: ReturnType<typeof createPresenceLifecycle>;
  sizeObserver: ResizeObserver | null;
  openSettleRafId: number | null;
  openSettleTimeoutId: number | null;
  closeZeroRafId: number | null;
  openSettleCleanups: Array<() => void>;
  suppressClick: boolean;
  suppressClickTimeoutId: number | null;
}

const ROOT_BINDING_KEY = "@data-slot/accordion";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/accordion] createAccordion() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

/**
 * Create an accordion controller for a root element
 *
 * Expected markup:
 * ```html
 * <div data-slot="accordion">
 *   <div data-slot="accordion-item" data-value="one">
 *     <button data-slot="accordion-trigger">Item One</button>
 *     <div data-slot="accordion-content">Content One</div>
 *   </div>
 *   <div data-slot="accordion-item" data-value="two">
 *     <button data-slot="accordion-trigger">Item Two</button>
 *     <div data-slot="accordion-content">Content Two</div>
 *   </div>
 * </div>
 * ```
 */
export function createAccordion(
  root: Element,
  options: AccordionOptions = {}
): AccordionController {
  const existingController = reuseRootBinding<AccordionController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  const rootEl = root as HTMLElement;
  const items = getParts<HTMLElement>(root, "accordion-item");

  if (items.length === 0) {
    throw new Error("Accordion requires at least one accordion-item");
  }

  const win = root.ownerDocument?.defaultView ?? window;

  const multiple = options.multiple ?? getDataBool(root, "multiple") ?? false;
  const onValueChange = options.onValueChange;
  const disabled = options.disabled ?? getDataBool(root, "disabled") ?? isElementDisabled(root);
  const orientation =
    options.orientation ??
    getDataEnum(root, "orientation", ORIENTATIONS) ??
    "vertical";
  const loopFocus = options.loopFocus ?? getDataBool(root, "loopFocus") ?? true;
  const hiddenUntilFound =
    options.hiddenUntilFound ?? getDataBool(root, "hiddenUntilFound") ?? false;
  // TODO(next-major): remove deprecated accordion `collapsible` option + `data-collapsible` fallback.
  const deprecatedCollapsible =
    options.collapsible ?? getDataBool(root, "collapsible");
  const collapsible = deprecatedCollapsible ?? true;

  const cleanups: Array<() => void> = [];
  const itemRecords: AccordionItemRecord[] = [];

  const setPanelSizeVars = (item: AccordionItemRecord, height: string, width: string) => {
    item.content.style.setProperty("--accordion-panel-height", height);
    item.content.style.setProperty("--accordion-panel-width", width);
  };

  const setPanelSizePx = (item: AccordionItemRecord, height: number, width: number) => {
    setPanelSizeVars(item, `${height}px`, `${width}px`);
  };

  const setPanelSizeAuto = (item: AccordionItemRecord) => {
    setPanelSizeVars(item, "auto", "auto");
  };

  const setPanelSizeZero = (item: AccordionItemRecord) => {
    setPanelSizePx(item, 0, 0);
  };

  const syncPanelSizePx = (item: AccordionItemRecord) => {
    setPanelSizePx(item, item.content.scrollHeight, item.content.scrollWidth);
  };

  const hasAutoPanelSize = (item: AccordionItemRecord) => {
    const height = item.content.style.getPropertyValue("--accordion-panel-height").trim();
    const width = item.content.style.getPropertyValue("--accordion-panel-width").trim();
    return height === "auto" && width === "auto";
  };

  const clearSuppressClickTracking = (item: AccordionItemRecord) => {
    item.suppressClick = false;
    if (item.suppressClickTimeoutId !== null) {
      win.clearTimeout(item.suppressClickTimeoutId);
      item.suppressClickTimeoutId = null;
    }
  };

  const clearOpenSettleTracking = (item: AccordionItemRecord) => {
    if (item.openSettleRafId !== null) {
      win.cancelAnimationFrame(item.openSettleRafId);
      item.openSettleRafId = null;
    }

    if (item.openSettleTimeoutId !== null) {
      win.clearTimeout(item.openSettleTimeoutId);
      item.openSettleTimeoutId = null;
    }

    item.openSettleCleanups.forEach((cleanup) => cleanup());
    item.openSettleCleanups = [];
  };

  const clearClosePhaseTracking = (item: AccordionItemRecord) => {
    if (item.closeZeroRafId !== null) {
      win.cancelAnimationFrame(item.closeZeroRafId);
      item.closeZeroRafId = null;
    }
  };

  const clearSizePhaseTracking = (item: AccordionItemRecord) => {
    clearOpenSettleTracking(item);
    clearClosePhaseTracking(item);
  };

  const applyOpenVisibility = (item: AccordionItemRecord) => {
    item.content.removeAttribute("hidden");
  };

  const applyClosedVisibility = (item: AccordionItemRecord) => {
    if (hiddenUntilFound) {
      item.content.setAttribute("hidden", "until-found");
    } else {
      item.content.hidden = true;
    }
    setPanelSizeZero(item);
  };

  let expandedValues = new Set<string>();

  const finishOpenSettle = (item: AccordionItemRecord) => {
    clearOpenSettleTracking(item);
    if (!expandedValues.has(item.value) || item.presence.isExiting) return;
    setPanelSizeAuto(item);
  };

  const scheduleOpenSettle = (item: AccordionItemRecord) => {
    clearOpenSettleTracking(item);

    const maxDuration = getMaxPresenceDurationMs(item.content);
    const maxSizeTransitionMs = getMaxSizeTransitionMs(item.content);
    const settleDuration = maxSizeTransitionMs || maxDuration;

    if (settleDuration > 0) {
      const startedAt =
        typeof win.performance?.now === "function" ? win.performance.now() : Date.now();
      const hasElapsed = (durationMs: number) => {
        const now =
          typeof win.performance?.now === "function" ? win.performance.now() : Date.now();
        return now - startedAt >= Math.max(0, durationMs - OPEN_SETTLE_EVENT_TOLERANCE_MS);
      };

      const onTransitionEnd = (event: Event) => {
        if (event.target !== item.content) return;
        const propertyName =
          "propertyName" in event ? String((event as TransitionEvent).propertyName) : "";

        if (maxSizeTransitionMs > 0) {
          if (!SIZE_TRANSITION_PROPERTIES.has(propertyName)) return;
          if (!hasElapsed(maxSizeTransitionMs)) return;
        } else if (!hasElapsed(settleDuration)) {
          return;
        }

        finishOpenSettle(item);
      };

      const onAnimationEnd = (event: Event) => {
        if (event.target !== item.content) return;
        if (maxSizeTransitionMs > 0) return;
        if (!hasElapsed(settleDuration)) return;

        finishOpenSettle(item);
      };

      item.content.addEventListener("transitionend", onTransitionEnd);
      item.content.addEventListener("animationend", onAnimationEnd);
      item.openSettleCleanups.push(() =>
        item.content.removeEventListener("transitionend", onTransitionEnd)
      );
      item.openSettleCleanups.push(() =>
        item.content.removeEventListener("animationend", onAnimationEnd)
      );

      item.openSettleTimeoutId = win.setTimeout(() => {
        item.openSettleTimeoutId = null;
        finishOpenSettle(item);
      }, Math.ceil(settleDuration) + 50);

      return;
    }

    item.openSettleRafId = win.requestAnimationFrame(() => {
      item.openSettleRafId = null;
      finishOpenSettle(item);
    });
  };

  const scheduleCloseToZero = (item: AccordionItemRecord) => {
    clearClosePhaseTracking(item);

    item.closeZeroRafId = win.requestAnimationFrame(() => {
      item.closeZeroRafId = null;
      if (!expandedValues.has(item.value) && item.presence.isExiting) {
        setPanelSizeZero(item);
      }
    });
  };

  const applyStaticItemAttrs = (item: AccordionItemRecord) => {
    item.el.setAttribute("data-index", String(item.index));
    item.content.setAttribute("data-index", String(item.index));
    item.content.setAttribute("data-orientation", orientation);

    setBoolAttr(item.el, "data-disabled", item.disabled);
    setBoolAttr(item.trigger, "data-disabled", item.disabled);
    setBoolAttr(item.content, "data-disabled", item.disabled);

    if (item.disabled) {
      item.trigger.setAttribute("aria-disabled", "true");
      if (item.trigger instanceof HTMLButtonElement) {
        item.trigger.disabled = true;
      }
    } else {
      item.trigger.removeAttribute("aria-disabled");
      if (item.trigger instanceof HTMLButtonElement) {
        item.trigger.disabled = false;
      }
    }
  };

  const setTriggerStateAttrs = (item: AccordionItemRecord, open: boolean) => {
    item.trigger.setAttribute("data-state", open ? "open" : "closed");
    setBoolAttr(item.trigger, "data-panel-open", open);
  };

  const initializeItemState = (item: AccordionItemRecord) => {
    const open = expandedValues.has(item.value);
    applyStaticItemAttrs(item);
    setAria(item.trigger, "expanded", open);
    setOpenClosedAttrs(item.el, open);
    setOpenClosedAttrs(item.content, open);
    setTriggerStateAttrs(item, open);
    item.content.removeAttribute("data-starting-style");
    item.content.removeAttribute("data-ending-style");

    if (open) {
      applyOpenVisibility(item);
      syncPanelSizePx(item);
      scheduleOpenSettle(item);
    } else {
      applyClosedVisibility(item);
    }
  };

  const syncItemState = (item: AccordionItemRecord) => {
    const open = expandedValues.has(item.value);
    const wasOpen = item.trigger.getAttribute("aria-expanded") === "true";

    applyStaticItemAttrs(item);
    setAria(item.trigger, "expanded", open);
    setOpenClosedAttrs(item.el, open);
    setOpenClosedAttrs(item.content, open);
    setTriggerStateAttrs(item, open);

    if (open) {
      clearClosePhaseTracking(item);
      applyOpenVisibility(item);
      syncPanelSizePx(item);
      if (!wasOpen) {
        item.presence.enter();
      }
      scheduleOpenSettle(item);
      return;
    }

    if (wasOpen) {
      clearOpenSettleTracking(item);
      syncPanelSizePx(item);
      item.presence.exit();
      scheduleCloseToZero(item);
      return;
    }

    clearSizePhaseTracking(item);
    item.content.removeAttribute("data-starting-style");
    item.content.removeAttribute("data-ending-style");
    applyClosedVisibility(item);
  };

  const sanitizeValues = (values: string[]) => {
    const validValues: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      if (seen.has(value) || !items.some((item) => item.dataset["value"] === value)) {
        continue;
      }

      seen.add(value);
      validValues.push(value);

      if (!multiple && validValues.length === 1) {
        break;
      }
    }

    return validValues;
  };

  const expandedValuesChanged = (nextExpanded: Set<string>) => {
    if (nextExpanded.size !== expandedValues.size) return true;
    return [...nextExpanded].some((value) => !expandedValues.has(value));
  };

  const syncAllItems = () => {
    itemRecords.forEach(syncItemState);
  };

  const emitValueChange = () => {
    const value = [...expandedValues];
    emit(root, "accordion:change", { value });
    onValueChange?.(value);
  };

  const applyExpandedValues = (values: string[]) => {
    const nextValues = sanitizeValues(values);

    if (!multiple && !collapsible && nextValues.length === 0 && expandedValues.size > 0) {
      return false;
    }

    const nextExpanded = new Set(nextValues);
    if (!expandedValuesChanged(nextExpanded)) {
      return false;
    }

    expandedValues = nextExpanded;
    syncAllItems();
    emitValueChange();
    return true;
  };

  const resolveDirection = (target: HTMLElement): "ltr" | "rtl" => {
    const authoredDirection = target.getAttribute("dir") ?? rootEl.getAttribute("dir");
    if (authoredDirection === "rtl") return "rtl";

    const computedDirection =
      getComputedStyle(target).direction ||
      getComputedStyle(rootEl).direction ||
      root.ownerDocument?.documentElement.getAttribute("dir") ||
      "";

    return computedDirection === "rtl" ? "rtl" : "ltr";
  };

  rootEl.setAttribute("data-orientation", orientation);
  setBoolAttr(rootEl, "data-disabled", !!disabled);

  items.forEach((item, index) => {
    const value = item.dataset["value"];
    if (!value) return;

    const trigger = getPart<HTMLElement>(item, "accordion-trigger");
    const content = getPart<HTMLElement>(item, "accordion-content");

    if (!trigger || !content) return;

    const contentId = ensureId(content, "accordion-content");
    const triggerId = ensureId(trigger, "accordion-trigger");
    trigger.setAttribute("aria-controls", contentId);
    content.setAttribute("aria-labelledby", triggerId);
    content.setAttribute("role", "region");

    const itemDisabled = !!disabled || isElementDisabled(item) || isElementDisabled(trigger);

    let record!: AccordionItemRecord;
    record = {
      el: item,
      value,
      index,
      disabled: itemDisabled,
      trigger,
      content,
      presence: createPresenceLifecycle({
        element: content,
        onExitComplete: () => {
          clearClosePhaseTracking(record);
          applyClosedVisibility(record);
        },
      }),
      sizeObserver: null,
      openSettleRafId: null,
      openSettleTimeoutId: null,
      closeZeroRafId: null,
      openSettleCleanups: [],
      suppressClick: false,
      suppressClickTimeoutId: null,
    };

    if (typeof ResizeObserver !== "undefined") {
      record.sizeObserver = new ResizeObserver(() => {
        if (!expandedValues.has(record.value) || record.presence.isExiting) return;
        if (hasAutoPanelSize(record)) return;
        syncPanelSizePx(record);
      });
      record.sizeObserver.observe(content);
    }

    cleanups.push(
      on(trigger, "click", () => {
        if (record.suppressClick) {
          clearSuppressClickTracking(record);
          return;
        }

        if (record.disabled) return;

        if (expandedValues.has(record.value)) {
          applyExpandedValues([...expandedValues].filter((value) => value !== record.value));
        } else if (multiple) {
          applyExpandedValues([...expandedValues, record.value]);
        } else {
          applyExpandedValues([record.value]);
        }
      })
    );

    cleanups.push(
      on(trigger, "keydown", (event) => {
        if (!KEYBOARD_TOGGLE_KEYS.has(event.key)) return;
        if (record.disabled) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        clearSuppressClickTracking(record);
        record.suppressClick = true;
        record.suppressClickTimeoutId = win.setTimeout(() => {
          record.suppressClick = false;
          record.suppressClickTimeoutId = null;
        }, 0);

        if (expandedValues.has(record.value)) {
          applyExpandedValues([...expandedValues].filter((value) => value !== record.value));
        } else if (multiple) {
          applyExpandedValues([...expandedValues, record.value]);
        } else {
          applyExpandedValues([record.value]);
        }
      })
    );

    if (hiddenUntilFound) {
      cleanups.push(
        on(content, "beforematch", () => {
          if (multiple) {
            applyExpandedValues([...expandedValues, record.value]);
          } else {
            applyExpandedValues([record.value]);
          }
        })
      );
    }

    itemRecords.push(record);
  });

  const itemValues = new Set(itemRecords.map((item) => item.value));
  const rawDefaultValue = options.defaultValue ?? getDataString(root, "defaultValue");
  const defaultValues = rawDefaultValue
    ? Array.isArray(rawDefaultValue)
      ? rawDefaultValue
      : [rawDefaultValue]
    : [];
  const initialValues = sanitizeValues(defaultValues.filter((value) => itemValues.has(value)));

  expandedValues = new Set(initialValues);

  itemRecords.forEach(initializeItemState);

  cleanups.push(
    on(rootEl, "keydown", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const currentItem = itemRecords.find((item) => item.trigger === target);
      if (!currentItem) return;

      const enabledItems = itemRecords.filter((item) => !item.disabled);
      const currentIndex = enabledItems.findIndex((item) => item.trigger === target);
      if (currentIndex === -1) return;

      const lastIndex = enabledItems.length - 1;
      let nextIndex = -1;

      const toNext = () => {
        if (loopFocus) {
          nextIndex = currentIndex + 1 > lastIndex ? 0 : currentIndex + 1;
        } else {
          nextIndex = Math.min(currentIndex + 1, lastIndex);
        }
      };

      const toPrev = () => {
        if (loopFocus) {
          nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
        } else {
          nextIndex = Math.max(currentIndex - 1, 0);
        }
      };

      switch (event.key) {
        case "ArrowDown":
          if (orientation === "vertical") toNext();
          break;
        case "ArrowUp":
          if (orientation === "vertical") toPrev();
          break;
        case "ArrowRight":
          if (orientation === "horizontal") {
            if (resolveDirection(currentItem.trigger) === "rtl") {
              toPrev();
            } else {
              toNext();
            }
          }
          break;
        case "ArrowLeft":
          if (orientation === "horizontal") {
            if (resolveDirection(currentItem.trigger) === "rtl") {
              toNext();
            } else {
              toPrev();
            }
          }
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = lastIndex;
          break;
        default:
          return;
      }

      if (nextIndex < 0) return;

      event.preventDefault();
      enabledItems[nextIndex]?.trigger.focus();
    })
  );

  cleanups.push(
    on(root, "accordion:set", (event) => {
      const detail = (event as CustomEvent).detail as { value?: string | string[] } | null;
      const value = detail?.value;
      if (value === undefined) return;

      applyExpandedValues(Array.isArray(value) ? value : [value]);
    })
  );

  const controller: AccordionController = {
    expand: (value: string) => {
      if (!itemValues.has(value) || expandedValues.has(value)) return;
      if (multiple) {
        applyExpandedValues([...expandedValues, value]);
      } else {
        applyExpandedValues([value]);
      }
    },
    collapse: (value: string) => {
      if (!itemValues.has(value) || !expandedValues.has(value)) return;
      applyExpandedValues([...expandedValues].filter((current) => current !== value));
    },
    toggle: (value: string) => {
      if (!itemValues.has(value)) return;
      if (expandedValues.has(value)) {
        controller.collapse(value);
      } else {
        controller.expand(value);
      }
    },
    get value() {
      return [...expandedValues];
    },
    destroy: () => {
      itemRecords.forEach((item) => {
        clearSuppressClickTracking(item);
        item.presence.cleanup();
        clearSizePhaseTracking(item);
        item.sizeObserver?.disconnect();
        item.sizeObserver = null;
      });

      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all accordion components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): AccordionController[] {
  const controllers: AccordionController[] = [];

  for (const root of getRoots(scope, "accordion")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createAccordion(root));
  }

  return controllers;
}
