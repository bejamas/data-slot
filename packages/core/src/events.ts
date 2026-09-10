/**
 * Add an event listener and return a cleanup function
 */
export function on<K extends keyof HTMLElementEventMap>(
  el: EventTarget,
  type: K,
  fn: (e: HTMLElementEventMap[K]) => void,
  opts?: AddEventListenerOptions
): () => void;
export function on(
  el: EventTarget,
  type: string,
  fn: (e: Event) => void,
  opts?: AddEventListenerOptions
): () => void;
export function on(
  el: EventTarget,
  type: string,
  fn: (e: Event) => void,
  opts?: AddEventListenerOptions
): () => void {
  el.addEventListener(type, fn as EventListener, opts);
  return () => el.removeEventListener(type, fn as EventListener, opts);
}

/**
 * Listen for commands dispatched directly on a component root, ignoring
 * commands bubbling from descendants without stopping their propagation.
 */
export const onRoot = (
  root: Element,
  type: string,
  fn: (e: Event) => void,
): (() => void) => on(root, type, (event) => {
  if (event.target === root) fn(event);
});

/**
 * Dispatch a custom event with optional detail
 */
export const emit = <T = unknown>(
  el: Element,
  name: string,
  detail?: T
): boolean =>
  el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));

/**
 * Compose multiple event handlers into one
 * Handlers are called in order, stops if event.defaultPrevented
 */
export const composeHandlers = <E extends Event>(
  ...handlers: Array<((e: E) => void) | undefined>
): ((e: E) => void) => {
  return (e: E) => {
    for (const handler of handlers) {
      if (e.defaultPrevented) break;
      handler?.(e);
    }
  };
};
