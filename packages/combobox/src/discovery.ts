import { getRoots, hasRootBinding } from "@data-slot/core";
import type { ComboboxController } from "./types";

const ROOT_BINDING_KEY = "@data-slot/combobox";

export function discoverComboboxes(scope: ParentNode, createCombobox: (root: Element) => ComboboxController) {
  return Array.from(getRoots(scope, "combobox"))
    .filter((root) => !hasRootBinding(root, ROOT_BINDING_KEY))
    .map(createCombobox);
}
