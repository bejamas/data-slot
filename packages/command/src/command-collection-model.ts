/** DOM ownership and value resolution for a command collection. */
export interface CommandGroupMeta {
  el: HTMLElement;
  heading: HTMLElement | null;
  value: string;
  forceMount: boolean;
  maxRank: number;
}

export interface CommandItemMeta {
  el: HTMLElement;
  value: string | null;
  keywords: string[];
  disabled: boolean;
  forceMount: boolean;
  rank: number;
  group: CommandGroupMeta | null;
}

const AUTHORED_VALUE_SYMBOL = Symbol("data-slot.command.authored-value");
const INFERRED_VALUE_SYMBOL = Symbol("data-slot.command.inferred-value");

export const normalizeCommandValue = (value: string | null | undefined): string | null =>
  value == null ? null : value.trim();

export const parseCommandKeywords = (value: string | undefined): string[] =>
  value
    ? value.split(/[,\n]/).map((part) => part.trim()).filter(Boolean)
    : [];

export const getOwnedCommandElements = <T extends HTMLElement>(
  scope: ParentNode,
  selector: string,
  root: HTMLElement,
): T[] => Array.from(scope.querySelectorAll<T>(selector)).filter((el) => el.closest('[data-slot="command"]') === root);

export const getDirectCommandChildren = <T extends HTMLElement>(parent: HTMLElement, slot: string): T[] =>
  Array.from(parent.children).filter(
    (child): child is T => child instanceof HTMLElement && child.getAttribute("data-slot") === slot,
  );

export const getCommandItemText = (item: HTMLElement): string => {
  const collectText = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement) || node.getAttribute("data-slot") === "command-shortcut") return "";
    return Array.from(node.childNodes, collectText).join("");
  };
  return collectText(item).replace(/\s+/g, " ").trim();
};

export const isCommandItemDisabled = (el: HTMLElement): boolean =>
  el.hasAttribute("disabled") || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";

type CommandTaggedElement = HTMLElement & {
  [AUTHORED_VALUE_SYMBOL]?: boolean;
  [INFERRED_VALUE_SYMBOL]?: string | null;
};

/** Keeps authored values stable while refreshing inferred text values after DOM mutations. */
export const resolveCommandValue = (
  el: HTMLElement,
  fallback: () => string | null,
): { authored: boolean; value: string | null } => {
  const tagged = el as CommandTaggedElement;
  const hasDataValue = el.hasAttribute("data-value");
  if (tagged[AUTHORED_VALUE_SYMBOL] === undefined) tagged[AUTHORED_VALUE_SYMBOL] = hasDataValue;
  if (!hasDataValue) tagged[AUTHORED_VALUE_SYMBOL] = false;
  else if (!tagged[AUTHORED_VALUE_SYMBOL]) {
    tagged[AUTHORED_VALUE_SYMBOL] = normalizeCommandValue(el.getAttribute("data-value")) !== tagged[INFERRED_VALUE_SYMBOL];
  }
  if (tagged[AUTHORED_VALUE_SYMBOL]) return { authored: true, value: normalizeCommandValue(el.getAttribute("data-value")) };
  const value = fallback();
  tagged[INFERRED_VALUE_SYMBOL] = value;
  if (value === null) el.removeAttribute("data-value");
  else el.setAttribute("data-value", value);
  return { authored: false, value };
};
