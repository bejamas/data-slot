/** Resolve DOM APIs from the realm that owns a node, rather than this module's realm. */
export function getDocument(owner?: Node | Document | null): Document {
  if (owner?.nodeType === 9) return owner as Document;
  return owner?.ownerDocument ?? document;
}

/** Resolve the Window associated with a node or document. */
export function getWindow(node?: Node | Document | null): Window & typeof globalThis {
  const doc = getDocument(node);
  return (doc.defaultView ?? window) as Window & typeof globalThis;
}
