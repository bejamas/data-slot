import {
  getPart,
  getRoots,
  getDataBool,
  getDataEnum,
  getDataNumber,
  createPortalLifecycle,
  createPresenceLifecycle,
  on,
  emit,
} from "@data-slot/core";
import type { PresenceLifecycleController } from "@data-slot/core";

const POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

const TOAST_TYPES = [
  "default",
  "success",
  "error",
  "warning",
  "info",
  "loading",
] as const;

const DEFAULT_LIMIT = 3;
const DEFAULT_DURATION = 5000;
const DEFAULT_POSITION: ToastPosition = "bottom-right";
const DEFAULT_GAP = 8;
const DEFAULT_SWIPE_THRESHOLD = 80;

export type ToastPosition = (typeof POSITIONS)[number];
type ToastType = (typeof TOAST_TYPES)[number];

export interface ToastActionEvent {
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

export interface ToastAction {
  label: string;
  onClick?: (() => void) | ((event: ToastActionEvent) => void);
  value?: string;
}

export interface ToastShowOptions {
  id?: string;
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
  closeButtonAriaLabel?: string;
  testId?: string;
}

export interface ToastUpdateOptions {
  title?: string;
  description?: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
  closeButtonAriaLabel?: string;
  testId?: string;
}

export interface ToastPromiseState
  extends Omit<
    ToastUpdateOptions,
    "title"
  > {
  title?: string;
  message?: string;
}

export type ToastPromiseStateValue<T> =
  | string
  | ToastPromiseState
  | ((value: T) => string | ToastPromiseState);

export type ToastPromiseErrorValue =
  | string
  | ToastPromiseState
  | ((error: unknown) => string | ToastPromiseState);

export interface ToastPromiseOptions<T> {
  loading: string | ToastPromiseState;
  success?: ToastPromiseStateValue<T>;
  error?: ToastPromiseErrorValue;
  description?: string;
}

export interface ToastPromiseHandle<T> {
  id: string;
  unwrap(): Promise<T>;
}

export interface ToastOptions {
  limit?: number;
  duration?: number;
  position?: ToastPosition;
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  portal?: boolean;
  onShow?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAction?: (id: string, value: string | undefined) => void;
}

export interface ToastController {
  show(options: ToastShowOptions): string;
  update(id: string, patch: ToastUpdateOptions): void;
  promise<T>(
    input: Promise<T> | (() => Promise<T>),
    options: ToastPromiseOptions<T>,
  ): ToastPromiseHandle<T>;
  dismiss(id: string): void;
  dismissAll(): void;
  readonly count: number;
  destroy(): void;
}

interface ToastEntry {
  id: string;
  element: HTMLElement;
  presence: PresenceLifecycleController;
  timerId: ReturnType<typeof setTimeout> | null;
  remainingMs: number;
  startedAt: number;
  duration: number;
  action?: ToastAction;
  toast: ResolvedToast;
  exiting: boolean;
  demoted: boolean;
}

interface ResolvedToast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
  dismissible: boolean;
  closeButtonAriaLabel?: string;
  testId?: string;
}

interface QueuedToast extends ResolvedToast {
  queuedAt: number;
}

interface ToastChangeDetail {
  id: string;
  action: "show" | "dismiss";
}

interface ToastActionDetail {
  id: string;
  value: string | undefined;
}

interface SwipeState {
  id: string;
  pointerId: number;
  startY: number;
  currentY: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isToastType = (value: unknown): value is ToastType =>
  typeof value === "string" && TOAST_TYPES.includes(value as ToastType);

const normalizeLimit = (value: number | undefined): number => {
  if (!isFiniteNumber(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.trunc(value));
};

const normalizeDuration = (value: number | undefined, fallback: number): number => {
  if (!isFiniteNumber(value)) return fallback;
  if (value <= 0) return 0;
  return Math.max(1, Math.trunc(value));
};

const getStackDirection = (position: ToastPosition): number =>
  position.startsWith("top") ? 1 : -1;

const getCssGap = (viewport: HTMLElement): number => {
  const raw = getComputedStyle(viewport).getPropertyValue("--toast-gap").trim();
  if (!raw) return DEFAULT_GAP;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_GAP;
};

const isTemplateElement = (el: Element | null): el is HTMLTemplateElement =>
  el instanceof HTMLTemplateElement;

const ensureTemplateHasItem = (template: HTMLTemplateElement): boolean =>
  !!template.content.querySelector('[data-slot="toast-item"]');

const createFallbackTemplate = (doc: Document): HTMLTemplateElement => {
  const template = doc.createElement("template");
  template.innerHTML = `
    <li data-slot="toast-item" role="status" aria-atomic="true">
      <span data-slot="toast-title"></span>
      <span data-slot="toast-description"></span>
      <button data-slot="toast-action" type="button"></button>
      <button data-slot="toast-close" type="button" aria-label="Close">&times;</button>
    </li>
  `;
  return template;
};

const setOpenState = (el: HTMLElement, state: "open" | "closed") => {
  el.setAttribute("data-state", state);
  if (state === "open") {
    el.setAttribute("data-open", "");
    el.removeAttribute("data-closed");
  } else {
    el.setAttribute("data-closed", "");
    el.removeAttribute("data-open");
  }
};

const setItemA11y = (item: HTMLElement, type: ToastShowOptions["type"]) => {
  if (type === "error" || type === "warning") {
    item.setAttribute("role", "alert");
    item.setAttribute("aria-live", "assertive");
  } else {
    item.setAttribute("role", "status");
    item.setAttribute("aria-live", "polite");
  }
  item.setAttribute("aria-atomic", "true");
};

const parseShowDetail = (detail: unknown): ToastShowOptions | null => {
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

const parseDismissDetail = (detail: unknown): string | null => {
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

const parseUpdateDetail = (
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

const resolvePromiseStateObject = (
  value: string | ToastPromiseState | undefined,
): ToastPromiseState => {
  if (typeof value === "string") {
    return { title: value };
  }
  return value ?? {};
};

const resolvePromiseStateValue = <T,>(
  value: ToastPromiseStateValue<T> | ToastPromiseErrorValue | undefined,
  payload: T | unknown,
): ToastPromiseState => {
  if (typeof value === "function") {
    const result = (value as (input: T | unknown) => string | ToastPromiseState)(payload);
    return resolvePromiseStateObject(result);
  }
  return resolvePromiseStateObject(value as string | ToastPromiseState | undefined);
};

/**
 * Create a toast controller for a root element.
 *
 * Required markup:
 * ```html
 * <div data-slot="toast">
 *   <template data-slot="toast-template">...</template>
 *   <ol data-slot="toast-viewport"></ol>
 * </div>
 * ```
 */
export function createToast(root: Element, options: ToastOptions = {}): ToastController {
  const viewport = getPart<HTMLElement>(root, "toast-viewport");
  if (!viewport) {
    throw new Error("Toast requires a toast-viewport slot");
  }
  const doc = root.ownerDocument ?? document;

  const authoredTemplate = getPart(root, "toast-template");
  const fallbackTemplate = createFallbackTemplate(root.ownerDocument ?? document);

  const resolvedLimit = normalizeLimit(options.limit ?? getDataNumber(root, "limit"));
  const defaultDuration = normalizeDuration(
    options.duration ?? getDataNumber(root, "duration"),
    DEFAULT_DURATION,
  );
  const position =
    options.position ??
    getDataEnum(root, "position", POSITIONS) ??
    DEFAULT_POSITION;
  const pauseOnHover = options.pauseOnHover ?? getDataBool(root, "pauseOnHover") ?? true;
  const pauseOnFocus = options.pauseOnFocus ?? getDataBool(root, "pauseOnFocus") ?? true;
  const portalOption = options.portal ?? getDataBool(root, "portal") ?? false;
  const onShow = options.onShow;
  const onDismiss = options.onDismiss;
  const onAction = options.onAction;

  const stackDirection = getStackDirection(position);

  root.setAttribute("data-position", position);
  if (!viewport.hasAttribute("role")) {
    viewport.setAttribute("role", "region");
  }
  if (!viewport.hasAttribute("aria-label")) {
    viewport.setAttribute("aria-label", "Notifications");
  }

  const portal = createPortalLifecycle({
    content: viewport,
    root,
    enabled: portalOption,
  });

  if (portalOption) {
    portal.mount();
  }

  const entries = new Map<string, ToastEntry>();
  const activeOrder: string[] = [];
  const queued = new Map<string, QueuedToast>();
  const queueOrder: string[] = [];
  const cleanups: Array<() => void> = [];

  let idCounter = 0;
  let destroyed = false;
  let pauseHover = false;
  let pauseFocus = false;
  let timersPaused = false;
  let swipeState: SwipeState | null = null;

  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          reindex();
        })
      : null;

  const removeFromActiveOrder = (id: string) => {
    const idx = activeOrder.indexOf(id);
    if (idx !== -1) {
      activeOrder.splice(idx, 1);
    }
  };

  const clearTimer = (entry: ToastEntry) => {
    if (entry.timerId) {
      clearTimeout(entry.timerId);
      entry.timerId = null;
    }
  };

  const demoteOldestVisibleToQueue = () => {
    const oldestId = activeOrder[0];
    if (!oldestId) return;

    const entry = entries.get(oldestId);
    if (!entry || entry.exiting) return;

    if (entry.duration > 0 && entry.timerId) {
      const elapsed = Date.now() - entry.startedAt;
      entry.remainingMs = Math.max(0, entry.remainingMs - elapsed);
    }

    clearTimer(entry);
    removeFromActiveOrder(oldestId);
    unobserveItem(entry.element);

    const queuedToast: QueuedToast = {
      ...entry.toast,
      duration: entry.duration <= 0 ? 0 : Math.max(1, entry.remainingMs),
      queuedAt: Date.now(),
    };

    queued.set(oldestId, queuedToast);
    queueOrder.push(oldestId);
    entry.demoted = true;
    entry.exiting = true;
    entry.element.removeAttribute("data-front");
    entry.element.style.zIndex = "0";
    entry.element.style.pointerEvents = "none";
    setOpenState(entry.element, "closed");
    reindex();
    entry.presence.exit();
  };

  const removeQueued = (id: string): QueuedToast | null => {
    const queuedToast = queued.get(id);
    if (!queuedToast) return null;
    queued.delete(id);
    const idx = queueOrder.indexOf(id);
    if (idx !== -1) {
      queueOrder.splice(idx, 1);
    }
    return queuedToast;
  };

  const reindex = () => {
    const newestFirst: ToastEntry[] = [];

    for (let i = activeOrder.length - 1; i >= 0; i -= 1) {
      const id = activeOrder[i];
      if (!id) continue;
      const entry = entries.get(id);
      if (!entry || entry.exiting) continue;
      newestFirst.push(entry);
    }

    const gap = getCssGap(viewport);
    const count = newestFirst.length;
    let cumulativeOffset = 0;
    let frontHeight = 0;

    for (let index = 0; index < newestFirst.length; index += 1) {
      const entry = newestFirst[index];
      if (!entry) continue;

      const rect = entry.element.getBoundingClientRect();
      const height = rect.height > 0 ? rect.height : entry.element.offsetHeight;
      if (index === 0) {
        frontHeight = height;
        entry.element.setAttribute("data-front", "");
      } else {
        entry.element.removeAttribute("data-front");
      }

      entry.element.style.setProperty("--toast-index", String(index));
      entry.element.style.setProperty("--toast-count", String(count));
      entry.element.style.setProperty("--toast-height", `${height}px`);
      entry.element.style.setProperty("--toast-offset-y", `${cumulativeOffset}px`);
      entry.element.style.setProperty("--toast-stack-direction", String(stackDirection));
      entry.element.style.zIndex = String(count - index + 1);
      entry.element.style.pointerEvents = "";

      cumulativeOffset += height + gap;
    }

    const stackSize = count > 0 ? Math.max(0, cumulativeOffset - gap) : 0;
    viewport.style.setProperty("--toast-count", String(count));
    viewport.style.setProperty("--toast-frontmost-height", `${frontHeight}px`);
    viewport.style.setProperty("--toast-stack-size", `${stackSize}px`);
    viewport.style.setProperty("--toast-stack-direction", String(stackDirection));
  };

  const isPaused = () => pauseHover || pauseFocus;

  const pauseAllTimers = () => {
    const now = Date.now();
    for (const id of [...activeOrder]) {
      const entry = entries.get(id);
      if (!entry || entry.exiting || entry.duration <= 0 || !entry.timerId) continue;
      const elapsed = now - entry.startedAt;
      entry.remainingMs = Math.max(0, entry.remainingMs - elapsed);
      clearTimer(entry);
    }
  };

  const dismiss = (id: string) => {
    const removedQueued = removeQueued(id);
    if (removedQueued) {
      emit<ToastChangeDetail>(root, "toast:change", { id, action: "dismiss" });
      onDismiss?.(id);
      return;
    }

    const entry = entries.get(id);
    if (!entry || entry.exiting) return;

    entry.exiting = true;
    clearTimer(entry);
    removeFromActiveOrder(id);
    entry.element.removeAttribute("data-front");
    entry.element.style.zIndex = "0";
    entry.element.style.pointerEvents = "none";
    setOpenState(entry.element, "closed");
    reindex();
    flushQueue();

    emit<ToastChangeDetail>(root, "toast:change", { id, action: "dismiss" });
    onDismiss?.(id);

    entry.presence.exit();
  };

  const resumeAllTimers = () => {
    for (const id of [...activeOrder]) {
      const entry = entries.get(id);
      if (!entry || entry.exiting || entry.duration <= 0 || entry.timerId) continue;

      if (entry.remainingMs <= 0) {
        dismiss(entry.id);
        continue;
      }

      entry.startedAt = Date.now();
      entry.timerId = setTimeout(() => {
        dismiss(entry.id);
      }, entry.remainingMs);
    }
  };

  const syncPauseState = () => {
    const paused = isPaused();
    if (paused) {
      viewport.setAttribute("data-expanded", "");
    } else {
      viewport.removeAttribute("data-expanded");
    }

    if (paused === timersPaused) return;
    timersPaused = paused;

    if (timersPaused) {
      pauseAllTimers();
    } else {
      resumeAllTimers();
    }
  };

  const observeItem = (element: HTMLElement) => {
    resizeObserver?.observe(element);
  };

  const unobserveItem = (element: HTMLElement) => {
    resizeObserver?.unobserve(element);
  };

  const forceRemoveEntry = (id: string, notifyDismiss = false) => {
    const entry = entries.get(id);
    if (!entry) return;

    clearTimer(entry);
    removeFromActiveOrder(id);
    unobserveItem(entry.element);
    entry.presence.cleanup();
    entry.element.remove();
    entries.delete(id);
    reindex();

    if (notifyDismiss) {
      emit<ToastChangeDetail>(root, "toast:change", { id, action: "dismiss" });
      onDismiss?.(id);
    }
  };

  const resolveTemplateFragment = (): { fragment: DocumentFragment; item: HTMLElement } => {
    const sourceTemplate =
      isTemplateElement(authoredTemplate) && ensureTemplateHasItem(authoredTemplate)
        ? authoredTemplate
        : fallbackTemplate;

    let fragment = sourceTemplate.content.cloneNode(true) as DocumentFragment;
    let item = fragment.querySelector<HTMLElement>('[data-slot="toast-item"]');

    if (!item) {
      fragment = fallbackTemplate.content.cloneNode(true) as DocumentFragment;
      item = fragment.querySelector<HTMLElement>('[data-slot="toast-item"]');
    }

    if (!item) {
      throw new Error("Toast template must include a toast-item slot");
    }

    return { fragment, item };
  };

  const applyToastContentToItem = (item: HTMLElement, toast: ResolvedToast) => {
    const titleSlot = item.querySelector<HTMLElement>('[data-slot="toast-title"]');
    const descriptionSlot = item.querySelector<HTMLElement>('[data-slot="toast-description"]');
    const actionSlot = item.querySelector<HTMLElement>('[data-slot="toast-action"]');
    const closeSlot = item.querySelector<HTMLElement>('[data-slot="toast-close"]');

    if (titleSlot) {
      titleSlot.textContent = toast.title;
      titleSlot.hidden = false;
    }

    if (descriptionSlot) {
      if (toast.description && toast.description.trim() !== "") {
        descriptionSlot.textContent = toast.description;
        descriptionSlot.hidden = false;
      } else {
        descriptionSlot.textContent = "";
        descriptionSlot.hidden = true;
      }
    }

    if (actionSlot) {
      if (toast.action?.label && toast.action.label.trim() !== "") {
        actionSlot.textContent = toast.action.label;
        actionSlot.hidden = false;
      } else {
        actionSlot.textContent = "";
        actionSlot.hidden = true;
      }
    }

    item.setAttribute("data-type", toast.type);
    if (toast.dismissible) {
      item.removeAttribute("data-dismissible");
    } else {
      item.setAttribute("data-dismissible", "false");
    }
    if (toast.testId && toast.testId.trim() !== "") {
      item.setAttribute("data-testid", toast.testId);
    } else {
      item.removeAttribute("data-testid");
    }

    if (closeSlot) {
      if (toast.closeButtonAriaLabel && toast.closeButtonAriaLabel.trim() !== "") {
        closeSlot.setAttribute("aria-label", toast.closeButtonAriaLabel);
      } else if (!closeSlot.getAttribute("aria-label")) {
        closeSlot.setAttribute("aria-label", "Close");
      }
    }

    setItemA11y(item, toast.type);
  };

  const createId = () => {
    let candidate = "";
    do {
      idCounter += 1;
      candidate = `toast-${idCounter}`;
    } while (entries.has(candidate) || queued.has(candidate));
    return candidate;
  };

  const startTimer = (entry: ToastEntry) => {
    if (entry.duration <= 0) return;
    entry.remainingMs = entry.duration;
    if (timersPaused) return;

    entry.startedAt = Date.now();
    entry.timerId = setTimeout(() => {
      dismiss(entry.id);
    }, entry.remainingMs);
  };

  const flushQueue = () => {
    while (activeOrder.length < resolvedLimit) {
      const nextId = queueOrder[queueOrder.length - 1];
      if (!nextId) return;
      if (entries.has(nextId)) return;

      queueOrder.pop();

      const nextQueued = queued.get(nextId);
      if (!nextQueued) continue;

      queued.delete(nextId);

      let remaining = nextQueued.duration;
      if (remaining > 0) {
        const elapsedHidden = Date.now() - nextQueued.queuedAt;
        remaining = Math.max(0, remaining - elapsedHidden);
      }

      if (remaining <= 0 && nextQueued.duration > 0) {
        emit<ToastChangeDetail>(root, "toast:change", { id: nextQueued.id, action: "dismiss" });
        onDismiss?.(nextQueued.id);
        continue;
      }

      const next: ResolvedToast = {
        id: nextQueued.id,
        title: nextQueued.title,
        description: nextQueued.description,
        type: nextQueued.type,
        duration: remaining,
        action: nextQueued.action,
        dismissible: nextQueued.dismissible,
        closeButtonAriaLabel: nextQueued.closeButtonAriaLabel,
        testId: nextQueued.testId,
      };

      mountToast(next, "oldest");
    }
  };

  const finishExit = (id: string) => {
    const entry = entries.get(id);
    if (!entry) return;

    clearTimer(entry);
    unobserveItem(entry.element);
    entry.presence.cleanup();
    entry.element.remove();
    entries.delete(id);
    reindex();
    flushQueue();
  };

  const mountToast = (toast: ResolvedToast, placement: "newest" | "oldest" = "newest") => {
    const { fragment, item } = resolveTemplateFragment();

    item.setAttribute("data-id", toast.id);
    applyToastContentToItem(item, toast);
    item.style.setProperty(
      "--toast-enter-direction",
      String(placement === "newest" ? stackDirection : -stackDirection),
    );
    item.style.setProperty("--toast-exit-direction", String(stackDirection));
    item.style.setProperty("--toast-swipe-movement-y", "0px");
    setOpenState(item, "open");

    const entry: ToastEntry = {
      id: toast.id,
      element: item,
      presence: createPresenceLifecycle({
        element: item,
        onExitComplete: () => {
          if (destroyed) return;
          finishExit(toast.id);
        },
      }),
      timerId: null,
      remainingMs: toast.duration,
      startedAt: 0,
      duration: toast.duration,
      action: toast.action,
      toast,
      exiting: false,
      demoted: false,
    };

    entries.set(toast.id, entry);
    if (placement === "oldest") {
      activeOrder.unshift(toast.id);
    } else {
      activeOrder.push(toast.id);
    }
    entry.presence.enter();
    viewport.appendChild(fragment);

    observeItem(item);
    reindex();
    startTimer(entry);

    emit<ToastChangeDetail>(root, "toast:change", { id: toast.id, action: "show" });
    onShow?.(toast.id);
  };

  const show = (showOptions: ToastShowOptions): string => {
    if (typeof showOptions.title !== "string" || showOptions.title.trim() === "") {
      throw new Error("Toast show requires a non-empty title");
    }

    const requestedId =
      typeof showOptions.id === "string" && showOptions.id.trim() !== ""
        ? showOptions.id
        : undefined;
    const id = requestedId ?? createId();

    if (entries.has(id)) {
      forceRemoveEntry(id, true);
    }

    if (removeQueued(id)) {
      emit<ToastChangeDetail>(root, "toast:change", { id, action: "dismiss" });
      onDismiss?.(id);
    }

    const toast: ResolvedToast = {
      id,
      title: showOptions.title,
      description: showOptions.description,
      type: isToastType(showOptions.type) ? showOptions.type : "default",
      duration: normalizeDuration(showOptions.duration, defaultDuration),
      action: showOptions.action,
      dismissible: showOptions.dismissible ?? true,
      closeButtonAriaLabel: showOptions.closeButtonAriaLabel,
      testId: showOptions.testId,
    };

    if (activeOrder.length >= resolvedLimit) {
      demoteOldestVisibleToQueue();
    }

    mountToast(toast);
    return id;
  };

  const resolveUpdatedToast = (
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

  const updateInternal = (id: string, patch: ToastUpdateOptions): boolean => {
    if (!id || id.trim() === "") return false;

    const queuedToast = queued.get(id);
    if (queuedToast) {
      const { next, durationChanged } = resolveUpdatedToast(queuedToast, patch);
      queued.set(id, {
        ...next,
        queuedAt: durationChanged ? Date.now() : queuedToast.queuedAt,
      });
      return true;
    }

    const entry = entries.get(id);
    if (!entry || entry.exiting) return false;

    const { next, durationChanged } = resolveUpdatedToast(entry.toast, patch);
    entry.toast = next;
    entry.action = next.action;

    applyToastContentToItem(entry.element, next);

    if (!next.dismissible && swipeState?.id === id) {
      swipeState = null;
      clearSwipeStyles(entry);
    }

    if (durationChanged) {
      clearTimer(entry);
      entry.duration = next.duration;
      entry.remainingMs = next.duration;
      if (next.duration > 0 && !timersPaused) {
        entry.startedAt = Date.now();
        entry.timerId = setTimeout(() => {
          dismiss(entry.id);
        }, entry.remainingMs);
      }
    }

    reindex();
    return true;
  };

  const update = (id: string, patch: ToastUpdateOptions) => {
    updateInternal(id, patch);
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

  const resolvePromiseShowOptions = (
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

  const resolveErrorTitle = (error: unknown): string => {
    if (typeof error === "string" && error.trim() !== "") return error;
    if (error instanceof Error && error.message.trim() !== "") return error.message;
    return "Error";
  };

  const promise = <T,>(
    input: Promise<T> | (() => Promise<T>),
    promiseOptions: ToastPromiseOptions<T>,
  ): ToastPromiseHandle<T> => {
    const loadingState = resolvePromiseStateObject(promiseOptions.loading);
    const loadingOptions = resolvePromiseShowOptions(loadingState, {
      title: "Loading...",
      type: "loading",
      duration: 0,
      description: promiseOptions.description,
    });
    const id = show(loadingOptions);

    const task =
      typeof input === "function"
        ? (input as () => Promise<T>)()
        : input;

    const tracked = task
      .then((value) => {
        const successState = resolvePromiseStateValue<T>(promiseOptions.success, value);
        const successOptions = resolvePromiseShowOptions(successState, {
          title: "Success",
          type: "success",
          duration: defaultDuration,
          description: promiseOptions.description,
        });
        updateInternal(id, successOptions);
        return value;
      })
      .catch((error: unknown) => {
        const errorState = resolvePromiseStateValue<unknown>(promiseOptions.error, error);
        const errorOptions = resolvePromiseShowOptions(errorState, {
          title: resolveErrorTitle(error),
          type: "error",
          duration: defaultDuration,
          description: promiseOptions.description,
        });
        updateInternal(id, errorOptions);
        throw error;
      });

    // Avoid unhandled rejection noise when caller doesn't consume unwrap().
    void tracked.catch(() => {});

    return {
      id,
      unwrap: () => tracked,
    };
  };

  const dismissAll = () => {
    for (const id of [...queueOrder]) {
      dismiss(id);
    }

    for (const id of [...activeOrder]) {
      dismiss(id);
    }
  };

  const createActionEvent = (): ToastActionEvent => {
    let defaultPrevented = false;
    return {
      get defaultPrevented() {
        return defaultPrevented;
      },
      preventDefault: () => {
        defaultPrevented = true;
      },
    };
  };

  const handleActionClick = (id: string) => {
    const entry = entries.get(id);
    if (!entry || entry.exiting) return;

    const value = entry.action?.value;
    const actionEvent = createActionEvent();
    (entry.action?.onClick as ((event: ToastActionEvent) => void) | undefined)?.(actionEvent);
    emit<ToastActionDetail>(root, "toast:action", { id, value });
    onAction?.(id, value);
    if (!actionEvent.defaultPrevented) {
      dismiss(id);
    }
  };

  const getItemIdFromEventTarget = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    const item = target.closest<HTMLElement>('[data-slot="toast-item"]');
    if (!item || !viewport.contains(item)) return null;
    const id = item.getAttribute("data-id");
    return id && id.trim() !== "" ? id : null;
  };

  const clearSwipeStyles = (entry: ToastEntry) => {
    entry.element.removeAttribute("data-swiping");
    entry.element.removeAttribute("data-swipe-out");
    entry.element.style.removeProperty("--toast-swipe-movement-y");
  };

  const beginSwipe = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target as Element | null;
    if (!target) return;

    if (target.closest('[data-slot="toast-action"]') || target.closest('[data-slot="toast-close"]')) {
      return;
    }

    const id = getItemIdFromEventTarget(target);
    if (!id) return;

    const entry = entries.get(id);
    if (!entry || entry.exiting || !entry.toast.dismissible) return;

    swipeState = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      currentY: event.clientY,
    };

    entry.element.setAttribute("data-swiping", "");
    entry.element.style.setProperty("--toast-swipe-movement-y", "0px");
    if ("setPointerCapture" in entry.element) {
      try {
        entry.element.setPointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported for this event target.
      }
    }
  };

  const updateSwipe = (event: PointerEvent) => {
    if (!swipeState || event.pointerId !== swipeState.pointerId) return;
    const entry = entries.get(swipeState.id);
    if (!entry || entry.exiting) {
      swipeState = null;
      return;
    }

    swipeState.currentY = event.clientY;
    const rawDeltaY = swipeState.currentY - swipeState.startY;
    const directedDelta = rawDeltaY * -stackDirection;
    const adjustedDeltaY = directedDelta < 0 ? rawDeltaY * 0.2 : rawDeltaY;
    entry.element.style.setProperty("--toast-swipe-movement-y", `${adjustedDeltaY}px`);
    entry.element.setAttribute("data-swiping", "");
  };

  const endSwipe = (event: PointerEvent | null, cancelled = false) => {
    if (!swipeState) return;
    if (event && event.pointerId !== swipeState.pointerId) return;

    const current = swipeState;
    swipeState = null;
    const entry = entries.get(current.id);
    if (!entry || entry.exiting) return;

    if (event && "releasePointerCapture" in entry.element) {
      try {
        entry.element.releasePointerCapture(current.pointerId);
      } catch {
        // Ignore if pointer capture was not active.
      }
    }

    const rawDeltaY = current.currentY - current.startY;
    const directedDelta = rawDeltaY * -stackDirection;
    const threshold = Math.max(DEFAULT_SWIPE_THRESHOLD, entry.element.offsetHeight * 0.45);
    const shouldDismiss = !cancelled && directedDelta >= threshold;

    clearSwipeStyles(entry);
    if (shouldDismiss) {
      entry.element.setAttribute("data-swipe-out", "");
      dismiss(entry.id);
    }
  };

  cleanups.push(
    on(viewport, "click", (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      const closeTrigger = target.closest('[data-slot="toast-close"]');
      if (closeTrigger) {
        const id = getItemIdFromEventTarget(closeTrigger);
        if (id) dismiss(id);
        return;
      }

      const actionTrigger = target.closest('[data-slot="toast-action"]');
      if (actionTrigger) {
        const id = getItemIdFromEventTarget(actionTrigger);
        if (id) handleActionClick(id);
      }
    }),
  );

  cleanups.push(
    on(viewport, "pointerdown", (e) => {
      beginSwipe(e as PointerEvent);
    }),
    on(doc, "pointermove", (e) => {
      updateSwipe(e as PointerEvent);
    }),
    on(doc, "pointerup", (e) => {
      endSwipe(e as PointerEvent);
    }),
    on(doc, "pointercancel", (e) => {
      endSwipe(e as PointerEvent, true);
    }),
  );

  cleanups.push(
    on(viewport, "pointerenter", () => {
      if (!pauseOnHover) return;
      pauseHover = true;
      syncPauseState();
    }),
    on(viewport, "pointerleave", () => {
      if (!pauseOnHover) return;
      pauseHover = false;
      syncPauseState();
    }),
  );

  cleanups.push(
    on(viewport, "focusin", () => {
      if (!pauseOnFocus) return;
      pauseFocus = true;
      syncPauseState();
    }),
    on(viewport, "focusout", (event) => {
      if (!pauseOnFocus) return;
      const nextTarget = (event as FocusEvent).relatedTarget;
      if (nextTarget instanceof Node && viewport.contains(nextTarget)) return;
      pauseFocus = false;
      syncPauseState();
    }),
  );

  cleanups.push(
    on(root, "toast:show", (e) => {
      const parsed = parseShowDetail((e as CustomEvent).detail);
      if (!parsed) return;
      show(parsed);
    }),
    on(root, "toast:update", (e) => {
      const parsed = parseUpdateDetail((e as CustomEvent).detail);
      if (!parsed) return;
      update(parsed.id, parsed.patch);
    }),
    on(root, "toast:dismiss", (e) => {
      const id = parseDismissDetail((e as CustomEvent).detail);
      if (!id) return;
      dismiss(id);
    }),
    on(root, "toast:clear", () => {
      dismissAll();
    }),
  );

  reindex();

  return {
    show,
    update,
    promise,
    dismiss,
    dismissAll,
    get count() {
      return activeOrder.length;
    },
    destroy: () => {
      destroyed = true;
      pauseHover = false;
      pauseFocus = false;
      timersPaused = false;
      viewport.removeAttribute("data-expanded");

      cleanups.forEach((cleanup) => cleanup());
      cleanups.length = 0;

      resizeObserver?.disconnect();

      for (const entry of entries.values()) {
        clearTimer(entry);
        entry.presence.cleanup();
        entry.element.remove();
      }
      entries.clear();
      activeOrder.length = 0;
      queued.clear();
      queueOrder.length = 0;

      portal.cleanup();
      bound.delete(root);
    },
  };
}

const bound = new WeakSet<Element>();

/**
 * Find and bind all toast roots in a scope.
 */
export function create(scope: ParentNode = document): ToastController[] {
  const controllers: ToastController[] = [];

  for (const root of getRoots(scope, "toast")) {
    if (bound.has(root)) continue;
    bound.add(root);
    controllers.push(createToast(root));
  }

  return controllers;
}
