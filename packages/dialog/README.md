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

Use `data-state` attributes for CSS styling:

```css
/* Backdrop/overlay */
[data-slot="dialog-content"] {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.5);
}

/* Closed state */
[data-slot="dialog"][data-state="closed"] [data-slot="dialog-content"] {
  display: none;
}

/* Animation */
[data-slot="dialog-content"] {
  opacity: 0;
  transition: opacity 0.2s;
}

[data-slot="dialog"][data-state="open"] [data-slot="dialog-content"] {
  opacity: 1;
}
```

With Tailwind:

```html
<div data-slot="dialog-content" class="fixed inset-0 grid place-items-center bg-black/50 data-[state=closed]:hidden">
  <div class="bg-white rounded-lg p-6 max-w-md">
    <!-- Dialog content -->
  </div>
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

