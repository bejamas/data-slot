// Convenience re-exports from @data-slot/* packages
// For tree-shaking, prefer importing from specific packages:
//   import { create } from "@data-slot/tabs"
//
// Or use subpath imports:
//   import { create } from "data-slot/tabs"

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
export type { PopoverOptions, PopoverController } from "@data-slot/popover";

export { createTooltip } from "@data-slot/tooltip";
export type { TooltipOptions, TooltipController } from "@data-slot/tooltip";

export { createDialog } from "@data-slot/dialog";
export type { DialogOptions, DialogController } from "@data-slot/dialog";

export { createNavigationMenu } from "@data-slot/navigation-menu";
export type {
  NavigationMenuOptions,
  NavigationMenuController,
} from "@data-slot/navigation-menu";

export { createDropdownMenu } from "@data-slot/dropdown-menu";
export type {
  DropdownMenuOptions,
  DropdownMenuController,
} from "@data-slot/dropdown-menu";

export { createCombobox } from "@data-slot/combobox";
export type {
  ComboboxOptions,
  ComboboxController,
} from "@data-slot/combobox";
