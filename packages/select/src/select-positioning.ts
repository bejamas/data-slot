import {
  computeFloatingPosition,
  computeFloatingTransformOrigin,
  createPositionSync,
  measurePopupContentRect,
} from "@data-slot/core";
import type { Align, Position, Side } from "./types";

const SIDES = ["top", "bottom"] as const;

type ContentRect = Pick<
  DOMRectReadOnly,
  "top" | "right" | "bottom" | "left" | "width" | "height"
>;
type AnchorRect = Pick<
  DOMRectReadOnly,
  "top" | "left" | "right" | "bottom" | "width" | "height"
>;
type Axis = "top" | "left";

type CollectionSnapshot = {
  items: HTMLElement[];
  enabledItems: HTMLElement[];
  highlightedIndex: number;
  value: string | null;
};

type SelectPositioningOptions = {
  root: Element;
  trigger: HTMLElement;
  content: HTMLElement;
  valueSlot: HTMLElement | null;
  getPositioner: () => HTMLElement;
  getViewport: () => HTMLElement | null;
  isOpen: () => boolean;
  getCollection: () => CollectionSnapshot;
  position: Position;
  preferredSide: Side;
  preferredAlign: Align;
  sideOffset: number;
  alignOffset: number;
  avoidCollisions: boolean;
  collisionPadding: number;
  lockScroll: boolean;
};

/** Owns select popup geometry, item alignment, and resize/scroll position syncing. */
export function createSelectPositioning(options: SelectPositioningOptions) {
  const {
    root,
    trigger,
    content,
    valueSlot,
    getPositioner,
    getViewport,
    isOpen,
    getCollection,
    position,
    preferredSide,
    preferredAlign,
    sideOffset,
    alignOffset,
    avoidCollisions,
    collisionPadding,
    lockScroll,
  } = options;
  const getScrollContainer = () => getViewport() ?? content;
  const getItemText = (item: HTMLElement) =>
    item.querySelector<HTMLElement>('[data-slot="select-item-text"]');
  const getMeasuredRect = (element: HTMLElement | null) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 ? rect : null;
  };
  const syncResolvedPositionAttributes = (
    alignTriggerActive = position === "item-aligned",
  ) => {
    content.setAttribute("data-position", position);
    content.setAttribute(
      "data-align-trigger",
      alignTriggerActive ? "true" : "false",
    );
    getViewport()?.setAttribute("data-position", position);
  };
  const getTriggerAlignmentRect = (triggerRect: DOMRect): AnchorRect =>
    getMeasuredRect(valueSlot) ?? triggerRect;
  const getOffsetInAncestorPaddingBox = (
    item: HTMLElement,
    ancestor: HTMLElement,
    ancestorRect: ContentRect,
    scrollOffset: number,
    axis: Axis,
  ) => {
    const offsetKey = axis === "top" ? "offsetTop" : "offsetLeft";
    const clientKey = axis === "top" ? "clientTop" : "clientLeft";
    const rectKey = axis === "top" ? "top" : "left";
    let offset = 0;
    let node: HTMLElement | null = item;
    while (node && node !== ancestor) {
      offset += node[offsetKey];
      const offsetParent: Element | null = node.offsetParent;
      if (!(offsetParent instanceof HTMLElement)) {
        offset = Number.NaN;
        break;
      }
      if (offsetParent !== ancestor) offset += offsetParent[clientKey];
      node = offsetParent;
    }
    if (node === ancestor && Number.isFinite(offset)) return offset;
    const itemRect = item.getBoundingClientRect();
    return (
      itemRect[rectKey] -
      ancestorRect[rectKey] -
      ancestor[clientKey] +
      scrollOffset
    );
  };
  const getItemTopInContent = (
    item: HTMLElement,
    cr: ContentRect,
    scrollContainer: HTMLElement,
  ) =>
    getOffsetInAncestorPaddingBox(
      item,
      content,
      cr,
      scrollContainer.scrollTop,
      "top",
    ) + content.clientTop;
  const getItemAlignmentAnchor = (item: HTMLElement) => {
    const itemText = getItemText(item);
    return getMeasuredRect(itemText) ? itemText! : item;
  };
  const computeItemAlignedPos = (
    tr: DOMRect,
    cr: ContentRect,
    scrollContainer: HTMLElement,
  ) => {
    const { items, enabledItems, highlightedIndex, value } = getCollection();
    const highlightedItem =
      highlightedIndex >= 0 ? enabledItems[highlightedIndex] : undefined;
    const selectedItem = items.find((item) => item.dataset["value"] === value);
    const alignItem = selectedItem ?? highlightedItem ?? enabledItems[0];
    const triggerAlignmentRect = getTriggerAlignmentRect(tr);
    const valueRect = getMeasuredRect(valueSlot);
    let x = tr.left;
    let y: number;
    let anchorTopInContent = 0;
    let anchorHeight = triggerAlignmentRect.height;
    if (alignItem) {
      const itemText = getItemText(alignItem);
      const hasExactTextAlignment = Boolean(
        valueRect && getMeasuredRect(itemText),
      );
      const alignAnchor =
        hasExactTextAlignment && itemText
          ? itemText
          : getItemAlignmentAnchor(alignItem);
      const alignAnchorRect =
        getMeasuredRect(alignAnchor) ?? alignAnchor.getBoundingClientRect();
      anchorTopInContent = getItemTopInContent(
        alignAnchor,
        cr,
        scrollContainer,
      );
      anchorHeight =
        alignAnchorRect.height ||
        alignAnchor.offsetHeight ||
        alignItem.getBoundingClientRect().height ||
        alignItem.offsetHeight ||
        triggerAlignmentRect.height;
      if (hasExactTextAlignment && valueRect)
        x = valueRect.left - (alignAnchorRect.left - cr.left);
      y =
        triggerAlignmentRect.top +
        triggerAlignmentRect.height / 2 -
        anchorTopInContent -
        anchorHeight / 2;
    } else y = tr.top;
    return {
      x,
      y,
      alignItem,
      anchorTopInContent,
      anchorHeight,
      triggerAlignmentRect,
    };
  };
  const update = () => {
    const positioner = getPositioner();
    const win = root.ownerDocument.defaultView ?? window;
    const tr = trigger.getBoundingClientRect();
    const scrollContainer = getScrollContainer();
    content.style.minWidth = `${tr.width}px`;
    const cr = measurePopupContentRect(content);
    let pos: { x: number; y: number };
    let side: Side = "bottom";
    let transformOrigin: string;
    let alignTriggerActive = position === "item-aligned";
    if (position === "item-aligned") {
      const minHeight =
        Number.parseFloat(win.getComputedStyle(content).minHeight) || 0;
      const availableHeight = Math.max(
        0,
        win.innerHeight - collisionPadding * 2,
      );
      const hasTriggerGeometry = tr.width > 0 || tr.height > 0;
      const nearViewportEdge =
        hasTriggerGeometry &&
        (tr.top < collisionPadding + 20 ||
          tr.bottom > win.innerHeight - collisionPadding - 20);
      const heightTooConstrained =
        cr.height > 0 &&
        ((scrollContainer.scrollHeight <= scrollContainer.clientHeight &&
          cr.height > availableHeight + 0.5) ||
          (minHeight > 0 &&
            availableHeight + 0.5 <
              Math.min(scrollContainer.scrollHeight || cr.height, minHeight)));
      if (nearViewportEdge || heightTooConstrained) {
        alignTriggerActive = false;
        const floating = computeFloatingPosition({
          anchorRect: tr,
          contentRect: cr,
          side: preferredSide,
          align: preferredAlign,
          sideOffset,
          alignOffset,
          avoidCollisions,
          collisionPadding,
          allowedSides: SIDES,
        });
        pos = { x: floating.x, y: floating.y };
        side = floating.side as Side;
        transformOrigin = computeFloatingTransformOrigin({
          side,
          align: floating.align,
          anchorRect: tr,
          popupX: pos.x,
          popupY: pos.y,
        });
      } else {
        const aligned = computeItemAlignedPos(tr, cr, scrollContainer);
        pos = { x: aligned.x, y: aligned.y };
        const triggerCenterX =
          aligned.triggerAlignmentRect.left +
          aligned.triggerAlignmentRect.width / 2;
        const triggerCenterY =
          aligned.triggerAlignmentRect.top +
          aligned.triggerAlignmentRect.height / 2;
        const clamp = (value: number, minimum: number, maximum: number) =>
          avoidCollisions
            ? maximum < minimum
              ? minimum
              : Math.min(Math.max(value, minimum), maximum)
            : value;
        pos.x = clamp(
          pos.x,
          collisionPadding,
          win.innerWidth - cr.width - collisionPadding,
        );
        if (aligned.alignItem) {
          const maxScrollTop = Math.max(
            0,
            scrollContainer.scrollHeight - scrollContainer.clientHeight,
          );
          const desiredScrollTop = (currentY: number) =>
            aligned.anchorTopInContent +
            aligned.anchorHeight / 2 -
            (triggerCenterY - currentY);
          if (maxScrollTop > 0) {
            pos.y = clamp(
              triggerCenterY - cr.height / 2,
              collisionPadding,
              win.innerHeight - cr.height - collisionPadding,
            );
            let scrollTop = Math.min(
              Math.max(desiredScrollTop(pos.y), 0),
              maxScrollTop,
            );
            scrollContainer.scrollTop = scrollTop;
            pos.y = clamp(
              triggerCenterY -
                (aligned.anchorTopInContent -
                  scrollTop +
                  aligned.anchorHeight / 2),
              collisionPadding,
              win.innerHeight - cr.height - collisionPadding,
            );
            scrollTop = Math.min(
              Math.max(desiredScrollTop(pos.y), 0),
              maxScrollTop,
            );
            scrollContainer.scrollTop = scrollTop;
            pos.y = clamp(
              triggerCenterY -
                (aligned.anchorTopInContent -
                  scrollTop +
                  aligned.anchorHeight / 2),
              collisionPadding,
              win.innerHeight - cr.height - collisionPadding,
            );
          } else {
            scrollContainer.scrollTop = 0;
            pos.y = clamp(
              aligned.y,
              collisionPadding,
              win.innerHeight - cr.height - collisionPadding,
            );
          }
        } else {
          scrollContainer.scrollTop = 0;
          pos.y = clamp(
            aligned.y,
            collisionPadding,
            win.innerHeight - cr.height - collisionPadding,
          );
        }
        side = pos.y < tr.top ? "top" : "bottom";
        transformOrigin = `${Math.min(Math.max(triggerCenterX - pos.x, 0), cr.width)}px ${Math.min(Math.max(triggerCenterY - pos.y, 0), cr.height)}px`;
      }
    } else {
      const floating = computeFloatingPosition({
        anchorRect: tr,
        contentRect: cr,
        side: preferredSide,
        align: preferredAlign,
        sideOffset,
        alignOffset,
        avoidCollisions,
        collisionPadding,
        allowedSides: SIDES,
      });
      pos = { x: floating.x, y: floating.y };
      side = floating.side as Side;
      transformOrigin = computeFloatingTransformOrigin({
        side,
        align: floating.align,
        anchorRect: tr,
        popupX: pos.x,
        popupY: pos.y,
      });
    }
    const resolvedAlign: Align =
      position === "item-aligned" && alignTriggerActive
        ? "center"
        : preferredAlign;
    positioner.style.position = lockScroll ? "fixed" : "absolute";
    positioner.style.top = "0px";
    positioner.style.left = "0px";
    positioner.style.transform = `translate3d(${pos.x + (lockScroll ? 0 : win.scrollX)}px, ${pos.y + (lockScroll ? 0 : win.scrollY)}px, 0)`;
    positioner.style.setProperty("--transform-origin", transformOrigin);
    positioner.style.willChange = "transform";
    positioner.style.margin = "0";
    syncResolvedPositionAttributes(alignTriggerActive);
    content.setAttribute("data-side", side);
    content.setAttribute("data-align", resolvedAlign);
    if (positioner !== content) {
      positioner.setAttribute("data-side", side);
      positioner.setAttribute("data-align", resolvedAlign);
    }
  };
  const sync = createPositionSync({
    observedElements: [trigger, content],
    isActive: isOpen,
    ancestorScroll: lockScroll,
    onUpdate: update,
    ignoreScrollTarget: (target) =>
      target instanceof Node && content.contains(target),
  });
  return {
    update,
    start: () => sync.start(),
    stop: () => sync.stop(),
    sync: () => sync.update(),
    syncResolvedPositionAttributes,
  };
}
