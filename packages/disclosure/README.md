# @data-slot/disclosure

Headless disclosure (show/hide) component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/disclosure
```

## Quick Start

```html
<div data-slot="disclosure">
  <button data-slot="disclosure-trigger">Toggle Content</button>
  <div data-slot="disclosure-content" hidden>
    Hidden content revealed on click.
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/disclosure";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all disclosure instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/disclosure";

const controllers = create(); // Returns DisclosureController[]
```

### `createDisclosure(root, options?)`

Create a controller for a specific element.

```typescript
import { createDisclosure } from "@data-slot/disclosure";

const disclosure = createDisclosure(element, {
  defaultOpen: false,
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when open state changes |

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `open()` | Open the disclosure |
| `close()` | Close the disclosure |
| `toggle()` | Toggle the disclosure |
| `isOpen` | Current open state (readonly `boolean`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<div data-slot="disclosure">
  <button data-slot="disclosure-trigger">Toggle</button>
  <div data-slot="disclosure-content">Content</div>
</div>
```

Both `disclosure-trigger` and `disclosure-content` are required.

## Styling

Use `data-state` attributes for CSS styling:

```css
/* Hidden state */
[data-slot="disclosure-content"][hidden] {
  display: none;
}

/* Or use data-state */
[data-slot="disclosure"][data-state="closed"] [data-slot="disclosure-content"] {
  display: none;
}

/* Animate */
[data-slot="disclosure-content"] {
  overflow: hidden;
  transition: max-height 0.3s;
  max-height: 0;
}

[data-slot="disclosure"][data-state="open"] [data-slot="disclosure-content"] {
  max-height: 500px;
}
```

With Tailwind:

```html
<div data-slot="disclosure" class="group">
  <button data-slot="disclosure-trigger" class="flex items-center gap-2">
    <span>Show more</span>
    <svg class="group-data-[state=open]:rotate-180 transition-transform">...</svg>
  </button>
  <div data-slot="disclosure-content" class="hidden group-data-[state=open]:block">
    Content here
  </div>
</div>
```

## Accessibility

The component automatically handles:

- `aria-expanded` state on trigger
- `aria-controls` linking trigger to content
- Unique ID generation for content

## Events

Listen for changes via custom events:

```javascript
element.addEventListener("disclosure:change", (e) => {
  console.log("Disclosure open:", e.detail.open);
});
```

## License

MIT

