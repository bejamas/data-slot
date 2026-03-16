# @data-slot/tooltip

Headless tooltip component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/tooltip
```

## Quick Start

```html
<div data-slot="tooltip">
  <button data-slot="tooltip-trigger">Hover me</button>
  <div data-slot="tooltip-content" hidden>
    Helpful tooltip text
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/tooltip";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all tooltip instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/tooltip";

const controllers = create(); // Returns TooltipController[]
```

### `createTooltip(root, options?)`

Create a controller for a specific element.

```typescript
import { createTooltip } from "@data-slot/tooltip";

const tooltip = createTooltip(element, {
  delay: 300,
  skipDelayDuration: 300,
  side: "top",
  align: "center",
  onOpenChange: (open) => console.log(open),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delay` | `number` | `300` | Delay before showing tooltip (ms) |
| `skipDelayDuration` | `number` | `300` | Duration to skip delay after closing (ms). Set to `0` to disable warm-up. |
| `side` | `"top" \| "right" \| "bottom" \| "left" \| "inline-start" \| "inline-end"` | `"top"` | Preferred side relative to trigger |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Preferred alignment |
| `sideOffset` | `number` | `4` | Distance from trigger in pixels |
| `alignOffset` | `number` | `0` | Offset from alignment edge in pixels |
| `avoidCollisions` | `boolean` | `true` | Flip/shift to stay in viewport |
| `collisionPadding` | `number` | `8` | Viewport edge padding in pixels |
| `portal` | `boolean` | `true` | Portal content to `document.body` while open |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when visibility changes |

**Note:** `side` and `align` are preferred placement inputs resolved at bind time. With collision handling enabled, computed `data-side` can differ at runtime.

### Data Attributes

Options can also be set via data attributes. JS options take precedence.

Placement attributes (`data-side`, `data-align`, `data-side-offset`, `data-align-offset`, `data-avoid-collisions`, `data-collision-padding`) resolve in this order:

1. JavaScript option
2. `tooltip-content`
3. `tooltip-positioner`
4. `tooltip` root (fallback)

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-delay` | number | `300` | Delay before showing tooltip (ms) |
| `data-skip-delay-duration` | number | `300` | Duration to skip delay after closing (ms) |
| `data-side` | string | `"top"` | Side relative to trigger (`top`, `right`, `bottom`, `left`, `inline-start`, `inline-end`) |
| `data-align` | string | `"center"` | Alignment along the side |
| `data-side-offset` | number | `4` | Distance from trigger (px) |
| `data-align-offset` | number | `0` | Alignment edge offset (px) |
| `data-avoid-collisions` | boolean | `true` | Collision handling |
| `data-collision-padding` | number | `8` | Viewport edge padding (px) |
| `data-portal` | boolean | `true` | Portal while open |

```html
<!-- Tooltip with faster response -->
<div data-slot="tooltip" data-delay="100">
  ...
</div>

<!-- Disable warm-up behavior -->
<div data-slot="tooltip" data-skip-delay-duration="0">
  ...
</div>

<!-- Side/align and offsets on content element -->
<div
  data-slot="tooltip-content"
  data-side="bottom"
  data-align="start"
  data-side-offset="8"
  data-align-offset="4"
>
  ...
</div>
```

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `show()` | Show the tooltip immediately. Respects disabled state. |
| `hide()` | Hide the tooltip |
| `isOpen` | Current visibility state (readonly `boolean`) |
| `destroy()` | Cleanup all event listeners and timers |

## Markup Structure

```html
<div data-slot="tooltip">
  <button data-slot="tooltip-trigger">Trigger</button>
  <div data-slot="tooltip-content">
    Content
    <div data-slot="tooltip-arrow"></div>
  </div>
</div>
```

### Required Slots

- `tooltip-trigger`
- `tooltip-content`

### Optional Slots

- `tooltip-positioner` - Optional authored positioning wrapper
- `tooltip-portal` - Optional authored portal wrapper that can contain `tooltip-positioner`
- `tooltip-arrow` - Optional arrow element positioned against the trigger

### Composed Portal Markup (Optional)

```html
<div data-slot="tooltip">
  <button data-slot="tooltip-trigger">Trigger</button>
  <div data-slot="tooltip-portal">
    <div data-slot="tooltip-positioner">
      <div data-slot="tooltip-content">
        Content
        <div data-slot="tooltip-arrow"></div>
      </div>
    </div>
  </div>
</div>
```

### Output Attributes

The component sets these attributes automatically:

| Element | Attribute | Values |
|---------|-----------|--------|
| Root | `data-state` | `"open"` \| `"closed"` (legacy compatibility) |
| Root | `data-open` / `data-closed` | Present when matching state |
| Root | `data-instant` | `"delay"` \| `"focus"` \| `"dismiss"` |
| Content | `data-state` | `"open"` \| `"closed"` (legacy compatibility) |
| Content | `data-open` / `data-closed` | Present when matching state |
| Content | `data-starting-style` | Present while opening |
| Content | `data-ending-style` | Present while closing |
| Content | `data-instant` | `"delay"` \| `"focus"` \| `"dismiss"` |
| Content | `data-side` | `"top"` \| `"right"` \| `"bottom"` \| `"left"` \| `"inline-start"` \| `"inline-end"` |
| Content | `data-align` | `"start"` \| `"center"` \| `"end"` |
| Content | `role` | `"tooltip"` |
| Content | `aria-hidden` | `"true"` when closed, `"false"` when open |
| Positioner | `data-open` / `data-closed` | Present when matching state |
| Positioner | `data-instant` | `"delay"` \| `"focus"` \| `"dismiss"` |
| Positioner | `data-side` | `"top"` \| `"right"` \| `"bottom"` \| `"left"` \| `"inline-start"` \| `"inline-end"` |
| Positioner | `data-align` | `"start"` \| `"center"` \| `"end"` |
| Arrow | `data-open` / `data-closed` | Present when matching state |
| Arrow | `data-instant` | `"delay"` \| `"focus"` \| `"dismiss"` |
| Arrow | `data-side` | `"top"` \| `"right"` \| `"bottom"` \| `"left"` \| `"inline-start"` \| `"inline-end"` |
| Arrow | `data-align` | `"start"` \| `"center"` \| `"end"` |
| Arrow | `data-uncentered` | Present when the arrow cannot stay perfectly centered |
| Arrow | `aria-hidden` | `"true"` |
| Trigger | `aria-describedby` | Content ID when open, removed when closed |

## Styling

Position is computed in JavaScript and applied to the positioner as `position: absolute` + `transform: translate3d(...)`.
By default, content is portaled to `document.body` while open.
The positioned element (`tooltip-positioner`, or `tooltip-content` when `portal` is disabled) gets `--transform-origin`, which `tooltip-content` can use for transform animations via CSS inheritance.
Use `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`, `data-side`, `data-align`, and `data-instant` for styling and animations.
Placement uses layout dimensions, so `scale`/`zoom` animations on `tooltip-content` remain stable without adding an extra wrapper.
Tooltip arrow geometry is runtime-owned: the controller writes inline `top` / `left` coordinates and `position: absolute` on `tooltip-arrow`. CSS should only handle edge attachment, rotation, and optional cosmetic nudges. Avoid overriding the arrow cross-axis with helpers like `top-1/2`, `left-1/2`, or `-translate-y-1/2`.

### Recommended CSS

The example below matches the Base/shadcn composition style: real `tooltip-arrow`, logical side support, and valued `data-instant`.

```css
[data-slot="tooltip-content"] {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  white-space: nowrap;
  background: #111827;
  color: white;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform-origin: var(--transform-origin, center center);
  --tooltip-slide-x: 0px;
  --tooltip-slide-y: 0px;
  transition: opacity 0.15s ease, visibility 0s linear 0.15s;
}

[data-slot="tooltip-content"][data-side="top"] { --tooltip-slide-y: 8px; }
[data-slot="tooltip-content"][data-side="bottom"] { --tooltip-slide-y: -8px; }
[data-slot="tooltip-content"][data-side="left"] { --tooltip-slide-x: 8px; }
[data-slot="tooltip-content"][data-side="right"] { --tooltip-slide-x: -8px; }
[data-slot="tooltip-content"][data-side="inline-start"] { --tooltip-slide-x: 8px; }
[data-slot="tooltip-content"][data-side="inline-end"] { --tooltip-slide-x: -8px; }

[data-slot="tooltip-content"][data-open] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition-delay: 0s;
}

[data-slot="tooltip-content"][data-closed] {
  pointer-events: none;
}

[data-slot="tooltip-content"][data-instant] {
  transition: none;
  animation: none;
}

[data-slot="tooltip-arrow"] {
  width: 0.625rem;
  height: 0.625rem;
  background: inherit;
  border-radius: 2px;
  transform: rotate(45deg);
}

[data-slot="tooltip-arrow"][data-side="top"] { bottom: -0.25rem; }
[data-slot="tooltip-arrow"][data-side="bottom"] { top: -0.25rem; }
[data-slot="tooltip-arrow"][data-side="left"] {
  right: -0.25rem;
  transform: translateX(-1.5px) rotate(45deg);
}
[data-slot="tooltip-arrow"][data-side="right"] {
  left: -0.25rem;
  transform: translateX(1.5px) rotate(45deg);
}
[data-slot="tooltip-arrow"][data-side="inline-start"] {
  right: -0.25rem;
  transform: translateX(-1.5px) rotate(45deg);
}
[data-slot="tooltip-arrow"][data-side="inline-end"] {
  left: -0.25rem;
  transform: translateX(1.5px) rotate(45deg);
}
```

### Tailwind Example

Use content and arrow data attributes for open-state styling:

```html
<div data-slot="tooltip">
  <button data-slot="tooltip-trigger">
    Hover me
  </button>
  <div
    data-slot="tooltip-content"
    data-side="top"
    class="px-2 py-1
           bg-gray-900 text-white text-sm rounded 
           opacity-0 pointer-events-none transition-opacity duration-150
           data-[open]:opacity-100 data-[open]:pointer-events-auto
           data-[instant]:transition-none"
  >
    Tooltip text
    <div
      data-slot="tooltip-arrow"
      class="absolute size-2.5 rotate-45 bg-gray-900
             data-[side=top]:-bottom-1
             data-[side=bottom]:-top-1
             data-[side=left]:-right-1
             data-[side=left]:-translate-x-[1.5px]
             data-[side=right]:-left-1
             data-[side=right]:translate-x-[1.5px]
             data-[side=inline-start]:-right-1
             data-[side=inline-start]:-translate-x-[1.5px]
             data-[side=inline-end]:-left-1
             data-[side=inline-end]:translate-x-[1.5px]"
    ></div>
  </div>
</div>
```

## Warm-up Behavior

When a user closes one tooltip and quickly hovers another, the second tooltip shows instantly (no delay). This creates a fluid browsing experience similar to native OS tooltips.

- Controlled by `skipDelayDuration` option
- Set to `0` to disable this behavior
- Warm-up opens and warm handoff closes use `data-instant="delay"`
- Focus-triggered opens use `data-instant="focus"`
- Dismiss-style closes (for example `Escape`) use `data-instant="dismiss"`
- Warm window is set only when a tooltip actually closes (not when a pending open is cancelled)

## Accessibility

The component automatically handles:

- `role="tooltip"` on content
- `aria-describedby` on trigger only when open (prevents stale announcements)
- `aria-hidden` on content: explicit `"true"`/`"false"` for consistent AT behavior
- Unique ID generation for content via `ensureId`

### Disabled Triggers

If the trigger has `disabled` attribute or `aria-disabled="true"`:
- Pointer and focus events will not open the tooltip
- Programmatic `.show()` also respects the disabled state

## Interaction Model

| Input | Behavior |
|-------|----------|
| Pointer enter trigger (mouse/pen) | Show after delay |
| Pointer leave trigger | Hide immediately (unless entering content) |
| Pointer enter content | Keep open (hoverable content) |
| Pointer leave content | Hide immediately (unless entering trigger) |
| Touch hover | Ignored (focus-only on touch devices) |
| Focus | Show after delay |
| Blur | Hide immediately |
| `Escape` | Hide immediately (listener only active when open) |

**Hoverable Content:** Moving the pointer from trigger to content (or vice versa) keeps the tooltip open. This allows users to interact with links or selectable text in tooltips.

**Focus Priority:** While the trigger has keyboard focus, the tooltip stays open even if the pointer leaves. This prevents jarring closures during keyboard navigation.

## Events

### Outbound Events

Listen for changes via custom events:

```javascript
element.addEventListener("tooltip:change", (e) => {
  const { open, trigger, content, reason } = e.detail;
  console.log(`Tooltip ${open ? 'opened' : 'closed'} via ${reason}`);
});
```

#### Event Detail

| Property | Type | Description |
|----------|------|-------------|
| `open` | `boolean` | Current visibility state |
| `trigger` | `HTMLElement` | The trigger element |
| `content` | `HTMLElement` | The content element |
| `reason` | `string` | What caused the change: `"pointer"`, `"focus"`, `"blur"`, `"escape"`, `"api"` |

### Inbound Events

Control the tooltip via events:

| Event | Detail | Description |
|-------|--------|-------------|
| `tooltip:set` | `{ open: boolean }` | Set visibility programmatically |

```javascript
// Show the tooltip
element.dispatchEvent(
  new CustomEvent("tooltip:set", { detail: { open: true } })
);

// Hide the tooltip
element.dispatchEvent(
  new CustomEvent("tooltip:set", { detail: { open: false } })
);
```

**Note:** Opening respects disabled state (trigger has `disabled` attribute or `aria-disabled="true"`). Closing is always allowed.

#### Deprecated Shapes

The following attributes and shapes are deprecated and will be removed in v1.0:

- Legacy `data-state="open|closed"` styling on `tooltip` root and `tooltip-content`

Use `data-open` / `data-closed`, `data-starting-style`, `data-ending-style`, and `data-instant` instead.

```javascript
// Deprecated: { value: boolean }
element.dispatchEvent(
  new CustomEvent("tooltip:set", { detail: { value: true } })
);
```

Use `{ open: boolean }` instead.

## License

MIT
