# @data-slot/accordion

Headless accordion component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/accordion
```

## Quick Start

```html
<div data-slot="accordion" data-default-value="one">
  <div data-slot="accordion-item" data-value="one">
    <button data-slot="accordion-trigger">
      <span>Section One</span>
      <svg data-slot="accordion-trigger-icon" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M6.75 0H5.25V5.25H0V6.75H5.25V12H6.75V6.75H12V5.25H6.75V0Z" />
      </svg>
    </button>
    <div data-slot="accordion-content">
      <div data-slot="accordion-content-inner">Content for section one</div>
    </div>
  </div>
  <div data-slot="accordion-item" data-value="two">
    <button data-slot="accordion-trigger">Section Two</button>
    <div data-slot="accordion-content">
      <div data-slot="accordion-content-inner">Content for section two</div>
    </div>
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
  orientation: "vertical",
  loopFocus: true,
  hiddenUntilFound: false,
  onValueChange: (values) => console.log(values),
});
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `multiple` | `boolean` | `false` | Allow multiple items open at once |
| `defaultValue` | `string \| string[]` | `undefined` | Initially expanded item(s) |
| `disabled` | `boolean` | `false` | Disable all user interaction for the accordion |
| `orientation` | `"horizontal" \| "vertical"` | `"vertical"` | Controls roving-focus arrow keys |
| `loopFocus` | `boolean` | `true` | Wrap roving focus at the ends |
| `hiddenUntilFound` | `boolean` | `false` | Use `hidden="until-found"` on closed panels |
| `onValueChange` | `(value: string[]) => void` | `undefined` | Callback when expanded items change |
| `collapsible` | `boolean` | `true` | Deprecated single-mode alias for “can close the last open item” |

### Deprecated Option

The following option is deprecated and will be removed in the next major release:

```typescript
createAccordion(element, {
  // Deprecated: use the default Base UI-style collapsible behavior instead.
  collapsible: false,
});
```

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence.

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `data-multiple` | `boolean` | `false` | Allow multiple items open at once |
| `data-default-value` | `string` | none | Initially expanded item, or a JSON array string for multiple defaults |
| `data-disabled` | `boolean` | `false` | Disable the entire accordion |
| `data-orientation` | `"horizontal" \| "vertical"` | `"vertical"` | Controls roving-focus arrow keys |
| `data-loop-focus` | `boolean` | `true` | Wrap roving focus at the ends |
| `data-hidden-until-found` | `boolean` | `false` | Use `hidden="until-found"` on closed panels |
| `data-collapsible` | `boolean` | `true` | Deprecated single-mode compatibility alias |

Boolean attributes: present or `"true"` = true, `"false"` = false, absent = default.

```html
<div
  data-slot="accordion"
  data-multiple
  data-default-value="one"
  data-orientation="horizontal"
>
  ...
</div>
```

For multiple default items in HTML, encode the value as JSON:

```html
<div
  data-slot="accordion"
  data-multiple
  data-default-value='["one","two"]'
>
  ...
</div>
```

### Controller

| Method/Property | Description |
| --- | --- |
| `expand(value)` | Expand an item by value |
| `collapse(value)` | Collapse an item by value |
| `toggle(value)` | Toggle an item by value |
| `value` | Currently expanded values (readonly `string[]`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<div data-slot="accordion">
  <div data-slot="accordion-item" data-value="unique-id">
    <button data-slot="accordion-trigger">
      <span>Trigger</span>
      <span data-slot="accordion-trigger-icon">+</span>
    </button>
    <div data-slot="accordion-content">
      <div data-slot="accordion-content-inner">Content</div>
    </div>
  </div>
</div>
```

`data-slot="accordion-trigger-icon"` and `data-slot="accordion-content-inner"` are optional styling hooks.

## Styling

### State Hooks

The accordion exposes these useful styling hooks:

| Element | Hooks |
| --- | --- |
| root | `data-disabled`, `data-orientation` |
| item | `data-state`, `data-open`, `data-closed`, `data-index`, `data-disabled` |
| trigger | `data-state`, `data-panel-open`, `data-disabled`, `aria-expanded` |
| content | `data-state`, `data-open`, `data-closed`, `data-index`, `data-disabled`, `data-orientation`, `data-starting-style`, `data-ending-style` |

### CSS Variables

The content element exposes size variables for height or width transitions:

| Variable | Description |
| --- | --- |
| `--accordion-panel-height` | Panel height (`auto` at rest, measured px during transitions, `0px` when closed) |
| `--accordion-panel-width` | Panel width (`auto` at rest, measured px during transitions, `0px` when closed) |
| `--radix-accordion-content-height` | Compatibility alias for Tailwind/Radix accordion keyframes |
| `--radix-accordion-content-width` | Compatibility alias for width-based integrations |

### CSS Example

```css
[data-slot="accordion-item"] {
  border-bottom: 1px solid #e5e7eb;
}

[data-slot="accordion-trigger"] {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: transparent;
  border: 0;
  text-align: left;
}

[data-slot="accordion-trigger-icon"] {
  margin-left: auto;
  width: 1rem;
  height: 1rem;
  color: #6b7280;
  transition: transform 0.2s ease;
}

[data-slot="accordion-item"][data-state="open"] [data-slot="accordion-trigger-icon"] {
  transform: rotate(45deg);
}

[data-slot="accordion-content"] {
  overflow: hidden;
  height: var(--accordion-panel-height);
  transition: height 0.2s ease;
}

[data-slot="accordion-content"][data-starting-style] {
  height: 0;
}

[data-slot="accordion-content-inner"] {
  padding: 0 1rem 1rem;
}
```

### Tailwind Example

```html
<div data-slot="accordion" class="overflow-hidden rounded-2xl border">
  <div
    data-slot="accordion-item"
    data-value="one"
    class="group border-b data-[open]:bg-muted/50"
  >
    <button
      data-slot="accordion-trigger"
      class="flex w-full items-center gap-6 p-4 text-left text-sm font-medium hover:underline"
    >
      <span>Section One</span>
      <svg
        data-slot="accordion-trigger-icon"
        viewBox="0 0 12 12"
        class="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-45"
      >
        <path d="M6.75 0H5.25V5.25H0V6.75H5.25V12H6.75V6.75H12V5.25H6.75V0Z" />
      </svg>
    </button>
    <div
      data-slot="accordion-content"
      class="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
    >
      <div
        data-slot="accordion-content-inner"
        class="h-(--accordion-panel-height) px-4 pb-4 pt-0 data-ending-style:h-0 data-starting-style:h-0"
      >
        Content
      </div>
    </div>
  </div>
</div>
```

## Keyboard Navigation

| Key | Action |
| --- | --- |
| `Enter` / `Space` | Toggle focused item |
| `ArrowDown` / `ArrowUp` | Move focus in vertical accordions |
| `ArrowRight` / `ArrowLeft` | Move focus in horizontal accordions |
| `Home` | Move focus to first enabled trigger |
| `End` | Move focus to last enabled trigger |

Disabled items are skipped during roving focus.

## Events

### Outbound Events

Listen for changes via custom events:

```javascript
element.addEventListener("accordion:change", (e) => {
  console.log("Expanded items:", e.detail.value);
});
```

### Inbound Events

Control the accordion via events:

| Event | Detail | Description |
| --- | --- | --- |
| `accordion:set` | `{ value: string \| string[] }` | Set expanded items programmatically |

```javascript
element.dispatchEvent(
  new CustomEvent("accordion:set", { detail: { value: "one" } })
);

element.dispatchEvent(
  new CustomEvent("accordion:set", { detail: { value: ["one", "two"] } })
);
```

`accordion:set` and controller methods still work when the accordion is disabled. User-triggered click and keyboard interaction do not.

## License

MIT
