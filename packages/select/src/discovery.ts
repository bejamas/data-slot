import { getRoots, hasRootBinding } from "@data-slot/core";
import type { SelectController } from "./types";

const ROOT_BINDING_KEY = "@data-slot/select";

export function discoverSelects(scope: ParentNode, createSelect: (root: Element) => SelectController) {
  return Array.from(getRoots(scope, "select"))
    .filter((root) => !hasRootBinding(root, ROOT_BINDING_KEY))
    .map(createSelect);
}
