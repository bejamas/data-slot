/**
 * Query a single part/slot within a component root
 */
export const getPart = <T extends Element = Element>(
  root: Element,
  slot: string
): T | null => root.querySelector<T>(`[data-slot="${slot}"]`);

/**
 * Query all parts/slots within a component root
 */
export const getParts = <T extends Element = Element>(
  root: Element,
  slot: string
): T[] => [...root.querySelectorAll<T>(`[data-slot="${slot}"]`)];

/**
 * Find all component roots within a scope by data-slot value
 */
export const getRoots = <T extends Element = Element>(
  scope: ParentNode,
  slot: string
): T[] => [...scope.querySelectorAll<T>(`[data-slot="${slot}"]`)];

// ============================================================================
// Data Attribute Helpers
// ============================================================================

// Dev warning tracking (only warn once per element+key)
const warnedKeys = new WeakMap<Element, Set<string>>();

/**
 * Warn once per element+key in development mode
 */
function warnOnce(el: Element, key: string, message: string): void {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return;
  
  let keys = warnedKeys.get(el);
  if (!keys) {
    keys = new Set();
    warnedKeys.set(el, keys);
  }
  if (keys.has(key)) return;
  keys.add(key);
  console.warn(`[@data-slot] ${message}`);
}

/**
 * Get attribute names to check for a key.
 * Supports both kebab-case (data-foo-bar) and camelCase (data-fooBar).
 */
function getAttrNames(key: string): string[] {
  const kebab = `data-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
  const camel = `data-${key}`;
  // Return unique names (kebab first, preferred)
  return kebab === camel ? [kebab] : [kebab, camel];
}

/**
 * Get raw attribute value, checking both kebab-case and camelCase.
 * Returns null if attribute is not present.
 */
function getRawAttr(el: Element, key: string): string | null {
  for (const name of getAttrNames(key)) {
    if (el.hasAttribute(name)) {
      return el.getAttribute(name);
    }
  }
  return null;
}

/**
 * Check if attribute is present (either kebab or camel form).
 */
function hasAttr(el: Element, key: string): boolean {
  return getAttrNames(key).some((name) => el.hasAttribute(name));
}

// Boolean truthy/falsy values
const BOOL_TRUE = new Set(["", "true", "1", "yes"]);
const BOOL_FALSE = new Set(["false", "0", "no"]);

/**
 * Parse a boolean data attribute.
 * - Present with no value, "true", "1", "yes" → true
 * - "false", "0", "no" → false
 * - Absent or invalid → undefined
 */
export function getDataBool(el: Element, key: string): boolean | undefined {
  if (!hasAttr(el, key)) return undefined;
  
  const val = getRawAttr(el, key);
  if (val === null) return undefined;
  
  const lower = val.toLowerCase();
  if (BOOL_TRUE.has(lower)) return true;
  if (BOOL_FALSE.has(lower)) return false;
  
  // Invalid value - warn in dev
  warnOnce(el, key, `Invalid boolean value "${val}" for data-${key}. Expected: true/false/1/0/yes/no or empty.`);
  return undefined;
}

/**
 * Parse a number data attribute.
 * - Valid finite number → number
 * - Absent, invalid, NaN, Infinity, empty → undefined
 */
export function getDataNumber(el: Element, key: string): number | undefined {
  const val = getRawAttr(el, key);
  if (val === null || val === "") return undefined;
  
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    warnOnce(el, key, `Invalid number value "${val}" for data-${key}.`);
    return undefined;
  }
  
  return num;
}

/**
 * Parse a string data attribute.
 * - Present (including empty string) → string
 * - Absent → undefined
 */
export function getDataString(el: Element, key: string): string | undefined {
  if (!hasAttr(el, key)) return undefined;
  return getRawAttr(el, key) ?? undefined;
}

/**
 * Parse an enum data attribute.
 * - Valid value in allowed array → T
 * - Absent or invalid → undefined
 */
export function getDataEnum<T extends string>(
  el: Element,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const val = getRawAttr(el, key);
  if (val === null) return undefined;

  if (allowed.includes(val as T)) {
    return val as T;
  }

  // Invalid value - warn in dev
  warnOnce(el, key, `Invalid value "${val}" for data-${key}. Expected one of: ${allowed.join(", ")}.`);
  return undefined;
}

// ============================================================================
// Portal Utilities
// ============================================================================

const portalOwners = new WeakMap<Element, Element>();
const PORTAL_OWNER_SYMBOL = Symbol.for("data-slot.portal-owner");

type PortalTaggedElement = Element & {
  [PORTAL_OWNER_SYMBOL]?: Element;
};

const getPortalOwner = (el: Element): Element | undefined =>
  (el as PortalTaggedElement)[PORTAL_OWNER_SYMBOL] ?? portalOwners.get(el);

const setPortalOwner = (el: Element, owner: Element): void => {
  portalOwners.set(el, owner);
  (el as PortalTaggedElement)[PORTAL_OWNER_SYMBOL] = owner;
};

const clearPortalOwner = (el: Element): void => {
  portalOwners.delete(el);
  delete (el as PortalTaggedElement)[PORTAL_OWNER_SYMBOL];
};

/** Check if target is inside root, including portaled descendants.
 *  Follows chained portal ownership for nested portals. */
export function containsWithPortals(root: Element, target: Node | null): boolean {
  return _containsWithPortals(root, target, new Set<Element>());
}

function _containsWithPortals(
  root: Element,
  target: Node | null,
  visited: Set<Element>
): boolean {
  if (!target) return false;
  const el = target instanceof Element ? target : target.parentElement;
  if (!el) return false;
  if (root.contains(el)) return true;
  // Walk up ancestors, following portal-owner chain recursively
  let current: Element | null = el;
  while (current) {
    const owner = getPortalOwner(current);
    if (owner && !visited.has(owner)) {
      visited.add(owner);
      if (_containsWithPortals(root, owner, visited)) return true;
    }
    current = current.parentElement;
  }
  return false;
}

export interface PortalState {
  originalParent: ParentNode | null;
  originalNextSibling: ChildNode | null;
  portaled: boolean;
}

export function portalToBody(
  el: Element,
  originRoot: Element,
  state: PortalState
): void {
  if (state.portaled) return;
  const body = (originRoot.ownerDocument ?? document)?.body;
  if (!body) return;
  state.originalParent = el.parentNode;
  state.originalNextSibling = el.nextSibling;
  setPortalOwner(el, originRoot);
  body.appendChild(el);
  state.portaled = true;
}

export function restorePortal(el: Element, state: PortalState): void {
  if (!state.portaled) return;
  clearPortalOwner(el);
  const parent = state.originalParent;
  const sibling = state.originalNextSibling;
  if (parent && (parent as Node).isConnected) {
    if (sibling && sibling.parentNode === parent) {
      parent.insertBefore(el, sibling);
    } else {
      parent.appendChild(el);
    }
  } else {
    el.remove();
  }
  state.portaled = false;
  state.originalParent = null;
  state.originalNextSibling = null;
}
