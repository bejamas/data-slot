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

### Initialization

#### `create(scope?)`

Auto-discover and bind all hover-card instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/hover-card";

const controllers = create(); // Returns HoverCardController[]
```

#### `createHoverCard(root, options?)`

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

### Slots

#### Runtime Slots

- `hover-card` - Root element that manages the open state and hover delays.
- `hover-card-trigger` - Required element that opens the card on hover or focus.
- `hover-card-content` - Required floating panel that displays the preview content.
- `hover-card-positioner` - Optional authored positioning wrapper around the content, reused instead of a generated wrapper.
- `hover-card-portal` - Optional authored portal wrapper that can contain the positioner and content.

#### Markup

```html
<div data-slot="hover-card">
  <button data-slot="hover-card-trigger">Trigger</button>
  <div data-slot="hover-card-content">Content</div>
</div>
```

#### Composed Portal Markup (Optional)

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

### Data Attributes

Options can be set via data attributes. JS options take precedence.

Placement attributes (`data-side`, `data-align`, `data-side-offset`, `data-align-offset`, `data-avoid-collisions`, `data-collision-padding`) resolve in this order:

1. JavaScript option
2. `hover-card-content`
3. `hover-card-positioner`
4. `hover-card` root (fallback)

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-open` | boolean | `false` | Initial open state |
| `data-delay` | number | `700` | Open delay (ms) |
| `data-skip-delay-duration` | number | `300` | Warm-up window to skip open delay (ms) |
| `data-close-delay` | number | `300` | Close delay (ms) |
| `data-side` | string | `"bottom"` | Preferred side |
| `data-align` | string | `"center"` | Preferred align |
| `data-side-offset` | number | `4` | Distance from trigger (px) |
| `data-align-offset` | number | `0` | Align offset (px) |
| `data-avoid-collisions` | boolean | `true` | Collision handling |
| `data-collision-padding` | number | `8` | Viewport edge padding (px) |
| `data-portal` | boolean | `true` | Portal while open |
| `data-mount-strategy` (root) | `"lazy" \| "eager"` | `"lazy"` | Detach closed content, or retain it in the document |
| `data-close-on-click-outside` | boolean | `true` | Outside click close |
| `data-close-on-escape` | boolean | `true` | Escape close |

Boolean attributes: present/`"true"` = true, `"false"` = false, absent = default.

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
| `mountStrategy` | `"lazy" \| "eager"` | `"lazy"` | Detach closed content; JS overrides root `data-mount-strategy` |
| `closeOnClickOutside` | `boolean` | `true` | Close when clicking outside |
| `closeOnEscape` | `boolean` | `true` | Close when pressing Escape |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when open state changes |

#### Controlled Mode

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

#### Controller Destruction

`destroy()` permanently disposes the controller and hides any open surface without
emitting an additional change event. Repeated destruction is safe; methods on the
old controller become no-ops. Create a new controller on the same root to rebind it.

### Content mounting and server rendering

By default, Hover Card removes its closed preview from the page’s DOM. This keeps
pages with many hover cards smaller after initialization. The link or button that
opens the card stays in the page.

Opening the card puts the same preview back into the page. Its state and event
listeners are preserved. Closing waits for any exit animation to finish before
removing it. If the card opens again during that animation, it stays in the page.
Cards configured to start open stay in the page from initialization.

Most applications can use this default without any changes.

If your code needs to find or update content while the card is closed—for example,
using `querySelector`—use `eager` mode to keep it in the DOM:

```js
createHoverCard(root, { mountStrategy: "eager" });
```

You can also add `data-mount-strategy="eager"` to the Hover Card root. A JavaScript
option takes precedence over the HTML attribute.

With the default `lazy` mode, DOM queries won’t find the closed preview. You can
also keep a reference to its content element before initializing Hover Card and
use that reference later.

**Server rendering and pages without JavaScript**

Lazy mounting does **not** reduce the HTML sent to the browser. The preview is
still included in your HTML; Hover Card removes it from the DOM after JavaScript
initializes if the card is closed.

Keep the preview’s initial markup hidden to prevent it briefly appearing before
initialization. Make essential information and links available outside the card
so people can still use the page without JavaScript. Neither `lazy` nor `eager`
mode provides that fallback automatically.

### Events

#### Outbound Events

- `hover-card:change` - emitted when open state changes or is requested in controlled mode.

```typescript
root.addEventListener("hover-card:change", (e) => {
  const { open, reason, trigger, content } = (e as CustomEvent).detail;
});
```

`reason` is one of: `"pointer" | "focus" | "blur" | "dismiss" | "api"`.

Focus opening is keyboard-intent based (`Tab` navigation). Programmatic focus (for example, dialog auto-focus on open) does not auto-open the hover-card.
Hover opening is pointer-intent based (recent mouse movement). Synthetic `pointerenter` caused by newly shown UI under a static cursor does not auto-open the hover-card.

#### Inbound Events

- `hover-card:set` - force open state

```typescript
root.dispatchEvent(new CustomEvent("hover-card:set", { detail: { open: true } }));
```

Deprecated shape is still supported:

```typescript
root.dispatchEvent(new CustomEvent("hover-card:set", { detail: { value: true } }));
```

### Styling

Position is computed in JavaScript and applied as `position: absolute` + `transform: translate3d(...)`.
By default, content is portaled to `document.body` while open.
The positioned element (`hover-card-positioner`, or `hover-card-content` when `portal` is disabled) receives `--transform-origin`, so animations can scale from the trigger anchor.
Use `data-open` / `data-closed`, `data-side`, and `data-align` for animation/styling.
Placement uses layout dimensions, so `scale`/`zoom` animations on `hover-card-content` stay aligned without requiring an extra inner wrapper.

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

[data-slot="hover-card-content"][data-instant] {
  transition: none;
  animation: none;
}
```

### Accessibility

The component automatically handles:

- `aria-haspopup="dialog"` on trigger
- `aria-controls` linking trigger to content
- `aria-expanded` state on trigger
- Unique content IDs via `ensureId`

### Behavior

#### Warm-up Behavior

When one hover-card closes, another hovered shortly after can open immediately (delay skipped).

- Controlled by `skipDelayDuration` / `data-skip-delay-duration`
- Set to `0` to disable warm-up behavior
- Warm-up applies across hover-card instances
- Warm-up opens add `data-instant` (root/content/positioner) for that open cycle, so CSS can disable animations
- During warm handoff to another hover-card trigger, the stale popup closes immediately (bypasses `closeDelay`) and that close cycle is marked with `data-instant`

## License

MIT
