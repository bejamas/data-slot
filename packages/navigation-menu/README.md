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
  <div data-slot="navigation-menu-portal">
    <div data-slot="navigation-menu-positioner">
      <div data-slot="navigation-menu-popup">
        <div data-slot="navigation-menu-viewport"></div>
      </div>
    </div>
  </div>
</nav>

<script type="module">
  import { create } from "@data-slot/navigation-menu";
  
  const controllers = create();
</script>
```

Minimal markup that only authors `navigation-menu-viewport` still works. The runtime
generates the popup stack while the menu is open and restores the original DOM on close.

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
  delayOpen: 0,
  delayClose: 0,
  onValueChange: (value) => console.log(value),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delayOpen` | `number` | `0` | Delay before opening on hover (ms) |
| `delayClose` | `number` | `0` | Delay before closing on mouse leave (ms) |
| `openOnFocus` | `boolean` | `false` | Whether focusing a trigger opens its content |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Viewport side relative to trigger |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Viewport alignment on cross-axis |
| `sideOffset` | `number` | `0` | Distance from trigger to viewport (px) |
| `alignOffset` | `number` | `0` | Cross-axis alignment offset (px) |
| `positionMethod` | `"absolute" \| "fixed"` | `"absolute"` | Positioning strategy for the shared popup positioner |
| `safeTriangle` | `boolean` | `false` | Enable hover safe-triangle switching guard |
| `onValueChange` | `(value: string \| null) => void` | `undefined` | Callback when active item changes |
| `debugSafeTriangle` | `boolean` | `false` | Show red hover safe-triangle debug overlay |

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-delay-open` | number | `0` | Delay before opening on hover (ms) |
| `data-delay-close` | number | `0` | Delay before closing on mouse leave (ms) |
| `data-open-on-focus` | boolean | `false` | Whether focusing a trigger opens its content |
| `data-side` | string | `"bottom"` | Side: `"top"`, `"right"`, `"bottom"`, `"left"` |
| `data-align` | string | `"start"` | Viewport alignment: `"start"`, `"center"`, or `"end"` |
| `data-side-offset` | number | `0` | Distance from trigger to viewport (px) |
| `data-align-offset` | number | `0` | Cross-axis alignment offset (px) |
| `data-position-method` | string | `"absolute"` | Positioning strategy: `"absolute"` or `"fixed"` |
| `data-safe-triangle` | boolean | `false` | Enable hover safe-triangle switching guard |
| `data-debug-safe-triangle` | boolean | `false` | Show red hover safe-triangle debug overlay |

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

`navigation-menu-positioner` is the canonical popup positioning slot. Its `data-side` /
`data-align` are mirrored output values and are not used as placement inputs.
`navigation-menu-viewport-positioner` is still accepted as a legacy alias.

```html
<!-- Faster hover response with focus auto-open opt-in -->
<nav data-slot="navigation-menu" data-delay-open="100" data-open-on-focus="true">
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
  <div data-slot="navigation-menu-portal">
    <div data-slot="navigation-menu-positioner">
      <div data-slot="navigation-menu-popup">
        <div data-slot="navigation-menu-viewport"></div>
      </div>
    </div>
  </div>
</nav>
```

If you only author `navigation-menu-viewport`, the runtime synthesizes the missing
`navigation-menu-portal`, `navigation-menu-positioner`, and `navigation-menu-popup`
wrappers while the menu is open.

### Slots

- `navigation-menu-indicator` - Animated highlight that follows top-level hover/focus targets; when a submenu is open, it stays anchored to the active trigger
- `navigation-menu-portal` - Portal wrapper that is moved to `document.body` while the menu is open
- `navigation-menu-positioner` - Canonical popup positioning surface; receives resolved side/alignment output and sizing vars
- `navigation-menu-popup` - Canonical animated popup shell that wraps the viewport
- `navigation-menu-viewport` - Clipping viewport that holds the active content panel
- `navigation-menu-viewport-positioner` - Deprecated alias for `navigation-menu-positioner`
- `navigation-menu-bridge` - Hover safety shield (gap bridge + triangle corridor)
- `navigation-menu-safe-triangle` - Debug-only hover safety polygon (rendered when enabled)

### Output Attributes

| Surface | Attributes |
|---------|------------|
| root | `data-state="open\|closed"`, `data-open`, `data-closed` |
| positioner | `data-state="open\|closed"`, `data-open`, `data-closed`, `data-side`, `data-align`, `data-instant` |
| popup | `data-state="open\|closed"`, `data-open`, `data-closed`, `data-side`, `data-align`, `data-starting-style`, `data-ending-style`, `data-instant` |
| viewport | `data-state="open\|closed"`, `data-open`, `data-closed`, `data-side`, `data-align`, `data-starting-style`, `data-ending-style`, `data-instant` |
| content | `data-state="active\|inactive"`, `data-open`, `data-closed`, `data-side`, `data-align`, `data-starting-style`, `data-ending-style`, `data-activation-direction="left\|right"` |

`data-activation-direction` is only emitted while switching between open top-level panels.
A full close is intentionally non-directional.

## Styling

`navigation-menu-portal` is moved to `document.body` while open. If authored popup-stack slots
are present, they are reused. Otherwise, missing `portal` / `positioner` / `popup` wrappers are
generated while open and removed on close.

Runtime geometry is owned by `navigation-menu-positioner`: `position`, `top`, `left`, `width`,
and `height` are written inline and reset on close. `navigation-menu-popup` is the canonical
animated shell. The active `navigation-menu-content` panel is mounted inside
`navigation-menu-viewport` while open and restored to its original markup location when inactive
or closed.

Use `positionMethod: "fixed"` or `data-position-method="fixed"` when the menu needs viewport-based
anchoring, such as inside sticky headers.

### Basic Styling

```css
/* Hidden by default */
[data-slot="navigation-menu-content"] {
  display: none;
}

[data-slot="navigation-menu-content"][data-open] {
  display: block;
}

/* Positioner owns placement geometry */
[data-slot="navigation-menu-positioner"],
[data-slot="navigation-menu-viewport-positioner"] {
  top: 0;
  left: 0;
  transition: top 0.3s, left 0.3s;
}

/* Skip initial position animation */
[data-slot="navigation-menu-positioner"][data-instant],
[data-slot="navigation-menu-viewport-positioner"][data-instant] {
  transition: none;
}

/* Popup owns the main shell animation */
[data-slot="navigation-menu-popup"] {
  transform-origin: var(--transform-origin);
  width: var(--popup-width);
  height: var(--popup-height);
  transition: transform 0.3s, width 0.3s, height 0.3s, opacity 0.15s;
}

[data-slot="navigation-menu-popup"][data-starting-style],
[data-slot="navigation-menu-popup"][data-ending-style] {
  opacity: 0;
}

/* Viewport keeps backward-compatible sizing aliases */
[data-slot="navigation-menu-viewport"] {
  width: var(--viewport-width);
  height: var(--viewport-height);
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

`data-instant` is used for the initial open phase and for sync-driven anchor tracking updates
(for example when a sticky trigger moves while the menu is open). It is cleared when switching,
closing, or after the tracking update settles. Use it to skip those reposition transitions without
suppressing exit animations.

### Motion Animations

Use `data-starting-style` / `data-ending-style` on `navigation-menu-popup` for full popup
open/close animations, and on `navigation-menu-content` for panel presence.
Directional panel switching should key off `data-activation-direction="left|right"` on content.
The active panel stays in normal flow; mounted inactive/exiting panels are absolutely positioned
by the runtime so they do not affect popup measurement while they animate out.

For exit animations, avoid CSS that force-hides content immediately by `data-state`
(for example `display: none` on non-active panels), because that bypasses the presence lifecycle.

```css
[data-slot="navigation-menu-popup"][data-starting-style],
[data-slot="navigation-menu-popup"][data-ending-style] {
  opacity: 0;
  transform: scale(0.96);
}

[data-slot="navigation-menu-content"][data-starting-style],
[data-slot="navigation-menu-content"][data-ending-style] {
  opacity: 0;
}

[data-slot="navigation-menu-content"][data-starting-style][data-activation-direction="right"] {
  transform: translateX(2rem);
}

[data-slot="navigation-menu-content"][data-starting-style][data-activation-direction="left"] {
  transform: translateX(-2rem);
}

[data-slot="navigation-menu-content"][data-ending-style][data-activation-direction="right"] {
  transform: translateX(-2rem);
}

[data-slot="navigation-menu-content"][data-ending-style][data-activation-direction="left"] {
  transform: translateX(2rem);
}
```

Legacy `data-motion` and `--motion-direction` are still emitted during panel switches for backward
compatibility. That includes both root-level and content-level `data-motion` output, but
`data-activation-direction` is the canonical directional hook.

`--popup-width` / `--popup-height` are the popup shell size vars. While the menu is open, they stay
at fixed pixel values so CSS can animate panel-to-panel size changes directly between `px` targets.
Initial open writes the measured size synchronously; the shell does not need an `auto` reset while
open.

### CSS Variables

| Variable | Element | Description |
|----------|---------|-------------|
| `--popup-width` | popup | Popup width while open; CSS can animate shell width between pixel values |
| `--popup-height` | popup | Popup height while open; CSS can animate shell height between pixel values |
| `--positioner-width` | positioner | Measured width of the active panel |
| `--positioner-height` | positioner | Measured height of the active panel |
| `--available-width` | positioner | Available width between the active trigger and the viewport edge |
| `--available-height` | positioner | Available height between the active trigger and the viewport edge |
| `--transform-origin` | popup / viewport / content / positioner | Pixel origin anchored to trigger (`side` + `align`), scoped to each element's coordinate space |
| `--viewport-width` | viewport | Legacy alias for the active panel width |
| `--viewport-height` | viewport | Legacy alias for the active panel height |
| `--indicator-left` | indicator | Left offset from list |
| `--indicator-width` | indicator | Width of hovered trigger |
| `--indicator-top` | indicator | Top offset from list |
| `--indicator-height` | indicator | Height of hovered trigger |
| `--motion-direction` | viewport | Legacy switching direction output: `1` (right) or `-1` (left) |

### Deprecated Compatibility

- `navigation-menu-viewport-positioner` is a deprecated alias for `navigation-menu-positioner`.
- `--viewport-width`, `--viewport-height`, root/content `data-motion`, and `--motion-direction` are deprecated and planned for removal in the next major release.
- Content-wrapped `navigation-menu-portal` / `navigation-menu-positioner` shells are restore-only compatibility and are also planned for removal in the next major release.

## Keyboard Navigation

### Within Top-Level Items

| Key | Action |
|-----|--------|
| `ArrowLeft` | Move focus to previous top-level item (submenu trigger or plain link) |
| `ArrowRight` | Move focus to next top-level item (submenu trigger or plain link) |
| `Tab` | Move focus to next top-level item in DOM order |
| `Shift+Tab` | Move focus to previous top-level item in reverse DOM order |
| `ArrowDown` | Move focus into content panel (only when focused item has submenu content) |
| `Home` | Move focus to first top-level item |
| `End` | Move focus to last top-level item |
| `Escape` | Close menu |

Top-level submenu triggers and plain links remain in the natural tab order.

### Within Content Panel

| Key | Action |
|-----|--------|
| `ArrowDown` / `ArrowRight` | Move to next focusable element |
| `ArrowUp` / `ArrowLeft` | Move to previous element (returns to trigger at start) |
| `Tab` | From last content item, move focus to next top-level nav item; if none, move to next focusable after nav root |
| `Shift+Tab` | From first content item, move focus back to owning trigger |
| `Escape` | Close menu and return focus to trigger |

## Behavior

- **Hover**: Opens after `delayOpen` ms, closes after `delayClose` ms
- **Click**: Locks menu open until explicit action (click same trigger, click another trigger, click outside, or `Escape`); hover does not switch/close while locked
- **Focus**: Does not auto-open by default; set `openOnFocus` / `data-open-on-focus="true"` to opt in
- **Trigger open focus**:
  - Pointer click/tap keeps focus on the trigger
  - Keyboard activation/programmatic click moves focus into menu content (first focusable item, or content panel fallback)
- **Indicator**: Plain top-level links participate in indicator positioning when no submenu is open; open submenu state takes precedence
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
