import { on } from "@data-slot/core";

interface ResizeDragOptions {
  root: HTMLElement;
  handles: HTMLElement[];
  horizontal: boolean;
  getLayout(): number[];
  onMove(handleIndex: number, initialLayout: number[], delta: number): boolean;
  onActiveChange(active: boolean): void;
}

interface DragSession {
  handleIndex: number;
  initialPosition: number;
  initialLayout: number[];
  previousDelta: number;
  cursor: HTMLStyleElement;
  cleanups: Array<() => void>;
}

// Only the active session may change the document's drag cursor or listeners.
const activeDrags = new WeakMap<Document, () => void>();

export function createResizeDrag(options: ResizeDragOptions) {
  const { root, handles, horizontal } = options;
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const cursors = horizontal
    ? { resizing: "ew-resize", minimum: "e-resize", maximum: "w-resize" }
    : { resizing: "ns-resize", minimum: "s-resize", maximum: "n-resize" };
  let session: DragSession | null = null;

  const stop = (): void => {
    if (!session) return;
    const previous = session;
    session = null;
    if (activeDrags.get(doc) === stop) activeDrags.delete(doc);
    previous.cleanups.forEach(cleanup => cleanup());
    previous.cursor.remove();
    const handle = handles[previous.handleIndex]!;
    if (doc.activeElement === handle) handle.setAttribute("data-active", "keyboard");
    else handle.removeAttribute("data-active");
    options.onActiveChange(false);
  };

  const move = (position: number, event: Event): void => {
    const current = session;
    if (!current) return;
    event.preventDefault();
    const rect = root.getBoundingClientRect();
    const size = horizontal ? rect.width : rect.height;
    const offset = position - current.initialPosition;
    const delta = (size === 0 ? 0 : offset / size * 100) * (horizontal && doc.dir === "rtl" ? -1 : 1);
    const changed = options.onMove(current.handleIndex, current.initialLayout, delta);
    // A layout callback may have ended this session or started another one.
    if (session !== current || current.previousDelta === delta) return;
    current.previousDelta = delta;
    const cursor = changed ? cursors.resizing : delta < 0 ? cursors.minimum : cursors.maximum;
    current.cursor.textContent = `*{cursor: ${cursor}!important;}`;
  };

  const start = (handleIndex: number, position: number, touchId?: number): void => {
    activeDrags.get(doc)?.();
    const cursor = doc.createElement("style");
    cursor.textContent = `*{cursor: ${cursors.resizing}!important;}`;
    doc.head.appendChild(cursor);
    const cleanups: Array<() => void> = [];
    session = { handleIndex, initialPosition: position, initialLayout: options.getLayout(), previousDelta: 0, cursor, cleanups };
    activeDrags.set(doc, stop);
    handles[handleIndex]!.setAttribute("data-active", "pointer");

    if (touchId === undefined) {
      cleanups.push(on(doc, "mousemove", event => move(horizontal ? event.clientX : event.clientY, event)));
      cleanups.push(on(win ?? doc, "mouseup", stop));
    } else {
      cleanups.push(on(doc, "touchmove", event => {
        const touch = Array.from(event.touches).find(touch => touch.identifier === touchId);
        if (touch) move(horizontal ? touch.clientX : touch.clientY, event);
      }, { passive: false }));
      const endTouch = (event: TouchEvent) => {
        if (Array.from(event.changedTouches).some(touch => touch.identifier === touchId)) stop();
      };
      cleanups.push(on(win ?? doc, "touchend", endTouch));
      cleanups.push(on(win ?? doc, "touchcancel", endTouch));
    }
    cleanups.push(on(doc, "contextmenu", stop));
    if (win) cleanups.push(on(win, "blur", stop));
    options.onActiveChange(true);
  };

  const cleanups = handles.flatMap((handle, index) => [
    on(handle, "mousedown", event => {
      if (event.defaultPrevented || event.button !== 0 || handle.getAttribute("data-disabled") === "true") return;
      event.preventDefault();
      start(index, horizontal ? event.clientX : event.clientY);
    }),
    on(handle, "touchstart", event => {
      if (event.defaultPrevented || event.touches.length !== 1 || handle.getAttribute("data-disabled") === "true") return;
      const touch = event.touches[0]!;
      event.preventDefault();
      start(index, horizontal ? touch.clientX : touch.clientY, touch.identifier);
    }, { passive: false }),
  ]);

  return {
    get activeHandle(): number | null { return session?.handleIndex ?? null; },
    stop,
    destroy() {
      cleanups.forEach(cleanup => cleanup());
      stop();
    },
  };
}
