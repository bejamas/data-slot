export { getPart, getParts, getRoots, getDataBool, getDataNumber, getDataString, getDataEnum, containsWithPortals, portalToBody, restorePortal } from "./parts.ts";
export type { PortalState } from "./parts.ts";
export { ensureId, setAria, linkLabelledBy } from "./aria.ts";
export { on, emit, composeHandlers } from "./events.ts";
export { lockScroll, unlockScroll } from "./scroll.ts";
export {
  computeFloatingPosition,
  ensureItemVisibleInContainer,
  createDismissLayer,
  createPortalLifecycle,
  createPositionSync,
} from "./popup.ts";
export type {
  PopupSide,
  PopupAlign,
  PopupPlacementOptions,
  ComputeFloatingPositionInput,
  FloatingPosition,
  PositionSyncOptions,
  PositionSyncController,
  DismissLayerOptions,
  PortalLifecycleOptions,
  PortalLifecycleController,
} from "./popup.ts";
