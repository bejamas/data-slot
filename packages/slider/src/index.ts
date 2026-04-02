import {
  getPart,
  getParts,
  getRoots,
  getDataNumber,
  getDataString,
  getDataEnum,
  getDataBool,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
} from "@data-slot/core";
import { setAria, ensureId } from "@data-slot/core";
import { on, emit } from "@data-slot/core";

const ORIENTATIONS = ["horizontal", "vertical"] as const;
const THUMB_ALIGNMENTS = ["center", "edge", "edge-client-only"] as const;

type ThumbAlignment = (typeof THUMB_ALIGNMENTS)[number];
type SliderValue = number | [number, number];
type VisualPercents = {
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

const ROOT_BINDING_KEY = "@data-slot/slider";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/slider] createSlider() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

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

function clampPercent(percent: number): number {
  return Math.max(0, Math.min(100, percent));
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
 *   <div data-slot="slider-track">
 *     <div data-slot="slider-range"></div>
 *   </div>
 *   <div data-slot="slider-thumb"></div>
 * </div>
 *
 * <!-- Optional control wrapper -->
 * <div data-slot="slider" data-default-value="50">
 *   <div data-slot="slider-control">
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
  const existingController = reuseRootBinding<SliderController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  const rootElement = root as HTMLElement;
  const track = getPart<HTMLElement>(root, "slider-track");
  const thumbs = getParts<HTMLElement>(root, "slider-thumb");
  const range = getPart<HTMLElement>(root, "slider-range");
  const explicitControl = getPart<HTMLElement>(root, "slider-control");

  if (!track || thumbs.length === 0) {
    throw new Error(
      "Slider requires slider-track and at least one slider-thumb",
    );
  }

  // Resolve the interactive control surface. Prefer an explicit control part,
  // then preserve the historical parent-of-track fallback, finally use the root.
  const control =
    explicitControl ??
    (track.parentElement instanceof HTMLElement ? track.parentElement : null) ??
    rootElement;

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
  const thumbAlignment =
    options.thumbAlignment ??
    getDataEnum(root, "thumbAlignment", THUMB_ALIGNMENTS) ??
    "center";
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
  let pressedThumbCenterOffset = 0;
  let layoutResizeObserver: ResizeObserver | null = null;

  const stateParts = Array.from(
    new Set(
      [rootElement, control, track, range, ...thumbs].filter(
        (part): part is HTMLElement => part instanceof HTMLElement,
      ),
    ),
  );

  const syncOrientation = () => {
    for (const part of stateParts) {
      part.setAttribute("data-orientation", orientation);
    }
  };

  syncOrientation();

  // Setup disabled state
  const applyDisabled = (isDisabled: boolean) => {
    for (const part of stateParts) {
      if (isDisabled) {
        part.setAttribute("data-disabled", "");
      } else {
        part.removeAttribute("data-disabled");
      }
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
    if (isRangeSlider) {
      thumb.setAttribute("data-index", String(index));
    } else {
      thumb.removeAttribute("data-index");
    }

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
  const usesInsetThumbAlignment = thumbAlignment !== "center";
  const layoutObservedParts = Array.from(
    new Set(
      [rootElement, control, track, ...thumbs].filter(
        (part): part is HTMLElement => part instanceof HTMLElement,
      ),
    ),
  );

  const applyTrackLayoutStyles = () => {
    track.style.position = "relative";
  };

  const applyThumbLayoutStyles = (thumb: HTMLElement, percent: number) => {
    thumb.style.position = "absolute";
    thumb.style.setProperty("--position", `${percent}%`);

    if (isHorizontal) {
      thumb.style.setProperty("inset-inline-start", "var(--position)");
      thumb.style.top = "50%";
      thumb.style.bottom = "";
      thumb.style.left = "";
      thumb.style.setProperty("translate", "-50% -50%");
    } else {
      thumb.style.removeProperty("inset-inline-start");
      thumb.style.bottom = "var(--position)";
      thumb.style.left = "50%";
      thumb.style.top = "";
      thumb.style.setProperty("translate", "-50% 50%");
    }
  };

  const applyRangeLayoutStyles = (
    startPercent: number,
    sizePercent: number,
    isRangeSegment: boolean,
  ) => {
    if (!range) return;

    const startPosition = isRangeSegment ? startPercent : sizePercent;

    range.style.setProperty("--start-position", `${startPosition}%`);
    range.style.position = isHorizontal ? "relative" : "absolute";

    if (isHorizontal) {
      range.style.setProperty(
        "inset-inline-start",
        isRangeSegment ? "var(--start-position)" : "0%",
      );
      range.style.width = isRangeSegment
        ? "var(--relative-size)"
        : "var(--start-position)";
      range.style.height = "inherit";
      range.style.bottom = "";
      range.style.left = "";
    } else {
      range.style.removeProperty("inset-inline-start");
      range.style.bottom = isRangeSegment ? "var(--start-position)" : "0%";
      range.style.height = isRangeSegment
        ? "var(--relative-size)"
        : "var(--start-position)";
      range.style.width = "inherit";
      range.style.left = "";
    }

    if (isRangeSegment) {
      range.style.setProperty("--relative-size", `${sizePercent}%`);
    } else {
      range.style.removeProperty("--relative-size");
    }
  };

  applyTrackLayoutStyles();

  const getAxisSize = (rect: DOMRect | DOMRectReadOnly): number =>
    isHorizontal ? rect.width : rect.height;

  const getTrackOffsetWithinContainer = (
    containerRect: DOMRect | DOMRectReadOnly,
    trackRect: DOMRect | DOMRectReadOnly,
  ): number =>
    isHorizontal
      ? trackRect.left - containerRect.left
      : containerRect.bottom - trackRect.bottom;

  const getThumbContainer = (thumb: HTMLElement): HTMLElement =>
    thumb.offsetParent instanceof HTMLElement ? thumb.offsetParent : control;

  const getInsetTrackPercent = (
    rawPercent: number,
    trackSize: number,
    thumbSize: number,
  ): number | undefined => {
    if (
      !Number.isFinite(trackSize) ||
      !Number.isFinite(thumbSize) ||
      trackSize <= 0
    ) {
      return undefined;
    }

    const effectiveThumbSize = Math.min(trackSize, thumbSize);
    const availableTravel = Math.max(0, trackSize - effectiveThumbSize);
    const centerOffsetWithinTrack =
      effectiveThumbSize / 2 + (availableTravel * rawPercent) / 100;
    const trackPercent = clampPercent((centerOffsetWithinTrack / trackSize) * 100);

    return Number.isFinite(trackPercent) ? trackPercent : undefined;
  };

  const getVisualPercents = (
    thumb: HTMLElement | undefined,
    rawPercent: number,
  ): VisualPercents => {
    const fallback = {
      thumbPercent: rawPercent,
      trackPercent: rawPercent,
    };

    if (!thumb || !usesInsetThumbAlignment) {
      return fallback;
    }

    const trackRect = track.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const containerRect = getThumbContainer(thumb).getBoundingClientRect();

    const trackSize = getAxisSize(trackRect);
    const thumbSize = getAxisSize(thumbRect);
    const containerSize = getAxisSize(containerRect);

    if (
      !Number.isFinite(trackSize) ||
      !Number.isFinite(thumbSize) ||
      !Number.isFinite(containerSize) ||
      trackSize <= 0 ||
      containerSize <= 0
    ) {
      return fallback;
    }

    const trackPercent = getInsetTrackPercent(rawPercent, trackSize, thumbSize);

    if (trackPercent === undefined) {
      return fallback;
    }

    const effectiveThumbSize = Math.min(trackSize, thumbSize);
    const availableTravel = Math.max(0, trackSize - effectiveThumbSize);
    const centerOffsetWithinTrack =
      effectiveThumbSize / 2 + (availableTravel * rawPercent) / 100;
    const trackOffsetWithinContainer = getTrackOffsetWithinContainer(
      containerRect,
      trackRect,
    );
    const centerOffsetWithinContainer = trackOffsetWithinContainer + centerOffsetWithinTrack;
    const thumbPercent = clampPercent(
      (centerOffsetWithinContainer / containerSize) * 100,
    );

    if (!Number.isFinite(trackPercent) || !Number.isFinite(thumbPercent)) {
      return fallback;
    }

    return { thumbPercent, trackPercent };
  };

  const getRangeLayoutPercents = (
    minRawPercent: number,
    maxRawPercent: number,
  ) => {
    const fallback = {
      startPercent: minRawPercent,
      sizePercent: Math.max(0, maxRawPercent - minRawPercent),
    };

    if (!usesInsetThumbAlignment) {
      return fallback;
    }

    const trackRect = track.getBoundingClientRect();
    const trackSize = getAxisSize(trackRect);

    if (!Number.isFinite(trackSize) || trackSize <= 0) {
      return fallback;
    }

    const thumbSizes = thumbs.slice(0, 2).map((thumb) => {
      if (!(thumb instanceof HTMLElement)) {
        return NaN;
      }

      return getAxisSize(thumb.getBoundingClientRect());
    });

    if (
      thumbSizes.length < 2 ||
      thumbSizes.some((thumbSize) => !Number.isFinite(thumbSize) || thumbSize <= 0)
    ) {
      return fallback;
    }

    // Use a single inset corridor for the filled segment so it remains ordered
    // even when range thumbs have different sizes or grow during interaction.
    const sharedThumbSize = Math.max(...thumbSizes);
    const startPercent = getInsetTrackPercent(
      minRawPercent,
      trackSize,
      sharedThumbSize,
    );
    const endPercent = getInsetTrackPercent(
      maxRawPercent,
      trackSize,
      sharedThumbSize,
    );

    if (startPercent === undefined || endPercent === undefined) {
      return fallback;
    }

    return {
      startPercent,
      sizePercent: Math.max(0, endPercent - startPercent),
    };
  };

  // Update visual state (CSS positioning, ARIA values)
  const updateVisualState = () => {
    if (isRange(currentValue)) {
      const [minVal, maxVal] = currentValue;
      const minRawPercent = valueToPercent(minVal, min, max);
      const maxRawPercent = valueToPercent(maxVal, min, max);
      const minVisual = getVisualPercents(thumbs[0], minRawPercent);
      const maxVisual = getVisualPercents(thumbs[1], maxRawPercent);
      const rangeLayout = getRangeLayoutPercents(minRawPercent, maxRawPercent);

      // Update thumbs with dynamic ARIA bounds
      if (thumbs[0]) {
        setAria(thumbs[0], "valuenow", String(minVal));
        setAria(thumbs[0], "valuemin", String(min));
        // Min thumb's max is constrained by max thumb's value
        setAria(thumbs[0], "valuemax", String(maxVal));
        applyThumbLayoutStyles(thumbs[0], minVisual.thumbPercent);
      }
      if (thumbs[1]) {
        setAria(thumbs[1], "valuenow", String(maxVal));
        // Max thumb's min is constrained by min thumb's value
        setAria(thumbs[1], "valuemin", String(minVal));
        setAria(thumbs[1], "valuemax", String(max));
        applyThumbLayoutStyles(thumbs[1], maxVisual.thumbPercent);
      }

      // Update range
      applyRangeLayoutStyles(
        rangeLayout.startPercent,
        rangeLayout.sizePercent,
        true,
      );
    } else {
      const rawPercent = valueToPercent(currentValue, min, max);
      const visual = getVisualPercents(thumbs[0], rawPercent);

      // Update thumb
      if (thumbs[0]) {
        setAria(thumbs[0], "valuenow", String(currentValue));
        setAria(thumbs[0], "valuemin", String(min));
        setAria(thumbs[0], "valuemax", String(max));
        applyThumbLayoutStyles(thumbs[0], visual.thumbPercent);
      }

      // Update range (from start to thumb)
      applyRangeLayoutStyles(0, visual.trackPercent, false);
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

  const syncLayoutResizeObserver = () => {
    layoutResizeObserver?.disconnect();
    layoutResizeObserver = null;

    if (!usesInsetThumbAlignment || typeof ResizeObserver !== "function") {
      return;
    }

    layoutResizeObserver = new ResizeObserver(() => {
      updateVisualState();
    });

    for (const part of layoutObservedParts) {
      layoutResizeObserver.observe(part);
    }
  };

  syncLayoutResizeObserver();
  cleanups.push(() => {
    layoutResizeObserver?.disconnect();
    layoutResizeObserver = null;
  });

  // Get position from pointer event - use track for geometry
  const getValueFromPointer = (
    e: PointerEvent,
    thumbIndex: number | null = null,
  ): number | null => {
    const rect = track.getBoundingClientRect();
    const trackSize = getAxisSize(rect);

    // Bail if track has zero size
    if (trackSize === 0) return null;

    const adjustedPointerCoord = (isHorizontal ? e.clientX : e.clientY) - pressedThumbCenterOffset;
    const distanceFromTrackStart = isHorizontal
      ? adjustedPointerCoord - rect.left
      : rect.bottom - adjustedPointerCoord;

    let percent = (distanceFromTrackStart / trackSize) * 100;

    if (usesInsetThumbAlignment && thumbIndex !== null) {
      const thumb = thumbs[thumbIndex];
      const thumbRect = thumb?.getBoundingClientRect();
      const thumbSize = thumbRect ? getAxisSize(thumbRect) : 0;
      const availableTravel = trackSize - thumbSize;

      if (Number.isFinite(thumbSize) && thumbSize > 0 && availableTravel > 0) {
        percent = ((distanceFromTrackStart - thumbSize / 2) / availableTravel) * 100;
      }
    }

    percent = clampPercent(percent);
    return percentToValue(percent, min, max);
  };

  const getThumbPressOffset = (
    thumbIndex: number | null,
    e: PointerEvent,
  ): number => {
    if (!usesInsetThumbAlignment || thumbIndex === null) {
      return 0;
    }

    const thumb = thumbs[thumbIndex];
    const rect = thumb?.getBoundingClientRect();
    const thumbSize = rect ? getAxisSize(rect) : 0;

    if (!thumb || !Number.isFinite(thumbSize) || thumbSize <= 0) {
      return 0;
    }

    const thumbCenter = isHorizontal
      ? rect.left + rect.width / 2
      : rect.top + rect.height / 2;

    return (isHorizontal ? e.clientX : e.clientY) - thumbCenter;
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

    // Check if user clicked directly on a thumb
    let thumbIndex = getThumbIndexFromTarget(e.target);
    pressedThumbCenterOffset = getThumbPressOffset(thumbIndex, e);

    let value = getValueFromPointer(e, thumbIndex);
    if (value === null) {
      pressedThumbCenterOffset = 0;
      return;
    }

    // If not on a thumb, find closest thumb
    if (thumbIndex === null) {
      thumbIndex = getClosestThumbIndex(value);
      const adjustedValue = getValueFromPointer(e, thumbIndex);
      if (adjustedValue !== null) {
        value = adjustedValue;
      }
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
    const value = getValueFromPointer(e, draggingThumbIndex);
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
    pressedThumbCenterOffset = 0;

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
      pressedThumbCenterOffset = 0;
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all slider components in a scope
 * Returns array of controllers for programmatic access
 */
export function create(scope: ParentNode = document): SliderController[] {
  const controllers: SliderController[] = [];

  for (const root of getRoots(scope, "slider")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createSlider(root));
  }

  return controllers;
}
