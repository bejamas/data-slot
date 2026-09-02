/** Resolve DOM APIs from the realm that owns a node, rather than this module's realm. */
export function getDocument(node?: Node | null): Document {
  return node?.ownerDocument ?? document;
}

/** Resolve the Window associated with a node or document. */
export function getWindow(node?: Node | Document | null): Window {
  const doc = node?.nodeType === 9 ? (node as Document) : getDocument(node);
  return doc.defaultView ?? window;
}

/** Create events in their target's realm so cross-window dispatch remains valid. */
export function createCustomEvent<T>(target: Node, name: string, detail?: T): CustomEvent<T> {
  const CustomEventConstructor = (getWindow(target) as Window & typeof globalThis).CustomEvent;
  return new CustomEventConstructor(name, { bubbles: true, detail });
}
