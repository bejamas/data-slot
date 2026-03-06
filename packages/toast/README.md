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
| `limit` | `number` | `3` | Maximum visible toasts at once; older toasts stay mounted with `data-visible="false"` |
| `duration` | `number` | `5000` | Default auto-dismiss duration in ms (`0` = persistent) |
| `position` | `"top-left" \| "top-center" \| "top-right" \| "bottom-left" \| "bottom-center" \| "bottom-right"` | `"bottom-right"` | Position token exposed as `data-position` on root and viewport |
| `pauseOnHover` | `boolean` | `true` | Pause all active timers while viewport is hovered |
| `pauseOnFocus` | `boolean` | `true` | Pause all active timers while viewport has focus within |
| `portal` | `boolean` | `false` | Portal viewport to `document.body` |
| `onShow` | `(id: string) => void` | `undefined` | Callback when a toast is shown |
| `onDismiss` | `(id: string) => void` | `undefined` | Callback when a toast starts dismissing |
| `onAction` | `(id: string, value: string \| undefined) => void` | `undefined` | Callback when action button is clicked |

Timers also pause automatically while the document is hidden or the window loses focus.

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
| `update(id, patch)` | Patch an existing active toast in place (visible or overflow-hidden) |
| `promise(input, options)` | Drive loading/success/error toast states from a promise, returns `{ id, unwrap() }` |
| `dismiss(id)` | Dismiss one toast |
| `dismissAll()` | Dismiss all active toasts |
| `count` | Total active (non-exiting) toast count, including overflow-hidden items |
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
| `data-limit` | number | `3` | Max visible toasts at once (older items remain mounted, hidden, and non-interactive when full) |
| `data-duration` | number | `5000` | Default duration in ms |
| `data-position` | position token | `"bottom-right"` | Placement hint for styling |
| `data-pause-on-hover` | boolean | `true` | Hover-based timer pause |
| `data-pause-on-focus` | boolean | `true` | Focus-based timer pause |
| `data-portal` | boolean | `false` | Portal viewport to body |

Runtime attributes:

- `toast-item`: `data-id`, `data-type`, `data-state`, `data-open`, `data-closed`, `data-mounted`, `data-removed`, `data-front`, `data-visible`, `data-expanded`
- `toast-item`: `data-swiping`, `data-swipe-out`, `data-dismissible="false"` (when swiping is disabled)
- `toast-item`: `aria-hidden`, `inert` while `data-visible="false"` (removed when visible again)
- `toast-viewport`: `data-expanded` (hover/focus fan-out state)

## Animation Tokens

The controller computes and writes stack tokens for animation styling:

- `--toast-index` (0 = newest)
- `--toast-count`
- `--toast-height`
- `--toast-initial-height`
- `--toast-offset`
- `--toast-expanded-offset-y`
- `--toast-collapsed-offset-y`
- `--toast-offset-y` (backward-compatible alias of `--toast-expanded-offset-y`)
- `--toast-lift` (`1` for top stacks, `-1` for bottom stacks)
- `--toast-frontmost-height` (on viewport)
- `--toast-expanded-stack-size` (on viewport)
- `--toast-collapsed-stack-size` (on viewport)
- `--toast-stack-size` (on viewport, active size; collapsed by default, expanded while `data-expanded`)
- `--toast-collapsed-peek` (on viewport; collapsed stack step)
- `--toast-stack-direction` (`1` for top stacks, `-1` for bottom stacks)
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
  height: var(--toast-stack-size, 0px);
  --toast-gap: 8px;
  --toast-collapsed-peek: 14px;
}

[data-slot="toast-item"] {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  box-sizing: border-box;
  opacity: 0;
  transform: translate3d(0, calc(var(--toast-lift, -1) * -100%), 0);
  transition:
    transform 400ms ease,
    opacity 400ms ease,
    height 400ms ease,
    box-shadow 200ms ease;
}

[data-slot="toast-item"][data-mounted="true"] {
  transform: translate3d(0, 0, 0);
  opacity: 1;
}

[data-slot="toast-item"][data-mounted="true"][data-expanded="false"][data-front="false"] {
  transform: translate3d(
      0,
      calc(var(--toast-collapsed-offset-y, 0px) * var(--toast-lift, -1)),
      0
    )
    scale(calc(1 - var(--toast-index, 0) * 0.05));
  height: var(--toast-frontmost-height);
}

[data-slot="toast-item"][data-mounted="true"][data-expanded="true"] {
  transform: translate3d(
    0,
    calc(var(--toast-offset, 0px) * var(--toast-lift, -1)),
    0
  );
  height: var(--toast-initial-height);
}

[data-slot="toast-item"][data-expanded="false"][data-front="false"][data-state="open"] > * {
  opacity: 0;
}

[data-slot="toast-item"][data-visible="false"] {
  opacity: 0;
  pointer-events: none;
}

[data-slot="toast-item"][data-expanded="true"]::after {
  content: "";
  position: absolute;
  left: 0;
  width: 100%;
  height: calc(var(--toast-gap, 0px) + 1px);
  bottom: 100%;
}

[data-slot="toast-item"][data-removed="true"][data-front="true"][data-swipe-out="false"] {
  transform: translate3d(0, calc(var(--toast-lift, -1) * -100%), 0);
  opacity: 0;
}

[data-slot="toast-item"][data-removed="true"][data-front="false"][data-swipe-out="false"][data-expanded="true"] {
  transform: translate3d(
    0,
    calc(var(--toast-lift, -1) * var(--toast-offset, 0px) + var(--toast-lift, -1) * -100%),
    0
  );
  opacity: 0;
}

[data-slot="toast-item"][data-removed="true"][data-front="false"][data-swipe-out="false"][data-expanded="false"] {
  transform: translate3d(0, 40%, 0);
  opacity: 0;
  transition:
    transform 500ms ease,
    opacity 200ms ease;
}
```

## Accessibility

- Viewport defaults: `role="region"`, `aria-label="Notifications"`
- Item defaults: `aria-atomic="true"`
- `error` and `warning` toasts are assertive (`role="alert"`)
- Other toasts are polite (`role="status"`)

## License

MIT
