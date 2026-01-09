# @data-slot/accordion

Headless accordion component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/accordion
```

## Quick Start

```html
<div data-slot="accordion">
  <div data-slot="accordion-item" data-value="one">
    <button data-slot="accordion-trigger">Section One</button>
    <div data-slot="accordion-content">Content for section one</div>
  </div>
  <div data-slot="accordion-item" data-value="two">
    <button data-slot="accordion-trigger">Section Two</button>
    <div data-slot="accordion-content">Content for section two</div>
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/accordion";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all accordion instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/accordion";

const controllers = create(); // Returns AccordionController[]
```

### `createAccordion(root, options?)`

Create a controller for a specific element.

```typescript
import { createAccordion } from "@data-slot/accordion";

const accordion = createAccordion(element, {
  multiple: true,
  defaultValue: ["one"],
  collapsible: true,
  onValueChange: (values) => console.log(values),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `multiple` | `boolean` | `false` | Allow multiple items open at once |
| `defaultValue` | `string \| string[]` | `undefined` | Initially expanded item(s) |
| `collapsible` | `boolean` | `true` | Whether items can be fully collapsed (single mode only) |
| `onValueChange` | `(value: string[]) => void` | `undefined` | Callback when expanded items change |

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `expand(value)` | Expand an item by value |
| `collapse(value)` | Collapse an item by value |
| `toggle(value)` | Toggle an item by value |
| `value` | Currently expanded values (readonly `string[]`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<div data-slot="accordion">
  <div data-slot="accordion-item" data-value="unique-id">
    <button data-slot="accordion-trigger">Trigger</button>
    <div data-slot="accordion-content">Content</div>
  </div>
</div>
```

## Styling

Use `data-state` attributes for CSS styling:

```css
/* Closed state */
[data-slot="accordion-content"][data-state="closed"] {
  display: none;
}

/* Open state */
[data-slot="accordion-content"][data-state="open"] {
  display: block;
}

/* Animate with grid */
[data-slot="accordion-item"] {
  display: grid;
  grid-template-rows: auto 0fr;
  transition: grid-template-rows 0.3s;
}

[data-slot="accordion-item"][data-state="open"] {
  grid-template-rows: auto 1fr;
}

[data-slot="accordion-content"] {
  overflow: hidden;
}
```

With Tailwind:

```html
<div data-slot="accordion-item" class="grid grid-rows-[auto_0fr] data-[state=open]:grid-rows-[auto_1fr] transition-[grid-template-rows]">
  <button data-slot="accordion-trigger">...</button>
  <div data-slot="accordion-content" class="overflow-hidden">...</div>
</div>
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Toggle focused item |
| `ArrowDown` | Move focus to next trigger |
| `ArrowUp` | Move focus to previous trigger |
| `Home` | Move focus to first trigger |
| `End` | Move focus to last trigger |

## Events

Listen for changes via custom events:

```javascript
element.addEventListener("accordion:change", (e) => {
  console.log("Expanded items:", e.detail.value);
});
```

## License

MIT

