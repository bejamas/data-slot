import { afterEach, describe, expect, it } from "bun:test";
import { createPresenceLifecycle } from "./popup";

// DOM emulators do not run CSS animations. Model only the browser boundary;
// bench/presence checks the same lifecycle with real CSS animations.
describe("presence animation completion", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    document.body.replaceChildren();
  });

  const setup = () => {
    const element = document.createElement("div");
    element.style.animationName = "exit";
    element.style.animationDuration = "200ms";
    document.body.append(element);
    let animations: Array<{ playState: AnimationPlayState; pending: boolean }> = [];
    Object.defineProperty(element, "getAnimations", { value: () => animations });
    let completed = 0;
    const presence = createPresenceLifecycle({
      element,
      onExitComplete: () => { completed++; element.hidden = true; },
    });
    cleanups.push(presence.cleanup);
    return {
      element, presence,
      setAnimations: (value: typeof animations) => { animations = value; },
      get completed() { return completed; },
    };
  };

  it("accepts a finished animation even before the JS duration has elapsed", () => {
    const test = setup();
    test.presence.exit();
    test.setAnimations([{ playState: "finished", pending: false }]);
    test.element.dispatchEvent(new Event("animationend"));
    expect(test.completed).toBe(1);
    expect(test.element.hidden).toBe(true);
    expect(test.presence.isExiting).toBe(false);
    test.element.dispatchEvent(new Event("animationend"));
    expect(test.completed).toBe(1);
  });

  it("waits for the longer running transition after a shorter animation ends", () => {
    const test = setup();
    test.presence.exit();
    test.setAnimations([
      { playState: "finished", pending: false },
      { playState: "running", pending: false },
    ]);
    test.element.dispatchEvent(new Event("animationend"));
    expect(test.completed).toBe(0);
    expect(test.element.hidden).toBe(false);
    test.setAnimations([]);
    test.element.dispatchEvent(new Event("transitionend"));
    expect(test.completed).toBe(1);
  });

  it("waits for pending animations", () => {
    const test = setup();
    test.presence.exit();
    test.setAnimations([{ playState: "idle", pending: true }]);
    test.element.dispatchEvent(new Event("animationend"));
    expect(test.completed).toBe(0);
  });

  it("ignores descendant animation events", () => {
    const test = setup();
    const child = document.createElement("div");
    test.element.append(child);
    test.presence.exit();
    child.dispatchEvent(new Event("animationend", { bubbles: true }));
    expect(test.completed).toBe(0);
    test.element.dispatchEvent(new Event("animationend"));
    expect(test.completed).toBe(1);
  });

  it("does not hide a reopened element when the old exit completes", () => {
    const test = setup();
    test.presence.exit();
    test.presence.enter();
    test.element.dispatchEvent(new Event("animationend"));
    expect(test.completed).toBe(0);
    expect(test.element.hidden).toBe(false);
  });

  it("retains the timeout when completion events are missing", async () => {
    const test = setup();
    test.element.style.animationDuration = "10ms";
    test.presence.exit();
    expect(test.completed).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 90));
    expect(test.completed).toBe(1);
  });
});
