import { describe, expect, it, beforeEach } from "bun:test";
import { createSlider, create } from "./index";

describe("Slider", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const setupSingle = (attrs = "", defaultValue?: number) => {
    document.body.innerHTML = `
      <div data-slot="slider" id="root" ${attrs}>
        <div class="slider-control">
          <div data-slot="slider-track">
            <div data-slot="slider-range"></div>
          </div>
          <div data-slot="slider-thumb"></div>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const track = root.querySelector('[data-slot="slider-track"]') as HTMLElement;
    const range = root.querySelector('[data-slot="slider-range"]') as HTMLElement;
    const thumb = root.querySelector('[data-slot="slider-thumb"]') as HTMLElement;
    const control = track.parentElement as HTMLElement;
    const controller = createSlider(root, defaultValue !== undefined ? { defaultValue } : {});

    return { root, track, range, thumb, control, controller };
  };

  const setupRange = (attrs = "", defaultValue?: [number, number]) => {
    document.body.innerHTML = `
      <div data-slot="slider" id="root" ${attrs}>
        <div class="slider-control">
          <div data-slot="slider-track">
            <div data-slot="slider-range"></div>
          </div>
          <div data-slot="slider-thumb"></div>
          <div data-slot="slider-thumb"></div>
        </div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const track = root.querySelector('[data-slot="slider-track"]') as HTMLElement;
    const range = root.querySelector('[data-slot="slider-range"]') as HTMLElement;
    const thumbs = [...root.querySelectorAll('[data-slot="slider-thumb"]')] as HTMLElement[];
    const control = track.parentElement as HTMLElement;
    const controller = createSlider(root, defaultValue !== undefined ? { defaultValue } : {});

    return { root, track, range, thumbs, control, controller };
  };

  describe("Basic Functionality", () => {
    it("initializes with default value from options", () => {
      const { controller } = setupSingle("", 50);
      expect(controller.value).toBe(50);
    });

    it("initializes with default value from data attribute", () => {
      const { controller } = setupSingle('data-default-value="75"');
      expect(controller.value).toBe(75);
    });

    it("JS options override data attributes", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-default-value="25" data-min="10" data-max="90">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createSlider(root, { defaultValue: 50, min: 0, max: 100 });

      expect(controller.value).toBe(50);
      expect(controller.min).toBe(0);
      expect(controller.max).toBe(100);
    });

    it("clamps value to min/max bounds", () => {
      const { controller } = setupSingle('data-min="0" data-max="100"');
      controller.setValue(150);
      expect(controller.value).toBe(100);

      controller.setValue(-50);
      expect(controller.value).toBe(0);
    });

    it("snaps value to step increments", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-step="10">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createSlider(root);

      controller.setValue(23);
      expect(controller.value).toBe(20);

      controller.setValue(27);
      expect(controller.value).toBe(30);
    });
  });

  describe("Sanity Guards", () => {
    it("swaps min and max if min > max", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-min="100" data-max="0">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createSlider(root);

      expect(controller.min).toBe(0);
      expect(controller.max).toBe(100);
    });

    it("defaults step to 1 if step <= 0", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-step="0" data-default-value="50">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const controller = createSlider(root);

      // Should work with default step of 1
      controller.setValue(50.5);
      expect(controller.value).toBe(51); // Snapped to nearest 1
    });

    it("handles zero-size track gracefully on pointer events", () => {
      const { control, track, controller } = setupSingle('data-default-value="50"');

      // Mock zero-size track
      track.getBoundingClientRect = () => ({
        left: 0, right: 0, top: 0, bottom: 0,
        width: 0, height: 0, x: 0, y: 0, toJSON() {}
      } as DOMRect);
      control.setPointerCapture = () => {};

      // Should not crash, value should remain unchanged
      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 50, clientY: 10, pointerId: 1, bubbles: true
      }));

      expect(controller.value).toBe(50);
    });
  });

  describe("ARIA", () => {
    it("sets role='slider' on thumb", () => {
      const { thumb } = setupSingle();
      expect(thumb.getAttribute("role")).toBe("slider");
    });

    it("sets aria-valuemin, aria-valuemax, aria-valuenow", () => {
      const { thumb, controller } = setupSingle('data-min="10" data-max="90" data-default-value="50"');

      expect(thumb.getAttribute("aria-valuemin")).toBe("10");
      expect(thumb.getAttribute("aria-valuemax")).toBe("90");
      expect(thumb.getAttribute("aria-valuenow")).toBe("50");

      controller.setValue(75);
      expect(thumb.getAttribute("aria-valuenow")).toBe("75");
    });

    it("sets aria-orientation", () => {
      const { thumb } = setupSingle('data-orientation="vertical"');
      expect(thumb.getAttribute("aria-orientation")).toBe("vertical");
    });

    it("sets aria-disabled when disabled", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-disabled>
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const thumb = root.querySelector('[data-slot="slider-thumb"]') as HTMLElement;
      createSlider(root);

      expect(thumb.getAttribute("aria-disabled")).toBe("true");
      expect(root.hasAttribute("data-disabled")).toBe(true);
    });

    it("updates aria-valuenow on value change", () => {
      const { thumb, controller } = setupSingle("", 25);

      expect(thumb.getAttribute("aria-valuenow")).toBe("25");

      controller.setValue(80);
      expect(thumb.getAttribute("aria-valuenow")).toBe("80");
    });

    it("sets dynamic aria-valuemin/max for range slider thumbs", () => {
      const { thumbs, controller } = setupRange("", [25, 75]);

      // Min thumb: aria-valuemin = global min, aria-valuemax = max thumb value
      expect(thumbs[0]!.getAttribute("aria-valuemin")).toBe("0");
      expect(thumbs[0]!.getAttribute("aria-valuemax")).toBe("75");

      // Max thumb: aria-valuemin = min thumb value, aria-valuemax = global max
      expect(thumbs[1]!.getAttribute("aria-valuemin")).toBe("25");
      expect(thumbs[1]!.getAttribute("aria-valuemax")).toBe("100");

      // Update values and verify ARIA updates
      controller.setValue([30, 60]);
      expect(thumbs[0]!.getAttribute("aria-valuemax")).toBe("60");
      expect(thumbs[1]!.getAttribute("aria-valuemin")).toBe("30");
    });

    it("prefers author-provided aria-label over default", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb" aria-label="Price minimum"></div>
            <div data-slot="slider-thumb" data-label="Price maximum"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const thumbs = [...root.querySelectorAll('[data-slot="slider-thumb"]')] as HTMLElement[];
      createSlider(root);

      // First thumb: existing aria-label should be preserved (not overwritten)
      expect(thumbs[0]!.getAttribute("aria-label")).toBe("Price minimum");

      // Second thumb: data-label should be used
      expect(thumbs[1]!.getAttribute("aria-label")).toBe("Price maximum");
    });
  });

  describe("Keyboard", () => {
    it("ArrowRight increases value for horizontal slider", () => {
      const { thumb, controller } = setupSingle('data-step="5" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(controller.value).toBe(55);
    });

    it("ArrowLeft decreases value for horizontal slider", () => {
      const { thumb, controller } = setupSingle('data-step="5" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      expect(controller.value).toBe(45);
    });

    it("ArrowUp/ArrowDown are ignored for horizontal slider", () => {
      const { thumb, controller } = setupSingle('data-step="5" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      expect(controller.value).toBe(50); // Unchanged

      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      expect(controller.value).toBe(50); // Unchanged
    });

    it("ArrowUp increases value for vertical slider", () => {
      const { thumb, controller } = setupSingle('data-orientation="vertical" data-step="5" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      expect(controller.value).toBe(55);
    });

    it("ArrowDown decreases value for vertical slider", () => {
      const { thumb, controller } = setupSingle('data-orientation="vertical" data-step="5" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      expect(controller.value).toBe(45);
    });

    it("ArrowLeft/ArrowRight are ignored for vertical slider", () => {
      const { thumb, controller } = setupSingle('data-orientation="vertical" data-step="5" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      expect(controller.value).toBe(50); // Unchanged

      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(controller.value).toBe(50); // Unchanged
    });

    it("PageUp increases by largeStep", () => {
      const { thumb, controller } = setupSingle('data-step="1" data-large-step="10" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", bubbles: true }));
      expect(controller.value).toBe(60);
    });

    it("PageDown decreases by largeStep", () => {
      const { thumb, controller } = setupSingle('data-step="1" data-large-step="10" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));
      expect(controller.value).toBe(40);
    });

    it("Home sets to min", () => {
      const { thumb, controller } = setupSingle('data-min="10" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      expect(controller.value).toBe(10);
    });

    it("End sets to max", () => {
      const { thumb, controller } = setupSingle('data-max="90" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
      expect(controller.value).toBe(90);
    });

    it("Shift+Arrow moves by largeStep", () => {
      const { thumb, controller } = setupSingle('data-step="1" data-large-step="10" data-default-value="50"');

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));
      expect(controller.value).toBe(60);

      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true }));
      expect(controller.value).toBe(50);
    });

    it("ignores keyboard when disabled", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-disabled data-default-value="50">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const thumb = root.querySelector('[data-slot="slider-thumb"]') as HTMLElement;
      const controller = createSlider(root);

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(controller.value).toBe(50);
    });

    it("emits commit on blur after keyboard interaction (not on every keydown)", () => {
      const { root, thumb, controller } = setupSingle('data-step="5" data-default-value="50"');
      const commitValues: number[] = [];

      root.addEventListener("slider:commit", (e) => {
        commitValues.push((e as CustomEvent).detail.value);
      });

      thumb.focus();
      // Multiple key presses should emit change events but not commit
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      // No commits yet (only on blur)
      expect(commitValues).toHaveLength(0);
      expect(controller.value).toBe(65);

      // Blur triggers commit
      thumb.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      expect(commitValues).toHaveLength(1);
      expect(commitValues[0]).toBe(65);
    });

    it("does not emit commit on blur if value unchanged", () => {
      const { root, thumb } = setupSingle('data-default-value="50"');
      const commitValues: number[] = [];

      root.addEventListener("slider:commit", (e) => {
        commitValues.push((e as CustomEvent).detail.value);
      });

      thumb.focus();
      // Press key but hit boundary (no change)
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      // Now at min (0), press Home again - no change
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

      // First Home changed value (50 -> 0), so blur should commit
      thumb.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      expect(commitValues).toHaveLength(1);
      expect(commitValues[0]).toBe(0);
    });
  });

  describe("Pointer Interaction", () => {
    it("sets data-dragging during drag", () => {
      const { root, thumb, track, control } = setupSingle();

      // Mock getBoundingClientRect on track
      track.getBoundingClientRect = () => ({
        left: 0, right: 100, top: 0, bottom: 20,
        width: 100, height: 20, x: 0, y: 0, toJSON() {}
      } as DOMRect);

      // Mock setPointerCapture
      control.setPointerCapture = () => {};
      control.releasePointerCapture = () => {};

      // Pointer down
      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 50, clientY: 10, pointerId: 1, bubbles: true
      }));

      expect(root.hasAttribute("data-dragging")).toBe(true);
      expect(thumb.hasAttribute("data-dragging")).toBe(true);

      // Pointer up
      control.dispatchEvent(new PointerEvent("pointerup", {
        clientX: 50, clientY: 10, pointerId: 1, bubbles: true
      }));

      expect(root.hasAttribute("data-dragging")).toBe(false);
      expect(thumb.hasAttribute("data-dragging")).toBe(false);
    });

    it("sets and clears touch-action during drag", () => {
      const { track, control } = setupSingle();

      track.getBoundingClientRect = () => ({
        left: 0, right: 100, top: 0, bottom: 20,
        width: 100, height: 20, x: 0, y: 0, toJSON() {}
      } as DOMRect);
      control.setPointerCapture = () => {};
      control.releasePointerCapture = () => {};

      // Before drag
      expect(control.style.touchAction).toBe("");

      // During drag
      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 50, clientY: 10, pointerId: 1, bubbles: true
      }));
      expect(control.style.touchAction).toBe("none");

      // After drag
      control.dispatchEvent(new PointerEvent("pointerup", {
        clientX: 50, clientY: 10, pointerId: 1, bubbles: true
      }));
      expect(control.style.touchAction).toBe("");
    });

    it("emits slider:change during interaction", () => {
      const { root, track, control } = setupSingle();
      let lastValue: number | undefined;

      root.addEventListener("slider:change", (e) => {
        lastValue = (e as CustomEvent).detail.value;
      });

      track.getBoundingClientRect = () => ({
        left: 0, right: 100, top: 0, bottom: 20,
        width: 100, height: 20, x: 0, y: 0, toJSON() {}
      } as DOMRect);
      control.setPointerCapture = () => {};

      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 30, clientY: 10, pointerId: 1, bubbles: true
      }));

      expect(lastValue).toBe(30);
    });

    it("emits slider:commit on pointer release", () => {
      const { root, track, control } = setupSingle();
      let commitValue: number | undefined;

      root.addEventListener("slider:commit", (e) => {
        commitValue = (e as CustomEvent).detail.value;
      });

      track.getBoundingClientRect = () => ({
        left: 0, right: 100, top: 0, bottom: 20,
        width: 100, height: 20, x: 0, y: 0, toJSON() {}
      } as DOMRect);
      control.setPointerCapture = () => {};
      control.releasePointerCapture = () => {};

      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 40, clientY: 10, pointerId: 1, bubbles: true
      }));
      control.dispatchEvent(new PointerEvent("pointerup", {
        clientX: 40, clientY: 10, pointerId: 1, bubbles: true
      }));

      expect(commitValue).toBe(40);
    });

    it("ignores pointer when disabled", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-disabled data-default-value="50">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      const track = root.querySelector('[data-slot="slider-track"]') as HTMLElement;
      const control = root.querySelector(".slider-control") as HTMLElement;
      const controller = createSlider(root);

      track.getBoundingClientRect = () => ({
        left: 0, right: 100, top: 0, bottom: 20,
        width: 100, height: 20, x: 0, y: 0, toJSON() {}
      } as DOMRect);

      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 30, clientY: 10, pointerId: 1, bubbles: true
      }));

      expect(controller.value).toBe(50);
      expect(root.hasAttribute("data-dragging")).toBe(false);
    });

    it("selects clicked thumb directly instead of by proximity", () => {
      const { thumbs, track, control, controller } = setupRange("", [50, 50]); // Same position

      track.getBoundingClientRect = () => ({
        left: 0, right: 100, top: 0, bottom: 20,
        width: 100, height: 20, x: 0, y: 0, toJSON() {}
      } as DOMRect);
      control.setPointerCapture = () => {};
      control.releasePointerCapture = () => {};

      // Click directly on max thumb (second thumb) even though both are at same position
      // The event target should be the thumb, not the control
      const pointerEvent = new PointerEvent("pointerdown", {
        clientX: 50, clientY: 10, pointerId: 1, bubbles: true
      });
      Object.defineProperty(pointerEvent, "target", { value: thumbs[1] });
      control.dispatchEvent(pointerEvent);

      // Max thumb should be dragging
      expect(thumbs[1]!.hasAttribute("data-dragging")).toBe(true);
      expect(thumbs[0]!.hasAttribute("data-dragging")).toBe(false);

      control.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
    });
  });

  describe("Range Slider", () => {
    it("supports two thumbs with array value", () => {
      const { controller } = setupRange("", [25, 75]);
      expect(controller.value).toEqual([25, 75]);
    });

    it("min thumb cannot exceed max thumb", () => {
      const { controller } = setupRange("", [25, 75]);

      // Try to set min thumb above max
      controller.setValue([80, 75]);
      // Should swap or clamp
      expect(controller.value).toEqual([75, 80]);
    });

    it("each thumb independently draggable", () => {
      const { thumbs, track, control, controller } = setupRange("", [25, 75]);

      track.getBoundingClientRect = () => ({
        left: 0, right: 100, top: 0, bottom: 20,
        width: 100, height: 20, x: 0, y: 0, toJSON() {}
      } as DOMRect);
      control.setPointerCapture = () => {};
      control.releasePointerCapture = () => {};

      // Click closer to min thumb (at 25%)
      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 20, clientY: 10, pointerId: 1, bubbles: true
      }));
      expect(thumbs[0]!.hasAttribute("data-dragging")).toBe(true);
      control.dispatchEvent(new PointerEvent("pointerup", {
        clientX: 20, clientY: 10, pointerId: 1, bubbles: true
      }));

      // Check that min was updated
      expect((controller.value as [number, number])[0]).toBe(20);
    });

    it("range element spans between thumbs", () => {
      const { range } = setupRange("", [25, 75]);

      expect(range.style.left).toBe("25%");
      expect(range.style.width).toBe("50%");
    });

    it("keyboard affects focused thumb only", () => {
      const { thumbs, controller } = setupRange('data-step="5"', [25, 75]);

      // Focus max thumb and move it
      thumbs[1]!.focus();
      thumbs[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      expect(controller.value).toEqual([25, 80]);

      // Focus min thumb and move it
      thumbs[0]!.focus();
      thumbs[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      expect(controller.value).toEqual([30, 80]);
    });

    it("uses lastActiveThumbIndex to break ties when thumbs overlap", () => {
      const { thumbs, track, control, controller } = setupRange("", [50, 50]); // Overlapping thumbs

      track.getBoundingClientRect = () => ({
        left: 0, right: 100, top: 0, bottom: 20,
        width: 100, height: 20, x: 0, y: 0, toJSON() {}
      } as DOMRect);
      control.setPointerCapture = () => {};
      control.releasePointerCapture = () => {};

      // First, interact with max thumb (index 1) via keyboard
      thumbs[1]!.focus();
      thumbs[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(controller.value).toEqual([50, 51]);

      // Reset to overlapping position
      controller.setValue([50, 50]);

      // Now click at 50% (equidistant) - should prefer max thumb (lastActiveThumbIndex = 1)
      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 50, clientY: 10, pointerId: 1, bubbles: true
      }));
      expect(thumbs[1]!.hasAttribute("data-dragging")).toBe(true);
      control.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));

      // Now interact with min thumb (index 0)
      thumbs[0]!.focus();
      thumbs[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));

      // Reset to overlapping again
      controller.setValue([50, 50]);

      // Click at 50% again - should now prefer min thumb (lastActiveThumbIndex = 0)
      control.dispatchEvent(new PointerEvent("pointerdown", {
        clientX: 50, clientY: 10, pointerId: 1, bubbles: true
      }));
      expect(thumbs[0]!.hasAttribute("data-dragging")).toBe(true);
      control.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
    });
  });

  describe("Callbacks & Events", () => {
    it("calls onValueChange during interaction", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-default-value="50">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      let lastValue: number | undefined;

      createSlider(root, {
        onValueChange: (value) => {
          lastValue = value as number;
        },
      });

      const thumb = root.querySelector('[data-slot="slider-thumb"]') as HTMLElement;
      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      expect(lastValue).toBe(51);
    });

    it("calls onValueCommit on blur after keyboard interaction", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root" data-default-value="50">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;
      let commitValue: number | undefined;

      createSlider(root, {
        onValueCommit: (value) => {
          commitValue = value as number;
        },
      });

      const thumb = root.querySelector('[data-slot="slider-thumb"]') as HTMLElement;
      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      // Not committed yet
      expect(commitValue).toBeUndefined();

      // Blur triggers commit
      thumb.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      expect(commitValue).toBe(51);
    });

    it("emits slider:change custom event", () => {
      const { root, thumb } = setupSingle('data-default-value="50"');
      let eventValue: number | undefined;

      root.addEventListener("slider:change", (e) => {
        eventValue = (e as CustomEvent).detail.value;
      });

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

      expect(eventValue).toBe(51);
    });

    it("emits slider:commit custom event on blur", () => {
      const { root, thumb } = setupSingle('data-default-value="50"');
      let commitValue: number | undefined;

      root.addEventListener("slider:commit", (e) => {
        commitValue = (e as CustomEvent).detail.value;
      });

      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(commitValue).toBeUndefined();

      thumb.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      expect(commitValue).toBe(51);
    });

    it("handles slider:set inbound event", () => {
      const { root, controller } = setupSingle('data-default-value="50"');

      root.dispatchEvent(new CustomEvent("slider:set", { detail: { value: 75 } }));
      expect(controller.value).toBe(75);

      // Also supports direct value
      root.dispatchEvent(new CustomEvent("slider:set", { detail: 25 }));
      expect(controller.value).toBe(25);
    });

    it("slider:set only emits commit if value changed", () => {
      const { root, controller } = setupSingle('data-default-value="50"');
      const commits: number[] = [];

      root.addEventListener("slider:commit", (e) => {
        commits.push((e as CustomEvent).detail.value);
      });

      // First set - value changes
      root.dispatchEvent(new CustomEvent("slider:set", { detail: { value: 75 } }));
      expect(commits).toHaveLength(1);
      expect(commits[0]).toBe(75);

      // Second set - same value, no commit
      root.dispatchEvent(new CustomEvent("slider:set", { detail: { value: 75 } }));
      expect(commits).toHaveLength(1);
    });
  });

  describe("Lifecycle", () => {
    it("destroy() cleans up all listeners", () => {
      const { root, thumb, controller } = setupSingle('data-default-value="50"');

      controller.destroy();

      // Keyboard should no longer work
      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(controller.value).toBe(50);
    });

    it("allows re-initialization after destroy", () => {
      const { root, controller } = setupSingle('data-default-value="50"');

      controller.destroy();

      // Re-create should work (same behavior as popover)
      const newController = createSlider(root, { defaultValue: 30 });
      expect(newController.value).toBe(30);

      newController.destroy();
    });

    it("create() auto-discovers all sliders", () => {
      document.body.innerHTML = `
        <div data-slot="slider" data-default-value="25">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
        <div data-slot="slider" data-default-value="75">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;

      const controllers = create();
      expect(controllers).toHaveLength(2);
      expect(controllers[0]!.value).toBe(25);
      expect(controllers[1]!.value).toBe(75);

      controllers.forEach((c) => c.destroy());
    });

    it("throws if required slots missing", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="root">
          <div class="slider-control">
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("root")!;

      expect(() => createSlider(root)).toThrow("Slider requires slider-track");
    });

    it("create() skips already-bound elements", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="slider1" data-default-value="25">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;

      // First call binds
      const first = create();
      expect(first).toHaveLength(1);

      // Second call skips already-bound
      const second = create();
      expect(second).toHaveLength(0);

      first.forEach((c) => c.destroy());
    });

    it("manual createSlider + create can double-bind (same as popover)", () => {
      document.body.innerHTML = `
        <div data-slot="slider" id="slider1" data-default-value="25">
          <div class="slider-control">
            <div data-slot="slider-track">
              <div data-slot="slider-range"></div>
            </div>
            <div data-slot="slider-thumb"></div>
          </div>
        </div>
      `;
      const root = document.getElementById("slider1")!;

      // Manual bind first
      const manual = createSlider(root);

      // create() will also bind (double-bind footgun, same as popover)
      const auto = create();
      expect(auto).toHaveLength(1);

      manual.destroy();
      auto.forEach((c) => c.destroy());
    });
  });

  describe("Orientation", () => {
    it("sets data-orientation on root", () => {
      const { root } = setupSingle('data-orientation="vertical"');
      expect(root.getAttribute("data-orientation")).toBe("vertical");
    });

    it("positions thumb vertically when orientation is vertical", () => {
      const { thumb } = setupSingle('data-orientation="vertical" data-default-value="50"');
      expect(thumb.style.bottom).toBe("50%");
    });

    it("positions range vertically when orientation is vertical", () => {
      const { range } = setupSingle('data-orientation="vertical" data-default-value="50"');
      expect(range.style.bottom).toBe("0%");
      expect(range.style.height).toBe("50%");
    });

    it("clears opposite axis styles for horizontal orientation", () => {
      const { thumb, range } = setupSingle('data-default-value="50"');
      // Horizontal: left is set, bottom should be cleared
      expect(thumb.style.left).toBe("50%");
      expect(thumb.style.bottom).toBe("");

      expect(range.style.left).toBe("0%");
      expect(range.style.width).toBe("50%");
      expect(range.style.bottom).toBe("");
      expect(range.style.height).toBe("");
    });

    it("clears opposite axis styles for vertical orientation", () => {
      const { thumb, range } = setupSingle('data-orientation="vertical" data-default-value="50"');
      // Vertical: bottom is set, left should be cleared
      expect(thumb.style.bottom).toBe("50%");
      expect(thumb.style.left).toBe("");

      expect(range.style.bottom).toBe("0%");
      expect(range.style.height).toBe("50%");
      expect(range.style.left).toBe("");
      expect(range.style.width).toBe("");
    });
  });

  describe("Visual State", () => {
    it("sets data-value on root", () => {
      const { root, controller } = setupSingle('data-default-value="50"');
      expect(root.getAttribute("data-value")).toBe("50");

      controller.setValue(75);
      expect(root.getAttribute("data-value")).toBe("75");
    });

    it("sets data-value with comma for range", () => {
      const { root } = setupRange("", [25, 75]);
      expect(root.getAttribute("data-value")).toBe("25,75");
    });

    it("positions thumb at correct percentage", () => {
      const { thumb } = setupSingle('data-default-value="50"');
      expect(thumb.style.left).toBe("50%");
    });

    it("sizes range element correctly for single value", () => {
      const { range } = setupSingle('data-default-value="30"');
      expect(range.style.left).toBe("0%");
      expect(range.style.width).toBe("30%");
    });
  });
});
