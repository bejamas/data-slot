# @data-slot/slider

Headless slider component for vanilla JavaScript. Supports single value and range sliders with full keyboard navigation and ARIA compliance.

## Installation

```bash
bun add @data-slot/slider
# or
npm install @data-slot/slider
```

## Usage

### HTML Structure

```html
<!-- Single value slider -->
<div data-slot="slider" data-default-value="50">
  <div data-slot="slider-track">
    <div data-slot="slider-range"></div>
  </div>
  <div data-slot="slider-thumb"></div>
</div>

<!-- Optional control wrapper -->
<div data-slot="slider" data-default-value="50">
  <div data-slot="slider-control">
    <div data-slot="slider-track">
      <div data-slot="slider-range"></div>
    </div>
    <div data-slot="slider-thumb"></div>
  </div>
</div>

<!-- Range slider (two thumbs) -->
<div data-slot="slider" data-default-value="25,75">
  <div data-slot="slider-track">
    <div data-slot="slider-range"></div>
  </div>
  <div data-slot="slider-thumb"></div>
  <div data-slot="slider-thumb"></div>
</div>
```

### JavaScript

```javascript
import { create, createSlider } from "@data-slot/slider";

// Auto-discover and bind all [data-slot="slider"] elements
const controllers = create();

// Or target a specific element
const slider = createSlider(element, {
  defaultValue: 50,
  min: 0,
  max: 100,
  step: 1,
  thumbAlignment: "edge",
  onValueChange: (value) => console.log("Changed:", value),
  onValueCommit: (value) => console.log("Committed:", value),
});

// Programmatic control
slider.setValue(75);
console.log(slider.value); // 75

// Cleanup
slider.destroy();
```

## API

### `create(scope?)`

Find and bind uninitialized `[data-slot="slider"]` descendants of `scope` (defaults to `document`). Returns `SliderController[]` for newly bound roots. To initialize the scope element itself, use `createSlider`.

```typescript
import { create } from "@data-slot/slider";

const controllers = create();
```

### `createSlider(root, options?)`

Create a `SliderController` for one root element. JavaScript options take precedence over the corresponding data attributes. Calling this again for a bound root returns its existing controller; destroy it before rebinding with new options.

```typescript
import { createSlider } from "@data-slot/slider";

const controller = createSlider(element, {});
```

### Options

JavaScript options take precedence over root data attributes.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultValue` | `number \| [number, number]` | `min` (single), `[min, min]` (range) | Initial value; clamped to the bounds and snapped to `step`. Two thumbs enable range mode. |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `100` | Maximum value |
| `step` | `number` | `1` | Step increment; non-positive values fall back to `1` |
| `largeStep` | `number` | `step * 10` | Increment for PageUp/PageDown and Shift+Arrow |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Slider orientation |
| `thumbAlignment` | `"center" \| "edge" \| "edge-client-only"` | `"center"` | Thumb placement at the track edges |
| `disabled` | `boolean` | `false` | Disable user interaction and inbound set events |
| `onValueChange` | `(value: number \| [number, number]) => void` | `undefined` | Called for value changes, including programmatic updates; silent on initialization and unchanged values |
| `onValueCommit` | `(value: number \| [number, number]) => void` | `undefined` | Called on pointer release/cancel, blur after a keyboard value change, or a changed `slider:set` update |

### Controller

| Method/Property | Description |
| --- | --- |
| `setValue(value: number \| [number, number])` | Update the value, including when disabled. Emits change when the value changes, but does not emit commit. |
| `value` | Current value (readonly `number \| [number, number]`) |
| `min` | Resolved minimum (readonly `number`) |
| `max` | Resolved maximum (readonly `number`) |
| `disabled` | Whether interaction is disabled (readonly `boolean`) |
| `destroy()` | Remove listeners and release the root binding |

## Data Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `data-default-value` | Initial value (`50` or `25,75` for range) | `min` (single), `[min, min]` (range) |
| `data-min` | Minimum value | `0` |
| `data-max` | Maximum value | `100` |
| `data-step` | Step increment | `1` |
| `data-large-step` | Large step for PageUp/PageDown | `step * 10` |
| `data-orientation` | `horizontal` or `vertical` | `horizontal` |
| `data-thumb-alignment` | `center`, `edge`, or `edge-client-only` | `center` |
| `data-disabled` | Disable the slider | - |

## Thumb Alignment

By default, slider thumbs are centered on the active value. That means the thumb can
extend beyond the track when the value is at `min` or `max`.

Use `thumbAlignment` or `data-thumb-alignment` to change that behavior:

- `"center"` - Default. The thumb is centered on the value and may overflow the track edges.
- `"edge"` - Insets the thumb so its edge aligns with the track edge at `min` and `max`.
- `"edge-client-only"` - Accepted for Base UI API parity. In this vanilla package it behaves the same as `"edge"`.

```html
<div data-slot="slider" data-default-value="25" data-thumb-alignment="edge">
  <div data-slot="slider-track">
    <div data-slot="slider-range"></div>
  </div>
  <div data-slot="slider-thumb"></div>
</div>
```

```javascript
createSlider(element, {
  defaultValue: 25,
  thumbAlignment: "edge",
});
```

## Events

### Outbound Events (on root)

| Event | Detail | Description |
|-------|--------|-------------|
| `slider:change` | `{ value: number \| [number, number] }` | Fires during value changes |
| `slider:commit` | `{ value: number \| [number, number] }` | Fires on pointer release/cancel, blur after a keyboard value change, or a changed `slider:set` update |

### Inbound Events (on root)

| Event | Detail | Description |
|-------|--------|-------------|
| `slider:set` | `{ value: number \| [number, number] }` | Set value programmatically |

```javascript
// Listen for changes
root.addEventListener("slider:change", (e) => {
  console.log("Value:", e.detail.value);
});

// Set value from outside
root.dispatchEvent(new CustomEvent("slider:set", {
  detail: { value: 50 }
}));

// Set range value
root.dispatchEvent(new CustomEvent("slider:set", {
  detail: { value: [25, 75] }
}));
```

**Note:** Blocked when slider is disabled.

### Deprecated Shapes

The following shapes are deprecated and will be removed in v1.0:

```javascript
// Deprecated: bare number
root.dispatchEvent(new CustomEvent("slider:set", {
  detail: 50
}));

// Deprecated: bare array
root.dispatchEvent(new CustomEvent("slider:set", {
  detail: [25, 75]
}));
```

Use `{ value: ... }` instead.

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `ArrowRight` / `ArrowLeft` | Increase / decrease by step in horizontal sliders |
| `ArrowUp` / `ArrowDown` | Increase / decrease by step in vertical sliders |
| `PageUp` | Increase by largeStep |
| `PageDown` | Decrease by largeStep |
| `Home` | Set to min |
| `End` | Set to max |
| `Shift+Arrow` | Move by largeStep |

## Styling

The component sets data attributes and inline styles for CSS hooks:

```css
/* Root state */
[data-slot="slider"][data-orientation="horizontal"] { ... }
[data-slot="slider"][data-orientation="vertical"] { ... }
[data-slot="slider"][data-disabled] { ... }
[data-slot="slider"][data-dragging] { ... }

/* Parts mirror shared state for shadcn/Base-style selectors */
[data-slot="slider-track"][data-orientation="horizontal"] { ... }
[data-slot="slider-track"][data-orientation="vertical"] { ... }
[data-slot="slider-range"][data-orientation="horizontal"] { ... }
[data-slot="slider-range"][data-orientation="vertical"] { ... }
[data-slot="slider-track"][data-disabled] { ... }
[data-slot="slider-range"][data-disabled] { ... }
[data-slot="slider-thumb"][data-orientation="horizontal"] { ... }
[data-slot="slider-thumb"][data-orientation="vertical"] { ... }
[data-slot="slider-thumb"][data-disabled] { ... }

/* Thumb positioning (set automatically) */
[data-slot="slider-thumb"] {
  position: absolute;
  /* --position: X%; inset-inline-start/top or bottom/left are applied inline */
  /* translate is applied inline to center the thumb on the resolved visual position */
}

/* Range thumbs expose their index */
[data-slot="slider-thumb"][data-index="0"] { ... }
[data-slot="slider-thumb"][data-index="1"] { ... }

/* Range positioning (set automatically) */
[data-slot="slider-range"] {
  /* horizontal: relative + inset-inline-start/width */
  /* vertical: absolute + bottom/height */
}

/* Thumb dragging state */
[data-slot="slider-thumb"][data-dragging] { ... }
```

`slider-track`, `slider-range`, and `slider-thumb` also get Base-style inline layout
styles from the controller. The runtime owns the track's `position: relative`, the
range's start/size positioning, and the thumb's absolute position / translate, so
authors only need to supply visual styles unless they intentionally want to override
that layout behavior.

When `thumbAlignment` is `"edge"` or `"edge-client-only"`, the runtime measures the
track and thumb size to keep the thumb inside the visible track. In those modes,
`--position` and the range start/size vars represent rendered layout positions rather
than raw value percentages.

## Accessibility

Each thumb element receives:
- `role="slider"`
- `tabindex="0"`
- `aria-valuemin` / `aria-valuemax` / `aria-valuenow`
- `aria-orientation`
- `aria-disabled` (when disabled)
- `aria-label` (from `data-label` or auto-generated for range)

`slider-track`, `slider-range`, and `slider-thumb` also mirror the root's
`data-orientation` and `data-disabled` attrs for styling. `slider-control` is optional;
when omitted, the root acts as the interactive control surface.

## License

MIT
