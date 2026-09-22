export {
  getPart,
  getParts,
  getOwnedElements,
  getRoots,
  getRootBinding,
  hasRootBinding,
  reuseRootBinding,
  setRootBinding,
  clearRootBinding,
  warnRootBindingOnce,
  getDataBool,
  getDataNumber,
  getDataString,
  getDataEnum,
  containsWithPortals,
  portalToBody,
  restorePortal,
} from "./parts.ts";
export type { PortalState } from "./parts.ts";
export { ensureId, setAria, linkLabelledBy } from "./aria.ts";
export { on, onRoot, emit, composeHandlers } from "./events.ts";
export { createFormFieldAdapter, observeFormReset } from "./form-field.ts";
export type { FormFieldAdapter, FormResetObserver } from "./form-field.ts";
export { lockScroll, unlockScroll } from "./scroll.ts";
export { getAutofocusOrFirstFocusable, getFocusable, getTabbables, isFocusable } from "./focus.ts";
export {
  computeFloatingPosition,
  computeFloatingTransformOrigin,
  getFloatingTransformOriginAnchor,
  measurePopupContentRect,
  ensureItemVisibleInContainer,
  focusElement,
  createModalStackItem,
  createDismissLayer,
  createPortalLifecycle,
  createTerminalLifecycle,
  drainCleanups,
  registerFloatingTerminalResources,
  registerModalTerminalResources,
  createPresenceLifecycle,
  createPositionSync,
} from "./popup.ts";
export type {
  PopupDirection,
  PopupSide,
  PopupAlign,
  PopupPlacementOptions,
  ComputeFloatingPositionInput,
  ComputeFloatingTransformOriginInput,
  FloatingPosition,
  FloatingTransformOriginAnchor,
  PositionSyncOptions,
  PositionSyncController,
  ModalStackItemOptions,
  ModalStackItemController,
  DismissLayerOptions,
  DismissLayerDetails,
  PortalLifecycleOptions,
  PortalLifecycleController,
  TerminalLifecycleController,
  FloatingTerminalResources,
  ModalTerminalResources,
  PresenceLifecycleOptions,
  PresenceLifecycleController,
} from "./popup.ts";
export { createSwipeGesture } from "./swipe.ts";
export type { SwipeAxis, SwipeMove, SwipeRelease, SwipeGestureOptions, SwipeGestureController } from "./swipe.ts";
export { createTypeahead } from "./typeahead.ts";
export type { TypeaheadOptions, TypeaheadController } from "./typeahead.ts";

export { createContentMount } from "./content-mount.ts";
export type { MountStrategy, ContentMountOptions } from "./content-mount.ts";
