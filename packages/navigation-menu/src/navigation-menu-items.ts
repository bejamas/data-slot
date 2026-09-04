import { ensureId, getPart } from "@data-slot/core";

export type NavigationMenuItem = {
  value: string;
  item: HTMLElement;
  trigger: HTMLElement;
  content: HTMLElement;
  index: number;
};

export type TopLevelNavigable =
  | {
      kind: "submenu";
      element: HTMLElement;
      item: HTMLElement;
      value: string;
      trigger: HTMLElement;
    }
  | { kind: "plain"; element: HTMLElement };

const focusable =
  'a[href], button:not([disabled]), [role="link"], [role="button"], [tabindex]:not([tabindex="-1"])';
const safeId = (value: string) => value.replace(/[^a-z0-9\-_:.]/gi, "-");

/** Discovers authored menu items and keeps all lookup rules in one place. */
export function createNavigationMenuItems(
  list: HTMLElement,
  items: HTMLElement[],
) {
  const itemMap = new Map<string, NavigationMenuItem>();
  const allItems: NavigationMenuItem[] = [];
  let index = 0;
  for (const item of items) {
    const value = item.dataset.value;
    if (!value) continue;
    const trigger = getPart<HTMLElement>(item, "navigation-menu-trigger");
    const content = getPart<HTMLElement>(item, "navigation-menu-content");
    if (!trigger || !content) continue;
    const managed = { value, item, trigger, content, index: index++ };
    allItems.push(managed);
    itemMap.set(value, managed);
    const safe = safeId(value);
    const triggerId = ensureId(trigger, `nav-menu-trigger-${safe}`);
    const contentId = ensureId(content, `nav-menu-content-${safe}`);
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-controls", contentId);
    content.setAttribute("aria-labelledby", triggerId);
  }

  const managedByElement = (el: Element | null): NavigationMenuItem | null => {
    const item = el?.closest(
      '[data-slot="navigation-menu-item"]',
    ) as HTMLElement | null;
    if (!item) return null;
    const value = item.dataset.value;
    const found = value ? itemMap.get(value) : null;
    return found?.item === item ? found : null;
  };
  const targetForPlainItem = (item: HTMLElement) => {
    if (item.matches(focusable)) return item;
    for (const candidate of item.querySelectorAll<HTMLElement>(focusable)) {
      if (
        !candidate.closest('[data-slot="navigation-menu-content"]') &&
        !candidate.hidden &&
        !candidate.closest("[hidden]")
      )
        return candidate;
    }
    return null;
  };
  const navigables: TopLevelNavigable[] = [];
  const navigableByElement = new Map<HTMLElement, TopLevelNavigable>();
  for (const item of items) {
    const managed = managedByElement(item);
    const entry: TopLevelNavigable | null = managed
      ? {
          kind: "submenu",
          element: managed.trigger,
          item: managed.item,
          value: managed.value,
          trigger: managed.trigger,
        }
      : (() => {
          const element = targetForPlainItem(item);
          return element ? { kind: "plain" as const, element } : null;
        })();
    if (!entry) continue;
    navigables.push(entry);
    navigableByElement.set(entry.element, entry);
    if (entry.kind === "submenu") navigableByElement.set(entry.item, entry);
  }
  const navigableByTarget = (target: EventTarget | null) => {
    let current = target instanceof HTMLElement ? target : null;
    while (current && current !== list) {
      const found = navigableByElement.get(current);
      if (found) return found;
      current = current.parentElement;
    }
    return null;
  };
  return {
    allItems,
    itemMap,
    navigables,
    navigableByTarget,
    isNonSubmenuListTarget(target: EventTarget | null) {
      if (!(target instanceof Node) || !list.contains(target)) return false;
      const el = target instanceof HTMLElement ? target : target.parentElement;
      if (
        !el ||
        el.closest('[data-slot="navigation-menu-indicator"]') ||
        managedByElement(el)
      )
        return false;
      return !!el.closest(
        '[data-slot="navigation-menu-item"], a[href], button, [role="link"], [role="button"]',
      );
    },
  };
}
