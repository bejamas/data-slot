import {
  getRoots,
  getDataBool,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
  ensureId,
  on,
  emit,
} from "@data-slot/core";

/* -------------------------------------------------------------------------------------------------
 * Local DOM helpers
 *
 * `@data-slot/core` exposes `getPart` for a single slotted element. Resizable needs to query
 * *all* matching parts (multiple panes / handles), and to read numeric data-* attributes. These
 * helpers stay local so the package does not depend on core API surface beyond what collapsible
 * already relies on. If core later exports `getParts` / `getDataNum`, swap these for the imports.
 * -----------------------------------------------------------------------------------------------*/

/**
 * Collect all `data-slot="{part}"` descendants that belong to *this* group,
 * i.e. excluding any that live inside a nested `data-slot="resizable"`.
 *
 * Note: we deliberately avoid the `:scope >` combinator. Bun's test DOM
 * (HappyDOM) does not reliably resolve `:scope` in `querySelectorAll`, so a
 * direct-child selector silently returns nothing there. A descendant query
 * plus an ownership check is correct in every engine and still supports
 * authors wrapping panes in extra layout elements.
 */
const getParts = <T extends Element>(root: Element, part: string): T[] =>
  Array.from(root.querySelectorAll<T>(`[data-slot="${part}"]`)).filter(
    (el) => el.closest('[data-slot="resizable"]') === root,
  );

const getDataNum = (el: Element, camelKey: string): number | null => {
  const value = (el as HTMLElement).dataset?.[camelKey];
  if (value == null || value === "") return null;
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
};

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type ResizableDirection = "horizontal" | "vertical";

export interface PaneConstraints {
  collapsedSize?: number;
  collapsible?: boolean;
  defaultSize?: number;
  maxSize?: number;
  minSize?: number;
}

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

type ResizeEvent = KeyboardEvent | MouseEvent | TouchEvent;

interface DragState {
  handleIndex: number;
  initialCursorPosition: number;
  initialLayout: number[];
}

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/

const ROOT_BINDING_KEY = "@data-slot/resizable";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/resizable] createResizable() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

const PRECISION = 10;
const RESIZE_KEYS = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"];

/* -------------------------------------------------------------------------------------------------
 * Numeric helpers (ported from PaneForge / react-resizable-panels)
 * -----------------------------------------------------------------------------------------------*/

const roundTo = (value: number, decimals: number): number =>
  Number.parseFloat(value.toFixed(decimals));

const compareWithTolerance = (
  actual: number,
  expected: number,
  fractionDigits: number = PRECISION,
): number => Math.sign(roundTo(actual, fractionDigits) - roundTo(expected, fractionDigits));

const almostEqual = (
  actual: number,
  expected: number,
  fractionDigits: number = PRECISION,
): boolean => compareWithTolerance(actual, expected, fractionDigits) === 0;

const arraysEqual = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const assert = (condition: unknown, message = "Assertion failed"): void => {
  if (!condition) throw new Error(`[@data-slot/resizable] ${message}`);
};

/* -------------------------------------------------------------------------------------------------
 * Constraint solver
 * -----------------------------------------------------------------------------------------------*/

const adjustedSizeForCollapsible = (
  size: number,
  collapsible: boolean | undefined,
  collapsedSize: number,
  minSize: number,
): number => {
  if (!collapsible) return minSize;
  const halfway = (collapsedSize + minSize) / 2;
  return compareWithTolerance(size, halfway) < 0 ? collapsedSize : minSize;
};

const resizePaneSize = (
  constraints: PaneConstraints[],
  index: number,
  initialSize: number,
): number => {
  const c = constraints[index];
  assert(c != null, "Pane constraints should not be null.");
  const { collapsedSize = 0, collapsible, maxSize = 100, minSize = 0 } = c;

  let next = initialSize;
  if (compareWithTolerance(next, minSize) < 0) {
    next = adjustedSizeForCollapsible(next, collapsible, collapsedSize, minSize);
  }
  next = Math.min(maxSize, next);
  return Number.parseFloat(next.toFixed(PRECISION));
};

/**
 * Adjusts the layout based on the delta of the resize handle.
 * All units are percentages. Ported from react-resizable-panels via PaneForge.
 */
const adjustLayoutByDelta = (
  delta: number,
  prevLayout: number[],
  constraints: PaneConstraints[],
  pivotIndices: number[],
  trigger: "imperative-api" | "keyboard" | "mouse-or-touch",
): number[] => {
  if (almostEqual(delta, 0)) return prevLayout;

  const nextLayout = [...prevLayout];
  const [firstPivot, secondPivot] = pivotIndices;
  let deltaApplied = 0;

  if (trigger === "keyboard") {
    {
      const index = delta < 0 ? secondPivot : firstPivot;
      const c = constraints[index];
      assert(c);
      if (c.collapsible) {
        const prevSize = prevLayout[index];
        assert(prevSize != null);
        const { collapsedSize = 0, minSize = 0 } = c;
        if (almostEqual(prevSize, collapsedSize)) {
          const localDelta = minSize - prevSize;
          if (compareWithTolerance(localDelta, Math.abs(delta)) > 0) {
            delta = delta < 0 ? 0 - localDelta : localDelta;
          }
        }
      }
    }
    {
      const index = delta < 0 ? firstPivot : secondPivot;
      const c = constraints[index];
      assert(c);
      if (c.collapsible) {
        const prevSize = prevLayout[index];
        assert(prevSize != null);
        const { collapsedSize = 0, minSize = 0 } = c;
        if (almostEqual(prevSize, minSize)) {
          const localDelta = prevSize - collapsedSize;
          if (compareWithTolerance(localDelta, Math.abs(delta)) > 0) {
            delta = delta < 0 ? 0 - localDelta : localDelta;
          }
        }
      }
    }
  }

  {
    const increment = delta < 0 ? 1 : -1;
    let index = delta < 0 ? secondPivot : firstPivot;
    let maxAvailableDelta = 0;

    while (true) {
      const prevSize = prevLayout[index];
      assert(prevSize != null);
      const maxSafeSize = resizePaneSize(constraints, index, 100);
      maxAvailableDelta += maxSafeSize - prevSize;
      index += increment;
      if (index < 0 || index >= constraints.length) break;
    }

    const minAbsDelta = Math.min(Math.abs(delta), Math.abs(maxAvailableDelta));
    delta = delta < 0 ? 0 - minAbsDelta : minAbsDelta;
  }

  {
    const pivotIndex = delta < 0 ? firstPivot : secondPivot;
    let index = pivotIndex;
    while (index >= 0 && index < constraints.length) {
      const deltaRemaining = Math.abs(delta) - Math.abs(deltaApplied);
      const prevSize = prevLayout[index];
      assert(prevSize != null);
      const unsafeSize = prevSize - deltaRemaining;
      const safeSize = resizePaneSize(constraints, index, unsafeSize);

      if (!almostEqual(prevSize, safeSize)) {
        deltaApplied += prevSize - safeSize;
        nextLayout[index] = safeSize;
        if (
          deltaApplied.toPrecision(3).localeCompare(Math.abs(delta).toPrecision(3), undefined, {
            numeric: true,
          }) >= 0
        ) {
          break;
        }
      }
      if (delta < 0) index -= 1;
      else index += 1;
    }
  }

  if (almostEqual(deltaApplied, 0)) return prevLayout;

  {
    const pivotIndex = delta < 0 ? secondPivot : firstPivot;
    const prevSize = prevLayout[pivotIndex];
    assert(prevSize != null);
    const unsafeSize = prevSize + deltaApplied;
    const safeSize = resizePaneSize(constraints, pivotIndex, unsafeSize);
    nextLayout[pivotIndex] = safeSize;

    if (!almostEqual(safeSize, unsafeSize)) {
      let deltaRemaining = unsafeSize - safeSize;
      const innerPivot = delta < 0 ? secondPivot : firstPivot;
      let index = innerPivot;
      while (index >= 0 && index < constraints.length) {
        const prevInner = nextLayout[index];
        assert(prevInner != null);
        const unsafeInner = prevInner + deltaRemaining;
        const safeInner = resizePaneSize(constraints, index, unsafeInner);
        if (!almostEqual(prevInner, safeInner)) {
          deltaRemaining -= safeInner - prevInner;
          nextLayout[index] = safeInner;
        }
        if (almostEqual(deltaRemaining, 0)) break;
        if (delta > 0) index -= 1;
        else index += 1;
      }
    }
  }

  const totalSize = nextLayout.reduce((sum, size) => sum + size, 0);
  if (!almostEqual(totalSize, 100)) return prevLayout;

  return nextLayout;
};

const getUnsafeDefaultLayout = (constraints: PaneConstraints[]): number[] => {
  const layout = new Array<number>(constraints.length);
  let numWithSizes = 0;
  let remaining = 100;

  for (let i = 0; i < constraints.length; i += 1) {
    const { defaultSize } = constraints[i];
    if (defaultSize != null) {
      numWithSizes += 1;
      layout[i] = defaultSize;
      remaining -= defaultSize;
    }
  }

  for (let i = 0; i < constraints.length; i += 1) {
    const { defaultSize } = constraints[i];
    if (defaultSize != null) continue;
    const numRemaining = constraints.length - numWithSizes;
    const size = remaining / numRemaining;
    numWithSizes += 1;
    layout[i] = size;
    remaining -= size;
  }

  return layout;
};

const validateLayout = (prevLayout: number[], constraints: PaneConstraints[]): number[] => {
  const nextLayout = [...prevLayout];
  const total = nextLayout.reduce((acc, cur) => acc + cur, 0);

  if (nextLayout.length !== constraints.length) {
    throw new Error(
      `[@data-slot/resizable] Invalid ${constraints.length} pane layout: ${nextLayout
        .map((s) => `${s}%`)
        .join(", ")}`,
    );
  }

  if (!almostEqual(total, 100)) {
    for (let i = 0; i < constraints.length; i += 1) {
      nextLayout[i] = (100 / total) * nextLayout[i];
    }
  }

  let remaining = 0;
  for (let i = 0; i < constraints.length; i += 1) {
    const unsafe = nextLayout[i];
    const safe = resizePaneSize(constraints, i, unsafe);
    if (unsafe !== safe) {
      remaining += unsafe - safe;
      nextLayout[i] = safe;
    }
  }

  if (!almostEqual(remaining, 0)) {
    for (let i = 0; i < constraints.length; i += 1) {
      const prev = nextLayout[i];
      const unsafe = prev + remaining;
      const safe = resizePaneSize(constraints, i, unsafe);
      if (prev !== safe) {
        remaining -= safe - prev;
        nextLayout[i] = safe;
        if (almostEqual(remaining, 0)) break;
      }
    }
  }

  return nextLayout;
};

const calculateAriaValues = (
  layout: number[],
  constraints: PaneConstraints[],
  pivotIndices: number[],
): { valueMax: number; valueMin: number; valueNow: number } => {
  let currentMin = 0;
  let currentMax = 100;
  let totalMin = 0;
  let totalMax = 0;
  const firstIndex = pivotIndices[0];

  for (let i = 0; i < constraints.length; i += 1) {
    const { maxSize = 100, minSize = 0 } = constraints[i];
    if (i === firstIndex) {
      currentMin = minSize;
      currentMax = maxSize;
    } else {
      totalMin += minSize;
      totalMax += maxSize;
    }
  }

  return {
    valueMax: Math.min(currentMax, 100 - totalMin),
    valueMin: Math.max(currentMin, 100 - totalMax),
    valueNow: layout[firstIndex],
  };
};

/* -------------------------------------------------------------------------------------------------
 * Global cursor style (shared across all groups, like PaneForge)
 * -----------------------------------------------------------------------------------------------*/

type CursorState =
  | "horizontal"
  | "horizontal-max"
  | "horizontal-min"
  | "vertical"
  | "vertical-max"
  | "vertical-min";

let cursorStyleEl: HTMLStyleElement | null = null;
let cursorState: CursorState | null = null;

const cursorFor = (state: CursorState): string => {
  switch (state) {
    case "horizontal":
      return "ew-resize";
    case "horizontal-max":
      return "w-resize";
    case "horizontal-min":
      return "e-resize";
    case "vertical":
      return "ns-resize";
    case "vertical-max":
      return "n-resize";
    case "vertical-min":
      return "s-resize";
  }
};

const setGlobalCursor = (state: CursorState, doc: Document): void => {
  if (cursorState === state) return;
  cursorState = state;
  if (cursorStyleEl === null) {
    cursorStyleEl = doc.createElement("style");
    doc.head.appendChild(cursorStyleEl);
  }
  cursorStyleEl.innerHTML = `*{cursor: ${cursorFor(state)}!important;}`;
};

const resetGlobalCursor = (): void => {
  if (cursorStyleEl === null) return;
  cursorStyleEl.parentNode?.removeChild(cursorStyleEl);
  cursorStyleEl = null;
  cursorState = null;
};

/* -------------------------------------------------------------------------------------------------
 * Geometry helpers
 * -----------------------------------------------------------------------------------------------*/

const cursorPosition = (dir: ResizableDirection, e: ResizeEvent): number => {
  const horizontal = dir === "horizontal";
  if (e.type.startsWith("mouse")) {
    const me = e as MouseEvent;
    return horizontal ? me.clientX : me.clientY;
  }
  if (e.type.startsWith("touch")) {
    const te = e as TouchEvent;
    const t = te.touches[0];
    assert(t, "Expected a touch point");
    return horizontal ? t.screenX : t.screenY;
  }
  throw new Error(`[@data-slot/resizable] Unsupported event type "${e.type}"`);
};

/* -------------------------------------------------------------------------------------------------
 * createResizable
 * -----------------------------------------------------------------------------------------------*/

const readPaneConstraints = (pane: HTMLElement): PaneConstraints => {
  const constraints: PaneConstraints = {};
  const defaultSize = getDataNum(pane, "defaultSize");
  const minSize = getDataNum(pane, "minSize");
  const maxSize = getDataNum(pane, "maxSize");
  const collapsedSize = getDataNum(pane, "collapsedSize");
  const collapsible = getDataBool(pane, "collapsible");
  if (defaultSize != null) constraints.defaultSize = defaultSize;
  if (minSize != null) constraints.minSize = minSize;
  if (maxSize != null) constraints.maxSize = maxSize;
  if (collapsedSize != null) constraints.collapsedSize = collapsedSize;
  if (collapsible != null) constraints.collapsible = collapsible;
  return constraints;
};

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
  const keyboardResizeBy = options.keyboardResizeBy ?? getDataNum(root, "keyboardResizeBy") ?? 10;
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

  const win = root.ownerDocument?.defaultView ?? window;
  const doc = root.ownerDocument ?? document;
  const isHorizontal = direction === "horizontal";

  const constraints: PaneConstraints[] = panes.map(readPaneConstraints);
  let layout = validateLayout(getUnsafeDefaultLayout(constraints), constraints);
  const sizeBeforeCollapse = new Map<number, number>();
  let dragState: DragState | null = null;
  let prevDelta = 0;
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
    handle.setAttribute("aria-controls", panes[i].id);
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
      pane.style.flexGrow = panes.length === 1 ? "1" : layout[i].toPrecision(3);
      pane.style.pointerEvents = dragState !== null ? "none" : "";
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
    layout = next;
    applyLayout();
    emit(root, "resizable:change", { layout: [...layout] });
    onLayoutChange?.([...layout]);
  };

  function isPaneCollapsed(index: number): boolean {
    const c = constraints[index];
    const size = layout[index];
    if (typeof size !== "number") return false;
    const { collapsedSize = 0, collapsible } = c;
    return collapsible === true && almostEqual(size, collapsedSize);
  }

  function isPaneExpanded(index: number): boolean {
    const { collapsedSize = 0, collapsible } = constraints[index];
    return !collapsible || layout[index] > collapsedSize;
  }

  const pivotForHandle = (handleIndex: number): [number, number] => [handleIndex, handleIndex + 1];

  // ---- Resize handlers --------------------------------------------------------

  const deltaForKeyboard = (e: KeyboardEvent): number => {
    let step = 10;
    if (e.shiftKey) step = 100;
    else if (keyboardResizeBy != null) step = keyboardResizeBy;

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

  const runResize = (handleIndex: number, event: ResizeEvent): void => {
    const prevLayout = layout;
    const pivotIndices = pivotForHandle(handleIndex);
    const keyboard = event.type === "keydown";

    let delta: number;
    if (keyboard) {
      delta = deltaForKeyboard(event as KeyboardEvent);
    } else if (dragState != null) {
      const groupRect = (root as HTMLElement).getBoundingClientRect();
      const groupSize = isHorizontal ? groupRect.width : groupRect.height;
      const offsetPixels = cursorPosition(direction, event) - dragState.initialCursorPosition;
      delta = groupSize === 0 ? 0 : (offsetPixels / groupSize) * 100;
    } else {
      return;
    }
    if (delta === 0) return;

    if (doc.dir === "rtl" && isHorizontal) delta = -delta;

    const base = dragState?.initialLayout ?? prevLayout;
    const next = adjustLayoutByDelta(
      delta,
      base,
      constraints,
      pivotIndices,
      keyboard ? "keyboard" : "mouse-or-touch",
    );
    const changed = !arraysEqual(prevLayout, next);

    if (event.type.startsWith("mouse") || event.type.startsWith("touch")) {
      if (prevDelta !== delta) {
        prevDelta = delta;
        if (!changed) {
          if (isHorizontal) {
            setGlobalCursor(delta < 0 ? "horizontal-min" : "horizontal-max", doc);
          } else {
            setGlobalCursor(delta < 0 ? "vertical-min" : "vertical-max", doc);
          }
        } else {
          setGlobalCursor(isHorizontal ? "horizontal" : "vertical", doc);
        }
      }
    }

    if (changed) commitLayout(next);
  };

  // ---- Drag lifecycle ---------------------------------------------------------

  const onMove = (e: Event): void => {
    if (dragState == null) return;
    e.preventDefault();
    runResize(dragState.handleIndex, e as ResizeEvent);
  };

  const stopDragging = (): void => {
    resetGlobalCursor();
    if (dragState != null) {
      const handle = handles[dragState.handleIndex];
      handle.removeAttribute("data-active");
      handle.blur();
    }
    dragState = null;
    applyLayout();
    emit(root, "resizable:dragging", { dragging: false });
  };

  const startDragging = (handleIndex: number, e: ResizeEvent): void => {
    e.preventDefault();
    const handle = handles[handleIndex];
    if (handle.getAttribute("data-disabled") === "true") return;
    dragState = {
      handleIndex,
      initialCursorPosition: cursorPosition(direction, e),
      initialLayout: [...layout],
    };
    handle.setAttribute("data-active", "pointer");
    applyLayout();
    emit(root, "resizable:dragging", { dragging: true });
  };

  // ---- Listeners --------------------------------------------------------------

  handles.forEach((handle, handleIndex) => {
    cleanups.push(on(handle, "mousedown", (e) => startDragging(handleIndex, e as MouseEvent)));
    cleanups.push(
      on(handle, "touchstart", (e) => startDragging(handleIndex, e as TouchEvent), {
        passive: false,
      }),
    );
    cleanups.push(on(handle, "mouseup", stopDragging));
    cleanups.push(on(handle, "touchend", stopDragging));
    cleanups.push(on(handle, "touchcancel", stopDragging));
    cleanups.push(on(handle, "focus", () => handle.setAttribute("data-active", "keyboard")));
    cleanups.push(
      on(handle, "blur", () => {
        if (dragState?.handleIndex !== handleIndex) {
          handle.removeAttribute("data-active");
        }
      }),
    );
    cleanups.push(
      on(handle, "keydown", (e) => {
        const ke = e as KeyboardEvent;
        if (handle.getAttribute("data-disabled") === "true" || ke.defaultPrevented) {
          return;
        }
        if (RESIZE_KEYS.includes(ke.key)) {
          ke.preventDefault();
          runResize(handleIndex, ke);
          return;
        }
        if (ke.key === "Enter") {
          // Toggle collapse on the pane before the handle.
          ke.preventDefault();
          const c = constraints[handleIndex];
          const size = layout[handleIndex];
          const { collapsedSize = 0, collapsible, minSize = 0 } = c;
          if (size == null || !collapsible) return;
          const delta = almostEqual(size, collapsedSize) ? minSize - size : collapsedSize - size;
          commitLayout(
            adjustLayoutByDelta(
              delta,
              layout,
              constraints,
              pivotForHandle(handleIndex),
              "keyboard",
            ),
          );
          return;
        }
        if (ke.key === "F6") {
          ke.preventDefault();
          const order = ke.shiftKey
            ? (handleIndex - 1 + handles.length) % handles.length
            : (handleIndex + 1) % handles.length;
          handles[order].focus();
        }
      }),
    );
  });

  const body = doc.body;
  cleanups.push(on(body, "mousemove", onMove));
  cleanups.push(on(body, "touchmove", onMove, { passive: false }));
  cleanups.push(on(body, "mouseleave", onMove));
  cleanups.push(on(body, "contextmenu", stopDragging));
  cleanups.push(on(win, "mouseup", stopDragging));
  cleanups.push(on(win, "touchend", stopDragging));

  // ---- Imperative API ---------------------------------------------------------

  const resizePane = (paneIndex: number, unsafeSize: number): void => {
    const isLast = paneIndex === panes.length - 1;
    const pivotIndices: [number, number] = isLast
      ? [paneIndex - 1, paneIndex]
      : [paneIndex, paneIndex + 1];
    const current = layout[paneIndex];
    const delta = isLast ? current - unsafeSize : unsafeSize - current;
    commitLayout(adjustLayoutByDelta(delta, layout, constraints, pivotIndices, "imperative-api"));
  };

  const collapse = (paneIndex: number): void => {
    const c = constraints[paneIndex];
    if (!c.collapsible) return;
    const { collapsedSize = 0 } = c;
    const current = layout[paneIndex];
    if (almostEqual(current, collapsedSize)) return;
    sizeBeforeCollapse.set(paneIndex, current);
    const isLast = paneIndex === panes.length - 1;
    const pivotIndices: [number, number] = isLast
      ? [paneIndex - 1, paneIndex]
      : [paneIndex, paneIndex + 1];
    const delta = isLast ? current - collapsedSize : collapsedSize - current;
    commitLayout(adjustLayoutByDelta(delta, layout, constraints, pivotIndices, "imperative-api"));
  };

  const expand = (paneIndex: number): void => {
    const c = constraints[paneIndex];
    if (!c.collapsible) return;
    const { collapsedSize = 0, minSize = 0 } = c;
    const current = layout[paneIndex];
    if (!almostEqual(current, collapsedSize)) return;
    const prev = sizeBeforeCollapse.get(paneIndex);
    const baseSize = prev != null && prev >= minSize ? prev : minSize;
    const isLast = paneIndex === panes.length - 1;
    const pivotIndices: [number, number] = isLast
      ? [paneIndex - 1, paneIndex]
      : [paneIndex, paneIndex + 1];
    const delta = isLast ? current - baseSize : baseSize - current;
    commitLayout(adjustLayoutByDelta(delta, layout, constraints, pivotIndices, "imperative-api"));
  };

  applyLayout();
  emit(root, "resizable:change", { layout: [...layout] });

  // Inbound control event.
  cleanups.push(
    on(root, "resizable:set", (e) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.layout && Array.isArray(detail.layout)) {
        commitLayout(validateLayout(detail.layout as number[], constraints));
      }
    }),
  );

  const controller: ResizableController = {
    get layout() {
      return [...layout];
    },
    setLayout: (next) => commitLayout(validateLayout(next, constraints)),
    resizePane,
    collapse,
    expand,
    isCollapsed: isPaneCollapsed,
    isExpanded: isPaneExpanded,
    getSize: (i) => layout[i],
    destroy: () => {
      stopDragging();
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
