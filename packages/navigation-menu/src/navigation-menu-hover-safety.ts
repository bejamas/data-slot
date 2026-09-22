import { getDataBool, on } from "@data-slot/core";
import type { LayoutSnapshot } from "./navigation-menu-layout";
import type { NavigationMenuPopupStack } from "./navigation-menu-popup-stack";

interface Point {
  x: number;
  y: number;
}
interface HoverSafeTriangle {
  apex: Point;
  edgeA: Point;
  edgeB: Point;
}

export interface NavigationMenuHoverSafetyOptions {
  root: Element;
  viewport: HTMLElement | null;
  popup: Pick<NavigationMenuPopupStack, "popup" | "positioner">;
  safeTriangle?: boolean;
  debugSafeTriangle?: boolean;
  activePanel(): { trigger: HTMLElement; content: HTMLElement } | null;
  onBridgeEnter(): void;
  onBridgeLeave(next: Node | null): void;
}

export interface NavigationMenuHoverSafety {
  update(snapshot: LayoutSnapshot): void;
  contains(node: Node | null): boolean;
  inCorridor(event: PointerEvent): boolean;
  clear(): void;
  hideBridge(): void;
  refreshDebug(): void;
  destroy(): void;
}

/** Owns hover-gap shielding, safe-triangle geometry, and optional debug DOM. */
export function createNavigationMenuHoverSafety(
  options: NavigationMenuHoverSafetyOptions,
): NavigationMenuHoverSafety {
  const { root, viewport, popup, activePanel, onBridgeEnter, onBridgeLeave } =
    options;
  const safeTriangle =
    options.safeTriangle ?? getDataBool(root, "safeTriangle") ?? false;
  const debugSafeTriangle =
    options.debugSafeTriangle ??
    getDataBool(root, "debugSafeTriangle") ??
    false;
  const safeTriangleEnabled = safeTriangle || debugSafeTriangle;
  const cleanups: Array<() => void> = [];
  let hoverBridge: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;

  const getBridgeHost = (): HTMLElement | null => {
    if (!viewport) return null;
    if (popup.positioner) return popup.positioner;
    if (popup.popup) return popup.popup;
    return viewport.parentElement instanceof HTMLElement
      ? viewport.parentElement
      : viewport;
  };
  const getOrCreateHoverBridge = (): HTMLElement => {
    const host = getBridgeHost();
    if (!hoverBridge) {
      hoverBridge = root.ownerDocument.createElement("div");
      hoverBridge.setAttribute("data-slot", "navigation-menu-bridge");
      hoverBridge.style.cssText =
        "position: absolute; pointer-events: auto; z-index: 0; display: none;";
      cleanups.push(
        on(hoverBridge, "pointerenter", onBridgeEnter),
        on(hoverBridge, "pointerleave", (event) =>
          onBridgeLeave((event as PointerEvent).relatedTarget as Node | null),
        ),
      );
    }
    if (host && hoverBridge.parentElement !== host)
      host.insertBefore(hoverBridge, host.firstChild);
    return hoverBridge;
  };
  const hideBridge = () => {
    if (!hoverBridge) return;
    Object.assign(hoverBridge.style, {
      height: "0",
      width: "0",
      top: "0px",
      left: "0px",
      right: "0px",
      bottom: "auto",
      transform: "none",
      clipPath: "none",
      display: "none",
    });
  };
  const getOverlay = (): HTMLElement | null => {
    if (!debugSafeTriangle || !root.ownerDocument.body) return null;
    if (!overlay) {
      overlay = root.ownerDocument.createElement("div");
      overlay.setAttribute("data-slot", "navigation-menu-safe-triangle");
      overlay.style.cssText =
        "position: fixed; pointer-events: none; display: none; z-index: 2147483647; background: rgba(255, 0, 0, 0.18); border: 1px solid rgba(255, 0, 0, 0.45)";
    }
    if (overlay.parentElement !== root.ownerDocument.body)
      root.ownerDocument.body.appendChild(overlay);
    return overlay;
  };
  const hideOverlay = () => {
    if (!overlay) return;
    Object.assign(overlay.style, {
      width: "0",
      height: "0",
      clipPath: "none",
      display: "none",
    });
  };
  const clear = () => {
    if (!debugSafeTriangle) hideOverlay();
  };
  const draw = (triangle: HoverSafeTriangle) => {
    const target = getOverlay();
    if (!target) return;
    const { apex, edgeA, edgeB } = triangle;
    const minX = Math.min(apex.x, edgeA.x, edgeB.x),
      minY = Math.min(apex.y, edgeA.y, edgeB.y);
    const width = Math.max(1, Math.max(apex.x, edgeA.x, edgeB.x) - minX),
      height = Math.max(1, Math.max(apex.y, edgeA.y, edgeB.y) - minY);
    const normalize = (point: Point) =>
      `${((point.x - minX) / width) * 100}% ${((point.y - minY) / height) * 100}%`;
    Object.assign(target.style, {
      display: "block",
      left: `${minX}px`,
      top: `${minY}px`,
      width: `${width}px`,
      height: `${height}px`,
      clipPath: `polygon(${normalize(apex)}, ${normalize(edgeA)}, ${normalize(edgeB)})`,
    });
  };
  const sign = (p1: Point, p2: Point, p3: Point) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const isPointInTriangle = (point: Point, a: Point, b: Point, c: Point) => {
    const d1 = sign(point, a, b),
      d2 = sign(point, b, c),
      d3 = sign(point, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const getFacingEdge = (
    apex: Point,
    rootRect: DOMRect,
    target: DOMRect,
  ): [Point, Point] => {
    const epsilon = 0.5;
    if (target.top >= rootRect.bottom - epsilon)
      return [
        { x: target.left, y: target.top },
        { x: target.right, y: target.top },
      ];
    if (target.bottom <= rootRect.top + epsilon)
      return [
        { x: target.left, y: target.bottom },
        { x: target.right, y: target.bottom },
      ];
    if (target.left >= rootRect.right - epsilon)
      return [
        { x: target.left, y: target.top },
        { x: target.left, y: target.bottom },
      ];
    if (target.right <= rootRect.left + epsilon)
      return [
        { x: target.right, y: target.top },
        { x: target.right, y: target.bottom },
      ];
    const edges: Array<[Point, Point]> = [
      [
        { x: target.left, y: target.top },
        { x: target.right, y: target.top },
      ],
      [
        { x: target.right, y: target.top },
        { x: target.right, y: target.bottom },
      ],
      [
        { x: target.left, y: target.bottom },
        { x: target.right, y: target.bottom },
      ],
      [
        { x: target.left, y: target.top },
        { x: target.left, y: target.bottom },
      ],
    ];
    return edges.reduce((best, edge) =>
      Math.abs(
        edge[0].y === edge[1].y ? apex.y - edge[0].y : apex.x - edge[0].x,
      ) <
      Math.abs(
        best[0].y === best[1].y ? apex.y - best[0].y : apex.x - best[0].x,
      )
        ? edge
        : best,
    );
  };
  const buildTriangle = (
    trigger: DOMRect,
    rootRect: DOMRect,
    target: DOMRect,
  ): HoverSafeTriangle | null => {
    if (target.width <= 0 || target.height <= 0) return null;
    const apex = {
      x: trigger.left + trigger.width / 2,
      y: trigger.top + trigger.height * 0.62,
    };
    let [edgeA, edgeB] = getFacingEdge(apex, rootRect, target);
    const span =
      edgeA.x === edgeB.x
        ? Math.abs(edgeB.y - edgeA.y)
        : Math.abs(edgeB.x - edgeA.x);
    const inset = span <= 28 ? 0 : Math.min(10, (span - 28) / 2);
    if (edgeA.x === edgeB.x) {
      const min = Math.min(edgeA.y, edgeB.y);
      const max = Math.max(edgeA.y, edgeB.y);
      edgeA = { x: edgeA.x, y: min + inset };
      edgeB = { x: edgeB.x, y: max - inset };
    } else {
      const min = Math.min(edgeA.x, edgeB.x);
      const max = Math.max(edgeA.x, edgeB.x);
      edgeA = { x: min + inset, y: edgeA.y };
      edgeB = { x: max - inset, y: edgeB.y };
    }
    return { apex, edgeA, edgeB };
  };
  const currentTriangle = (): HoverSafeTriangle | null => {
    const panel = activePanel();
    if (!safeTriangleEnabled || !viewport || !panel) return null;
    const viewportRect = viewport.getBoundingClientRect(),
      contentRect = panel.content.getBoundingClientRect();
    return buildTriangle(
      panel.trigger.getBoundingClientRect(),
      (root as HTMLElement).getBoundingClientRect(),
      viewportRect.width > 0 && viewportRect.height > 0
        ? viewportRect
        : contentRect,
    );
  };
  const inCorridor = (event: PointerEvent) => {
    const triangle = currentTriangle();
    return (
      !!triangle &&
      isPointInTriangle(
        { x: event.clientX, y: event.clientY },
        triangle.apex,
        triangle.edgeA,
        triangle.edgeB,
      )
    );
  };
  const hull = (points: Point[]) => {
    const unique = Array.from(
      new Map(
        points.map((point) => [
          `${point.x.toFixed(3)}:${point.y.toFixed(3)}`,
          point,
        ]),
      ).values(),
    ).sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    if (unique.length <= 2) return unique;
    const cross = (o: Point, a: Point, b: Point) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = (source: Point[]) => {
      const result: Point[] = [];
      for (const point of source) {
        while (
          result.length >= 2 &&
          cross(
            result[result.length - 2]!,
            result[result.length - 1]!,
            point,
          ) <= 0
        )
          result.pop();
        result.push(point);
      }
      return result;
    };
    const lower = half(unique),
      upper = half([...unique].reverse());
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  };
  const setShape = (points: Point[], offset: Point) => {
    if (points.length < 3) return hideBridge();
    const bridge = getOrCreateHoverBridge();
    const rendered =
      bridge.parentElement === popup.positioner
        ? points.map((point) => ({
            x: point.x - offset.x,
            y: point.y - offset.y,
          }))
        : points;
    const shape = hull(rendered);
    if (shape.length < 3) return hideBridge();
    const minX = Math.min(...shape.map((p) => p.x)),
      minY = Math.min(...shape.map((p) => p.y)),
      maxX = Math.max(...shape.map((p) => p.x)),
      maxY = Math.max(...shape.map((p) => p.y)),
      width = Math.max(1, maxX - minX),
      height = Math.max(1, maxY - minY);
    const normalize = (p: Point) =>
      `${((p.x - minX) / width) * 100}% ${((p.y - minY) / height) * 100}%`;
    Object.assign(bridge.style, {
      display: "block",
      transform: "none",
      bottom: "auto",
      right: "auto",
      left: `${minX}px`,
      top: `${minY}px`,
      width: `${width}px`,
      height: `${height}px`,
      clipPath: `polygon(${shape.map(normalize).join(", ")})`,
    });
  };
  const update = (snapshot: LayoutSnapshot) => {
    const bottom = Math.max(
        0,
        snapshot.viewportRect.top - snapshot.rootRect.bottom,
      ),
      topGap = Math.max(
        0,
        snapshot.rootRect.top - snapshot.viewportRect.bottom,
      ),
      rightGap = Math.max(
        0,
        snapshot.viewportRect.left - snapshot.rootRect.right,
      ),
      leftGap = Math.max(
        0,
        snapshot.rootRect.left - snapshot.viewportRect.right,
      ),
      vertical = Math.max(bottom, topGap, snapshot.viewportMarginTop),
      horizontal = Math.max(rightGap, leftGap);
    const triangle = safeTriangleEnabled
        ? buildTriangle(
            snapshot.triggerRect,
            snapshot.rootRect,
            snapshot.viewportRect,
          )
        : null,
      points: Point[] = [];
    if (vertical >= horizontal && vertical > 0) {
      const gap = Math.max(bottom, topGap, snapshot.viewportMarginTop);
      let left = snapshot.offset.x,
        width = snapshot.contentSize.width;
      const top =
        topGap > bottom && topGap >= snapshot.viewportMarginTop
          ? snapshot.offset.y + snapshot.contentSize.height
          : snapshot.offset.y - gap;
      if (triangle) {
        const min =
            Math.min(triangle.edgeA.x, triangle.edgeB.x) -
            snapshot.rootRect.left,
          max =
            Math.max(triangle.edgeA.x, triangle.edgeB.x) -
            snapshot.rootRect.left;
        left = min - 8;
        width = max - min + 16;
      }
      points.push(
        { x: left, y: top },
        { x: left, y: top },
        { x: left + width, y: top },
        { x: left + width, y: top + gap },
        { x: left, y: top + gap },
      );
    } else if (horizontal > 0) {
      const gap = Math.max(rightGap, leftGap);
      let top = snapshot.offset.y,
        height = snapshot.contentSize.height;
      const left =
        leftGap > rightGap
          ? snapshot.offset.x + snapshot.contentSize.width
          : snapshot.offset.x - gap;
      if (triangle) {
        const min =
            Math.min(triangle.edgeA.y, triangle.edgeB.y) -
            snapshot.rootRect.top,
          max =
            Math.max(triangle.edgeA.y, triangle.edgeB.y) -
            snapshot.rootRect.top;
        top = min - 8;
        height = max - min + 16;
      }
      points.push(
        { x: left, y: top },
        { x: left + gap, y: top },
        { x: left + gap, y: top + height },
        { x: left, y: top + height },
      );
    }
    if (triangle)
      points.push(
        {
          x: triangle.apex.x - snapshot.rootRect.left,
          y: triangle.apex.y - snapshot.rootRect.top,
        },
        {
          x: triangle.edgeA.x - snapshot.rootRect.left,
          y: triangle.edgeA.y - snapshot.rootRect.top,
        },
        {
          x: triangle.edgeB.x - snapshot.rootRect.left,
          y: triangle.edgeB.y - snapshot.rootRect.top,
        },
      );
    setShape(points, snapshot.offset);
    refreshDebug();
  };
  const refreshDebug = () => {
    if (!debugSafeTriangle) return;
    const triangle = currentTriangle();
    if (triangle) draw(triangle);
    else hideOverlay();
  };
  const contains = (node: Node | null) =>
    !!node &&
    (!!activePanel()?.content.contains(node) ||
      !!viewport?.contains(node) ||
      !!popup.popup?.contains(node) ||
      !!hoverBridge?.contains(node) ||
      !!popup.positioner?.contains(node));
  const destroy = () => {
    hideBridge();
    hideOverlay();
    overlay?.remove();
    overlay = null;
    cleanups.splice(0).forEach((cleanup) => cleanup());
  };
  return {
    update,
    contains,
    inCorridor,
    clear,
    hideBridge,
    refreshDebug,
    destroy,
  };
}
