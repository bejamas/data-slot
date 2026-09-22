/** Whether closed overlay content remains in the connected document. */
export type MountStrategy = "lazy" | "eager";

// Root-owned storage avoids retaining removed roots and works across separately
// bundled copies of core, like the root binding and portal ownership symbols.
const RETAINED_CONTENT = Symbol.for("data-slot.retained-content");
type ContentOwner = Element & { [RETAINED_CONTENT]?: Set<Element> };
const EMPTY_CONTENT: readonly Element[] = [];

export function getRetainedContent(root: Element): Iterable<Element> {
  return (root as ContentOwner)[RETAINED_CONTENT] ?? EMPTY_CONTENT;
}

export interface ContentMountOptions {
  root: Element;
  /** The whole authored portal/positioner, or the content itself. */
  target: Element;
  strategy?: MountStrategy;
}

/**
 * Retains node identity while closed. Call mount before portal.mount, unmount
 * after portal.restore, and cleanup after portal.cleanup.
 */
export function createContentMount(options: ContentMountOptions) {
  const { root, target } = options;
  const owner = root as ContentOwner;
  const lazy = (options.strategy ?? "lazy") === "lazy";
  const anchor = lazy ? root.ownerDocument.createComment("data-slot content") : null;
  let destroyed = false;
  let detached = false;
  if (anchor) target.before(anchor);

  const mount = () => {
    if (destroyed || !detached) return;
    anchor?.parentNode?.insertBefore(target, anchor.nextSibling);
    owner[RETAINED_CONTENT]?.delete(target);
    detached = false;
  };

  return {
    mount,
    unmount() {
      if (destroyed || !lazy || detached) return;
      target.remove();
      detached = true;
      (owner[RETAINED_CONTENT] ??= new Set()).add(target);
    },
    cleanup() {
      if (destroyed) return;
      // Restore into detached authored roots too, so destroy/rebind works.
      if (anchor?.parentNode) anchor.parentNode.insertBefore(target, anchor.nextSibling);
      anchor?.remove();
      owner[RETAINED_CONTENT]?.delete(target);
      if (!owner[RETAINED_CONTENT]?.size) delete owner[RETAINED_CONTENT];
      destroyed = true;
    },
  };
}
