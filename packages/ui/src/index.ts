// Named component exports remain separate ESM imports so bundlers can remove
// every unused component. Subpaths expose each package's complete API.

export * from "@data-slot/core";

export { createCollapsible } from "@data-slot/collapsible";
export type {
  CollapsibleOptions,
  CollapsibleController,
} from "@data-slot/collapsible";

export { createTabs } from "@data-slot/tabs";
export type { TabsOptions, TabsController } from "@data-slot/tabs";

export { createAccordion } from "@data-slot/accordion";
export type {
  AccordionOptions,
  AccordionController,
} from "@data-slot/accordion";

export { createPopover } from "@data-slot/popover";
export type {
  PopoverOptions,
  PopoverController,
  PopoverSide,
  PopoverAlign,
  PopoverPosition,
} from "@data-slot/popover";

export { createHoverCard } from "@data-slot/hover-card";
export type {
  HoverCardOptions,
  HoverCardController,
  HoverCardSide,
  HoverCardAlign,
  HoverCardReason,
} from "@data-slot/hover-card";

export { createTooltip } from "@data-slot/tooltip";
export type {
  TooltipOptions,
  TooltipController,
  TooltipSide,
  TooltipAlign,
  TooltipReason,
} from "@data-slot/tooltip";

export { createDialog } from "@data-slot/dialog";
export type { DialogOptions, DialogController } from "@data-slot/dialog";

export { createDrawer } from "@data-slot/drawer";
export type {
  DrawerOptions,
  DrawerController,
  DrawerSnapPoint,
  DrawerSwipeDirection,
  DrawerChangeReason,
  DrawerChangeDetails,
  DrawerSnapChangeDetails,
} from "@data-slot/drawer";

export { createAlertDialog } from "@data-slot/alert-dialog";
export type {
  AlertDialogOptions,
  AlertDialogController,
} from "@data-slot/alert-dialog";

export { createNavigationMenu } from "@data-slot/navigation-menu";
export type {
  NavigationMenuOptions,
  NavigationMenuController,
  PositionMethod,
  Align as NavigationMenuAlign,
} from "@data-slot/navigation-menu";

export { createDropdownMenu } from "@data-slot/dropdown-menu";
export type {
  DropdownMenuOptions,
  DropdownMenuController,
  DropdownMenuHighlightChangeDetail,
  DropdownMenuItemType,
  DropdownMenuOpenChangeDetail,
  DropdownMenuOpenChangeReason,
  DropdownMenuOpenChangeSource,
  DropdownMenuSelectDetail,
  DropdownMenuSelectionSource,
  DropdownMenuSetDetail,
  DropdownMenuSetSource,
  DropdownMenuUserSource,
  DropdownMenuValueChangeDetail,
  DropdownMenuValuesChangeDetail,
} from "@data-slot/dropdown-menu";

export { createSwitch } from "@data-slot/switch";
export type { SwitchOptions, SwitchController } from "@data-slot/switch";

export { createToggle } from "@data-slot/toggle";
export type { ToggleOptions, ToggleController } from "@data-slot/toggle";

export { createToggleGroup } from "@data-slot/toggle-group";
export type { ToggleGroupOptions, ToggleGroupController } from "@data-slot/toggle-group";

export { createRadioGroup } from "@data-slot/radio-group";
export type {
  RadioGroupOptions,
  RadioGroupController,
} from "@data-slot/radio-group";

export { createSelect } from "@data-slot/select";
export type {
  SelectOptions,
  SelectController,
  Position as SelectPosition,
  Side as SelectSide,
  Align as SelectAlign,
} from "@data-slot/select";

export { createCombobox } from "@data-slot/combobox";
export type {
  ComboboxOptions,
  ComboboxController,
  ComboboxItemToStringValue,
  Side as ComboboxSide,
  Align as ComboboxAlign,
} from "@data-slot/combobox";

export { createCommand } from "@data-slot/command";
export type {
  CommandOptions,
  CommandController,
  CommandFilter,
} from "@data-slot/command";

export { createToast } from "@data-slot/toast";
export type {
  ToastPosition,
  ToastAction,
  ToastActionEvent,
  ToastClearableField,
  ToastPromiseErrorValue,
  ToastPromiseHandle,
  ToastPromiseOptions,
  ToastPromiseState,
  ToastPromiseStateValue,
  ToastShowOptions,
  ToastUpdateOptions,
  ToastOptions,
  ToastController,
} from "@data-slot/toast";

export { createCarousel } from "@data-slot/carousel";
export type {
  CarouselOptions,
  CarouselController,
} from "@data-slot/carousel";

export { createSlider } from "@data-slot/slider";
export type { SliderOptions, SliderController } from "@data-slot/slider";

export { createResizable } from "@data-slot/resizable";
export type {
  ResizableOptions,
  ResizableController,
  ResizableDirection,
  PaneConstraints,
} from "@data-slot/resizable";
