import { expect, it, spyOn } from "bun:test";
import { createTerminalLifecycle } from "./popup";

it("forgets canceled work and only cancels outstanding work on destroy", () => {
  const cancelRaf = spyOn(globalThis, "cancelAnimationFrame");
  const cancelTimeout = spyOn(globalThis, "clearTimeout");
  const lifecycle = createTerminalLifecycle();
  try {
    for (let i = 0; i < 100; i++) {
      const frame = lifecycle.trackRaf(() => {});
      const timer = lifecycle.trackTimeout(() => {}, 60_000);
      lifecycle.cancelRaf(frame);
      lifecycle.cancelTimeout(timer);
      lifecycle.cancelRaf(frame);
      lifecycle.cancelTimeout(timer);
    }
    expect(cancelRaf).toHaveBeenCalledTimes(100);
    expect(cancelTimeout).toHaveBeenCalledTimes(100);
    cancelRaf.mockClear();
    cancelTimeout.mockClear();

    const pendingFrame = lifecycle.trackRaf(() => {});
    const pendingTimer = lifecycle.trackTimeout(() => {}, 60_000);
    lifecycle.destroy();
    expect(cancelRaf).toHaveBeenCalledTimes(1);
    expect(cancelRaf).toHaveBeenCalledWith(pendingFrame);
    expect(cancelTimeout).toHaveBeenCalledTimes(1);
    expect(cancelTimeout).toHaveBeenCalledWith(pendingTimer);
    lifecycle.cancelRaf(null);
    lifecycle.cancelTimeout(null);
    lifecycle.destroy();
    expect(cancelRaf).toHaveBeenCalledTimes(1);
    expect(cancelTimeout).toHaveBeenCalledTimes(1);
  } finally {
    lifecycle.destroy();
    cancelRaf.mockRestore();
    cancelTimeout.mockRestore();
  }
});

it("does not run canceled callbacks while allowing other work to finish", async () => {
  const lifecycle = createTerminalLifecycle();
  const calls: string[] = [];
  try {
    lifecycle.cancelRaf(lifecycle.trackRaf(() => calls.push("canceled frame")));
    lifecycle.cancelTimeout(lifecycle.trackTimeout(() => calls.push("canceled timer"), 0));
    await Promise.all([
      new Promise<void>((resolve) => lifecycle.trackRaf(() => {
        calls.push("frame");
        resolve();
      })),
      new Promise<void>((resolve) => lifecycle.trackTimeout(() => {
        calls.push("timer");
        resolve();
      }, 0)),
    ]);
    expect(calls.sort()).toEqual(["frame", "timer"]);
  } finally {
    lifecycle.destroy();
  }
});
