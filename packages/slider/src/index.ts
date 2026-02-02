import {
  getPart,
  getParts,
  getRoots,
  getDataNumber,
  getDataString,
  getDataEnum,
  getDataBool,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

const ORIENTATIONS = ["horizontal", "vertical"] as const;

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

type SliderValue = number | [number, number];

/**
 * Parse a default value from string (e.g., "50" or "25,75")
 */
function parseDefaultValue(str: string | undefined): SliderValue | undefined {
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
function isRange(value: SliderValue): value is [number, number] {
  return Array.isArray(value);
}

/**
 * Clamp and snap a value to step
 */
function clampAndSnap(
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
function valueToPercent(val: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((val - min) / (max - min)) * 100;
}

/**
 * Calculate value from percentage
 */
function percentToValue(percent: number, min: number, max: number): number {
  return (percent / 100) * (max - min) + min;
}

/**
 * Create a slider controller for a root element
 *
 * ## Events
 * - **Outbound** `slider:change` (on root): Fires during value changes.
 *   `event.detail: { value: number | [number, number] }`
 * - **Outbound** `slider:commit` (on root): Fires when interaction ends (pointer release, blur).
 *   `event.detail: { value: number | [number, number] }`
 * - **Inbound** `slider:set` (on root): Set value programmatically.
 *   `event.detail: { value: number | [number, number] }`
 *
 * @example
 * ```js
 * // Listen for value changes
 * root.addEventListener("slider:change", (e) => console.log(e.detail.value));
 * // Set value from outside
 * root.dispatchEvent(new CustomEvent("slider:set", { detail: { value: 50 } }));
 * ```
 *
 * Expected markup:
 * ```html
 * <div data-slot="slider" data-default-value="50">
 *   <div class="slider-control">
 *     <div data-slot="slider-track">
 *       <div data-slot="slider-range"></div>
 *     </div>
 *     <div data-slot="slider-thumb"></div>
 *   </div>
 * </div>
 * ```
 */
export function createSlider(
  root: Element,
  options: SliderOptions = {},
): SliderController {
  const track = getPart<HTMLElement>(root, "slider-track");
  const thumbs = getParts<HTMLElement>(root, "slider-thumb");
  const range = getPart<HTMLElement>(root, "slider-range");

  if (!track || thumbs.length === 0) {
    throw new Error(
      "Slider requires slider-track and at least one slider-thumb",
    );
  }

  // Get control element (parent of track)
  const control = track.parentElement;
  if (!control) {
    throw new Error("Slider track must have a parent element (control)");
  }

  // Resolve options with explicit precedence: JS > data-* > default
  let min = options.min ?? getDataNumber(root, "min") ?? 0;
  let max = options.max ?? getDataNumber(root, "max") ?? 100;

  // Sanity: swap if min > max
  if (min > max) {
    [min, max] = [max, min];
  }

  // Sanity: step must be positive
  let step = options.step ?? getDataNumber(root, "step") ?? 1;
  if (step <= 0) step = 1;

  const largeStep =
    options.largeStep ?? getDataNumber(root, "largeStep") ?? step * 10;
  const orientation =
    options.orientation ??
    getDataEnum(root, "orientation", ORIENTATIONS) ??
    "horizontal";
  const disabled = options.disabled ?? getDataBool(root, "disabled") ?? false;
  const onValueChange = options.onValueChange;
  const onValueCommit = options.onValueCommit;

  // Parse default value
  const dataDefaultValue = parseDefaultValue(
    getDataString(root, "defaultValue"),
  );
  let defaultValue: SliderValue =
    options.defaultValue ?? dataDefaultValue ?? min;

  // Determine if range slider based on thumb count and value
  const isRangeSlider = thumbs.length >= 2;

  // Normalize default value for range slider
  if (isRangeSlider && !isRange(defaultValue)) {
    defaultValue = [min, defaultValue];
  } else if (!isRangeSlider && isRange(defaultValue)) {
    defaultValue = defaultValue[1];
  }

  // Current value(s)
  let currentValue: SliderValue = isRange(defaultValue)
    ? [
        clampAndSnap(defaultValue[0], min, max, step),
        clampAndSnap(defaultValue[1], min, max, step),
      ]
    : clampAndSnap(defaultValue, min, max, step);

  const cleanups: Array<() => void> = [];
  let draggingThumbIndex: number | null = null;
  // Track last active thumb for tie-breaking on overlapping thumbs
  let lastActiveThumbIndex = 0;
  // Track value at start of keyboard interaction for commit detection
  let valueAtInteractionStart: SliderValue | null = null;
  // Store original touchAction to restore later
  let prevTouchAction: string | null = null;

  // Set orientation attribute on root
  root.setAttribute("data-orientation", orientation);

  // Setup disabled state
  const applyDisabled = (isDisabled: boolean) => {
    if (isDisabled) {
      root.setAttribute("data-disabled", "");
    } else {
      root.removeAttribute("data-disabled");
    }
    for (const thumb of thumbs) {
      setAria(thumb, "disabled", isDisabled);
      thumb.tabIndex = isDisabled ? -1 : 0;
    }
  };
  applyDisabled(disabled);

  // Setup initial ARIA for thumbs (static attributes)
  const setupThumbAria = (thumb: HTMLElement, index: number) => {
    thumb.setAttribute("role", "slider");
    thumb.tabIndex = disabled ? -1 : 0;
    ensureId(thumb, "slider-thumb");
    setAria(thumb, "orientation", orientation);

    // Prefer author-provided labels (data-label or existing aria-label/aria-labelledby)
    const hasAriaLabel =
      thumb.hasAttribute("aria-label") || thumb.hasAttribute("aria-labelledby");
    const dataLabel = thumb.dataset["label"];

    if (dataLabel) {
      setAria(thumb, "label", dataLabel);
    } else if (!hasAriaLabel && isRangeSlider) {
      // Fall back to default labels only if nothing provided
      setAria(thumb, "label", index === 0 ? "Minimum" : "Maximum");
    }
  };

  for (let i = 0; i < thumbs.length; i++) {
    setupThumbAria(thumbs[i]!, i);
  }

  const isHorizontal = orientation === "horizontal";

  // Update visual state (CSS positioning, ARIA values)
  const updateVisualState = () => {
    if (isRange(currentValue)) {
      const [minVal, maxVal] = currentValue;
      const minPercent = valueToPercent(minVal, min, max);
      const maxPercent = valueToPercent(maxVal, min, max);

      // Update thumbs with dynamic ARIA bounds
      if (thumbs[0]) {
        setAria(thumbs[0], "valuenow", String(minVal));
        setAria(thumbs[0], "valuemin", String(min));
        // Min thumb's max is constrained by max thumb's value
        setAria(thumbs[0], "valuemax", String(maxVal));

        if (isHorizontal) {
          thumbs[0].style.left = `${minPercent}%`;
          thumbs[0].style.bottom = "";
        } else {
          thumbs[0].style.bottom = `${minPercent}%`;
          thumbs[0].style.left = "";
        }
      }
      if (thumbs[1]) {
        setAria(thumbs[1], "valuenow", String(maxVal));
        // Max thumb's min is constrained by min thumb's value
        setAria(thumbs[1], "valuemin", String(minVal));
        setAria(thumbs[1], "valuemax", String(max));

        if (isHorizontal) {
          thumbs[1].style.left = `${maxPercent}%`;
          thumbs[1].style.bottom = "";
        } else {
          thumbs[1].style.bottom = `${maxPercent}%`;
          thumbs[1].style.left = "";
        }
      }

      // Update range
      if (range) {
        if (isHorizontal) {
          range.style.left = `${minPercent}%`;
          range.style.width = `${maxPercent - minPercent}%`;
          range.style.bottom = "";
          range.style.height = "";
        } else {
          range.style.bottom = `${minPercent}%`;
          range.style.height = `${maxPercent - minPercent}%`;
          range.style.left = "";
          range.style.width = "";
        }
      }
    } else {
      const percent = valueToPercent(currentValue, min, max);

      // Update thumb
      if (thumbs[0]) {
        setAria(thumbs[0], "valuenow", String(currentValue));
        setAria(thumbs[0], "valuemin", String(min));
        setAria(thumbs[0], "valuemax", String(max));

        if (isHorizontal) {
          thumbs[0].style.left = `${percent}%`;
          thumbs[0].style.bottom = "";
        } else {
          thumbs[0].style.bottom = `${percent}%`;
          thumbs[0].style.left = "";
        }
      }

      // Update range (from start to thumb)
      if (range) {
        if (isHorizontal) {
          range.style.left = "0%";
          range.style.width = `${percent}%`;
          range.style.bottom = "";
          range.style.height = "";
        } else {
          range.style.bottom = "0%";
          range.style.height = `${percent}%`;
          range.style.left = "";
          range.style.width = "";
        }
      }
    }

    // Update root data-value
    if (isRange(currentValue)) {
      root.setAttribute("data-value", `${currentValue[0]},${currentValue[1]}`);
    } else {
      root.setAttribute("data-value", String(currentValue));
    }
  };

  // Check if two values are equal
  const valuesEqual = (a: SliderValue, b: SliderValue): boolean => {
    if (isRange(a) && isRange(b)) {
      return a[0] === b[0] && a[1] === b[1];
    }
    return a === b;
  };

  // Apply value change, returns true if value actually changed
  const applyValue = (newValue: SliderValue, emitEvents = true): boolean => {
    // Normalize and clamp
    let normalized: SliderValue;
    if (isRange(newValue)) {
      let [minVal, maxVal] = newValue;
      minVal = clampAndSnap(minVal, min, max, step);
      maxVal = clampAndSnap(maxVal, min, max, step);
      // Ensure min <= max
      if (minVal > maxVal) {
        [minVal, maxVal] = [maxVal, minVal];
      }
      normalized = [minVal, maxVal];
    } else {
      normalized = clampAndSnap(newValue, min, max, step);
    }

    // Check if value actually changed
    const changed = !valuesEqual(normalized, currentValue);

    if (!changed) return false;

    currentValue = normalized;
    updateVisualState();

    if (emitEvents) {
      emit(root, "slider:change", { value: currentValue });
      onValueChange?.(currentValue);
    }

    return true;
  };

  // Initialize visual state
  updateVisualState();

  // Get position from pointer event - use track for geometry
  const getValueFromPointer = (e: PointerEvent): number | null => {
    const rect = track.getBoundingClientRect();

    // Bail if track has zero size
    if (isHorizontal && rect.width === 0) return null;
    if (!isHorizontal && rect.height === 0) return null;

    let percent: number;
    if (isHorizontal) {
      percent = ((e.clientX - rect.left) / rect.width) * 100;
    } else {
      // Vertical: bottom is min, top is max
      percent = ((rect.bottom - e.clientY) / rect.height) * 100;
    }

    percent = Math.max(0, Math.min(100, percent));
    return percentToValue(percent, min, max);
  };

  // Find thumb index from element
  const getThumbIndexFromTarget = (
    target: EventTarget | null,
  ): number | null => {
    if (!target || !(target instanceof HTMLElement)) return null;

    // Check if target is a thumb
    const thumbIndex = thumbs.indexOf(target);
    if (thumbIndex !== -1) return thumbIndex;

    // Check if target is inside a thumb
    for (let i = 0; i < thumbs.length; i++) {
      if (thumbs[i]!.contains(target)) return i;
    }

    return null;
  };

  // Find closest thumb for a value (for range sliders)
  const getClosestThumbIndex = (value: number): number => {
    if (!isRange(currentValue)) return 0;

    const [minVal, maxVal] = currentValue;
    const distToMin = Math.abs(value - minVal);
    const distToMax = Math.abs(value - maxVal);

    // If equidistant, prefer last active thumb
    if (distToMin === distToMax) {
      return lastActiveThumbIndex;
    }
    return distToMin < distToMax ? 0 : 1;
  };

  // Update value for a specific thumb
  const updateThumbValue = (thumbIndex: number, newVal: number): boolean => {
    if (isRange(currentValue)) {
      const [minVal, maxVal] = currentValue;
      if (thumbIndex === 0) {
        // Min thumb: clamp to [min, maxVal]
        const clampedMin = clampAndSnap(newVal, min, maxVal, step);
        return applyValue([clampedMin, maxVal]);
      } else {
        // Max thumb: clamp to [minVal, max]
        const clampedMax = clampAndSnap(newVal, minVal, max, step);
        return applyValue([minVal, clampedMax]);
      }
    } else {
      return applyValue(newVal);
    }
  };

  // Pointer event handlers - listen on control for bigger hit area
  const onPointerDown = (e: PointerEvent) => {
    if (disabled) return;

    e.preventDefault();

    const value = getValueFromPointer(e);
    if (value === null) return;

    // Check if user clicked directly on a thumb
    let thumbIndex = getThumbIndexFromTarget(e.target);

    // If not on a thumb, find closest thumb
    if (thumbIndex === null) {
      thumbIndex = getClosestThumbIndex(value);
    }

    draggingThumbIndex = thumbIndex;
    lastActiveThumbIndex = thumbIndex;

    // Set dragging state
    root.setAttribute("data-dragging", "");
    thumbs[thumbIndex]?.setAttribute("data-dragging", "");
    thumbs[thumbIndex]?.focus();

    // Store and set touch-action during drag to prevent scrolling
    prevTouchAction = control.style.touchAction;
    control.style.touchAction = "none";

    // Update value
    updateThumbValue(thumbIndex, value);

    // Capture pointer
    control.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (draggingThumbIndex === null || disabled) return;

    e.preventDefault();
    const value = getValueFromPointer(e);
    if (value === null) return;

    updateThumbValue(draggingThumbIndex, value);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (draggingThumbIndex === null) return;

    // Remove dragging state
    root.removeAttribute("data-dragging");
    for (const thumb of thumbs) {
      thumb.removeAttribute("data-dragging");
    }

    // Restore touch-action
    control.style.touchAction = prevTouchAction ?? "";
    prevTouchAction = null;

    // Emit commit event
    emit(root, "slider:commit", { value: currentValue });
    onValueCommit?.(currentValue);

    draggingThumbIndex = null;

    // Safe release - can throw if capture wasn't properly set
    try {
      control.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore - capture may not have been set
    }
  };

  cleanups.push(on(control, "pointerdown", onPointerDown));
  cleanups.push(on(control, "pointermove", onPointerMove));
  cleanups.push(on(control, "pointerup", onPointerUp));
  cleanups.push(on(control, "pointercancel", onPointerUp));

  // Keyboard navigation
  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    const target = e.target as HTMLElement;
    const thumbIndex = thumbs.indexOf(target);
    if (thumbIndex === -1) return;

    let delta = 0;
    let absolute: number | null = null;

    switch (e.key) {
      case "ArrowRight":
        // Only for horizontal sliders
        if (!isHorizontal) return;
        delta = step;
        break;
      case "ArrowLeft":
        // Only for horizontal sliders
        if (!isHorizontal) return;
        delta = -step;
        break;
      case "ArrowUp":
        // Only for vertical sliders
        if (isHorizontal) return;
        delta = step;
        break;
      case "ArrowDown":
        // Only for vertical sliders
        if (isHorizontal) return;
        delta = -step;
        break;
      case "PageUp":
        delta = largeStep;
        break;
      case "PageDown":
        delta = -largeStep;
        break;
      case "Home":
        absolute = min;
        break;
      case "End":
        absolute = max;
        break;
      default:
        return;
    }

    // Shift+Arrow for large step
    if (e.shiftKey && e.key.startsWith("Arrow")) {
      delta = delta > 0 ? largeStep : delta < 0 ? -largeStep : 0;
    }

    e.preventDefault();

    // Track last active thumb
    lastActiveThumbIndex = thumbIndex;

    // Capture value at start of keyboard interaction
    if (valueAtInteractionStart === null) {
      valueAtInteractionStart = isRange(currentValue)
        ? [currentValue[0], currentValue[1]]
        : currentValue;
    }

    // Get current value for this thumb
    const currentThumbValue = isRange(currentValue)
      ? (currentValue[thumbIndex] ?? currentValue[0])
      : currentValue;

    const newVal = absolute !== null ? absolute : currentThumbValue + delta;
    updateThumbValue(thumbIndex, newVal);
  };

  // Emit commit on blur (end of keyboard interaction)
  const onBlur = () => {
    // Check if we had an interaction and value changed
    if (valueAtInteractionStart !== null) {
      if (!valuesEqual(valueAtInteractionStart, currentValue)) {
        emit(root, "slider:commit", { value: currentValue });
        onValueCommit?.(currentValue);
      }
      valueAtInteractionStart = null;
    }
  };

  for (const thumb of thumbs) {
    cleanups.push(on(thumb, "keydown", onKeyDown));
    cleanups.push(on(thumb, "blur", onBlur));
  }

  // Listen for external set commands
  // Blocked when slider is disabled
  // Preferred shape: { value: number | [number, number] }
  // Deprecated shapes: number | [number, number]
  const handleSet = (e: Event) => {
    if (disabled) return;

    const evt = e as CustomEvent;
    const detail = evt.detail as
      | { value?: SliderValue }
      | SliderValue
      | undefined;

    let value: SliderValue | undefined;
    if (typeof detail === "number") {
      value = detail; // Deprecated
    } else if (Array.isArray(detail)) {
      value = detail as [number, number]; // Deprecated
    } else if (detail && typeof detail === "object" && "value" in detail) {
      value = detail.value; // Preferred
    }

    if (value !== undefined) {
      const changed = applyValue(value);
      if (changed) {
        emit(root, "slider:commit", { value: currentValue });
        onValueCommit?.(currentValue);
      }
    }
  };
  cleanups.push(on(root, "slider:set", handleSet));

  const controller: SliderController = {
    setValue: (value: SliderValue) => {
      applyValue(value);
    },
    get value() {
      return currentValue;
    },
    get min() {
      return min;
    },
    get max() {
      return max;
    },
    get disabled() {
      return disabled;
    },
    destroy: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };

  return controller;
}

// WeakSet to track bound elements
const bound = new WeakSet<Element>();

/**
 * Find and bind all slider components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): SliderController[] {
  const controllers: SliderController[] = [];

  for (const root of getRoots(scope, "slider")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createSlider(root));
  }

  return controllers;
}
