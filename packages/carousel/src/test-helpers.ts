import { createCarousel, type CarouselOptions } from "./index";

type Orientation = "horizontal" | "vertical";

interface Fixture {
  /** Attributes for the carousel root. */
  attrs?: string;
  slideCount?: number;
  /** Render previous/next control buttons. */
  controls?: boolean;
  options?: CarouselOptions;
}

const rect = (start: number, size: number, orientation: Orientation): DOMRect => {
  const horizontal = orientation === "horizontal";
  const left = horizontal ? start : 0;
  const top = horizontal ? 0 : start;
  const width = horizontal ? size : 120;
  const height = horizontal ? 80 : size;
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} } as DOMRect;
};

/**
 * Lay the content's children end to end along `orientation`, each `size` px,
 * and make scrollTo take effect immediately. Returns a function that re-lays
 * the current children after they change.
 */
export const mockGeometry = (content: HTMLElement, orientation: Orientation, size = 100) => {
  const scrolled = () => (orientation === "horizontal" ? content.scrollLeft : content.scrollTop);
  content.getBoundingClientRect = () => rect(0, size, orientation);
  content.scrollTo = ((options: ScrollToOptions) => {
    if (typeof options.left === "number") content.scrollLeft = options.left;
    if (typeof options.top === "number") content.scrollTop = options.top;
  }) as typeof content.scrollTo;
  const layout = () => {
    Array.from(content.children).forEach((child, index) => {
      (child as HTMLElement).getBoundingClientRect = () => rect(index * size - scrolled(), size, orientation);
    });
  };
  layout();
  return layout;
};

/** Render a carousel with mocked geometry and bind it. */
export const render = ({ attrs = "", slideCount = 3, controls = true, options = {} }: Fixture = {}) => {
  const slides = Array.from({ length: slideCount }, (_, i) => `<div data-slot="carousel-item">Slide ${i + 1}</div>`).join("");
  document.body.innerHTML = `
    <div data-slot="carousel" id="root" ${attrs}>
      <div data-slot="carousel-content" id="content">${slides}</div>
      ${controls ? '<button data-slot="carousel-previous" id="prev">Prev</button>' : ""}
      ${controls ? '<button data-slot="carousel-next" id="next">Next</button>' : ""}
    </div>
  `;
  const root = document.getElementById("root")!;
  const content = document.getElementById("content") as HTMLElement;
  const items = Array.from(content.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'));
  const prev = document.getElementById("prev") as HTMLButtonElement | null;
  const next = document.getElementById("next") as HTMLButtonElement | null;
  const orientation = options.orientation ?? (attrs.includes('data-orientation="vertical"') ? "vertical" : "horizontal");
  const layout = mockGeometry(content, orientation);
  const controller = createCarousel(root, options);
  return { root, content, items, prev, next, controller, layout };
};

/** Record scrollTo calls while still applying them. */
export const spyScrollTo = (content: HTMLElement) => {
  const calls: ScrollToOptions[] = [];
  const apply = content.scrollTo.bind(content);
  content.scrollTo = ((options: ScrollToOptions) => {
    calls.push(options);
    apply(options);
  }) as typeof content.scrollTo;
  return calls;
};

/** Collect the indices carried by carousel:change events on `root`. */
export const recordChanges = (root: Element) => {
  const changes: number[] = [];
  root.addEventListener("carousel:change", (event) => {
    changes.push((event as CustomEvent<{ index: number }>).detail.index);
  });
  return changes;
};

export const keydown = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

/** Move the scroll position and fire scroll, plus scrollend when `settled`. */
export const scrollContent = (content: HTMLElement, position: number, settled = false) => {
  content.scrollLeft = position;
  content.dispatchEvent(new Event("scroll", { bubbles: true }));
  if (settled) content.dispatchEvent(new Event("scrollend"));
};

/** Wait for queued MutationObserver callbacks. */
export const flushMutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const pointer = (type: string, init: PointerEventInit) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });

export const press = (target: Element, pointerId: number, clientX: number, clientY: number) =>
  target.dispatchEvent(pointer("pointerdown", { pointerId, clientX, clientY }));

/** Move a pointer on the document; returns the event so tests can inspect defaultPrevented. */
export const move = (pointerId: number, clientX: number, clientY: number) => {
  const event = pointer("pointermove", { pointerId, clientX, clientY });
  document.dispatchEvent(event);
  return event;
};

export const lift = (pointerId: number, clientX: number, clientY: number) =>
  document.dispatchEvent(pointer("pointerup", { pointerId, clientX, clientY }));

export const cancelPointer = (pointerId: number) =>
  document.dispatchEvent(pointer("pointercancel", { pointerId }));

/** Replace `target[key]` while `run` executes, then restore it. */
export const withProperty = <T extends object, K extends keyof T>(target: T, key: K, value: T[K], run: () => void) => {
  const own = Object.prototype.hasOwnProperty.call(target, key);
  const original = target[key];
  Reflect.set(target, key, value);
  try {
    run();
  } finally {
    if (own) Reflect.set(target, key, original);
    else Reflect.deleteProperty(target, key);
  }
};
