# @data-slot/navigation-menu

Headless navigation menu (mega menu) component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/navigation-menu
```

## Quick Start

```html
<nav data-slot="navigation-menu">
  <ul data-slot="navigation-menu-list">
    <li data-slot="navigation-menu-item" data-value="products">
      <button data-slot="navigation-menu-trigger">Products</button>
      <div data-slot="navigation-menu-content">
        <a href="/product-a">Product A</a>
        <a href="/product-b">Product B</a>
      </div>
    </li>
    <li data-slot="navigation-menu-item" data-value="company">
      <button data-slot="navigation-menu-trigger">Company</button>
      <div data-slot="navigation-menu-content">
        <a href="/about">About</a>
        <a href="/careers">Careers</a>
      </div>
    </li>
    <div data-slot="navigation-menu-indicator"></div>
  </ul>
  <div data-slot="navigation-menu-viewport"></div>
</nav>

<script type="module">
  import { create } from "@data-slot/navigation-menu";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all navigation menu instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/navigation-menu";

const controllers = create(); // Returns NavigationMenuController[]
```

### `createNavigationMenu(root, options?)`

Create a controller for a specific element.

```typescript
import { createNavigationMenu } from "@data-slot/navigation-menu";

const menu = createNavigationMenu(element, {
  delayOpen: 200,
  delayClose: 150,
  onValueChange: (value) => console.log(value),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delayOpen` | `number` | `200` | Delay before opening on hover (ms) |
| `delayClose` | `number` | `150` | Delay before closing on mouse leave (ms) |
| `openOnFocus` | `boolean` | `true` | Whether focusing a trigger opens its content |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Viewport side relative to trigger |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Viewport alignment on cross-axis |
| `sideOffset` | `number` | `0` | Distance from trigger to viewport (px) |
| `alignOffset` | `number` | `0` | Cross-axis alignment offset (px) |
| `onValueChange` | `(value: string \| null) => void` | `undefined` | Callback when active item changes |

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-delay-open` | number | `200` | Delay before opening on hover (ms) |
| `data-delay-close` | number | `150` | Delay before closing on mouse leave (ms) |
| `data-open-on-focus` | boolean | `true` | Whether focusing a trigger opens its content |
| `data-side` | string | `"bottom"` | Side: `"top"`, `"right"`, `"bottom"`, `"left"` |
| `data-align` | string | `"start"` | Viewport alignment: `"start"`, `"center"`, or `"end"` |
| `data-side-offset` | number | `0` | Distance from trigger to viewport (px) |
| `data-align-offset` | number | `0` | Cross-axis alignment offset (px) |

Boolean attributes: present or `"true"` = true, `"false"` = false, absent = default.

Placement attributes (`data-side`, `data-align`, `data-side-offset`, `data-align-offset`) control
how the viewport is positioned relative to the active trigger:
- `start` - Align viewport left edge with trigger left edge (default)
- `center` - Center viewport under trigger
- `end` - Align viewport right edge with trigger right edge

Can be set on:
1. `navigation-menu-content` (highest priority, per-panel)
2. `navigation-menu-item`
3. `navigation-menu` root (lowest priority, global default)

`navigation-menu-viewport-positioner` / `navigation-menu-positioner` are styling containers.
Their `data-side` / `data-align` are mirrored output values and are not used as placement inputs.

```html
<!-- Faster hover response, no auto-open on focus -->
<nav data-slot="navigation-menu" data-delay-open="100" data-open-on-focus="false">
  ...
</nav>

<!-- Center-align a narrow submenu under its trigger -->
<li data-slot="navigation-menu-item" data-value="company" data-align="center">
  <button data-slot="navigation-menu-trigger">Company</button>
  <div data-slot="navigation-menu-content">
    <a href="/about">About</a>
    <a href="/careers">Careers</a>
  </div>
</li>
```

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `open(value)` | Open a specific item |
| `close()` | Close the menu |
| `value` | Currently active item value (readonly `string \| null`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<nav data-slot="navigation-menu">
  <ul data-slot="navigation-menu-list">
    <li data-slot="navigation-menu-item" data-value="unique-id">
      <button data-slot="navigation-menu-trigger">Label</button>
      <div data-slot="navigation-menu-content">
        <!-- Links, content -->
      </div>
    </li>
    <!-- Optional hover indicator -->
    <div data-slot="navigation-menu-indicator"></div>
  </ul>
  <!-- Optional viewport for animated content switching -->
  <div data-slot="navigation-menu-viewport"></div>
</nav>
```

### Optional Slots

- `navigation-menu-indicator` - Animated highlight that follows the hovered trigger
- `navigation-menu-viewport` - Container for content with size transitions
- `navigation-menu-viewport-positioner` - Positioning wrapper for viewport (generated if not authored)
- `navigation-menu-portal` - Optional authored portal wrapper that can contain positioners

## Styling

`navigation-menu-viewport` is portaled to `document.body` while open. If authored
`navigation-menu-portal` / `navigation-menu-viewport-positioner` slots are present, they are
reused. Otherwise, a `navigation-menu-viewport-positioner` wrapper is generated and positioned
at the navigation root so submenu layers are not clipped by local stacking contexts.

The active `navigation-menu-content` panel is mounted inside `navigation-menu-viewport` while open
and restored to its original markup location when inactive/closed.

### Basic Styling

```css
/* Hidden by default */
[data-slot="navigation-menu-content"] {
  display: none;
}

[data-slot="navigation-menu-content"][data-state="active"] {
  display: block;
}

/* Viewport sizing and positioning */
[data-slot="navigation-menu-viewport"] {
  top: 0;
  left: 0;
  transform: translate3d(0, 0, 0);
  width: var(--viewport-width);
  height: var(--viewport-height);
  transition: transform 0.3s, width 0.3s, height 0.3s;
}

/* Skip animation on initial open */
[data-slot="navigation-menu-viewport"][data-instant] {
  transition: none;
}

/* Indicator positioning */
[data-slot="navigation-menu-indicator"] {
  position: absolute;
  left: var(--indicator-left);
  width: var(--indicator-width);
  transition: left 0.2s, width 0.2s;
}
```

### Motion Animations

Content panels receive `data-motion` attributes for directional enter/exit animations.
Both content and viewport also receive `data-starting-style` / `data-ending-style` markers from
presence lifecycle hooks, so you can style smooth fade/scale transitions before unmount.

```css
/* Entering from right */
[data-slot="navigation-menu-content"][data-motion="from-right"] {
  animation: slideFromRight 0.2s;
}

/* Exiting to left */
[data-slot="navigation-menu-content"][data-motion="to-left"] {
  animation: slideToLeft 0.2s;
}

/* Presence lifecycle helpers */
[data-slot="navigation-menu-content"][data-ending-style],
[data-slot="navigation-menu-viewport"][data-ending-style] {
  opacity: 0;
}

@keyframes slideFromRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideToLeft {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100%); opacity: 0; }
}
```

### CSS Variables

| Variable | Element | Description |
|----------|---------|-------------|
| `--viewport-width` | viewport | Width of active content |
| `--viewport-height` | viewport | Height of active content |
| `--indicator-left` | indicator | Left offset from list |
| `--indicator-width` | indicator | Width of hovered trigger |
| `--indicator-top` | indicator | Top offset from list |
| `--indicator-height` | indicator | Height of hovered trigger |
| `--motion-direction` | viewport | `1` (right) or `-1` (left) |

## Keyboard Navigation

### Within Trigger List

| Key | Action |
|-----|--------|
| `ArrowLeft` | Move focus to previous trigger |
| `ArrowRight` | Move focus to next trigger |
| `ArrowDown` | Move focus into content panel |
| `Home` | Move focus to first trigger |
| `End` | Move focus to last trigger |
| `Escape` | Close menu |

### Within Content Panel

| Key | Action |
|-----|--------|
| `ArrowDown` / `ArrowRight` | Move to next focusable element |
| `ArrowUp` / `ArrowLeft` | Move to previous element (returns to trigger at start) |
| `Escape` | Close menu and return focus to trigger |

## Behavior

- **Hover**: Opens after `delayOpen` ms, closes after `delayClose` ms
- **Click**: Locks menu open until clicking outside or same trigger
- **Focus**: Opens immediately on keyboard focus
- **Switching**: Instant transition between items (no delay)

## Events

### Outbound Events

Listen for changes via custom events:

```javascript
element.addEventListener("navigation-menu:change", (e) => {
  console.log("Active item:", e.detail.value);
});
```

### Inbound Events

Control the navigation menu via events:

| Event | Detail | Description |
|-------|--------|-------------|
| `navigation-menu:set` | `{ value: string \| null }` | Set active item or close menu |

```javascript
// Open a specific item
element.dispatchEvent(
  new CustomEvent("navigation-menu:set", { detail: { value: "products" } })
);

// Close the menu
element.dispatchEvent(
  new CustomEvent("navigation-menu:set", { detail: { value: null } })
);
```

## License

MIT
