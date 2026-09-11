import { expect, it } from "bun:test";
import { emit, onRoot } from "./index";

it("onRoot isolates nested commands while preserving propagation and cleanup", () => {
  const container = document.createElement("div");
  container.innerHTML = '<div id="outer"><div id="inner"><span></span></div></div>';
  const outer = container.querySelector<HTMLElement>("#outer")!;
  const inner = container.querySelector<HTMLElement>("#inner")!;
  const handled: string[] = [];
  const observed: string[] = [];
  container.addEventListener("component:set", (event) => {
    observed.push((event.target as HTMLElement).id);
  });
  const cleanupOuter = onRoot(outer, "component:set", () => handled.push("outer"));
  const cleanupInner = onRoot(inner, "component:set", () => handled.push("inner"));
  try {
    emit(inner, "component:set", { value: "inner" });
    expect(handled).toEqual(["inner"]);
    expect(observed).toEqual(["inner"]);

    emit(outer, "component:set", { value: "outer" });
    expect(handled).toEqual(["inner", "outer"]);
    expect(observed).toEqual(["inner", "outer"]);

    emit(inner.querySelector("span")!, "component:set");
    expect(handled).toEqual(["inner", "outer"]);
    expect(observed).toEqual(["inner", "outer", ""]);

    cleanupInner();
    cleanupOuter();
    emit(inner, "component:set");
    emit(outer, "component:set");
    expect(handled).toEqual(["inner", "outer"]);
    expect(observed).toEqual(["inner", "outer", "", "inner", "outer"]);
  } finally {
    cleanupInner();
    cleanupOuter();
  }
});
