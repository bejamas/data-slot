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
  position: "bottom",
  closeOnClickOutside: true,
  closeOnEscape: true,
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `position` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Position relative to trigger |
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

Set position via HTML:

```html
<div data-slot="popover-content" data-position="top">
```

## Styling

Use `data-state` and `data-position` attributes:

```css
/* Hidden state */
[data-slot="popover-content"][hidden] {
  display: none;
}

/* Positioning */
[data-slot="popover"] {
  position: relative;
}

[data-slot="popover-content"] {
  position: absolute;
}

[data-slot="popover-content"][data-position="top"] {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
}

[data-slot="popover-content"][data-position="bottom"] {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
}

[data-slot="popover-content"][data-position="left"] {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
}

[data-slot="popover-content"][data-position="right"] {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
}
```

With Tailwind:

```html
<div data-slot="popover" class="relative">
  <button data-slot="popover-trigger">Open</button>
  <div 
    data-slot="popover-content" 
    class="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white shadow-lg rounded-lg p-4 hidden data-[state=open]:block"
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

Listen for changes via custom events:

```javascript
element.addEventListener("popover:change", (e) => {
  console.log("Popover open:", e.detail.open);
});
```

## License

MIT

