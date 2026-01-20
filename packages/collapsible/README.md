# @data-slot/collapsible

Headless collapsible (show/hide) component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/collapsible
```

## Quick Start

```html
<div data-slot="collapsible">
  <button data-slot="collapsible-trigger">Toggle Content</button>
  <div data-slot="collapsible-content" hidden>
    Hidden content revealed on click.
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/collapsible";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all collapsible instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/collapsible";

const controllers = create(); // Returns CollapsibleController[]
```

### `createCollapsible(root, options?)`

Create a controller for a specific element.

```typescript
import { createCollapsible } from "@data-slot/collapsible";

const collapsible = createCollapsible(element, {
  defaultOpen: false,
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when open state changes (not called on init) |

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `open()` | Open the collapsible |
| `close()` | Close the collapsible |
| `toggle()` | Toggle the collapsible |
| `isOpen` | Current open state (readonly `boolean`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<div data-slot="collapsible">
  <button data-slot="collapsible-trigger">Toggle</button>
  <div data-slot="collapsible-content">Content</div>
</div>
```

Both `collapsible-trigger` and `collapsible-content` are required.

## Styling

Use `data-state` attributes for CSS styling (available on both root and content):

```css
/* Hidden state */
[data-slot="collapsible-content"][hidden] {
  display: none;
}

/* Or use data-state */
[data-slot="collapsible"][data-state="closed"] [data-slot="collapsible-content"] {
  display: none;
}

/* Animate using data-state on content */
[data-slot="collapsible-content"] {
  overflow: hidden;
  transition: max-height 0.3s;
  max-height: 0;
}

[data-slot="collapsible-content"][data-state="open"] {
  max-height: 500px;
}
```

With Tailwind:

```html
<div data-slot="collapsible" class="group">
  <button data-slot="collapsible-trigger" class="flex items-center gap-2">
    <span>Show more</span>
    <svg class="group-data-[state=open]:rotate-180 transition-transform">...</svg>
  </button>
  <div data-slot="collapsible-content" class="hidden group-data-[state=open]:block">
    Content here
  </div>
</div>
```

## Accessibility

The component automatically handles:

- `aria-expanded` state on trigger
- `aria-controls` linking trigger to content
- `role="region"` on content
- `aria-labelledby` linking content back to trigger
- Unique ID generation for trigger and content
- Disabled trigger support (respects `disabled` attribute and `aria-disabled="true"`)

## Events

Listen for changes via custom events:

```javascript
element.addEventListener("collapsible:change", (e) => {
  console.log("Collapsible open:", e.detail.open);
});
```

## License

MIT
