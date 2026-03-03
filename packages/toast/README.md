# @data-slot/toast

Headless, imperative toast notifications for vanilla JavaScript. Runtime-rendered, template-driven, accessible, and unstyled.

## Installation

```bash
npm install @data-slot/toast
```

## Quick Start

```html
<div data-slot="toast" data-position="bottom-right">
  <template data-slot="toast-template">
    <li data-slot="toast-item" role="status" aria-atomic="true">
      <div data-slot="toast-title"></div>
      <div data-slot="toast-description"></div>
      <button data-slot="toast-action" type="button"></button>
      <button data-slot="toast-close" type="button" aria-label="Close">×</button>
    </li>
  </template>

  <ol data-slot="toast-viewport" role="region" aria-label="Notifications"></ol>
</div>

<script type="module">
  import { create } from "@data-slot/toast";

  const [toaster] = create();

  toaster?.show({
    title: "Changes saved",
    description: "All updates are synced",
    type: "success",
  });
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all toast roots in a scope (`document` by default).

```ts
import { create } from "@data-slot/toast";

const controllers = create(); // ToastController[]
```

### `createToast(root, options?)`

Create a controller for one toast root.

```ts
import { createToast } from "@data-slot/toast";

const toaster = createToast(element, {
  limit: 3,
  duration: 5000,
  position: "bottom-right",
  pauseOnHover: true,
  pauseOnFocus: true,
  portal: false,
  onShow: (id) => console.log("shown", id),
  onDismiss: (id) => console.log("dismissed", id),
  onAction: (id, value) => console.log("action", id, value),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | `number` | `3` | Maximum visible toasts at once; newest toasts stay visible and older ones move to queue |
| `duration` | `number` | `5000` | Default auto-dismiss duration in ms (`0` = persistent) |
| `position` | `"top-left" \| "top-center" \| "top-right" \| "bottom-left" \| "bottom-center" \| "bottom-right"` | `"bottom-right"` | Position token exposed as `data-position` on root |
| `pauseOnHover` | `boolean` | `true` | Pause all active timers while viewport is hovered |
| `pauseOnFocus` | `boolean` | `true` | Pause all active timers while viewport has focus within |
| `portal` | `boolean` | `false` | Portal viewport to `document.body` |
| `onShow` | `(id: string) => void` | `undefined` | Callback when a toast is shown |
| `onDismiss` | `(id: string) => void` | `undefined` | Callback when a toast starts dismissing |
| `onAction` | `(id: string, value: string \| undefined) => void` | `undefined` | Callback when action button is clicked |

### `show(options)`

```ts
const id = toaster.show({
  id: "save-1",
  title: "Saved",
  description: "Your profile was updated",
  type: "success",
  duration: 4000,
  dismissible: true,
  closeButtonAriaLabel: "Close notification",
  testId: "save-toast",
  action: {
    label: "Undo",
    value: "undo-save",
    onClick: () => console.log("undo"),
  },
});
```

`title` is required. If `id` is reused, the previous toast is force-replaced.
`action.onClick` may call `event.preventDefault()` to keep the toast open.

### `promise(input, options)`

```ts
const handled = toaster.promise(fetch("/api/save"), {
  loading: "Saving...",
  success: "Saved",
  error: (error) => ({
    title: error instanceof Error ? error.message : "Save failed",
  }),
});

await handled.unwrap();
```

`promise()` keeps a stable toast id across loading/success/error states and returns `{ id, unwrap() }`.

### Controller

| Method / Property | Description |
|-------------------|-------------|
| `show(options)` | Create and show a toast, returns its id |
| `update(id, patch)` | Patch an existing active/queued toast in place |
| `promise(input, options)` | Drive loading/success/error toast states from a promise, returns `{ id, unwrap() }` |
| `dismiss(id)` | Dismiss one toast |
| `dismissAll()` | Dismiss all active toasts |
| `count` | Active (non-exiting) toast count |
| `destroy()` | Cleanup listeners, timers, observers and restore portaled viewport |

## Slots

### Required

- `toast-viewport`

### Optional

- `toast-template` (`<template>`)
- `toast-item`
- `toast-title`
- `toast-description`
- `toast-action`
- `toast-close`

If `toast-template` is missing or invalid, the library generates a full fallback template.

## Data Attributes

JS options take precedence over data attributes.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-limit` | number | `3` | Max visible toasts at once (older items queue when full) |
| `data-duration` | number | `5000` | Default duration in ms |
| `data-position` | position token | `"bottom-right"` | Placement hint for styling |
| `data-pause-on-hover` | boolean | `true` | Hover-based timer pause |
| `data-pause-on-focus` | boolean | `true` | Focus-based timer pause |
| `data-portal` | boolean | `false` | Portal viewport to body |

Runtime attributes:

- `toast-item`: `data-id`, `data-type`, `data-state`, `data-open`, `data-closed`, `data-front`, `data-starting-style`, `data-ending-style`
- `toast-item`: `data-swiping`, `data-swipe-out`, `data-dismissible="false"` (when swiping is disabled)
- `toast-viewport`: `data-expanded` (hover/focus fan-out state)

## Animation Tokens

The controller computes and writes stack tokens for animation styling:

- `--toast-index` (0 = newest)
- `--toast-count`
- `--toast-height`
- `--toast-offset-y`
- `--toast-frontmost-height` (on viewport)
- `--toast-stack-size` (on viewport, full visible stack hit-area)
- `--toast-stack-direction` (`1` for top stacks, `-1` for bottom stacks)
- `--toast-enter-direction` (item-level; may differ for promoted queued items)
- `--toast-exit-direction` (item-level; stable exit direction for stack position)
- `--toast-swipe-movement-y` (item-level; live vertical swipe offset)

These are updated on show, dismiss, exit complete, and item resize.

## Events

### Outbound (on root)

| Event | Detail |
|-------|--------|
| `toast:change` | `{ id: string, action: "show" \| "dismiss" }` |
| `toast:action` | `{ id: string, value: string \| undefined }` |

### Inbound (on root)

| Event | Detail |
|-------|--------|
| `toast:show` | `ToastShowOptions` |
| `toast:update` | `{ id: string } & ToastUpdateOptions` |
| `toast:dismiss` | `{ id: string }` or `string` |
| `toast:clear` | none |

```js
root.dispatchEvent(
  new CustomEvent("toast:show", {
    detail: { title: "Background sync complete", type: "success" },
  }),
);

root.dispatchEvent(
  new CustomEvent("toast:update", {
    detail: { id: "save-1", title: "Saved", type: "success" },
  }),
);

root.dispatchEvent(new CustomEvent("toast:dismiss", { detail: { id: "save-1" } }));
root.dispatchEvent(new CustomEvent("toast:clear"));
```

## Styling Example

```css
[data-slot="toast-viewport"] {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  width: min(360px, calc(100vw - 2rem));
  --toast-gap: 8;
}

[data-slot="toast-item"] {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  transform: translateY(calc(var(--toast-index) * -8px))
    scale(calc(1 - var(--toast-index) * 0.04));
  opacity: calc(1 - var(--toast-index) * 0.12);
  transition: transform 400ms ease, opacity 400ms ease, box-shadow 200ms ease;
}

[data-slot="toast-viewport"][data-expanded] [data-slot="toast-item"] {
  transform: translateY(calc(var(--toast-offset-y) * var(--toast-stack-direction) * 1px));
  opacity: 1;
}

[data-slot="toast-item"][data-starting-style] {
  transform: translateY(calc(var(--toast-enter-direction) * 24px));
  opacity: 0;
}

[data-slot="toast-item"][data-ending-style] {
  transform: translateY(calc(var(--toast-exit-direction) * 24px));
  opacity: 0;
}
```

## Accessibility

- Viewport defaults: `role="region"`, `aria-label="Notifications"`
- Item defaults: `aria-atomic="true"`
- `error` and `warning` toasts are assertive (`role="alert"`)
- Other toasts are polite (`role="status"`)

## License

MIT
