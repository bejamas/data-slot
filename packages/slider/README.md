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
  <div class="slider-control">
    <div data-slot="slider-track">
      <div data-slot="slider-range"></div>
    </div>
    <div data-slot="slider-thumb"></div>
  </div>
</div>

<!-- Range slider (two thumbs) -->
<div data-slot="slider" data-default-value="25,75">
  <div class="slider-control">
    <div data-slot="slider-track">
      <div data-slot="slider-range"></div>
    </div>
    <div data-slot="slider-thumb"></div>
    <div data-slot="slider-thumb"></div>
  </div>
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
  onValueChange: (value) => console.log("Changed:", value),
  onValueCommit: (value) => console.log("Committed:", value),
});

// Programmatic control
slider.setValue(75);
console.log(slider.value); // 75

// Cleanup
slider.destroy();
```

## Data Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `data-default-value` | Initial value (`50` or `25,75` for range) | `min` |
| `data-min` | Minimum value | `0` |
| `data-max` | Maximum value | `100` |
| `data-step` | Step increment | `1` |
| `data-large-step` | Large step for PageUp/PageDown | `step * 10` |
| `data-orientation` | `horizontal` or `vertical` | `horizontal` |
| `data-disabled` | Disable the slider | - |

## Events

### Outbound Events (on root)

| Event | Detail | Description |
|-------|--------|-------------|
| `slider:change` | `{ value: number \| [number, number] }` | Fires during value changes |
| `slider:commit` | `{ value: number \| [number, number] }` | Fires when interaction ends |

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
| `ArrowRight` / `ArrowUp` | Increase by step |
| `ArrowLeft` / `ArrowDown` | Decrease by step |
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

/* Thumb positioning (set automatically) */
[data-slot="slider-thumb"] {
  position: absolute;
  /* left: X% (horizontal) or bottom: X% (vertical) */
}

/* Range positioning (set automatically) */
[data-slot="slider-range"] {
  position: absolute;
  /* left + width (horizontal) or bottom + height (vertical) */
}

/* Thumb dragging state */
[data-slot="slider-thumb"][data-dragging] { ... }
```

## Accessibility

Each thumb element receives:
- `role="slider"`
- `tabindex="0"`
- `aria-valuemin` / `aria-valuemax` / `aria-valuenow`
- `aria-orientation`
- `aria-disabled` (when disabled)
- `aria-label` (from `data-label` or auto-generated for range)

## License

MIT
