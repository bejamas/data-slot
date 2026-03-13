import {
  getPart,
  getRoots,
  getDataBool,
  reuseRootBinding,
  hasRootBinding,
  setRootBinding,
  clearRootBinding,
} from "@data-slot/core";
import { setAria, ensureId, linkLabelledBy } from "@data-slot/core";
import { on, emit } from "@data-slot/core";
import { lockScroll, unlockScroll } from "@data-slot/core";
import {
  createPortalLifecycle,
  createModalStackItem,
  createDismissLayer,
  createPresenceLifecycle,
  focusElement,
} from "@data-slot/core";

export interface AlertDialogOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Close when clicking overlay */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape */
  closeOnEscape?: boolean;
  /** Lock body scroll when open */
  lockScroll?: boolean;
}

export interface AlertDialogController {
  /** Open the alert dialog */
  open(): void;
  /** Close the alert dialog */
  close(): void;
  /** Toggle the alert dialog */
  toggle(): void;
  /** Current open state */
  readonly isOpen: boolean;
  /** Cleanup all event listeners */
  destroy(): void;
}

const ROOT_BINDING_KEY = "@data-slot/alert-dialog";
const DUPLICATE_BINDING_WARNING =
  "[@data-slot/alert-dialog] createAlertDialog() called more than once for the same root. Returning the existing controller. Destroy it before rebinding with new options.";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function createAlertDialog(
  root: Element,
  options: AlertDialogOptions = {}
): AlertDialogController {
  const existingController = reuseRootBinding<AlertDialogController>(
    root,
    ROOT_BINDING_KEY,
    DUPLICATE_BINDING_WARNING
  );
  if (existingController) return existingController;

  const defaultOpen = options.defaultOpen ?? getDataBool(root, "defaultOpen") ?? false;
  const onOpenChange = options.onOpenChange;
  const closeOnClickOutside =
    options.closeOnClickOutside ?? getDataBool(root, "closeOnClickOutside") ?? false;
  const closeOnEscape = options.closeOnEscape ?? getDataBool(root, "closeOnEscape") ?? true;
  const lockScrollOption = options.lockScroll ?? getDataBool(root, "lockScroll") ?? true;

  const trigger = getPart<HTMLElement>(root, "alert-dialog-trigger");
  const portal = getPart<HTMLElement>(root, "alert-dialog-portal");
  const overlay = getPart<HTMLElement>(root, "alert-dialog-overlay");
  const content = getPart<HTMLElement>(root, "alert-dialog-content");
  const title = getPart<HTMLElement>(root, "alert-dialog-title");
  const description = getPart<HTMLElement>(root, "alert-dialog-description");

  if (!content) {
    throw new Error("Alert dialog requires alert-dialog-content slot");
  }
  if (!overlay) {
    throw new Error("Alert dialog requires alert-dialog-overlay slot");
  }

  let isOpen = false;
  let isDestroyed = false;
  let previousActiveElement: HTMLElement | null = null;
  const cleanups: Array<() => void> = [];

  const portalLifecycle = portal
    ? createPortalLifecycle({ content: portal, root })
    : null;

  let didLockScroll = false;

  ensureId(content, "alert-dialog-content");
  content.setAttribute("role", "alertdialog");
  setAria(content, "modal", true);
  linkLabelledBy(content, title, description);

  overlay.setAttribute("role", "presentation");
  overlay.setAttribute("aria-hidden", "true");
  overlay.tabIndex = -1;

  if (trigger) {
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", content.id);
    setAria(trigger, "expanded", false);
  }

  let addedTabIndex = false;

  const ensureContentFocusable = () => {
    if (!content.hasAttribute("tabindex")) {
      content.tabIndex = -1;
      addedTabIndex = true;
    }
  };

  const cleanupContentFocusable = () => {
    if (addedTabIndex) {
      content.removeAttribute("tabindex");
      addedTabIndex = false;
    }
  };

  const focusFirst = () => {
    const autofocusEl = content.querySelector<HTMLElement>("[autofocus]");
    if (autofocusEl) return autofocusEl.focus();

    const first = content.querySelector<HTMLElement>(FOCUSABLE);
    if (first) return first.focus();

    ensureContentFocusable();
    content.focus();
  };

  const restoreFocus = () => {
    requestAnimationFrame(() => {
      if (
        previousActiveElement &&
        document.contains(previousActiveElement) &&
        typeof previousActiveElement.focus === "function"
      ) {
        focusElement(previousActiveElement);
      } else if (trigger && document.contains(trigger)) {
        focusElement(trigger);
      }
      previousActiveElement = null;
    });
  };

  const setDataState = (state: "open" | "closed") => {
    root.setAttribute("data-state", state);
    portal?.setAttribute("data-state", state);
    overlay.setAttribute("data-state", state);
    content.setAttribute("data-state", state);

    if (state === "open") {
      root.setAttribute("data-open", "");
      portal?.setAttribute("data-open", "");
      overlay.setAttribute("data-open", "");
      content.setAttribute("data-open", "");
      root.removeAttribute("data-closed");
      portal?.removeAttribute("data-closed");
      overlay.removeAttribute("data-closed");
      content.removeAttribute("data-closed");
      return;
    }

    root.setAttribute("data-closed", "");
    portal?.setAttribute("data-closed", "");
    overlay.setAttribute("data-closed", "");
    content.setAttribute("data-closed", "");
    root.removeAttribute("data-open");
    portal?.removeAttribute("data-open");
    overlay.removeAttribute("data-open");
    content.removeAttribute("data-open");
  };

  let currentExitEpoch = 0;
  let pendingExitCount = 0;
  let overlayExitEpoch = 0;
  let contentExitEpoch = 0;

  const finishClosePart = (element: HTMLElement, epoch: number) => {
    if (isDestroyed || isOpen || epoch !== currentExitEpoch) return;

    element.hidden = true;
    pendingExitCount = Math.max(0, pendingExitCount - 1);

    if (pendingExitCount === 0) {
      cleanupContentFocusable();
      restoreFocus();
    }
  };

  const overlayPresence = createPresenceLifecycle({
    element: overlay,
    onExitComplete: () => finishClosePart(overlay, overlayExitEpoch),
  });

  const contentPresence = createPresenceLifecycle({
    element: content,
    onExitComplete: () => finishClosePart(content, contentExitEpoch),
  });

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const focusables = content.querySelectorAll<HTMLElement>(FOCUSABLE);

    if (focusables.length === 0) {
      e.preventDefault();
      ensureContentFocusable();
      content.focus();
      return;
    }

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;

    if (!content.contains(active)) {
      e.preventDefault();
      first.focus();
      return;
    }

    if (first === last) {
      e.preventDefault();
      return;
    }

    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const modalStack = createModalStackItem({
    content,
    overlay,
    onTabKeydown: handleKeydown,
    cssVarPrefix: "alert-dialog",
  });

  const updateState = (open: boolean, force = false) => {
    if (isOpen === open && !force) return;

    if (open) {
      currentExitEpoch += 1;
      pendingExitCount = 0;

      portalLifecycle?.mount();
      previousActiveElement = document.activeElement as HTMLElement;
      modalStack.open();

      if (lockScrollOption && !didLockScroll) {
        lockScroll();
        didLockScroll = true;
      }
    } else {
      currentExitEpoch += 1;
      pendingExitCount = 2;
      overlayExitEpoch = currentExitEpoch;
      contentExitEpoch = currentExitEpoch;
      modalStack.close();

      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }
    }

    isOpen = open;
    if (trigger) {
      setAria(trigger, "expanded", isOpen);
    }

    if (open) {
      overlay.hidden = false;
      content.hidden = false;
      setDataState("open");
      overlayPresence.enter();
      contentPresence.enter();
    } else {
      setDataState("closed");
      overlayPresence.exit();
      contentPresence.exit();
    }

    emit(root, "alert-dialog:change", { open: isOpen });
    onOpenChange?.(isOpen);

    if (open) {
      requestAnimationFrame(focusFirst);
    }
  };

  content.hidden = true;
  overlay.hidden = true;
  setDataState("closed");

  if (trigger) {
    cleanups.push(on(trigger, "click", () => updateState(!isOpen)));
  }

  cleanups.push(
    on(content, "click", (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      const cancelEl = target.closest?.('[data-slot="alert-dialog-cancel"]');
      if (cancelEl && content.contains(cancelEl)) {
        updateState(false);
      }
    })
  );

  if (closeOnClickOutside) {
    cleanups.push(
      on(overlay, "click", (e) => {
        if ((e as MouseEvent).button !== 0) return;
        if (e.target === overlay && isOpen) {
          updateState(false);
        }
      })
    );
  }

  cleanups.push(
    createDismissLayer({
      root,
      isOpen: () => isOpen,
      onDismiss: () => updateState(false),
      closeOnClickOutside: false,
      closeOnEscape,
    })
  );

  const controller: AlertDialogController = {
    open: () => updateState(true),
    close: () => updateState(false),
    toggle: () => updateState(!isOpen),
    get isOpen() {
      return isOpen;
    },
    destroy: () => {
      isDestroyed = true;
      modalStack.destroy();
      currentExitEpoch += 1;
      pendingExitCount = 0;
      overlayPresence.cleanup();
      contentPresence.cleanup();
      isOpen = false;
      setDataState("closed");
      overlay.hidden = true;
      content.hidden = true;
      if (trigger) {
        setAria(trigger, "expanded", false);
      }
      if (didLockScroll) {
        unlockScroll();
        didLockScroll = false;
      }
      cleanupContentFocusable();
      if (previousActiveElement !== null) {
        restoreFocus();
      }
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;

      portalLifecycle?.cleanup();
      clearRootBinding(root, ROOT_BINDING_KEY, controller);
    },
  };

  cleanups.push(
    on(root, "alert-dialog:set", (e) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.open === "boolean") {
        updateState(detail.open);
      }
    })
  );

  setRootBinding(root, ROOT_BINDING_KEY, controller);

  if (defaultOpen) updateState(true);

  return controller;
}

export function create(scope: ParentNode = document): AlertDialogController[] {
  const controllers: AlertDialogController[] = [];

  for (const root of getRoots(scope, "alert-dialog")) {
    if (hasRootBinding(root, ROOT_BINDING_KEY)) continue;
    controllers.push(createAlertDialog(root));
  }

  return controllers;
}
