import { TOAST_TYPES } from "./types";
import type {
  ResolvedToast, ToastAction, ToastClearableField, ToastPromiseState, ToastPromiseStateValue,
  ToastShowOptions, ToastType, ToastUpdateOptions,
} from "./types";

const DEFAULT_LIMIT = 3;

// ============================================================================
// Field guards: the single definition of what each toast field accepts.
// ============================================================================

type ToastField = keyof Omit<ToastShowOptions, "id">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";
const isString = (value: unknown): value is string => typeof value === "string";
export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
export const isToastType = (value: unknown): value is ToastType =>
  typeof value === "string" && TOAST_TYPES.includes(value as ToastType);
const isToastAction = (value: unknown): value is ToastAction =>
  isRecord(value) &&
  isNonEmptyString(value["label"]) &&
  (value["onClick"] === undefined || typeof value["onClick"] === "function") &&
  (value["value"] === undefined || isString(value["value"]));

const FIELD_GUARDS: { [K in ToastField]: (value: unknown) => value is NonNullable<ToastShowOptions[K]> } = {
  title: isNonEmptyString,
  description: isString,
  type: isToastType,
  duration: isFiniteNumber,
  action: isToastAction,
  dismissible: isBoolean,
  closeButtonAriaLabel: isString,
  testId: isString,
};
const TOAST_FIELDS = Object.keys(FIELD_GUARDS) as ToastField[];
const CLEARABLE_FIELDS: ReadonlySet<ToastField> = new Set<ToastClearableField>([
  "description", "action", "closeButtonAriaLabel", "testId",
]);

// ============================================================================
// Normalization
// ============================================================================

export const normalizeLimit = (value: number | undefined): number => {
  if (!isFiniteNumber(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.trunc(value));
};

export const normalizeDuration = (value: number | undefined, fallback: number): number => {
  if (!isFiniteNumber(value)) return fallback;
  if (value <= 0) return 0;
  return Math.max(1, Math.trunc(value));
};

/** The toast a `show()` patch is applied onto. */
export const createDefaultToast = (id: string, duration: number): ResolvedToast => ({
  id,
  title: "",
  type: "default",
  duration,
  dismissible: true,
});

/** `undefined` keeps the base value; `null` clears it. */
const patched = <T,>(base: T | undefined, value: T | null | undefined): T | undefined =>
  value === undefined ? base : (value ?? undefined);

/**
 * Apply a patch onto a toast. Missing or `undefined` fields keep the base
 * value; `null` clears a clearable field. Showing a toast is applying the
 * options onto `createDefaultToast()`.
 */
export const applyToastPatch = (base: ResolvedToast, patch: ToastUpdateOptions): ResolvedToast => {
  const title = patch.title ?? base.title;
  if (!isNonEmptyString(title)) {
    throw new Error("Toast requires a non-empty title");
  }
  return {
    id: base.id,
    title,
    description: patched(base.description, patch.description),
    type: isToastType(patch.type) ? patch.type : base.type,
    duration: patch.duration === undefined ? base.duration : normalizeDuration(patch.duration, base.duration),
    action: patched(base.action, patch.action),
    dismissible: patch.dismissible ?? base.dismissible,
    closeButtonAriaLabel: patched(base.closeButtonAriaLabel, patch.closeButtonAriaLabel),
    testId: patched(base.testId, patch.testId),
  };
};

// ============================================================================
// Untrusted event details
// ============================================================================

/** Keep the fields of an untrusted record that pass their guard, plus `null` on clearable fields. */
const sanitizeFields = (record: Record<string, unknown>): ToastUpdateOptions => {
  const patch: ToastUpdateOptions = {};
  for (const key of TOAST_FIELDS) {
    const value = record[key];
    if (FIELD_GUARDS[key](value) || (value === null && CLEARABLE_FIELDS.has(key))) {
      Object.assign(patch, { [key]: value });
    }
  }
  return patch;
};

export const parseShowDetail = (
  detail: unknown,
): { id: string | undefined; patch: ToastUpdateOptions } | null => {
  if (!isRecord(detail)) return null;
  const patch = sanitizeFields(detail);
  if (!patch.title) return null;
  return { id: isNonEmptyString(detail["id"]) ? detail["id"] : undefined, patch };
};

export const parseUpdateDetail = (
  detail: unknown,
): { id: string; patch: ToastUpdateOptions } | null => {
  if (!isRecord(detail) || !isNonEmptyString(detail["id"])) return null;
  const patch = sanitizeFields(detail);
  return Object.keys(patch).length > 0 ? { id: detail["id"], patch } : null;
};

export const parseDismissDetail = (detail: unknown): string | null => {
  if (isNonEmptyString(detail)) return detail;
  if (isRecord(detail) && isNonEmptyString(detail["id"])) return detail["id"];
  return null;
};

// ============================================================================
// Promise states
// ============================================================================

export const resolvePromiseStateObject = (
  value: string | ToastPromiseState | undefined,
): ToastPromiseState => (typeof value === "string" ? { title: value } : value ?? {});

export const resolvePromiseStateValue = <T,>(
  value: ToastPromiseStateValue<T> | undefined,
  payload: T,
): ToastPromiseState => resolvePromiseStateObject(
  typeof value === "function" ? value(payload) : value,
);

interface PromiseStateFallback {
  title: string;
  type: ToastType;
  duration: number;
  description?: string;
}

/**
 * Turn a promise state into a patch. Only `title`, `type`, `duration`, and
 * `description` fall back to defaults; everything else the state leaves out
 * stays as the toast currently has it.
 */
export const resolvePromisePatch = (
  state: ToastPromiseState,
  fallback: PromiseStateFallback,
): ToastUpdateOptions => {
  const { message, ...patch } = state;
  return {
    ...patch,
    title: isNonEmptyString(state.title) ? state.title : isNonEmptyString(message) ? message : fallback.title,
    description: state.description === undefined ? fallback.description : state.description,
    type: state.type ?? fallback.type,
    duration: state.duration ?? fallback.duration,
  };
};

export const resolveErrorTitle = (error: unknown): string => {
  if (isNonEmptyString(error)) return error;
  if (error instanceof Error && isNonEmptyString(error.message)) return error.message;
  return "Error";
};
