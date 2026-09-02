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
export { getAutofocusOrFirstFocusable, getFocusable, getTabbables } from "./focus.ts";
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
  PortalLifecycleOptions,
  PortalLifecycleController,
  TerminalLifecycleController,
  FloatingTerminalResources,
  PresenceLifecycleOptions,
  PresenceLifecycleController,
} from "./popup.ts";
export { createTypeahead } from "./typeahead.ts";
export type { TypeaheadOptions, TypeaheadController } from "./typeahead.ts";
