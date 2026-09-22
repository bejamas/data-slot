export interface PaneConstraints {
  collapsedSize?: number;
  collapsible?: boolean;
  defaultSize?: number;
  maxSize?: number;
  minSize?: number;
}

export type ResolvedPaneConstraints = Required<Omit<PaneConstraints, "defaultSize">> & Pick<PaneConstraints, "defaultSize">;

export function resolvePaneConstraints(input: PaneConstraints): ResolvedPaneConstraints {
  const { collapsedSize = 0, collapsible = false, minSize = 0, maxSize = 100, defaultSize } = input;
  assert([collapsedSize, minSize, maxSize, ...(defaultSize === undefined ? [] : [defaultSize])]
    .every(size => Number.isFinite(size) && size >= 0 && size <= 100),
  "Pane constraints must be finite percentages between 0 and 100.");
  assert(minSize <= maxSize, "Pane minSize must not exceed maxSize.");
  assert(!collapsible || collapsedSize <= minSize, "Pane collapsedSize must not exceed minSize.");
  return { collapsedSize, collapsible, minSize, maxSize, defaultSize };
}

const PRECISION = 10;

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

export const almostEqual = (
  actual: number,
  expected: number,
  fractionDigits: number = PRECISION,
): boolean => compareWithTolerance(actual, expected, fractionDigits) === 0;

export const arraysEqual = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(`[@data-slot/resizable] ${message}`);
}

/* -------------------------------------------------------------------------------------------------
 * Constraint solver
 * -----------------------------------------------------------------------------------------------*/

const adjustedSizeForCollapsible = (
  size: number,
  collapsible: boolean,
  collapsedSize: number,
  minSize: number,
): number => {
  if (!collapsible) return minSize;
  const halfway = (collapsedSize + minSize) / 2;
  return compareWithTolerance(size, halfway) < 0 ? collapsedSize : minSize;
};

const resizePaneSize = (
  constraints: ResolvedPaneConstraints[],
  index: number,
  initialSize: number,
): number => {
  const c = constraints[index];
  assert(c != null, "Pane constraints should not be null.");
  const { collapsedSize, collapsible, maxSize, minSize } = c;

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
export const adjustLayoutByDelta = (
  delta: number,
  prevLayout: number[],
  constraints: ResolvedPaneConstraints[],
  pivotIndices: readonly [number, number],
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
        const { collapsedSize, minSize } = c;
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
        const { collapsedSize, minSize } = c;
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

export const getUnsafeDefaultLayout = (constraints: ResolvedPaneConstraints[]): number[] => {
  const layout = new Array<number>(constraints.length);
  let numWithSizes = 0;
  let remaining = 100;

  for (let i = 0; i < constraints.length; i += 1) {
    const { defaultSize } = constraints[i]!;
    if (defaultSize != null) {
      numWithSizes += 1;
      layout[i] = defaultSize;
      remaining -= defaultSize;
    }
  }

  for (let i = 0; i < constraints.length; i += 1) {
    const { defaultSize } = constraints[i]!;
    if (defaultSize != null) continue;
    const numRemaining = constraints.length - numWithSizes;
    const size = remaining / numRemaining;
    numWithSizes += 1;
    layout[i] = size;
    remaining -= size;
  }

  return layout;
};

export const validateLayout = (prevLayout: number[], constraints: ResolvedPaneConstraints[]): number[] => {
  const nextLayout = [...prevLayout];
  const total = nextLayout.reduce((acc, cur) => acc + cur, 0);

  if (nextLayout.length !== constraints.length) {
    throw new Error(
      `[@data-slot/resizable] Invalid ${constraints.length} pane layout: ${nextLayout
        .map((s) => `${s}%`)
        .join(", ")}`,
    );
  }

  if (!Number.isFinite(total) || total <= 0 || nextLayout.some(size => !Number.isFinite(size) || size < 0)) {
    throw new Error("[@data-slot/resizable] Layout sizes must be finite, non-negative numbers with a positive total.");
  }

  if (!almostEqual(total, 100)) {
    for (let i = 0; i < constraints.length; i += 1) {
      nextLayout[i] = (nextLayout[i]! / total) * 100;
    }
  }

  let remaining = 0;
  for (let i = 0; i < constraints.length; i += 1) {
    const unsafe = nextLayout[i]!;
    const safe = resizePaneSize(constraints, i, unsafe);
    if (unsafe !== safe) {
      remaining += unsafe - safe;
      nextLayout[i] = safe;
    }
  }

  if (!almostEqual(remaining, 0)) {
    for (let i = 0; i < constraints.length; i += 1) {
      const prev = nextLayout[i]!;
      const unsafe = prev + remaining;
      const safe = resizePaneSize(constraints, i, unsafe);
      if (prev !== safe) {
        remaining -= safe - prev;
        nextLayout[i] = safe;
        if (almostEqual(remaining, 0)) break;
      }
    }
  }

  // Snapping across a collapse gap can leave a remainder that another local
  // clamp cannot absorb. Resolve the discrete choices before accepting a layout.
  const result = almostEqual(remaining, 0) ? nextLayout : resolveCollapseGaps(nextLayout, constraints);
  assert(almostEqual(result.reduce((sum, size) => sum + size, 0), 100) && result.every((size, i) => {
    const c = constraints[i]!;
    return Number.isFinite(size) && (c.collapsible && almostEqual(size, c.collapsedSize)
      || compareWithTolerance(size, c.minSize) >= 0 && compareWithTolerance(size, c.maxSize) <= 0);
  }), "Pane constraints cannot form a layout totaling 100%.");
  return result;
};

type SizeRange = readonly [min: number, max: number];

const allowedRanges = (c: ResolvedPaneConstraints): SizeRange[] =>
  c.collapsible && c.collapsedSize < c.minSize
    ? [[c.minSize, c.maxSize], [c.collapsedSize, c.collapsedSize]]
    : [[c.minSize, c.maxSize]];

/** Merge overlapping ranges so equivalent collapse combinations share one range. */
function mergeRanges(ranges: SizeRange[]): SizeRange[] {
  const merged: SizeRange[] = [];
  for (const [min, max] of ranges.sort((a, b) => a[0] - b[0])) {
    const previous = merged.at(-1);
    if (previous && compareWithTolerance(min, previous[1]) <= 0) {
      merged[merged.length - 1] = [previous[0], Math.max(previous[1], max)];
    } else {
      merged.push([min, max]);
    }
  }
  return merged;
}

function resolveCollapseGaps(requested: number[], constraints: ResolvedPaneConstraints[]): number[] {
  // Each suffix describes all totals the remaining panes can actually occupy,
  // including the gaps between collapsed and expanded sizes.
  const suffix: SizeRange[][] = Array.from({ length: constraints.length + 1 }, () => []);
  suffix[constraints.length] = [[0, 0]];
  for (let i = constraints.length - 1; i >= 0; i -= 1) {
    suffix[i] = mergeRanges(allowedRanges(constraints[i]!).flatMap(([min, max]) =>
      suffix[i + 1]!.map(([tailMin, tailMax]): SizeRange => [min + tailMin, Math.min(100, max + tailMax)]),
    ).filter(([min]) => compareWithTolerance(min, 100) <= 0));
  }
  assert(suffix[0]!.some(([min, max]) => compareWithTolerance(min, 100) <= 0 && compareWithTolerance(max, 100) >= 0),
    "Pane constraints cannot form a layout totaling 100%.");

  let remaining = 100;
  return constraints.map((c, i) => {
    let best: number | undefined;
    for (const [min, max] of allowedRanges(c)) {
      for (const [tailMin, tailMax] of suffix[i + 1]!) {
        const lower = Math.max(min, remaining - tailMax);
        const upper = Math.min(max, remaining - tailMin);
        if (compareWithTolerance(lower, upper) > 0) continue;
        const size = roundTo(Math.max(lower, Math.min(upper, requested[i]!)), PRECISION);
        if (best === undefined || Math.abs(size - requested[i]!) < Math.abs(best - requested[i]!)) best = size;
      }
    }
    assert(best !== undefined, "Pane constraints cannot form a layout totaling 100%.");
    remaining -= best;
    return best;
  });
}

export const calculateAriaValues = (
  layout: number[],
  constraints: ResolvedPaneConstraints[],
  pivotIndices: readonly [number, number],
): { valueMax: number; valueMin: number; valueNow: number } => {
  let currentMin = 0;
  let currentMax = 100;
  let totalMin = 0;
  let totalMax = 0;
  const firstIndex = pivotIndices[0];

  for (let i = 0; i < constraints.length; i += 1) {
    const { maxSize, minSize, collapsible, collapsedSize } = constraints[i]!;
    const minimum = collapsible ? collapsedSize : minSize;
    if (i === firstIndex) {
      currentMin = minimum;
      currentMax = maxSize;
    } else {
      totalMin += minimum;
      totalMax += maxSize;
    }
  }

  return {
    valueMax: Math.min(currentMax, 100 - totalMin),
    valueMin: Math.max(currentMin, 100 - totalMax),
    valueNow: layout[firstIndex]!,
  };
};
