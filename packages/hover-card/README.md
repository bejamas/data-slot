# @data-slot/hover-card

Headless hover-card (preview-card style) for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/hover-card
```

## Quick Start

```html
<div data-slot="hover-card">
  <button data-slot="hover-card-trigger">Hover me</button>
  <div data-slot="hover-card-content" hidden>
    Preview content
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/hover-card";

  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all hover-card instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/hover-card";

const controllers = create(); // Returns HoverCardController[]
```

### `createHoverCard(root, options?)`

Create a controller for a specific element.

```typescript
import { createHoverCard } from "@data-slot/hover-card";

const hoverCard = createHoverCard(element, {
  delay: 700,
  closeDelay: 300,
  side: "bottom",
  align: "center",
  portal: true,
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Initial open state (uncontrolled only) |
| `open` | `boolean` | - | Controlled open state |
| `delay` | `number` | `700` | Delay before opening on hover/keyboard focus (ms) |
| `skipDelayDuration` | `number` | `300` | Duration to skip delay after closing (ms). Set `0` to disable warm-up. |
| `closeDelay` | `number` | `300` | Delay before closing after leave/blur (ms) |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Preferred side relative to trigger |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Preferred alignment on the side axis |
| `sideOffset` | `number` | `4` | Distance from trigger in pixels |
| `alignOffset` | `number` | `0` | Offset from alignment edge in pixels |
| `avoidCollisions` | `boolean` | `true` | Flip/shift to stay in viewport |
| `collisionPadding` | `number` | `8` | Viewport edge padding in pixels |
| `portal` | `boolean` | `true` | Portal content to `document.body` while open |
| `closeOnClickOutside` | `boolean` | `true` | Close when clicking outside |
| `closeOnEscape` | `boolean` | `true` | Close when pressing Escape |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when open state changes |

### Controlled Mode

When `open` is provided, hover/focus/outside interactions emit `onOpenChange` but do not mutate internal state.
Use controller `setOpen(open)` or the `hover-card:set` event to apply state.

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `open()` | Request open state (`setOpen(true)` for forced update) |
| `close()` | Request closed state (`setOpen(false)` for forced update) |
| `toggle()` | Request toggle |
| `setOpen(open)` | Force open/closed update (works in controlled mode) |
| `isOpen` | Current open state (readonly `boolean`) |
| `destroy()` | Cleanup all event listeners and timers |

## Markup Structure

```html
<div data-slot="hover-card">
  <button data-slot="hover-card-trigger">Trigger</button>
  <div data-slot="hover-card-content">Content</div>
</div>
```

### Required Slots

- `hover-card-trigger`
- `hover-card-content`

### Optional Slots

- `hover-card-positioner` - Optional authored positioning wrapper
- `hover-card-portal` - Optional authored portal wrapper that can contain `hover-card-positioner`

### Composed Portal Markup (Optional)

```html
<div data-slot="hover-card">
  <button data-slot="hover-card-trigger">Trigger</button>
  <div data-slot="hover-card-portal">
    <div data-slot="hover-card-positioner">
      <div data-slot="hover-card-content">Content</div>
    </div>
  </div>
</div>
```

## Data Attributes

Options can be set via data attributes on root/content. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-open` | boolean | `false` | Initial open state |
| `data-delay` | number | `700` | Open delay (ms) |
| `data-skip-delay-duration` | number | `300` | Warm-up window to skip open delay (ms) |
| `data-close-delay` | number | `300` | Close delay (ms) |
| `data-side` | string | `"bottom"` | Preferred side (content first, then root) |
| `data-align` | string | `"center"` | Preferred align (content first, then root) |
| `data-side-offset` | number | `4` | Distance from trigger (px) |
| `data-align-offset` | number | `0` | Align offset (px) |
| `data-avoid-collisions` | boolean | `true` | Collision handling |
| `data-collision-padding` | number | `8` | Viewport edge padding (px) |
| `data-portal` | boolean | `true` | Portal while open |
| `data-close-on-click-outside` | boolean | `true` | Outside click close |
| `data-close-on-escape` | boolean | `true` | Escape close |

Boolean attributes: present/`"true"` = true, `"false"` = false, absent = default.

## Events

### Outbound

- `hover-card:change` - emitted when open state changes or is requested in controlled mode.

```typescript
root.addEventListener("hover-card:change", (e) => {
  const { open, reason, trigger, content } = (e as CustomEvent).detail;
});
```

`reason` is one of: `"pointer" | "focus" | "blur" | "dismiss" | "api"`.

Focus opening is keyboard-intent based (`Tab` navigation). Programmatic focus (for example, dialog auto-focus on open) does not auto-open the hover-card.

### Inbound

- `hover-card:set` - force open state

```typescript
root.dispatchEvent(new CustomEvent("hover-card:set", { detail: { open: true } }));
```

Deprecated shape is still supported:

```typescript
root.dispatchEvent(new CustomEvent("hover-card:set", { detail: { value: true } }));
```

## Styling

Position is computed in JavaScript and applied as `position: absolute` + `transform: translate3d(...)`.
By default, content is portaled to `document.body` while open.
Use `data-open` / `data-closed`, `data-side`, and `data-align` for animation/styling.

```css
[data-slot="hover-card-content"] {
  transform-origin: var(--transform-origin, center);
  --hover-card-slide-x: 0px;
  --hover-card-slide-y: -4px;
}

[data-slot="hover-card-content"][data-side="top"] {
  --hover-card-slide-y: 4px;
}
[data-slot="hover-card-content"][data-side="bottom"] {
  --hover-card-slide-y: -4px;
}
[data-slot="hover-card-content"][data-side="left"] {
  --hover-card-slide-x: 4px;
  --hover-card-slide-y: 0px;
}
[data-slot="hover-card-content"][data-side="right"] {
  --hover-card-slide-x: -4px;
  --hover-card-slide-y: 0px;
}

[data-slot="hover-card-content"][data-open] {
  animation: hover-card-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

[data-slot="hover-card-content"][data-closed] {
  pointer-events: none;
  animation: hover-card-out 120ms ease-in forwards;
}
```

## Warm-up Behavior

When one hover-card closes, another hovered shortly after can open immediately (delay skipped).

- Controlled by `skipDelayDuration` / `data-skip-delay-duration`
- Set to `0` to disable warm-up behavior
- Warm-up applies across hover-card instances

## Accessibility

The component automatically handles:

- `aria-haspopup="dialog"` on trigger
- `aria-controls` linking trigger to content
- `aria-expanded` state on trigger
- Unique content IDs via `ensureId`

## License

MIT
