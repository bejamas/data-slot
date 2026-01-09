# @data-slot/tooltip

Headless tooltip component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/tooltip
```

## Quick Start

```html
<div data-slot="tooltip">
  <button data-slot="tooltip-trigger">Hover me</button>
  <div data-slot="tooltip-content" role="tooltip" hidden>
    Helpful tooltip text
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/tooltip";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all tooltip instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/tooltip";

const controllers = create(); // Returns TooltipController[]
```

### `createTooltip(root, options?)`

Create a controller for a specific element.

```typescript
import { createTooltip } from "@data-slot/tooltip";

const tooltip = createTooltip(element, {
  delay: 300,
  skipDelayDuration: 300,
  position: "top",
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delay` | `number` | `300` | Delay before showing tooltip (ms) |
| `skipDelayDuration` | `number` | `300` | Duration to skip delay after closing (ms). Set to `0` to disable. |
| `position` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Position relative to trigger |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when visibility changes |

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `show()` | Show the tooltip immediately |
| `hide()` | Hide the tooltip |
| `isOpen` | Current visibility state (readonly `boolean`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<div data-slot="tooltip">
  <button data-slot="tooltip-trigger">Trigger</button>
  <div data-slot="tooltip-content" role="tooltip">Content</div>
</div>
```

Both `tooltip-trigger` and `tooltip-content` are required.

### Data Attributes

Set position via HTML:

```html
<div data-slot="tooltip-content" data-position="bottom" role="tooltip">
```

## Styling

### Basic Styling

```css
/* Hidden state */
[data-slot="tooltip-content"][hidden] {
  display: none;
}

/* Positioning */
[data-slot="tooltip"] {
  position: relative;
}

[data-slot="tooltip-content"] {
  position: absolute;
  white-space: nowrap;
}

[data-slot="tooltip-content"][data-position="top"] {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
}

[data-slot="tooltip-content"][data-position="bottom"] {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}

[data-slot="tooltip-content"][data-position="left"] {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 8px;
}

[data-slot="tooltip-content"][data-position="right"] {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
}
```

### Animations

```css
[data-slot="tooltip-content"] {
  opacity: 0;
  transition: opacity 0.15s;
}

[data-slot="tooltip"][data-state="open"] [data-slot="tooltip-content"] {
  opacity: 1;
}

/* Skip transition during warm-up (instant show) */
[data-slot="tooltip-content"][data-instant] {
  transition: none;
}
```

### Tailwind Example

```html
<div data-slot="tooltip" class="relative inline-block group">
  <button data-slot="tooltip-trigger">
    Hover me
  </button>
  <div 
    data-slot="tooltip-content" 
    data-position="top"
    role="tooltip"
    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-data-[state=open]:opacity-100 transition-opacity pointer-events-none"
  >
    Tooltip text
  </div>
</div>
```

## Warm-up Behavior

When a user closes one tooltip and quickly hovers another, the second tooltip shows instantly (no delay). This creates a fluid browsing experience similar to native OS tooltips.

- Controlled by `skipDelayDuration` option
- Set to `0` to disable this behavior
- The `data-instant` attribute is set when showing instantly (use to skip CSS transitions)

## Accessibility

The component automatically handles:

- `role="tooltip"` on content
- `aria-describedby` linking trigger to content
- Unique ID generation for content

## Keyboard & Interaction

| Action | Behavior |
|--------|----------|
| Mouse enter | Show after delay |
| Mouse leave | Hide immediately |
| Focus | Show after delay |
| Blur | Hide immediately |
| `Escape` | Hide immediately |

## Events

Listen for changes via custom events:

```javascript
element.addEventListener("tooltip:change", (e) => {
  console.log("Tooltip visible:", e.detail.open);
});
```

## License

MIT

