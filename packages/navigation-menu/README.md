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
| `onValueChange` | `(value: string \| null) => void` | `undefined` | Callback when active item changes |

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-delay-open` | number | `200` | Delay before opening on hover (ms) |
| `data-delay-close` | number | `150` | Delay before closing on mouse leave (ms) |
| `data-open-on-focus` | boolean | `true` | Whether focusing a trigger opens its content |

Boolean attributes: present or `"true"` = true, `"false"` = false, absent = default.

```html
<!-- Faster hover response, no auto-open on focus -->
<nav data-slot="navigation-menu" data-delay-open="100" data-open-on-focus="false">
  ...
</nav>
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

## Styling

### Basic Styling

```css
/* Hidden by default */
[data-slot="navigation-menu-content"] {
  display: none;
}

[data-slot="navigation-menu-content"][data-state="active"] {
  display: block;
}

/* Viewport sizing */
[data-slot="navigation-menu-viewport"] {
  width: var(--viewport-width);
  height: var(--viewport-height);
  transition: width 0.3s, height 0.3s;
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

Content panels receive `data-motion` attributes for enter/exit animations:

```css
/* Entering from right */
[data-slot="navigation-menu-content"][data-motion="from-right"] {
  animation: slideFromRight 0.2s;
}

/* Exiting to left */
[data-slot="navigation-menu-content"][data-motion="to-left"] {
  animation: slideToLeft 0.2s;
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

Listen for changes via custom events:

```javascript
element.addEventListener("navigation-menu:change", (e) => {
  console.log("Active item:", e.detail.value);
});
```

## License

MIT

