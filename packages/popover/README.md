# @data-slot/popover

Headless popover component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/popover
```

## Quick Start

```html
<div data-slot="popover">
  <button data-slot="popover-trigger">Open Popover</button>
  <div data-slot="popover-content" hidden>
    <p>Popover content here</p>
    <button data-slot="popover-close">Close</button>
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/popover";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all popover instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/popover";

const controllers = create(); // Returns PopoverController[]
```

### `createPopover(root, options?)`

Create a controller for a specific element.

```typescript
import { createPopover } from "@data-slot/popover";

const popover = createPopover(element, {
  defaultOpen: false,
  side: "bottom",
  align: "center",
  sideOffset: 4,
  alignOffset: 0,
  avoidCollisions: true,
  collisionPadding: 8,
  closeOnClickOutside: true,
  closeOnEscape: true,
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Preferred side relative to trigger |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Preferred alignment on the side axis |
| `sideOffset` | `number` | `4` | Distance from trigger in pixels |
| `alignOffset` | `number` | `0` | Offset from alignment edge in pixels |
| `avoidCollisions` | `boolean` | `true` | Flip/shift to stay in viewport |
| `collisionPadding` | `number` | `8` | Viewport edge padding in pixels |
| `position` | `"top" \| "bottom" \| "left" \| "right"` | - | Deprecated alias for `side` |
| `closeOnClickOutside` | `boolean` | `true` | Close when clicking outside |
| `closeOnEscape` | `boolean` | `true` | Close when pressing Escape |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when open state changes |

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `open()` | Open the popover |
| `close()` | Close the popover |
| `toggle()` | Toggle the popover |
| `isOpen` | Current open state (readonly `boolean`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<div data-slot="popover">
  <button data-slot="popover-trigger">Trigger</button>
  <div data-slot="popover-content">
    Content
    <button data-slot="popover-close">Close</button>
  </div>
</div>
```

### Required Slots

- `popover-trigger` - Button to toggle popover
- `popover-content` - The popover panel

### Optional Slots

- `popover-close` - Button to close the popover

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence over data attributes.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-open` | boolean | `false` | Initial open state |
| `data-side` | string | `"bottom"` | Preferred side |
| `data-align` | string | `"center"` | Preferred alignment |
| `data-side-offset` | number | `4` | Distance from trigger (px) |
| `data-align-offset` | number | `0` | Offset from alignment edge (px) |
| `data-avoid-collisions` | boolean | `true` | Flip/shift to stay in viewport |
| `data-collision-padding` | number | `8` | Viewport edge padding (px) |
| `data-close-on-click-outside` | boolean | `true` | Close when clicking outside |
| `data-close-on-escape` | boolean | `true` | Close when pressing Escape |

Boolean attributes: present or `"true"` = true, `"false"` = false, absent = default.

Placement can be set on root or content (content takes precedence):

```html
<div data-slot="popover-content" data-side="top" data-align="end">
```

`data-position` is still supported as a deprecated fallback alias for `data-side`.

```html
<!-- Popover that stays open when clicking outside -->
<div data-slot="popover" data-close-on-click-outside="false">
  ...
</div>
```

## Styling

Popover position is computed in JavaScript and applied as `position: fixed` + inline `top/left`.
Use `data-state`, `data-side`, and `data-align` for styling/animation:

```css
/* Hidden state */
[data-slot="popover-content"][hidden] {
  display: none;
}

[data-slot="popover-content"] {
  position: fixed;
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}

[data-slot="popover-content"][hidden][data-side="top"] {
  transform: translateY(4px);
}
[data-slot="popover-content"][hidden][data-side="bottom"] {
  transform: translateY(-4px);
}
[data-slot="popover-content"][hidden][data-side="left"] {
  transform: translateX(4px);
}
[data-slot="popover-content"][hidden][data-side="right"] {
  transform: translateX(-4px);
}
```

With Tailwind:

```html
<div data-slot="popover">
  <button data-slot="popover-trigger">Open</button>
  <div
    data-slot="popover-content"
    data-side="bottom"
    data-align="start"
    class="fixed bg-white shadow-lg rounded-lg p-4 transition data-[state=closed]:opacity-0"
  >
    Content
  </div>
</div>
```

## Accessibility

The component automatically handles:

- `aria-haspopup="dialog"` on trigger
- `aria-controls` linking trigger to content
- `aria-expanded` state on trigger
- Unique ID generation for content

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Toggle popover (on trigger) |
| `Escape` | Close popover and return focus to trigger |

## Events

### Outbound Events

Listen for changes via custom events:

```javascript
element.addEventListener("popover:change", (e) => {
  console.log("Popover open:", e.detail.open);
});
```

### Inbound Events

Control the popover via events:

| Event | Detail | Description |
|-------|--------|-------------|
| `popover:set` | `{ open: boolean }` | Set open state programmatically |

```javascript
// Open the popover
element.dispatchEvent(
  new CustomEvent("popover:set", { detail: { open: true } })
);

// Close the popover
element.dispatchEvent(
  new CustomEvent("popover:set", { detail: { open: false } })
);
```

#### Deprecated Shapes

The following shapes are deprecated and will be removed in the next major release:

- `popover:set` detail `{ value: boolean }` (use `{ open: boolean }`)
- `position` option (use `side`)
- `data-position` attribute (use `data-side`)

```javascript
// Deprecated: { value: boolean }
element.dispatchEvent(
  new CustomEvent("popover:set", { detail: { value: true } })
);
```

Use the replacements listed above.

## License

MIT
