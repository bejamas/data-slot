# @data-slot/dropdown-menu

Headless dropdown menu component with full keyboard navigation and ARIA support.

## Installation

```bash
npm install @data-slot/dropdown-menu
```

## Usage

### HTML Structure

```html
<div data-slot="dropdown-menu">
  <button data-slot="dropdown-menu-trigger">Options</button>
  <div data-slot="dropdown-menu-content">
    <div data-slot="dropdown-menu-group">
      <div data-slot="dropdown-menu-label">Actions</div>
      <button data-slot="dropdown-menu-item">
        Edit
        <span data-slot="dropdown-menu-shortcut">Ctrl+E</span>
      </button>
      <button data-slot="dropdown-menu-item" data-variant="destructive">Delete</button>
    </div>
    <div data-slot="dropdown-menu-separator"></div>
    <button data-slot="dropdown-menu-item" data-disabled>Disabled</button>
  </div>
</div>
```

### JavaScript

```js
import { create, createDropdownMenu } from "@data-slot/dropdown-menu";

// Auto-bind all dropdown menus in the document
const controllers = create();

// Or bind a specific element
const root = document.querySelector('[data-slot="dropdown-menu"]');
const controller = createDropdownMenu(root, {
  onOpenChange: (open) => console.log("Menu open:", open),
  onSelect: (value) => console.log("Selected:", value),
});

// Programmatic control
controller.open();
controller.close();
controller.toggle();
controller.destroy();
```

## Slots

| Slot | Description |
|------|-------------|
| `dropdown-menu` | Root container |
| `dropdown-menu-trigger` | Button that opens the menu |
| `dropdown-menu-content` | The menu panel |
| `dropdown-menu-group` | Groups related items |
| `dropdown-menu-label` | Non-interactive label for groups |
| `dropdown-menu-item` | Clickable menu item |
| `dropdown-menu-separator` | Visual divider |
| `dropdown-menu-shortcut` | Keyboard shortcut hint |

## Data Attributes

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-state` | `open`, `closed` | Current menu state (on root and content) |
| `data-side` | `top`, `right`, `bottom`, `left` | Computed side after collision avoidance (may flip) |
| `data-align` | `start`, `center`, `end` | Requested alignment (position may shift to fit viewport) |
| `data-variant` | `default`, `destructive` | Item variant for styling |
| `data-inset` | - | Adds left padding for alignment |
| `data-disabled` | - | Disables the item |
| `data-highlighted` | - | Currently focused item |
| `data-value` | string | Optional value for item selection |

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open menu (on trigger) or activate item |
| `ArrowDown` | Open menu (on trigger) or move to next item |
| `ArrowUp` | Move to previous item |
| `Home` | Move to first item |
| `End` | Move to last item |
| `Escape` | Close menu |
| `A-Z` | Jump to item starting with letter (typeahead) |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `dropdown-menu:change` | `{ open: boolean }` | Fired when menu opens or closes |
| `dropdown-menu:select` | `{ value: string }` | Fired when an item is selected |

## Options

```ts
interface DropdownMenuOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Callback when an item is selected */
  onSelect?: (value: string) => void;
  /** Close when clicking outside (default: true) */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape (default: true) */
  closeOnEscape?: boolean;
  /** Close when an item is selected (default: true) */
  closeOnSelect?: boolean;

  // Positioning options (Radix-compatible)
  /** Preferred side of trigger: "top" | "right" | "bottom" | "left" (default: "bottom") */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment against trigger: "start" | "center" | "end" (default: "start") */
  align?: "start" | "center" | "end";
  /** Distance from trigger in px (default: 4) */
  sideOffset?: number;
  /** Offset from alignment edge in px (default: 0) */
  alignOffset?: number;
  /** Flip/shift to stay in viewport (default: true) */
  avoidCollisions?: boolean;
  /** Viewport edge padding in px (default: 8) */
  collisionPadding?: number;
}
```

### Data Attribute Options

Options can also be set via data attributes on the root element. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-open` | boolean | `false` | Initial open state |
| `data-close-on-click-outside` | boolean | `true` | Close when clicking outside |
| `data-close-on-escape` | boolean | `true` | Close when pressing Escape |
| `data-close-on-select` | boolean | `true` | Close when an item is selected |
| `data-side` | string | `"bottom"` | Preferred side: top, right, bottom, left |
| `data-align` | string | `"start"` | Alignment: start, center, end |
| `data-side-offset` | number | `4` | Distance from trigger in px |
| `data-align-offset` | number | `0` | Offset from alignment edge in px |
| `data-avoid-collisions` | boolean | `true` | Flip/shift to stay in viewport |
| `data-collision-padding` | number | `8` | Viewport edge padding in px |

Boolean attributes: present or `"true"` = true, `"false"` = false, absent = default.

```html
<!-- Menu positioned at top with larger offset -->
<div data-slot="dropdown-menu" data-side="top" data-side-offset="8">
  ...
</div>

<!-- Menu that stays open after selection -->
<div data-slot="dropdown-menu" data-close-on-select="false">
  ...
</div>
```

## Positioning

The dropdown menu uses `position: fixed` and automatically positions itself relative to the trigger. It supports all standard placement options:

```js
createDropdownMenu(root, {
  side: "bottom",     // top, right, bottom, left
  align: "start",     // start, center, end
  sideOffset: 4,      // gap from trigger
  alignOffset: 0,     // shift along alignment axis
  avoidCollisions: true,
  collisionPadding: 8,
});
```

When `avoidCollisions` is enabled (default), the menu will:
- Flip to the opposite side if it would overflow the viewport
- Shift/clamp to stay within the viewport with the specified padding

The content element receives `data-side` (computed, may flip) and `data-align` (requested, position may shift) attributes, useful for animations.

## License

MIT
