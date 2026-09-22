import {
  create,
  createNavigationMenu as createNavigationMenuController,
} from "./navigation-menu-controller";

export { create };
export {
  type Align,
  type NavigationMenuController,
  type NavigationMenuOptions,
  type PositionMethod,
} from "./navigation-menu-controller";

export function createNavigationMenu(
  root: Element,
  options: import("./navigation-menu-controller").NavigationMenuOptions = {},
) {
  return createNavigationMenuController(root, options);
}
