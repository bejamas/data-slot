export {
  getPart,
  getParts,
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
export { on, emit, composeHandlers } from "./events.ts";
export { lockScroll, unlockScroll } from "./scroll.ts";
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
  createPresenceLifecycle,
  createPositionSync,
} from "./popup.ts";
export type {
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
  PresenceLifecycleOptions,
  PresenceLifecycleController,
} from "./popup.ts";
