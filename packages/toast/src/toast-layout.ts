import { getFocusable, isFocusable } from "@data-slot/core";

const DEFAULT_GAP = 8;
const DEFAULT_COLLAPSED_PEEK = 14;
const PREV_TAB_INDEX_ATTR = "data-toast-prev-tabindex";
const NO_TAB_INDEX = "__none__";
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

/**
 * Author CSS pins each item's height to tokens this module writes, so the
 * rendered box never reflects the item's natural size. Override the height
 * inline for the duration of one synchronous read, then put it back. The
 * write and restore land in the same task, so no transition or resize fires.
 */
const measureNaturalHeight = (item: HTMLElement): number => {
  const pinnedHeight = item.style.height;
  item.style.height = "auto";
  // offsetHeight ignores transforms such as the collapsed-stack scale.
  const height = item.offsetHeight || item.getBoundingClientRect().height;
  item.style.height = pinnedHeight;
  return height;
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
  const naturalHeights = new WeakMap<HTMLElement, number>();
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

      const height = measureNaturalHeight(item) || (naturalHeights.get(item) ?? 0);
      // Remember the last real size so hidden items (e.g. display: none overflow) keep their offsets.
      if (height > 0) naturalHeights.set(item, height);
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
