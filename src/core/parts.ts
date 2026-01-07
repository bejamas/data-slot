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
