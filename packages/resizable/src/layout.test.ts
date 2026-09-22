import { describe, expect, it } from "bun:test";
import { resolvePaneConstraints, validateLayout, type PaneConstraints } from "./layout";

const resolve = (constraints: PaneConstraints[]) => constraints.map(resolvePaneConstraints);

describe("Resizable layout constraints", () => {
  it("resolves collapse gaps instead of returning a 120% layout", () => {
    const constraints = resolve([
      { collapsible: true, minSize: 60 },
      { collapsible: true, minSize: 60 },
    ]);
    expect(validateLayout([50, 50], constraints)).toEqual([100, 0]);
    expect(validateLayout([0, 100], constraints)).toEqual([0, 100]);
  });

  it.each([
    [{ minSize: 60 }, { minSize: 60 }],
    [{ maxSize: 40 }, { maxSize: 40 }],
    [{ collapsible: true, minSize: 60, maxSize: 60 }, { collapsible: true, minSize: 60, maxSize: 60 }],
    [{ maxSize: 90 }],
  ].map(constraints => ({ constraints })))("rejects constraints that cannot fill the group: %j", ({ constraints }) => {
    expect(() => validateLayout(constraints.map(() => 1), resolve(constraints))).toThrow("totaling 100%");
  });

  it.each([
    { minSize: -1 }, { maxSize: 101 }, { maxSize: -10 },
    { minSize: 70, maxSize: 60 }, { minSize: NaN },
    { collapsedSize: Infinity }, { defaultSize: -5 },
    { collapsible: true, collapsedSize: 30, minSize: 20 },
  ])("rejects invalid individual constraints: %j", constraints => {
    expect(() => resolvePaneConstraints(constraints)).toThrow();
  });

  it("normalizes tiny finite values without overflow", () => {
    expect(validateLayout([Number.MIN_VALUE, Number.MIN_VALUE], resolve([{}, {}]))).toEqual([50, 50]);
  });

  it("preserves redistribution for ordinary continuous constraints", () => {
    expect(validateLayout([50, 30, 20], resolve([{}, { minSize: 50 }, {}]))).toEqual([30, 50, 20]);
  });

  it("agrees with an exhaustive feasibility oracle across three-pane collapse combinations", () => {
    const profiles: PaneConstraints[] = [
      {}, { minSize: 60 }, { maxSize: 30 },
      { collapsible: true, minSize: 60 },
      { collapsible: true, collapsedSize: 10, minSize: 40, maxSize: 60 },
      { collapsible: true, minSize: 60, maxSize: 60 },
    ];
    const accepts = (size: number, c: ReturnType<typeof resolvePaneConstraints>) =>
      c.collapsible && size === c.collapsedSize || size >= c.minSize && size <= c.maxSize;
    for (const first of profiles) for (const second of profiles) for (const third of profiles) {
      const constraints = resolve([first, second, third]);
      // All boundaries are multiples of ten, so integer grid enumeration is an
      // independent, exhaustive oracle for whether these constraints are feasible.
      let feasible = false;
      for (let a = 0; a <= 100; a += 10) for (let b = 0; b <= 100 - a; b += 10) {
        if ([a, b, 100 - a - b].every((size, i) => accepts(size, constraints[i]!))) feasible = true;
      }
      for (const requested of [[20, 30, 50], [50, 25, 25], [100, 0, 0], [1, 1, 1]]) {
        if (!feasible) {
          expect(() => validateLayout(requested, constraints)).toThrow("totaling 100%");
          continue;
        }
        const result = validateLayout(requested, constraints);
        expect(result.reduce((sum, size) => sum + size, 0)).toBeCloseTo(100, 8);
        expect(result.every((size, i) => Number.isFinite(size) && accepts(size, constraints[i]!))).toBe(true);
      }
    }
  });
});
