import { expect, it } from "bun:test";
import { createNavigationMenuPopupStack } from "./navigation-menu-popup-stack";

it("measures without intrinsic size caps and restores the available-space limits", () => {
  const root = document.createElement("nav");
  root.innerHTML = `
    <div data-slot="navigation-menu-positioner"
      style="--available-width: 320px; --available-height: 100px; max-width: var(--available-width)">
      <div data-slot="navigation-menu-popup" style="max-height: var(--available-height)">
        <div data-slot="navigation-menu-viewport">
          <div style="width: 384px; max-width: var(--available-width)">Short label</div>
        </div>
      </div>
    </div>
  `;
  document.body.append(root);
  const positioner = root.firstElementChild as HTMLElement;
  const popup = positioner.firstElementChild as HTMLElement;
  const viewport = popup.firstElementChild as HTMLElement;
  const panel = viewport.firstElementChild as HTMLElement;
  const stack = createNavigationMenuPopupStack({
    root,
    viewport,
    isDestroyed: () => false,
    beforeRestore: () => {},
  });
  const limits: string[][] = [];
  // Happy DOM has no layout engine. Inspect the real computed constraints at
  // the point where a browser would read the popup's border-box dimensions.
  Object.defineProperty(popup, "offsetWidth", {
    get() {
      limits.push([
        getComputedStyle(positioner).maxWidth,
        getComputedStyle(panel).maxWidth,
        getComputedStyle(popup).maxHeight,
      ]);
      return 386;
    },
  });
  Object.defineProperty(popup, "offsetHeight", { get: () => 174 });

  try {
    for (const mode of ["initial-open", "measure-target"] as const) {
      expect(stack.measure(mode, { width: 0, height: 0 })).toEqual({
        width: 386,
        height: 174,
      });
      expect(limits.at(-1)).toEqual(["none", "none", "none"]);
      expect(getComputedStyle(positioner).maxWidth).toBe("320px");
      expect(getComputedStyle(panel).maxWidth).toBe("320px");
      expect(getComputedStyle(popup).maxHeight).toBe("100px");
    }
  } finally {
    stack.destroy();
    root.remove();
  }
});
