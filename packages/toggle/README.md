# @data-slot/toggle

Headless toggle button component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/toggle
```

## Quick Start

```html
<button data-slot="toggle">Bold</button>
<button data-slot="toggle" data-default-pressed>Italic</button>

<script type="module">
  import { create } from "@data-slot/toggle";

  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all toggle instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/toggle";

const controllers = create(); // Returns ToggleController[]
```

### `createToggle(root, options?)`

Create a controller for a specific element.

```typescript
import { createToggle } from "@data-slot/toggle";

const toggle = createToggle(element, {
  defaultPressed: false,
  disabled: false,
  onPressedChange: (pressed) => console.log(pressed),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultPressed` | `boolean` | `false` | Initial pressed state |
| `disabled` | `boolean` | `false` | Disabled state |
| `onPressedChange` | `(pressed: boolean) => void` | `undefined` | Callback when state changes |

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-pressed` | boolean | `false` | Initial pressed state |
| `data-disabled` | boolean | `false` | Disabled state |

```html
<!-- Initially pressed toggle -->
<button data-slot="toggle" data-default-pressed>Bold</button>
```

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `toggle()` | Toggle the pressed state (ignores disabled) |
| `press()` | Set pressed to true (ignores disabled) |
| `release()` | Set pressed to false (ignores disabled) |
| `pressed` | Current pressed state (readonly `boolean`) |
| `destroy()` | Cleanup all event listeners |

**Note:** Controller methods always work, even when disabled. This allows programmatic control regardless of user interaction state. If you need to check disabled state before calling controller methods, check the element's attributes yourself.

## Markup Structure

```html
<button data-slot="toggle">Label</button>
```

The toggle is a simple single-element component. Always use a native `<button>` element—keyboard support (Enter/Space) and focus handling are only guaranteed with `<button>`. Non-button elements (e.g., `<div>`, `<span>`) are not recommended and would require manual keyboard handling.

## Styling

### State Attributes

The component sets these attributes for styling:

- `aria-pressed="true|false"` - ARIA state
- `data-state="on|off"` - CSS styling hook

### Basic Styling

```css
/* Unpressed state */
[data-slot="toggle"] {
  background: #e5e7eb;
  border: none;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

/* Pressed state */
[data-slot="toggle"][data-state="on"] {
  background: #3b82f6;
  color: white;
}

/* Or use aria-pressed */
[data-slot="toggle"][aria-pressed="true"] {
  background: #3b82f6;
  color: white;
}

/* Disabled state */
[data-slot="toggle"][aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Tailwind Example

```html
<button
  data-slot="toggle"
  class="px-4 py-2 rounded bg-gray-200 data-[state=on]:bg-blue-500 data-[state=on]:text-white aria-disabled:opacity-50"
>
  Bold
</button>
```

## Keyboard Support

The toggle uses a native `<button>` element, so keyboard support is automatic:

| Key | Action |
|-----|--------|
| `Enter` | Toggle state |
| `Space` | Toggle state |

## Disabled Behavior

When disabled (via `disabled` option, `data-disabled` attribute, native `disabled` attribute, or `aria-disabled="true"`):

| Input | Blocked? |
|-------|----------|
| Click / Enter / Space | Yes |
| `toggle:set` event | Yes |
| Controller methods (`toggle()`, `press()`, `release()`) | No |

For `<button>` elements, the `disabled` option sets both the native `disabled` attribute and `aria-disabled="true"`. For other elements, only `aria-disabled` is set.

## Accessibility

The component automatically handles:

- `aria-pressed` state on the button
- Native `disabled` and `aria-disabled` when disabled (for buttons)
- `type="button"` to prevent form submission

## Events

### Outbound Events

Listen for changes via custom events:

```javascript
element.addEventListener("toggle:change", (e) => {
  console.log("Pressed:", e.detail.pressed);
});
```

### Inbound Events

Control the toggle via events (ignored when disabled):

| Event | Detail | Description |
|-------|--------|-------------|
| `toggle:set` | `{ value: boolean }` | Set pressed state programmatically |

```javascript
// Set to specific state
element.dispatchEvent(
  new CustomEvent("toggle:set", { detail: { value: true } })
);
```

### Deprecated Shapes

The following shapes are deprecated and will be removed in v1.0:

```javascript
// Deprecated: boolean detail
element.dispatchEvent(
  new CustomEvent("toggle:set", { detail: true })
);

// Deprecated: { pressed } shape
element.dispatchEvent(
  new CustomEvent("toggle:set", { detail: { pressed: true } })
);
```

Use `{ value: boolean }` instead.

## License

MIT
