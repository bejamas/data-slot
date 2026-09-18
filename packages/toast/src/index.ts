import {
  getPart, getRoots, getDataBool, getDataEnum, getDataNumber,
  createPortalLifecycle, createTerminalLifecycle, focusElement, on, emit,
  reuseRootBinding, hasRootBinding, setRootBinding, clearRootBinding,
} from "@data-slot/core";
import { POSITIONS } from "./types";
import type {
  ToastController, ToastOptions, ToastShowOptions, ToastUpdateOptions,
  ToastActionEvent, ToastPromiseOptions, ToastPromiseHandle,
} from "./types";
import {
  normalizeLimit, normalizeDuration, isNonEmptyString, createDefaultToast, applyToastPatch,
  parseShowDetail, parseUpdateDetail, parseDismissDetail,
  resolvePromiseStateObject, resolvePromiseStateValue, resolvePromisePatch, resolveErrorTitle,
} from "./toast-options";
import { createToastEntry, type ToastEntry } from "./toast-entry";
import { createToastLayout, getToastFocusableNodes } from "./toast-layout";
import { createToastGestures } from "./toast-gestures";
import { createToastInteraction } from "./toast-interaction";

export type {
  ToastAction, ToastActionEvent, ToastClearableField, ToastController, ToastOptions, ToastPosition,
  ToastPromiseErrorValue, ToastPromiseHandle, ToastPromiseOptions, ToastPromiseState,
  ToastPromiseStateValue, ToastShowOptions, ToastUpdateOptions,
} from "./types";

interface ToastChangeDetail {
  id: string;
  action: "show" | "dismiss";
}

interface ToastActionDetail {
  id: string;
  value: string | undefined;
}

const ROOT_BINDING_KEY = "@data-slot/toast";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/toast] createToast() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

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
  const existingController = reuseRootBinding<ToastController>(
    root, ROOT_BINDING_KEY, DUPLICATE_BINDING_WARNING,
  );
  if (existingController) return existingController;

  const viewport = getPart<HTMLElement>(root, "toast-viewport");
  if (!viewport) {
    throw new Error("Toast requires a toast-viewport slot");
  }
  const doc = root.ownerDocument ?? document;

  const template = getPart(root, "toast-template");

  const resolvedLimit = normalizeLimit(options.limit ?? getDataNumber(root, "limit"));
  const defaultDuration = normalizeDuration(
    options.duration ?? getDataNumber(root, "duration"),
    5000,
  );
  const position =
    options.position ??
    getDataEnum(root, "position", POSITIONS) ??
    "bottom-right";
  const pauseOnHover = options.pauseOnHover ?? getDataBool(root, "pauseOnHover") ?? true;
  const pauseOnFocus = options.pauseOnFocus ?? getDataBool(root, "pauseOnFocus") ?? true;
  const portalOption = options.portal ?? getDataBool(root, "portal") ?? false;
  const onShow = options.onShow;
  const onDismiss = options.onDismiss;
  const onAction = options.onAction;

  const stackDirection = position.startsWith("top") ? 1 : -1;

  root.setAttribute("data-position", position);
  viewport.setAttribute("data-position", position);
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

  // Map insertion order is the stack order; exiting entries remain until disposal.
  const entries = new Map<string, ToastEntry>();
  const lifecycle = createTerminalLifecycle();
  const cleanups: Array<() => void> = [];
  let idCounter = 0;
  let previousFocusedElement: HTMLElement | null = null;

  const activeEntries = () => [...entries.values()].filter((entry) => entry.active);
  const isCurrentEntry = (entry: ToastEntry) => entries.get(entry.id) === entry;
  const hasExitingEntries = () => [...entries.values()].some((entry) => entry.exiting);

  const layout = createToastLayout({
    viewport,
    limit: resolvedLimit,
    stackDirection,
    getItems: () => activeEntries().reverse().map((entry) => entry.element),
    // Layout changes can move focus; re-derive the focus reason and settle any deferred collapse.
    onLayout: () => interaction.set("focus", pauseOnFocus && hasVisibleFocusWithinViewport()),
  });
  const interaction = createToastInteraction({
    hasExitingEntries,
    setExpanded: (expanded) => layout.setExpanded(expanded),
    setPaused: (paused) => {
      for (const entry of activeEntries()) entry.setPaused(paused);
    },
  });
  if (doc.visibilityState === "hidden") interaction.set("document", true);

  const isVisibleFocusTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Node) || !viewport.contains(target)) return false;
    if (!(target instanceof Element)) return true;

    const item = target.closest<HTMLElement>('[data-slot="toast-item"]');
    if (!item || !viewport.contains(item)) return true;

    return item.getAttribute("data-visible") === "true" && item.getAttribute("data-state") === "open";
  };

  const hasVisibleFocusWithinViewport = () =>
    isVisibleFocusTarget(doc.activeElement);

  const focusNextVisibleToast = () => {
    for (const entry of activeEntries().reverse()) {
      if (entry.element.getAttribute("data-visible") !== "true") continue;

      const target = getToastFocusableNodes(entry.element)[0];
      if (target) {
        focusElement(target);
        return true;
      }
    }

    return false;
  };

  const restorePreviousFocus = () => {
    if (previousFocusedElement && previousFocusedElement.isConnected) {
      focusElement(previousFocusedElement);
      return true;
    }
    return false;
  };

  const handleDismissFocus = (dismissedElement?: HTMLElement) => {
    const active = doc.activeElement;
    if (!(active instanceof HTMLElement) || !viewport.contains(active)) return;
    if (dismissedElement && !dismissedElement.contains(active)) return;
    if (focusNextVisibleToast()) return;
    if (restorePreviousFocus()) return;
    active.blur();
  };

  const notifyDismiss = (id: string) => {
    emit<ToastChangeDetail>(root, "toast:change", { id, action: "dismiss" });
    onDismiss?.(id);
  };

  const removeEntry = (entry: ToastEntry) => {
    if (!isCurrentEntry(entry)) return;
    gestures.cancel(entry);
    layout.unobserve(entry.element);
    entry.destroy();
    entries.delete(entry.id);
    layout.update();
  };

  const dismissEntry = (entry: ToastEntry, manageFocus = true) => {
    if (!isCurrentEntry(entry) || !entry.active) return;
    gestures.cancel(entry);
    entry.dismiss();
    layout.update();
    if (manageFocus) handleDismissFocus(entry.element);
    notifyDismiss(entry.id);
  };

  const dismiss = (id: string) => {
    const entry = entries.get(id);
    if (entry) dismissEntry(entry);
  };

  const createId = () => {
    let candidate = "";
    do {
      idCounter += 1;
      candidate = `toast-${idCounter}`;
    } while (entries.has(candidate));
    return candidate;
  };

  const showEntry = (requestedId: string | undefined, patch: ToastUpdateOptions): ToastEntry => {
    const id = isNonEmptyString(requestedId) ? requestedId : createId();
    // Validates the title before any side effect below.
    const toast = applyToastPatch(createDefaultToast(id, defaultDuration), patch);
    const previous = entries.get(id);
    const notifyReplacement = previous?.active;
    if (previous) removeEntry(previous);
    if (notifyReplacement) notifyDismiss(id);

    const entry = createToastEntry(toast, {
      viewport, template,
      expanded: interaction.expanded,
      paused: interaction.paused,
      onTimeout: dismissEntry,
      onExitComplete: removeEntry,
    });
    if (lifecycle.isDestroyed) {
      entry.destroy();
      return entry;
    }
    // A dismissal callback may have reused the same ID while replacement was pending.
    const reentrantEntry = entries.get(id);
    if (reentrantEntry) removeEntry(reentrantEntry);
    entries.set(id, entry);
    entry.mount();
    layout.observe(entry.element);
    layout.update();

    if (isCurrentEntry(entry) && entry.active) {
      emit<ToastChangeDetail>(root, "toast:change", { id, action: "show" });
      onShow?.(id);
    }
    return entry;
  };

  const show = (options: ToastShowOptions): string => {
    if (lifecycle.isDestroyed) return options.id ?? createId();
    return showEntry(options.id, options).id;
  };

  const updateEntry = (entry: ToastEntry, patch: ToastUpdateOptions) => {
    if (!isCurrentEntry(entry) || !entry.active) return;
    entry.update(patch);
    if (!entry.toast.dismissible) gestures.cancel(entry);
    layout.update();
  };

  const update = (id: string, patch: ToastUpdateOptions) => {
    const entry = entries.get(id);
    if (entry) updateEntry(entry, patch);
  };

  const promise = <T,>(
    input: Promise<T> | (() => Promise<T>),
    promiseOptions: ToastPromiseOptions<T>,
  ): ToastPromiseHandle<T> => {
    const loadingState = resolvePromiseStateObject(promiseOptions.loading);
    const loadingPatch = resolvePromisePatch(loadingState, {
      title: "Loading...",
      type: "loading",
      duration: 0,
      description: promiseOptions.description,
    });
    const entry = lifecycle.isDestroyed ? undefined : showEntry(undefined, loadingPatch);
    const id = entry?.id ?? createId();

    const task: Promise<T> = Promise.resolve().then(() =>
      typeof input === "function"
        ? input()
        : input,
    );

    const tracked = task
      .then((value) => {
        const successState = resolvePromiseStateValue<T>(promiseOptions.success, value);
        const successPatch = resolvePromisePatch(successState, {
          title: "Success",
          type: "success",
          duration: defaultDuration,
          description: promiseOptions.description,
        });
        if (entry) updateEntry(entry, successPatch);
        return value;
      })
      .catch((error: unknown) => {
        const errorState = resolvePromiseStateValue<unknown>(promiseOptions.error, error);
        const errorPatch = resolvePromisePatch(errorState, {
          title: resolveErrorTitle(error),
          type: "error",
          duration: defaultDuration,
          description: promiseOptions.description,
        });
        if (entry) updateEntry(entry, errorPatch);
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
    const shouldManageFocus =
      doc.activeElement instanceof HTMLElement && viewport.contains(doc.activeElement);
    for (const entry of activeEntries()) {
      dismissEntry(entry, false);
    }
    if (shouldManageFocus) {
      handleDismissFocus();
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

    const value = entry.toast.action?.value;
    const actionEvent = createActionEvent();
    entry.toast.action?.onClick?.(actionEvent);
    emit<ToastActionDetail>(root, "toast:action", { id, value });
    onAction?.(id, value);
    if (!actionEvent.defaultPrevented) {
      dismissEntry(entry);
    }
  };

  const getEntryFromEventTarget = (target: EventTarget | null): ToastEntry | undefined => {
    if (!(target instanceof Element)) return undefined;
    const item = target.closest<HTMLElement>('[data-slot="toast-item"]');
    if (!item || !viewport.contains(item)) return undefined;
    const entry = entries.get(item.getAttribute("data-id") ?? "");
    return entry?.element === item ? entry : undefined;
  };

  const gestures = createToastGestures({
    viewport,
    position,
    getEntry: getEntryFromEventTarget,
    dismiss: (entry) => dismissEntry(entry),
  });

  cleanups.push(
    on(viewport, "click", (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      const closeTrigger = target.closest('[data-slot="toast-close"]');
      if (closeTrigger) {
        const entry = getEntryFromEventTarget(closeTrigger);
        if (entry) dismissEntry(entry);
        return;
      }

      const actionTrigger = target.closest('[data-slot="toast-action"]');
      if (actionTrigger) {
        const entry = getEntryFromEventTarget(actionTrigger);
        if (entry) handleActionClick(entry.id);
      }
    }),
  );

  // Focus only counts while it sits on a visible, open toast.
  const hasVisibleFocus = (candidate: EventTarget | null) =>
    isVisibleFocusTarget(candidate) || hasVisibleFocusWithinViewport();

  cleanups.push(
    on(viewport, "pointerenter", () => {
      if (pauseOnHover) interaction.set("hover", true);
    }),
    on(viewport, "pointerleave", () => {
      if (pauseOnHover) interaction.set("hover", false);
    }),
    on(viewport, "focusin", (event) => {
      if (!pauseOnFocus) return;
      const { relatedTarget, target } = event as FocusEvent;
      if (relatedTarget instanceof HTMLElement && !viewport.contains(relatedTarget)) {
        previousFocusedElement = relatedTarget;
      }
      interaction.set("focus", hasVisibleFocus(target));
    }),
    on(viewport, "focusout", (event) => {
      if (!pauseOnFocus) return;
      interaction.set("focus", hasVisibleFocus((event as FocusEvent).relatedTarget));
    }),
  );

  const win = doc.defaultView ?? window;

  cleanups.push(
    on(win, "blur", () => interaction.set("window", true)),
    on(win, "focus", () => interaction.set("window", false)),
    on(doc, "visibilitychange", () => interaction.set("document", doc.visibilityState === "hidden")),
  );

  cleanups.push(
    on(root, "toast:show", (e) => {
      const parsed = parseShowDetail((e as CustomEvent).detail);
      if (!parsed || lifecycle.isDestroyed) return;
      showEntry(parsed.id, parsed.patch);
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

  lifecycle.onDestroy(() => {
    cleanups.forEach((cleanup) => cleanup());
    gestures.destroy();
    layout.destroy();
    for (const entry of entries.values()) entry.destroy();
    entries.clear();
    previousFocusedElement = null;
    portal.cleanup();
    clearRootBinding(root, ROOT_BINDING_KEY, controller);
  });

  layout.update();
  const controller: ToastController = {
    show, update, promise, dismiss, dismissAll,
    get count() { return activeEntries().length; },
    destroy: () => { lifecycle.destroy(); },
  };
  setRootBinding(root, ROOT_BINDING_KEY, controller);
  return controller;
}

/**
 * Find and bind all toast roots in a scope.
 */
export function create(scope: ParentNode = document): ToastController[] {
  const controllers: ToastController[] = [];

  for (const root of getRoots(scope, "toast")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createToast(root));
  }

  return controllers;
}
