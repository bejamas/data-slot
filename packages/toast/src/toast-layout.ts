import { getFocusable, isFocusable } from "@data-slot/core";

const DEFAULT_GAP = 8;
const DEFAULT_COLLAPSED_PEEK = 14;
const PREV_TAB_INDEX_ATTR = "data-toast-prev-tabindex";
const NO_TAB_INDEX = "__none__";
const RUNTIME_MEASUREMENT_ATTRS = [
  "data-mounted",
  "data-expanded",
  "data-front",
  "data-visible",
  "data-removed",
  "data-swiping",
  "data-swipe-out",
  "aria-hidden",
  "inert",
] as const;
const RUNTIME_MEASUREMENT_STYLE_PROPS = [
  "--toast-index",
  "--toast-count",
  "--toast-height",
  "--toast-initial-height",
  "--toast-offset",
  "--toast-expanded-offset-y",
  "--toast-collapsed-offset-y",
  "--toast-offset-y",
  "--toast-lift",
  "--toast-stack-direction",
  "--toast-swipe-movement-x",
  "--toast-swipe-movement-y",
  "--toast-swipe-end-x",
  "--toast-swipe-end-y",
] as const;

const getCssGap = (viewport: HTMLElement): number => {
  const raw = getComputedStyle(viewport).getPropertyValue("--toast-gap").trim();
  if (!raw) return DEFAULT_GAP;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_GAP;
};

const getCssCollapsedPeek = (viewport: HTMLElement): number => {
  const raw = getComputedStyle(viewport).getPropertyValue("--toast-collapsed-peek").trim();
  if (!raw) return DEFAULT_COLLAPSED_PEEK;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_COLLAPSED_PEEK;
  return Math.max(0, parsed);
};

const getToastHeight = (
  item: HTMLElement,
  viewport: HTMLElement,
  fallbackWidth: number,
): number => {
  const rectHeight = item.getBoundingClientRect().height;
  const renderedHeight = rectHeight > 0 ? rectHeight : item.offsetHeight;
  const intrinsicHeight = item.scrollHeight;
  const styles = getComputedStyle(item);
  const borderTop = Number.parseFloat(styles.borderTopWidth);
  const borderBottom = Number.parseFloat(styles.borderBottomWidth);
  const borderHeight =
    (Number.isFinite(borderTop) ? borderTop : 0) +
    (Number.isFinite(borderBottom) ? borderBottom : 0);
  const intrinsicBorderBoxHeight =
    intrinsicHeight > 0 ? intrinsicHeight + borderHeight : 0;
  const measurementWidth =
    item.getBoundingClientRect().width || item.offsetWidth || fallbackWidth;

  if (measurementWidth > 0) {
    const clone = item.cloneNode(true) as HTMLElement;
    for (const attr of RUNTIME_MEASUREMENT_ATTRS) {
      clone.removeAttribute(attr);
    }
    for (const prop of RUNTIME_MEASUREMENT_STYLE_PROPS) {
      clone.style.removeProperty(prop);
    }

    clone.setAttribute("aria-hidden", "true");
    clone.style.position = "absolute";
    clone.style.inset = "0 auto auto 0";
    clone.style.width = `${measurementWidth}px`;
    clone.style.height = "auto";
    clone.style.maxHeight = "none";
    clone.style.pointerEvents = "none";
    clone.style.visibility = "hidden";
    clone.style.opacity = "1";
    clone.style.transform = "none";
    clone.style.transition = "none";
    clone.style.animation = "none";
    clone.style.zIndex = "-1";

    viewport.append(clone);
    const cloneRectHeight = clone.getBoundingClientRect().height;
    const cloneHeight = cloneRectHeight > 0 ? cloneRectHeight : clone.offsetHeight;
    clone.remove();

    if (cloneHeight > 0) {
      return cloneHeight;
    }
  }

  if (intrinsicBorderBoxHeight > 0) {
    return intrinsicBorderBoxHeight;
  }
  return renderedHeight;
};

export const getToastFocusableNodes = (item: HTMLElement): HTMLElement[] => {
  const nodes = getFocusable(item);
  // Core discovery returns descendants; an authored toast root can also receive focus.
  if (isFocusable(item)) {
    nodes.unshift(item);
  }
  return nodes.filter((node) => node.getAttribute("aria-hidden") !== "true");
};

const getManagedFocusableNodes = (item: HTMLElement): HTMLElement[] => {
  const nodes = [...item.querySelectorAll<HTMLElement>(`[${PREV_TAB_INDEX_ATTR}]`)];
  if (item.hasAttribute(PREV_TAB_INDEX_ATTR)) {
    nodes.unshift(item);
  }

  return nodes;
};

const setItemVisibilityInteractivity = (item: HTMLElement, isVisible: boolean) => {
  if (isVisible) {
    item.removeAttribute("aria-hidden");
    item.removeAttribute("inert");

    for (const node of getManagedFocusableNodes(item)) {
      const previousTabIndex = node.getAttribute(PREV_TAB_INDEX_ATTR);
      node.removeAttribute(PREV_TAB_INDEX_ATTR);
      if (!previousTabIndex || previousTabIndex === NO_TAB_INDEX) {
        node.removeAttribute("tabindex");
      } else {
        node.setAttribute("tabindex", previousTabIndex);
      }
    }
    return;
  }

  for (const node of getToastFocusableNodes(item)) {
    if (!node.hasAttribute(PREV_TAB_INDEX_ATTR)) {
      const existingTabIndex = node.getAttribute("tabindex");
      node.setAttribute(
        PREV_TAB_INDEX_ATTR,
        existingTabIndex === null ? NO_TAB_INDEX : existingTabIndex,
      );
    }
    node.setAttribute("tabindex", "-1");
  }

  item.setAttribute("aria-hidden", "true");
  item.setAttribute("inert", "");
};

interface ToastLayoutOptions {
  viewport: HTMLElement;
  limit: number;
  stackDirection: number;
  getItems(): readonly HTMLElement[];
  onLayout(): void;
}

/** Owns stack measurement, overflow interactivity, and resize observation. */
export function createToastLayout({ viewport, limit, stackDirection, getItems, onLayout }: ToastLayoutOptions) {
  const doc = viewport.ownerDocument;
  const observed = new Set<HTMLElement>();
  let destroyed = false;
  const setExpanded = (expanded: boolean) => {
    if (expanded) {
      viewport.setAttribute("data-expanded", "");
    } else {
      viewport.removeAttribute("data-expanded");
    }

    const targetStackSize = expanded
      ? viewport.style.getPropertyValue("--toast-expanded-stack-size")
      : viewport.style.getPropertyValue("--toast-collapsed-stack-size");
    viewport.style.setProperty(
      "--toast-stack-size",
      targetStackSize.trim() !== "" ? targetStackSize : "0px",
    );
    for (const item of observed) item.setAttribute("data-expanded", String(expanded));
  };

  const update = () => {
    if (destroyed) return;
    const newestFirst = getItems();
    const gap = getCssGap(viewport);
    const collapsedPeek = getCssCollapsedPeek(viewport);
    const count = newestFirst.length;
    let expandedOffset = 0;
    let visibleExpandedOffset = 0;
    let visibleCount = 0;
    let frontHeight = 0;

    for (let index = 0; index < newestFirst.length; index += 1) {
      const item = newestFirst[index];
      if (!item) continue;
      const isVisible = index < limit;
      const wasVisible = item.getAttribute("data-visible") !== "false";

      const height = getToastHeight(
        item,
        viewport,
        viewport.getBoundingClientRect().width || viewport.clientWidth,
      );
      if (index === 0) {
        frontHeight = height;
      }
      const collapsedOffset = index * collapsedPeek;

      item.style.setProperty("--toast-index", String(index));
      item.style.setProperty("--toast-count", String(count));
      item.style.setProperty("--toast-height", `${height}px`);
      item.style.setProperty("--toast-initial-height", `${height}px`);
      item.style.setProperty("--toast-offset", `${expandedOffset}px`);
      item.style.setProperty("--toast-expanded-offset-y", `${expandedOffset}px`);
      item.style.setProperty("--toast-collapsed-offset-y", `${collapsedOffset}px`);
      item.style.setProperty("--toast-offset-y", `${expandedOffset}px`);
      item.style.setProperty("--toast-lift", String(stackDirection));
      item.style.setProperty("--toast-stack-direction", String(stackDirection));
      item.setAttribute("data-front", String(index === 0));
      item.setAttribute("data-visible", String(isVisible));
      item.setAttribute("data-removed", "false");
      item.style.zIndex = String(count - index + 1);
      item.style.pointerEvents = isVisible ? "" : "none";
      if (!isVisible && wasVisible) {
        const active = doc.activeElement;
        if (active instanceof HTMLElement && item.contains(active)) {
          active.blur();
        }
      }
      setItemVisibilityInteractivity(item, isVisible);

      expandedOffset += height + gap;
      if (isVisible) {
        visibleCount += 1;
        visibleExpandedOffset += height + gap;
      }
    }

    const expandedStackSize =
      visibleCount > 0 ? Math.max(0, visibleExpandedOffset - gap) : 0;
    const collapsedStackSize =
      visibleCount > 0 ? Math.max(0, frontHeight + collapsedPeek * (visibleCount - 1)) : 0;
    viewport.style.setProperty("--toast-count", String(count));
    viewport.style.setProperty("--toast-frontmost-height", `${frontHeight}px`);
    viewport.style.setProperty("--toast-expanded-stack-size", `${expandedStackSize}px`);
    viewport.style.setProperty("--toast-collapsed-stack-size", `${collapsedStackSize}px`);
    viewport.style.setProperty("--toast-lift", String(stackDirection));
    viewport.style.setProperty("--toast-stack-direction", String(stackDirection));

    onLayout();
  };

  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
  return {
    update,
    setExpanded,
    observe(item: HTMLElement) {
      observed.add(item);
      observer?.observe(item);
    },
    unobserve(item: HTMLElement) {
      observed.delete(item);
      observer?.unobserve(item);
    },
    destroy() {
      destroyed = true;
      observer?.disconnect();
      observed.clear();
      viewport.removeAttribute("data-expanded");
    },
  };
}
