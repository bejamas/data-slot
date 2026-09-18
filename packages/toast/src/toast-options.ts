import { TOAST_TYPES } from "./types";
import type { ResolvedToast, ToastAction, ToastShowOptions, ToastUpdateOptions, ToastType, ToastPromiseState, ToastPromiseStateValue } from "./types";

const DEFAULT_LIMIT = 3;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isToastType = (value: unknown): value is ToastType =>
  typeof value === "string" && TOAST_TYPES.includes(value as ToastType);

export const normalizeLimit = (value: number | undefined): number => {
  if (!isFiniteNumber(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.trunc(value));
};

export const normalizeDuration = (value: number | undefined, fallback: number): number => {
  if (!isFiniteNumber(value)) return fallback;
  if (value <= 0) return 0;
  return Math.max(1, Math.trunc(value));
};

export const parseShowDetail = (detail: unknown): ToastShowOptions | null => {
  if (!detail || typeof detail !== "object") return null;

  const record = detail as Record<string, unknown>;
  if (typeof record["title"] !== "string" || record["title"].trim() === "") {
    return null;
  }

  const action = parseActionDetail(record["action"]);

  return {
    id: typeof record["id"] === "string" ? record["id"] : undefined,
    title: record["title"],
    description: typeof record["description"] === "string" ? record["description"] : undefined,
    type: isToastType(record["type"]) ? record["type"] : undefined,
    duration: isFiniteNumber(record["duration"]) ? record["duration"] : undefined,
    action,
    dismissible: typeof record["dismissible"] === "boolean" ? record["dismissible"] : undefined,
    closeButtonAriaLabel:
      typeof record["closeButtonAriaLabel"] === "string" ? record["closeButtonAriaLabel"] : undefined,
    testId: typeof record["testId"] === "string" ? record["testId"] : undefined,
  };
};

export const parseDismissDetail = (detail: unknown): string | null => {
  if (typeof detail === "string" && detail.trim() !== "") {
    return detail;
  }
  if (detail && typeof detail === "object") {
    const id = (detail as { id?: unknown }).id;
    if (typeof id === "string" && id.trim() !== "") {
      return id;
    }
  }
  return null;
};

const parseActionDetail = (detail: unknown): ToastAction | undefined => {
  if (!detail || typeof detail !== "object") return undefined;

  const actionRecord = detail as Record<string, unknown>;
  if (typeof actionRecord["label"] !== "string" || actionRecord["label"].trim() === "") {
    return undefined;
  }

  return {
    label: actionRecord["label"],
    onClick:
      typeof actionRecord["onClick"] === "function"
        ? (actionRecord["onClick"] as ToastAction["onClick"])
        : undefined,
    value: typeof actionRecord["value"] === "string" ? actionRecord["value"] : undefined,
  };
};

export const parseUpdateDetail = (
  detail: unknown,
): { id: string; patch: ToastUpdateOptions } | null => {
  if (!detail || typeof detail !== "object") return null;

  const record = detail as Record<string, unknown>;
  const id = typeof record["id"] === "string" && record["id"].trim() !== "" ? record["id"] : null;
  if (!id) return null;

  const hasOwn = <K extends keyof ToastUpdateOptions>(key: K): boolean =>
    Object.prototype.hasOwnProperty.call(record, key);
  const patch: ToastUpdateOptions = {};
  let hasPatch = false;
  const setPatch = <K extends keyof ToastUpdateOptions>(key: K, value: ToastUpdateOptions[K]) => {
    patch[key] = value;
    hasPatch = true;
  };

  if (hasOwn("title")) {
    if (typeof record["title"] !== "string" || record["title"].trim() === "") {
      return null;
    }
    setPatch("title", record["title"]);
  }

  if (hasOwn("description")) {
    const description = record["description"];
    if (description === null || typeof description === "undefined") {
      setPatch("description", undefined);
    } else if (typeof description === "string") {
      setPatch("description", description);
    }
  }

  if (hasOwn("type") && isToastType(record["type"])) {
    setPatch("type", record["type"]);
  }

  if (hasOwn("duration") && isFiniteNumber(record["duration"])) {
    setPatch("duration", record["duration"]);
  }

  if (hasOwn("action")) {
    if (record["action"] === null || typeof record["action"] === "undefined") {
      setPatch("action", undefined);
    } else {
      const action = parseActionDetail(record["action"]);
      if (action) {
        setPatch("action", action);
      }
    }
  }

  if (hasOwn("dismissible") && typeof record["dismissible"] === "boolean") {
    setPatch("dismissible", record["dismissible"]);
  }

  if (hasOwn("closeButtonAriaLabel")) {
    const closeButtonAriaLabel = record["closeButtonAriaLabel"];
    if (closeButtonAriaLabel === null || typeof closeButtonAriaLabel === "undefined") {
      setPatch("closeButtonAriaLabel", undefined);
    } else if (typeof closeButtonAriaLabel === "string") {
      setPatch("closeButtonAriaLabel", closeButtonAriaLabel);
    }
  }

  if (hasOwn("testId")) {
    const testId = record["testId"];
    if (testId === null || typeof testId === "undefined") {
      setPatch("testId", undefined);
    } else if (typeof testId === "string") {
      setPatch("testId", testId);
    }
  }

  if (!hasPatch) return null;
  return { id, patch };
};

export const resolvePromiseStateObject = (
  value: string | ToastPromiseState | undefined,
): ToastPromiseState => {
  if (typeof value === "string") {
    return { title: value };
  }
  return value ?? {};
};

export const resolvePromiseStateValue = <T,>(
  value: ToastPromiseStateValue<T> | undefined,
  payload: T,
): ToastPromiseState => resolvePromiseStateObject(
  typeof value === "function" ? value(payload) : value,
);

export const resolveUpdatedToast = (
  current: ResolvedToast,
  patch: ToastUpdateOptions,
): { next: ResolvedToast; durationChanged: boolean } => {
  const hasOwn = <K extends keyof ToastUpdateOptions>(key: K): boolean =>
    Object.prototype.hasOwnProperty.call(patch, key);

  const nextTitle = hasOwn("title") ? patch.title : current.title;
  if (!nextTitle || nextTitle.trim() === "") {
    throw new Error("Toast update requires title to remain non-empty");
  }

  const durationChanged = hasOwn("duration");
  const nextDuration = durationChanged
    ? normalizeDuration(patch.duration, current.duration)
    : current.duration;

  const next: ResolvedToast = {
    id: current.id,
    title: nextTitle,
    description: hasOwn("description") ? patch.description : current.description,
    type: hasOwn("type") && isToastType(patch.type) ? patch.type : current.type,
    duration: nextDuration,
    action: hasOwn("action") ? patch.action : current.action,
    dismissible: hasOwn("dismissible") ? (patch.dismissible ?? true) : current.dismissible,
    closeButtonAriaLabel: hasOwn("closeButtonAriaLabel")
      ? patch.closeButtonAriaLabel
      : current.closeButtonAriaLabel,
    testId: hasOwn("testId") ? patch.testId : current.testId,
  };

  return { next, durationChanged };
};

const resolvePromiseTitle = (
  state: ToastPromiseState,
  fallbackTitle: string,
): string => {
  if (typeof state.title === "string" && state.title.trim() !== "") {
    return state.title;
  }
  if (typeof state.message === "string" && state.message.trim() !== "") {
    return state.message;
  }
  return fallbackTitle;
};

export const resolvePromiseShowOptions = (
  state: ToastPromiseState,
  fallback: {
    title: string;
    type: ToastType;
    duration: number;
    description?: string;
  },
): ToastShowOptions => ({
  title: resolvePromiseTitle(state, fallback.title),
  description: state.description ?? fallback.description,
  type: isToastType(state.type) ? state.type : fallback.type,
  duration: normalizeDuration(state.duration, fallback.duration),
  action: state.action,
  dismissible: state.dismissible,
  closeButtonAriaLabel: state.closeButtonAriaLabel,
  testId: state.testId,
});

export const resolveErrorTitle = (error: unknown): string => {
  if (typeof error === "string" && error.trim() !== "") return error;
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  return "Error";
};

