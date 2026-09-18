import { createPresenceLifecycle, createTerminalLifecycle } from "@data-slot/core";
import type { ResolvedToast, ToastType, ToastUpdateOptions } from "./types";
import { resolveUpdatedToast } from "./toast-options";

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

const setItemA11y = (item: HTMLElement, type: ToastType) => {
  if (type === "error" || type === "warning") {
    item.setAttribute("role", "alert");
    item.setAttribute("aria-live", "assertive");
  } else {
    item.setAttribute("role", "status");
    item.setAttribute("aria-live", "polite");
  }
  item.setAttribute("aria-atomic", "true");
};

export interface ToastEntry {
  readonly id: string;
  readonly element: HTMLElement;
  readonly toast: ResolvedToast;
  readonly active: boolean;
  readonly exiting: boolean;
  mount(): void;
  update(patch: ToastUpdateOptions): void;
  setPaused(paused: boolean): void;
  dismiss(): void;
  destroy(): void;
}

interface ToastEntryOptions {
  viewport: HTMLElement;
  template: Element | null;
  stackDirection: number;
  expanded: boolean;
  paused: boolean;
  onTimeout(entry: ToastEntry): void;
  onExitComplete(entry: ToastEntry): void;
}

/** Owns one toast's content, countdown, presence, and terminal cleanup. */
export function createToastEntry(initial: ResolvedToast, options: ToastEntryOptions): ToastEntry {
  const { viewport, stackDirection } = options;
  const source = isTemplateElement(options.template) && ensureTemplateHasItem(options.template)
    ? options.template : createFallbackTemplate(viewport.ownerDocument);
  const fragment = source.content.cloneNode(true) as DocumentFragment;
  const item = fragment.querySelector<HTMLElement>('[data-slot="toast-item"]')!;
  const closeButtonLabelDefaults = new WeakMap<HTMLElement, string | null>();
  const lifecycle = createTerminalLifecycle();
  let toast = initial;
  let exiting = false;
  let paused = options.paused;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let remainingMs = toast.duration;
  let startedAt = 0;

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
      if (!closeButtonLabelDefaults.has(closeSlot)) {
        closeButtonLabelDefaults.set(closeSlot, closeSlot.getAttribute("aria-label"));
      }
      if (toast.closeButtonAriaLabel && toast.closeButtonAriaLabel.trim() !== "") {
        closeSlot.setAttribute("aria-label", toast.closeButtonAriaLabel);
      } else {
        const defaultCloseLabel = closeButtonLabelDefaults.get(closeSlot);
        if (defaultCloseLabel && defaultCloseLabel.trim() !== "") {
          closeSlot.setAttribute("aria-label", defaultCloseLabel);
        } else {
          closeSlot.setAttribute("aria-label", "Close");
        }
      }
      if (!closeSlot.getAttribute("aria-label")) {
        closeSlot.setAttribute("aria-label", "Close");
      }
    }

    setItemA11y(item, toast.type);
  };

  const clearTimer = () => {
    lifecycle.cancelTimeout(timer);
    timer = null;
  };
  const resumeTimer = () => {
    if (!entry.active || paused || toast.duration <= 0 || timer !== null) return;
    if (remainingMs <= 0) {
      options.onTimeout(entry);
      return;
    }
    startedAt = Date.now();
    timer = lifecycle.trackTimeout(() => {
      timer = null;
      options.onTimeout(entry);
    }, remainingMs);
  };
  const presence = createPresenceLifecycle({
    element: item,
    win: viewport.ownerDocument.defaultView ?? window,
    onExitComplete: () => {
      if (!lifecycle.isDestroyed) options.onExitComplete(entry);
    },
  });
  lifecycle.onDestroy(() => {
    presence.cleanup();
    item.remove();
  });

  const entry: ToastEntry = {
    get id() { return toast.id; },
    element: item,
    get toast() { return toast; },
    get active() { return !exiting && !lifecycle.isDestroyed; },
    get exiting() { return exiting; },
    mount() {
      viewport.appendChild(fragment);
      lifecycle.trackRaf(() => {
        lifecycle.trackRaf(() => {
          if (entry.active) item.setAttribute("data-mounted", "true");
        });
      });
      resumeTimer();
    },
    update(patch) {
      if (!entry.active) return;
      const { next, durationChanged } = resolveUpdatedToast(toast, patch);
      toast = next;
      applyToastContentToItem(item, toast);
      if (durationChanged) {
        clearTimer();
        remainingMs = toast.duration;
        resumeTimer();
      }
    },
    setPaused(nextPaused) {
      if (paused === nextPaused || !entry.active) return;
      paused = nextPaused;
      if (paused) {
        if (timer !== null) remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt));
        clearTimer();
      } else {
        resumeTimer();
      }
    },
    dismiss() {
      if (!entry.active) return;
      exiting = true;
      clearTimer();
      item.setAttribute("data-removed", "true");
      item.style.zIndex = "0";
      item.style.pointerEvents = "none";
      setOpenState(item, "closed");
      presence.exit();
    },
    destroy() { lifecycle.destroy(); },
  };

  item.setAttribute("data-id", toast.id);
  applyToastContentToItem(item, toast);
  for (const name of ["mounted", "removed", "front", "visible", "swiping", "swipe-out"]) {
    item.setAttribute(`data-${name}`, "false");
  }
  item.setAttribute("data-expanded", String(options.expanded));
  for (const name of ["enter-direction", "exit-direction", "lift"]) {
    item.style.setProperty(`--toast-${name}`, String(stackDirection));
  }
  for (const name of ["movement-x", "movement-y", "end-x", "end-y"]) {
    item.style.setProperty(`--toast-swipe-${name}`, "0px");
  }
  setOpenState(item, "open");
  return entry;
}
