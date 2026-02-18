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
  hiddenUntilFound: false,
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `hiddenUntilFound` | `boolean` | `false` | Use `hidden="until-found"` when closed |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when open state changes (not called on init) |

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-open` | boolean | `false` | Initial open state |
| `data-hidden-until-found` | boolean | `false` | Use `hidden="until-found"` when closed |

Boolean attributes: present or `"true"` = true, `"false"` = false, absent = default.

```html
<!-- Start expanded -->
<div data-slot="collapsible" data-default-open>
  ...
</div>
```

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

/* Presence lifecycle markers */
[data-slot="collapsible-content"][data-starting-style] {
  opacity: 0;
}

[data-slot="collapsible-content"][data-ending-style] {
  opacity: 0;
}
```

## CSS Variables

The content element exposes size variables you can use for dimension animations:

| Variable | Description |
|----------|-------------|
| `--collapsible-panel-height` | The measured panel height |
| `--collapsible-panel-width` | The measured panel width |

Example:

```css
[data-slot="collapsible-content"] {
  height: var(--collapsible-panel-height);
  width: var(--collapsible-panel-width);
}
```

## Find-in-Page Support

Enable `hiddenUntilFound` (or `data-hidden-until-found`) to close panels with
`hidden="until-found"`. This allows browser find-in-page to reveal matching text.

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

### Outbound Events

Listen for changes via custom events:

```javascript
element.addEventListener("collapsible:change", (e) => {
  console.log("Collapsible open:", e.detail.open);
});
```

### Inbound Events

Control the collapsible via events:

| Event | Detail | Description |
|-------|--------|-------------|
| `collapsible:set` | `{ open: boolean }` | Set open state programmatically |

```javascript
// Open the collapsible
element.dispatchEvent(
  new CustomEvent("collapsible:set", { detail: { open: true } })
);

// Close the collapsible
element.dispatchEvent(
  new CustomEvent("collapsible:set", { detail: { open: false } })
);
```

**Note:** Blocked when trigger is disabled (has `disabled` attribute or `aria-disabled="true"`).

#### Deprecated Shapes

The following shape is deprecated and will be removed in v1.0:

```javascript
// Deprecated: { value: boolean }
element.dispatchEvent(
  new CustomEvent("collapsible:set", { detail: { value: true } })
);
```

Use `{ open: boolean }` instead.

## License

MIT
