import {
  getRoots,
  getParts,
  getDataNumber,
  getDataBool,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  ensureId,
  on,
  emit,
} from "@data-slot/core";
import {
  adjustLayoutByDelta,
  almostEqual,
  arraysEqual,
  assert,
  calculateAriaValues,
  getUnsafeDefaultLayout,
  resolvePaneConstraints,
  validateLayout,
  type ResolvedPaneConstraints,
} from "./layout";
import { createResizeDrag } from "./drag";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type ResizableDirection = "horizontal" | "vertical";

export type { PaneConstraints } from "./layout";

export interface ResizableOptions {
  /** Layout axis. @default "horizontal" */
  direction?: ResizableDirection;
  /**
   * Amount (in %) to resize by per keyboard arrow press.
   * Shift increases this to a full jump. @default 10
   */
  keyboardResizeBy?: number;
  /** Called whenever the layout changes, with sizes as percentages. */
  onLayoutChange?: (layout: number[]) => void;
}

export interface ResizableController {
  /** Current layout as an array of percentages (one entry per pane). */
  readonly layout: number[];
  /** Imperatively set the full layout. Values are validated/clamped. */
  setLayout(layout: number[]): void;
  /** Resize a pane (by index) to a target size in %. */
  resizePane(paneIndex: number, size: number): void;
  /** Collapse a collapsible pane by index. */
  collapse(paneIndex: number): void;
  /** Expand a collapsed pane by index back to its prior (or min) size. */
  expand(paneIndex: number): void;
  /** Whether the pane at index is currently collapsed. */
  isCollapsed(paneIndex: number): boolean;
  /** Whether the pane at index is currently expanded. */
  isExpanded(paneIndex: number): boolean;
  /** Get the current size (in %) of the pane at index. */
  getSize(paneIndex: number): number;
  /** Cleanup all event listeners and global styles. */
  destroy(): void;
}

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/

const ROOT_BINDING_KEY = "@data-slot/resizable";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/resizable] createResizable() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

const RESIZE_KEYS = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"];

/* -------------------------------------------------------------------------------------------------
 * createResizable
 * -----------------------------------------------------------------------------------------------*/

const readPaneConstraints = (pane: HTMLElement): ResolvedPaneConstraints => resolvePaneConstraints({
  defaultSize: getDataNumber(pane, "defaultSize"),
  minSize: getDataNumber(pane, "minSize"),
  maxSize: getDataNumber(pane, "maxSize"),
  collapsedSize: getDataNumber(pane, "collapsedSize"),
  collapsible: getDataBool(pane, "collapsible"),
});

/**
 * Create a resizable panel group controller for a root element.
 *
 * Expected markup:
 * ```html
 * <div data-slot="resizable" data-direction="horizontal">
 *   <div data-slot="resizable-panel" data-default-size="50" data-min-size="20">A</div>
 *   <div data-slot="resizable-handle"></div>
 *   <div data-slot="resizable-panel" data-default-size="50">B</div>
 * </div>
 * ```
 */
export function createResizable(
  root: Element,
  options: ResizableOptions = {},
): ResizableController {
  const existing = reuseRootBinding<ResizableController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING,
  );
  if (existing) return existing;

  const direction =
    options.direction ??
    (root.getAttribute("data-direction") as ResizableDirection | null) ??
    "horizontal";
  const keyboardResizeBy = options.keyboardResizeBy ?? getDataNumber(root, "keyboardResizeBy") ?? 10;
  const onLayoutChange = options.onLayoutChange;

  const panes = getParts<HTMLElement>(root, "resizable-panel");
  const handles = getParts<HTMLElement>(root, "resizable-handle");

  if (!panes || panes.length === 0) {
    throw new Error("Resizable requires at least one resizable-panel slot");
  }
  if (handles.length !== panes.length - 1) {
    throw new Error(
      `Resizable expects exactly ${panes.length - 1} handle(s) for ${panes.length} panes, got ${handles.length}`,
    );
  }

  const doc = root.ownerDocument ?? document;
  const isHorizontal = direction === "horizontal";

  const constraints = panes.map(readPaneConstraints);
  let layout = validateLayout(getUnsafeDefaultLayout(constraints), constraints);
  const sizeBeforeCollapse = new Map<number, number>();
  const cleanups: Array<() => void> = [];

  // ---- DOM wiring -------------------------------------------------------------

  ensureId(root, "resizable");
  (root as HTMLElement).style.display = "flex";
  (root as HTMLElement).style.flexDirection = isHorizontal ? "row" : "column";
  (root as HTMLElement).style.overflow = "hidden";
  root.setAttribute("data-slot", "resizable");
  root.setAttribute("data-direction", direction);

  panes.forEach((pane) => {
    ensureId(pane, "resizable-panel");
    pane.setAttribute("data-direction", direction);
    pane.style.flexBasis = "0";
    pane.style.flexShrink = "1";
    pane.style.overflow = "hidden";
    // flex-grow is set by applyLayout() below, which is the single source of
    // truth for sizing. (CSS normalizes the number on assignment, so the
    // serialized value is engine-defined, e.g. "25" — never rely on "25.0".)
  });

  handles.forEach((handle, i) => {
    ensureId(handle, "resizable-handle");
    handle.setAttribute("role", "separator");
    handle.setAttribute("data-direction", direction);
    handle.setAttribute("aria-orientation", isHorizontal ? "vertical" : "horizontal");
    if (!handle.hasAttribute("tabindex")) handle.setAttribute("tabindex", "0");
    handle.style.touchAction = "none";
    handle.style.userSelect = "none";
    (handle.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = "none";
    handle.setAttribute("aria-controls", panes[i]!.id);
  });

  const setDataState = (): void => {
    panes.forEach((pane, i) => {
      const collapsed = isPaneCollapsed(i);
      pane.setAttribute("data-state", collapsed ? "collapsed" : "expanded");
      if (collapsed) {
        pane.setAttribute("data-collapsed", "");
        pane.removeAttribute("data-expanded");
      } else {
        pane.setAttribute("data-expanded", "");
        pane.removeAttribute("data-collapsed");
      }
    });
  };

  const applyLayout = (): void => {
    panes.forEach((pane, i) => {
      pane.style.flexGrow = panes.length === 1 ? "1" : layout[i]!.toPrecision(3);
      pane.style.pointerEvents = drag.activeHandle !== null ? "none" : "";
    });
    handles.forEach((handle, i) => {
      const { valueMax, valueMin, valueNow } = calculateAriaValues(layout, constraints, [i, i + 1]);
      handle.setAttribute("aria-valuemax", `${Math.round(valueMax)}`);
      handle.setAttribute("aria-valuemin", `${Math.round(valueMin)}`);
      handle.setAttribute("aria-valuenow", valueNow != null ? `${Math.round(valueNow)}` : "");
    });
    setDataState();
  };

  const commitLayout = (next: number[]): void => {
    if (arraysEqual(layout, next)) return;
    constraints.forEach((c, index) => {
      if (c.collapsible && !almostEqual(layout[index]!, c.collapsedSize) && almostEqual(next[index]!, c.collapsedSize)) {
        sizeBeforeCollapse.set(index, layout[index]!);
      }
    });
    layout = next;
    applyLayout();
    emit(root, "resizable:change", { layout: [...layout] });
    onLayoutChange?.([...layout]);
  };

  function isPaneCollapsed(index: number): boolean {
    const c = constraints[index];
    const size = layout[index];
    if (!c || typeof size !== "number") return false;
    const { collapsedSize, collapsible } = c;
    return collapsible === true && almostEqual(size, collapsedSize);
  }

  function isPaneExpanded(index: number): boolean {
    const c = constraints[index];
    const size = layout[index];
    if (!c || size == null) return false;
    const { collapsedSize, collapsible } = c;
    return !collapsible || size > collapsedSize;
  }

  const pivotForHandle = (handleIndex: number): [number, number] => [handleIndex, handleIndex + 1];

  // ---- Resize handlers --------------------------------------------------------

  const deltaForKeyboard = (e: KeyboardEvent): number => {
    const step = e.shiftKey ? 100 : keyboardResizeBy;

    switch (e.key) {
      case "ArrowDown":
        return isHorizontal ? 0 : step;
      case "ArrowLeft":
        return isHorizontal ? -step : 0;
      case "ArrowRight":
        return isHorizontal ? step : 0;
      case "ArrowUp":
        return isHorizontal ? 0 : -step;
      case "End":
        return 100;
      case "Home":
        return -100;
      default:
        return 0;
    }
  };

  const drag = createResizeDrag({
    root: root as HTMLElement,
    handles,
    horizontal: isHorizontal,
    getLayout: () => [...layout],
    onMove(handleIndex, initialLayout, delta) {
      const next = adjustLayoutByDelta(delta, initialLayout, constraints, pivotForHandle(handleIndex), "mouse-or-touch");
      const changed = !arraysEqual(layout, next);
      commitLayout(next);
      return changed;
    },
    onActiveChange(dragging) {
      applyLayout();
      emit(root, "resizable:dragging", { dragging });
    },
  });
  cleanups.push(() => drag.destroy());

  const resizeFromKeyboard = (handleIndex: number, event: KeyboardEvent): void => {
    let delta = deltaForKeyboard(event);
    if (delta === 0) return;
    drag.stop();
    if (doc.dir === "rtl" && isHorizontal) delta = -delta;
    commitLayout(adjustLayoutByDelta(delta, layout, constraints, pivotForHandle(handleIndex), "keyboard"));
  };

  // ---- Listeners --------------------------------------------------------------

  handles.forEach((handle, handleIndex) => {
    cleanups.push(on(handle, "focus", () => handle.setAttribute("data-active", "keyboard")));
    cleanups.push(
      on(handle, "blur", () => {
        if (drag.activeHandle !== handleIndex) {
          handle.removeAttribute("data-active");
        }
      }),
    );
    cleanups.push(
      on(handle, "keydown", (ke) => {
        if (handle.getAttribute("data-disabled") === "true" || ke.defaultPrevented) {
          return;
        }
        if (RESIZE_KEYS.includes(ke.key)) {
          ke.preventDefault();
          resizeFromKeyboard(handleIndex, ke);
          return;
        }
        if (ke.key === "Enter") {
          // Toggle collapse on the pane before the handle.
          ke.preventDefault();
          if (isPaneCollapsed(handleIndex)) expand(handleIndex);
          else collapse(handleIndex);
          return;
        }
        if (ke.key === "F6") {
          ke.preventDefault();
          const order = ke.shiftKey
            ? (handleIndex - 1 + handles.length) % handles.length
            : (handleIndex + 1) % handles.length;
          handles[order]!.focus();
        }
      }),
    );
  });

  // ---- Imperative API ---------------------------------------------------------

  const getSize = (paneIndex: number): number => {
    const size = layout[paneIndex];
    assert(Number.isInteger(paneIndex) && size != null, "Invalid pane index.");
    return size;
  };

  const resizePane = (paneIndex: number, unsafeSize: number): void => {
    const current = getSize(paneIndex);
    assert(Number.isFinite(unsafeSize), "Pane size must be finite.");
    if (panes.length === 1) return;
    drag.stop();
    const isLast = paneIndex === panes.length - 1;
    const pivotIndices: [number, number] = isLast
      ? [paneIndex - 1, paneIndex]
      : [paneIndex, paneIndex + 1];
    const delta = isLast ? current - unsafeSize : unsafeSize - current;
    commitLayout(adjustLayoutByDelta(delta, layout, constraints, pivotIndices, "imperative-api"));
  };

  const collapse = (paneIndex: number): void => {
    const current = getSize(paneIndex);
    const c = constraints[paneIndex]!;
    if (!c.collapsible) return;
    const { collapsedSize } = c;
    if (almostEqual(current, collapsedSize)) return;
    resizePane(paneIndex, collapsedSize);
  };

  const expand = (paneIndex: number): void => {
    const current = getSize(paneIndex);
    const c = constraints[paneIndex]!;
    if (!c.collapsible) return;
    const { collapsedSize, minSize } = c;
    if (!almostEqual(current, collapsedSize)) return;
    const prev = sizeBeforeCollapse.get(paneIndex);
    const baseSize = prev != null && prev >= minSize ? prev : minSize;
    resizePane(paneIndex, baseSize);
  };

  const setLayout = (next: number[]): void => {
    const validated = validateLayout(next, constraints);
    drag.stop();
    commitLayout(validated);
  };

  applyLayout();
  emit(root, "resizable:change", { layout: [...layout] });

  // Inbound control event.
  cleanups.push(
    on(root, "resizable:set", (e) => {
      if (e.target !== root) return;
      const detail = (e as CustomEvent).detail;
      if (detail?.layout && Array.isArray(detail.layout)) {
        setLayout(detail.layout);
      }
    }),
  );

  const controller: ResizableController = {
    get layout() {
      return [...layout];
    },
    setLayout,
    resizePane,
    collapse,
    expand,
    isCollapsed: isPaneCollapsed,
    isExpanded: isPaneExpanded,
    getSize,
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all resizable groups in a scope.
 * Returns an array of controllers for programmatic access.
 */
export function create(scope: ParentNode = document): ResizableController[] {
  const controllers: ResizableController[] = [];
  for (const root of getRoots(scope, "resizable")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createResizable(root));
  }
  return controllers;
}
