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

export type ToastPosition = (typeof POSITIONS)[number];
type ToastType = (typeof TOAST_TYPES)[number];

export interface ToastAction {
  label: string;
  onClick?: () => void;
  value?: string;
}

export interface ToastShowOptions {
  id?: string;
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
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

  const actionRecord =
    record["action"] && typeof record["action"] === "object"
      ? (record["action"] as Record<string, unknown>)
      : null;

  const action =
    actionRecord && typeof actionRecord["label"] === "string" && actionRecord["label"].trim() !== ""
      ? {
          label: actionRecord["label"],
          onClick:
            typeof actionRecord["onClick"] === "function"
              ? (actionRecord["onClick"] as () => void)
              : undefined,
          value: typeof actionRecord["value"] === "string" ? actionRecord["value"] : undefined,
        }
      : undefined;

  return {
    id: typeof record["id"] === "string" ? record["id"] : undefined,
    title: record["title"],
    description: typeof record["description"] === "string" ? record["description"] : undefined,
    type: isToastType(record["type"]) ? record["type"] : undefined,
    duration: isFiniteNumber(record["duration"]) ? record["duration"] : undefined,
    action,
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

    const titleSlot = item.querySelector<HTMLElement>('[data-slot="toast-title"]');
    const descriptionSlot = item.querySelector<HTMLElement>('[data-slot="toast-description"]');
    const actionSlot = item.querySelector<HTMLElement>('[data-slot="toast-action"]');

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

    item.setAttribute("data-id", toast.id);
    item.setAttribute("data-type", toast.type);
    item.style.setProperty(
      "--toast-enter-direction",
      String(placement === "newest" ? stackDirection : -stackDirection),
    );
    item.style.setProperty("--toast-exit-direction", String(stackDirection));
    setItemA11y(item, toast.type);
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
    };

    if (activeOrder.length >= resolvedLimit) {
      demoteOldestVisibleToQueue();
    }

    mountToast(toast);
    return id;
  };

  const dismissAll = () => {
    for (const id of [...queueOrder]) {
      dismiss(id);
    }

    for (const id of [...activeOrder]) {
      dismiss(id);
    }
  };

  const handleActionClick = (id: string) => {
    const entry = entries.get(id);
    if (!entry || entry.exiting) return;

    const value = entry.action?.value;
    entry.action?.onClick?.();
    emit<ToastActionDetail>(root, "toast:action", { id, value });
    onAction?.(id, value);
    dismiss(id);
  };

  const getItemIdFromEventTarget = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    const item = target.closest<HTMLElement>('[data-slot="toast-item"]');
    if (!item || !viewport.contains(item)) return null;
    const id = item.getAttribute("data-id");
    return id && id.trim() !== "" ? id : null;
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
