import { create as accordion } from "@data-slot/accordion";
import { create as alertDialog } from "@data-slot/alert-dialog";
import { create as carousel } from "@data-slot/carousel";
import { create as collapsible } from "@data-slot/collapsible";
import { create as combobox } from "@data-slot/combobox";
import { create as command } from "@data-slot/command";
import { create as dialog } from "@data-slot/dialog";
import { create as drawer } from "@data-slot/drawer";
import { create as dropdownMenu } from "@data-slot/dropdown-menu";
import { create as hoverCard } from "@data-slot/hover-card";
import { create as navigationMenu } from "@data-slot/navigation-menu";
import { create as popover } from "@data-slot/popover";
import { create as radioGroup } from "@data-slot/radio-group";
import { create as resizable } from "@data-slot/resizable";
import { create as select } from "@data-slot/select";
import { create as slider } from "@data-slot/slider";
import { create as switchCreate } from "@data-slot/switch";
import { create as tabs } from "@data-slot/tabs";
import { create as toast } from "@data-slot/toast";
import { create as toggle } from "@data-slot/toggle";
import { create as toggleGroup } from "@data-slot/toggle-group";
import { create as tooltip } from "@data-slot/tooltip";

const creators = [
  accordion, alertDialog, carousel, collapsible, combobox, command, dialog, drawer,
  dropdownMenu, hoverCard, navigationMenu, popover, radioGroup, resizable, select,
  slider, switchCreate, tabs, toast, toggle, toggleGroup, tooltip,
];

const start = performance.now();
for (const create of creators) create(document);
(window as unknown as { __initMs: number }).__initMs = performance.now() - start;
