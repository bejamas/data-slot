# @data-slot/dialog

Headless modal dialog component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/dialog
```

## Quick Start

```html
<div data-slot="dialog">
  <button data-slot="dialog-trigger">Open Dialog</button>
  <div data-slot="dialog-content" hidden>
    <h2 data-slot="dialog-title">Dialog Title</h2>
    <p data-slot="dialog-description">Dialog description text.</p>
    <button data-slot="dialog-close">Close</button>
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/dialog";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all dialog instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/dialog";

const controllers = create(); // Returns DialogController[]
```

### `createDialog(root, options?)`

Create a controller for a specific element.

```typescript
import { createDialog } from "@data-slot/dialog";

const dialog = createDialog(element, {
  defaultOpen: false,
  closeOnClickOutside: true,
  closeOnEscape: true,
  lockScroll: true,
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `closeOnClickOutside` | `boolean` | `true` | Close when clicking outside content |
| `closeOnEscape` | `boolean` | `true` | Close when pressing Escape |
| `lockScroll` | `boolean` | `true` | Lock body scroll when open |
| `alertDialog` | `boolean` | `false` | Use alertdialog role for confirmations |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when open state changes |

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence over data attributes.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-open` | boolean | `false` | Initial open state |
| `data-close-on-click-outside` | boolean | `true` | Close when clicking outside content |
| `data-close-on-escape` | boolean | `true` | Close when pressing Escape |
| `data-lock-scroll` | boolean | `true` | Lock body scroll when open |
| `data-alert-dialog` | boolean | `false` | Use alertdialog role for confirmations |

Boolean attributes: present or `"true"` = true, `"false"` = false, absent = default.

```html
<!-- Disable close on Escape -->
<div data-slot="dialog" data-close-on-escape="false">
  ...
</div>

<!-- Alert dialog that stays open when clicking outside -->
<div data-slot="dialog" data-alert-dialog data-close-on-click-outside="false">
  ...
</div>
```

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `open()` | Open the dialog |
| `close()` | Close the dialog |
| `toggle()` | Toggle the dialog |
| `isOpen` | Current open state (readonly `boolean`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<div data-slot="dialog">
  <button data-slot="dialog-trigger">Open</button>
  <div data-slot="dialog-content" role="dialog">
    <h2 data-slot="dialog-title">Title</h2>
    <p data-slot="dialog-description">Description</p>
    <button data-slot="dialog-close">Close</button>
  </div>
</div>
```

### Required Slots

- `dialog-content` - The dialog panel (required)

### Optional Slots

- `dialog-trigger` - Button to open the dialog
- `dialog-title` - Title for `aria-labelledby`
- `dialog-description` - Description for `aria-describedby`
- `dialog-close` - Button to close the dialog

## Styling

Dialog exposes both `data-state="open|closed"` and popup-style animation hooks:

- `data-open` / `data-closed` on `dialog`, `dialog-portal`, `dialog-overlay`, and `dialog-content`
- `data-starting-style` while opening
- `data-ending-style` while closing

Use `data-open` / `data-closed` with `data-starting-style` / `data-ending-style` for animations:

```css
/* Backdrop */
[data-slot="dialog-overlay"] {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 0.2s ease;
}

[data-slot="dialog-overlay"][data-open] {
  opacity: 1;
}

[data-slot="dialog-content"] {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

[data-slot="dialog-content"][data-open] {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

[data-slot="dialog-overlay"][data-starting-style],
[data-slot="dialog-overlay"][data-ending-style] {
  opacity: 0;
}

[data-slot="dialog-content"][data-starting-style],
[data-slot="dialog-content"][data-ending-style] {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}
```

Stacking is intentionally not hardcoded in JavaScript. Configure `z-index` in your CSS.  
When multiple dialogs are open, `data-stack-index` and CSS variables are exposed on
`dialog-overlay` and `dialog-content`:
- `data-stack-index`
- `--dialog-stack-index`
- `--dialog-overlay-stack-index` (overlay)
- `--dialog-content-stack-index` (content)

With Tailwind:

```html
<div
  data-slot="dialog-overlay"
  class="fixed inset-0 bg-black/50 opacity-0 transition-opacity duration-200 data-[open]:opacity-100 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
></div>
<div
  data-slot="dialog-content"
  class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 opacity-0 scale-95 transition-all duration-200 data-[open]:opacity-100 data-[open]:scale-100 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95"
>
  <!-- Dialog content -->
</div>
```

## Accessibility

The component automatically handles:

- `role="dialog"` on content
- `aria-modal="true"` on content
- `aria-labelledby` linked to title
- `aria-describedby` linked to description
- `aria-haspopup="dialog"` on trigger
- `aria-expanded` state on trigger
- Focus trap within dialog
- Focus restoration on close

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Escape` | Close dialog |
| `Tab` | Cycle focus within dialog |
| `Shift+Tab` | Cycle focus backwards |

## Events

### Outbound Events

Listen for changes via custom events:

```javascript
element.addEventListener("dialog:change", (e) => {
  console.log("Dialog open:", e.detail.open);
});
```

### Inbound Events

Control the dialog via events:

| Event | Detail | Description |
|-------|--------|-------------|
| `dialog:set` | `{ open: boolean }` | Set open state programmatically |

```javascript
// Open the dialog
element.dispatchEvent(
  new CustomEvent("dialog:set", { detail: { open: true } })
);

// Close the dialog
element.dispatchEvent(
  new CustomEvent("dialog:set", { detail: { open: false } })
);
```

#### Deprecated Shapes

The following shape is deprecated and will be removed in v1.0:

```javascript
// Deprecated: { value: boolean }
element.dispatchEvent(
  new CustomEvent("dialog:set", { detail: { value: true } })
);
```

Use `{ open: boolean }` instead.

## License

MIT
