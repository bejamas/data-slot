import { afterEach, describe, expect, it } from "bun:test";
import { createContentMount, getRoots, createPresenceLifecycle } from "./index";

afterEach(() => { document.body.innerHTML = ""; });

const setup = () => {
  document.body.innerHTML = `<div data-slot="hover-card"><button>Trigger</button><section><div data-slot="tooltip"><button>Nested</button></div></section><p>After</p></div>`;
  const root = document.body.firstElementChild!;
  const target = root.querySelector("section")!;
  const nested = target.firstElementChild!;
  const mounting = createContentMount({ root, target });
  return { root, target, nested, mounting };
};

describe("content mounting", () => {
  it("preserves nodes, listeners, authored order and scoped nested discovery", () => {
    const { root, target, nested, mounting } = setup();
    const button = nested.querySelector("button")!;
    let clicks = 0;
    button.addEventListener("click", () => clicks++);
    mounting.unmount();
    expect(target.isConnected).toBe(false);
    expect(getRoots(document, "tooltip")).toEqual([nested]);
    expect(getRoots(root, "tooltip")).toEqual([nested]);
    expect(getRoots(root.lastElementChild!, "tooltip")).toEqual([]);
    mounting.mount();
    button.click();
    expect(clicks).toBe(1);
    expect(root.children[1]).toBe(target);
    expect(getRoots(document, "tooltip")).toEqual([nested]);
    mounting.unmount();
    mounting.cleanup();
    mounting.cleanup();
    mounting.unmount();
    expect(root.children[1]).toBe(target);
    expect([...root.childNodes].some(node => node.nodeType === Node.COMMENT_NODE)).toBe(false);
  });

  it("restores into a removed root without reconnecting it to the document", () => {
    const { root, target, mounting } = setup();
    mounting.unmount();
    root.remove();
    expect(getRoots(document, "tooltip")).toEqual([]);
    mounting.cleanup();
    expect(target.parentNode).toBe(root);
    expect(target.isConnected).toBe(false);
  });

  it("leaves eager content connected", () => {
    const { root, target, mounting } = setup();
    mounting.cleanup();
    const eager = createContentMount({ root, target, strategy: "eager" });
    eager.unmount();
    expect(target.isConnected).toBe(true);
    eager.cleanup();
  });

  it("does not resurrect removed authored markup", () => {
    const { root, target, mounting } = setup();
    mounting.unmount();
    root.replaceChildren();
    mounting.cleanup();
    expect(root.childNodes.length).toBe(0);
    expect(target.isConnected).toBe(false);
  });

  it("discovers recursively detached nested roots exactly once", () => {
    const { root, target, nested, mounting } = setup();
    const inner = createContentMount({ root: nested, target: nested.querySelector("button")! });
    inner.unmount();
    mounting.unmount();
    expect(getRoots(document, "tooltip")).toEqual([nested]);
    expect(getRoots(root, "tooltip")).toEqual([nested]);
    mounting.mount();
    expect(getRoots(document, "tooltip")).toEqual([nested]);
    inner.cleanup();
    mounting.cleanup();
    expect(target.isConnected).toBe(true);
  });
});

describe("exit completion", () => {
  it("ignores shorter and descendant transitions, then completes the longest exit", () => {
    const { target, mounting } = setup();
    const element = target as HTMLElement;
    element.style.transitionProperty = "opacity, transform";
    element.style.transitionDuration = "20ms, 100ms";
    let now = 0;
    let exits = 0;
    const win = {
      performance: { now: () => now },
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
      cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    } as unknown as Window;
    const presence = createPresenceLifecycle({ element, win, onExitComplete: () => exits++ });
    presence.exit();
    now = 20;
    element.dispatchEvent(new TransitionEvent("transitionend"));
    expect(exits).toBe(0);
    now = 100;
    element.firstElementChild!.dispatchEvent(new TransitionEvent("transitionend", { bubbles: true }));
    expect(exits).toBe(0);
    element.dispatchEvent(new TransitionEvent("transitionend"));
    expect(exits).toBe(1);
    presence.cleanup();
    mounting.cleanup();
  });
});
