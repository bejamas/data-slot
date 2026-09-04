export const ORIENTATIONS = ["horizontal", "vertical"] as const;
export const THUMB_ALIGNMENTS = ["center", "edge", "edge-client-only"] as const;

export type ThumbAlignment = (typeof THUMB_ALIGNMENTS)[number];
export type SliderValue = number | [number, number];
export type VisualPercents = {
  thumbPercent: number;
  trackPercent: number;
};

export interface SliderOptions {
  /** Initial value(s) - number or [min, max] for range */
  defaultValue?: number | [number, number];
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Larger step for PageUp/PageDown/Shift+Arrow */
  largeStep?: number;
  /** Slider orientation */
  orientation?: "horizontal" | "vertical";
  /**
   * Thumb alignment when the value is at the track edges.
   * "edge-client-only" is accepted for Base UI compatibility and behaves the same as "edge".
   */
  thumbAlignment?: ThumbAlignment;
  /** Disable the slider */
  disabled?: boolean;
  /** Callback when value changes during interaction */
  onValueChange?: (value: number | [number, number]) => void;
  /** Callback when interaction ends (pointer release, blur) */
  onValueCommit?: (value: number | [number, number]) => void;
}

export interface SliderController {
  /** Set value programmatically */
  setValue(value: number | [number, number]): void;
  /** Current value(s) */
  readonly value: number | [number, number];
  /** Min value */
  readonly min: number;
  /** Max value */
  readonly max: number;
  /** Whether slider is disabled */
  readonly disabled: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

/**
 * Parse a default value from string (e.g., "50" or "25,75")
 */
export function parseDefaultValue(str: string | undefined): SliderValue | undefined {
  if (!str) return undefined;
  const parts = str.split(",").map((s) => parseFloat(s.trim()));
  if (parts.some((p) => isNaN(p))) return undefined;
  if (parts.length === 2) return [parts[0]!, parts[1]!];
  if (parts.length === 1) return parts[0];
  return undefined;
}

/**
 * Check if value is a range (two-thumb) slider
 */
export function isRange(value: SliderValue): value is [number, number] {
  return Array.isArray(value);
}

/**
 * Clamp and snap a value to step
 */
export function clampAndSnap(
  val: number,
  min: number,
  max: number,
  step: number,
): number {
  // Snap to step first
  const snapped = Math.round((val - min) / step) * step + min;
  // Handle floating point precision
  const decimals = step.toString().split(".")[1]?.length ?? 0;
  const rounded = parseFloat(snapped.toFixed(decimals));
  // Clamp to range
  return Math.min(max, Math.max(min, rounded));
}

/**
 * Calculate percentage from value
 */
export function valueToPercent(val: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((val - min) / (max - min)) * 100;
}

/**
 * Calculate value from percentage
 */
export function percentToValue(percent: number, min: number, max: number): number {
  return (percent / 100) * (max - min) + min;
}

export function clampPercent(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}
