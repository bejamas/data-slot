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
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"top"` | Side of tooltip relative to trigger (bind-time only) |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Alignment along the side (bind-time only) |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Callback when visibility changes |

**Note:** `side` and `align` are resolved once at bind time. To change placement dynamically, destroy and recreate the tooltip with new options.

### Data Attributes

Options can also be set via data attributes. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-delay` | number | `300` | Delay before showing tooltip (ms) |
| `data-skip-delay-duration` | number | `300` | Duration to skip delay after closing (ms) |
| `data-side` | string | `"top"` | Side relative to trigger (checked on content first, then root) |
| `data-align` | string | `"center"` | Alignment along the side (checked on content first, then root) |

```html
<!-- Tooltip with faster response -->
<div data-slot="tooltip" data-delay="100">
  ...
</div>

<!-- Disable warm-up behavior -->
<div data-slot="tooltip" data-skip-delay-duration="0">
  ...
</div>

<!-- Side/align on content element -->
<div data-slot="tooltip-content" data-side="bottom" data-align="start">
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
  <div data-slot="tooltip-content">Content</div>
</div>
```

Both `tooltip-trigger` and `tooltip-content` are required.

### Output Attributes

The component sets these attributes automatically:

| Element | Attribute | Values |
|---------|-----------|--------|
| Root | `data-state` | `"open"` \| `"closed"` |
| Content | `data-state` | `"open"` \| `"closed"` |
| Content | `data-side` | `"top"` \| `"right"` \| `"bottom"` \| `"left"` |
| Content | `data-align` | `"start"` \| `"center"` \| `"end"` |
| Content | `role` | `"tooltip"` |
| Content | `aria-hidden` | `"true"` when closed, `"false"` when open |
| Trigger | `aria-describedby` | Content ID when open, removed when closed |

## Styling

This tooltip uses simple CSS positioning and is not collision-aware. Visibility is controlled entirely via CSS using the `data-state` attribute.

### Recommended CSS

The visibility transition trick keeps the tooltip visible during fade-out, then becomes non-focusable after the transition completes—no JS timers needed.

```css
/* Positioning */
[data-slot="tooltip"] {
  position: relative;
}

[data-slot="tooltip-content"] {
  position: absolute;
  white-space: nowrap;
  /* Hidden by default */
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  /* Visibility delays hiding until after opacity fades */
  transition: opacity 0.15s, visibility 0s linear 0.15s;
}

/* Open state */
[data-slot="tooltip"][data-state="open"] [data-slot="tooltip-content"] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition-delay: 0s;
}

/* Side positioning */
[data-slot="tooltip-content"][data-side="top"] {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
}

[data-slot="tooltip-content"][data-side="bottom"] {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}

[data-slot="tooltip-content"][data-side="left"] {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 8px;
}

[data-slot="tooltip-content"][data-side="right"] {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
}

/* Alignment (example for top/bottom sides) */
[data-slot="tooltip-content"][data-side="top"][data-align="start"],
[data-slot="tooltip-content"][data-side="bottom"][data-align="start"] {
  left: 0;
  transform: none;
}

[data-slot="tooltip-content"][data-side="top"][data-align="end"],
[data-slot="tooltip-content"][data-side="bottom"][data-align="end"] {
  left: auto;
  right: 0;
  transform: none;
}
```

### Tailwind Example

Use `group` on the root and `group-data-[state=open]:` for open state styles:

```html
<div data-slot="tooltip" class="group relative inline-block">
  <button data-slot="tooltip-trigger">
    Hover me
  </button>
  <div 
    data-slot="tooltip-content" 
    data-side="top"
    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 
           bg-gray-900 text-white text-sm rounded 
           opacity-0 pointer-events-none transition-opacity duration-150
           group-data-[state=open]:opacity-100 
           group-data-[state=open]:pointer-events-auto"
  >
    Tooltip text
  </div>
</div>
```

## Warm-up Behavior

When a user closes one tooltip and quickly hovers another, the second tooltip shows instantly (no delay). This creates a fluid browsing experience similar to native OS tooltips.

- Controlled by `skipDelayDuration` option
- Set to `0` to disable this behavior
- Warm-up only skips the delay, not CSS transitions
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

Listen for changes via custom events:

```javascript
element.addEventListener("tooltip:change", (e) => {
  const { open, trigger, content, reason } = e.detail;
  console.log(`Tooltip ${open ? 'opened' : 'closed'} via ${reason}`);
});
```

### Event Detail

| Property | Type | Description |
|----------|------|-------------|
| `open` | `boolean` | Current visibility state |
| `trigger` | `HTMLElement` | The trigger element |
| `content` | `HTMLElement` | The content element |
| `reason` | `string` | What caused the change: `"pointer"`, `"focus"`, `"blur"`, `"escape"`, `"api"` |

## License

MIT
