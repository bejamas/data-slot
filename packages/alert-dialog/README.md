# @data-slot/alert-dialog

Headless alert dialog component for vanilla JavaScript. Accessible, unstyled, and modal by default.

## Installation

```bash
npm install @data-slot/alert-dialog
```

## Usage

```html
<div data-slot="alert-dialog">
  <button data-slot="alert-dialog-trigger">Delete project</button>

  <div data-slot="alert-dialog-portal">
    <div data-slot="alert-dialog-overlay" hidden></div>
    <div data-slot="alert-dialog-content" hidden>
      <div data-slot="alert-dialog-header">
        <div data-slot="alert-dialog-media">!</div>
        <h2 data-slot="alert-dialog-title">Delete project?</h2>
        <p data-slot="alert-dialog-description">
          This action cannot be undone.
        </p>
      </div>

      <div data-slot="alert-dialog-footer">
        <button data-slot="alert-dialog-cancel">Cancel</button>
        <button data-slot="alert-dialog-action">Delete</button>
      </div>
    </div>
  </div>
</div>

<script type="module">
  import { createAlertDialog } from "@data-slot/alert-dialog";

  const root = document.querySelector('[data-slot="alert-dialog"]');
  const alertDialog = createAlertDialog(root);

  root
    .querySelector('[data-slot="alert-dialog-action"]')
    ?.addEventListener("click", () => {
      // Run your confirm action, then close explicitly.
      alertDialog.close();
    });
</script>
```

## API

### `create(scope?)`

Auto-discovers and binds all alert dialogs in a scope.

```ts
import { create } from "@data-slot/alert-dialog";

const controllers = create();
```

### `createAlertDialog(root, options?)`

```ts
import { createAlertDialog } from "@data-slot/alert-dialog";

const alertDialog = createAlertDialog(element, {
  closeOnClickOutside: false,
  onOpenChange: (open) => console.log(open),
});
```

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Called when open state changes |
| `closeOnClickOutside` | `boolean` | `false` | Close when clicking the overlay |
| `closeOnEscape` | `boolean` | `true` | Close when pressing `Escape` |
| `lockScroll` | `boolean` | `true` | Lock page scroll while open |

#### Controller

| Method | Description |
| --- | --- |
| `open()` | Open the alert dialog |
| `close()` | Close the alert dialog |
| `toggle()` | Toggle the alert dialog |
| `destroy()` | Remove listeners and cleanup |
| `isOpen` | Current open state |

## Slots

### Runtime slots

- `alert-dialog` - Root element
- `alert-dialog-trigger` - Element that toggles the alert dialog
- `alert-dialog-portal` - Optional element portaled to `document.body`
- `alert-dialog-overlay` - Required overlay
- `alert-dialog-content` - Required modal content
- `alert-dialog-title` - Title used for `aria-labelledby`
- `alert-dialog-description` - Description used for `aria-describedby`
- `alert-dialog-cancel` - Close button

### Style-only slots

- `alert-dialog-header`
- `alert-dialog-footer`
- `alert-dialog-media`
- `alert-dialog-action`

`alert-dialog-action` is intentionally just a styled action slot. It does not close automatically.

## State and events

- `data-state="open" | "closed"` on root, portal, overlay, and content
- `data-open` / `data-closed` on root, portal, overlay, and content
- `data-stack-index` on overlay and content when multiple modal layers are open

Events:

| Event | Detail | Description |
| --- | --- | --- |
| `alert-dialog:change` | `{ open: boolean }` | Fired when open state changes |
| `alert-dialog:set` | `{ open: boolean }` | Programmatically set open state |

## Accessibility

- `role="alertdialog"` on content
- `aria-modal="true"` on content
- `aria-labelledby` / `aria-describedby` wiring from title and description
- Focus is trapped while open
- Focus returns to the trigger or previously focused element when closed
