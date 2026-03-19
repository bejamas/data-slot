# @data-slot/ui

Headless UI components for vanilla JavaScript. Tiny, accessible, unstyled.

**Convenience subpaths stay tiny and tree-shake cleanly.** Zero dependencies.

## Installation

```bash
npm install @data-slot/ui
```

## Packages

This is a convenience package that re-exports all `@data-slot/*` packages:

| Package | Size | Description |
|---------|------|-------------|
| `@data-slot/navigation-menu` | 7.2 KB | Dropdown navigation menus |
| `@data-slot/core` | 5.5 KB | Shared utilities |
| `@data-slot/command` | 4.7 KB | Command palette with ranked search |
| `@data-slot/combobox` | 4.5 KB | Autocomplete input with filtering |
| `@data-slot/select` | 4.0 KB | Select input with keyboard navigation |
| `@data-slot/dropdown-menu` | 2.7 KB | Action menus with keyboard navigation |
| `@data-slot/hover-card` | 2.6 KB | Hover/focus preview cards |
| `@data-slot/tabs` | 2.3 KB | Tabbed interfaces with keyboard nav |
| `@data-slot/tooltip` | 2.2 KB | Hover/focus tooltips |
| `@data-slot/popover` | 2.0 KB | Anchored floating content |
| `@data-slot/dialog` | 1.9 KB | Modal dialogs with focus management |
| `@data-slot/alert-dialog` | 1.8 KB | Blocking confirmation dialogs |
| `@data-slot/switch` | 1.8 KB | Form-ready on/off switch |
| `@data-slot/toggle-group` | 1.7 KB | Single/multi toggle groups |
| `@data-slot/collapsible` | 1.6 KB | Simple show/hide toggle |
| `@data-slot/accordion` | 1.4 KB | Collapsible content sections |
| `@data-slot/toggle` | 740 B | Pressed-state toggle button |

## Usage

### Subpath Imports (Recommended)

For tree-shaking, use subpath imports:

```typescript
import { create } from "@data-slot/ui/tabs";
import { createDialog } from "@data-slot/ui/dialog";
```

Available subpaths:
- `@data-slot/ui/core`
- `@data-slot/ui/tabs`
- `@data-slot/ui/dialog`
- `@data-slot/ui/alert-dialog`
- `@data-slot/ui/accordion`
- `@data-slot/ui/popover`
- `@data-slot/ui/hover-card`
- `@data-slot/ui/tooltip`
- `@data-slot/ui/collapsible`
- `@data-slot/ui/navigation-menu`
- `@data-slot/ui/dropdown-menu`
- `@data-slot/ui/switch`
- `@data-slot/ui/toggle`
- `@data-slot/ui/toggle-group`
- `@data-slot/ui/select`
- `@data-slot/ui/combobox`
- `@data-slot/ui/command`

### Direct Package Imports

For the smallest bundle, install and import specific packages:

```bash
npm install @data-slot/tabs @data-slot/dialog @data-slot/alert-dialog
```

```typescript
import { create } from "@data-slot/tabs";
import { createDialog } from "@data-slot/dialog";
import { createAlertDialog } from "@data-slot/alert-dialog";
```

### Barrel Import

Import everything (larger bundle):

```typescript
import { createTabs, createDialog, createAlertDialog } from "@data-slot/ui";
```

## Quick Start

```html
<div data-slot="tabs" data-default-value="one">
  <div data-slot="tabs-list">
    <button data-slot="tabs-trigger" data-value="one">Tab One</button>
    <button data-slot="tabs-trigger" data-value="two">Tab Two</button>
  </div>
  <div data-slot="tabs-content" data-value="one">Content One</div>
  <div data-slot="tabs-content" data-value="two">Content Two</div>
</div>

<script type="module">
  import { create } from "@data-slot/ui/tabs";
  
  const controllers = create();
  controllers[0]?.select("two");
</script>
```

## API Pattern

All components follow the same pattern:

```typescript
// Auto-discover and bind all instances in the DOM
import { create } from "@data-slot/ui/tabs";
const controllers = create(); // Returns Controller[]

// Or create for a specific element
import { createTabs } from "@data-slot/ui/tabs";
const tabs = createTabs(document.querySelector('[data-slot="tabs"]'));

tabs.select("news");  // Programmatic control
tabs.destroy();       // Cleanup
```

## Styling

Components are unstyled. Use `data-state`, switch-specific state hooks, and ARIA attributes for CSS:

```css
/* Active tab trigger */
[data-slot="tabs-trigger"][aria-selected="true"] {
  font-weight: bold;
}

/* Checked switch */
[data-slot="switch"][data-checked] {
  background: black;
}

/* Open dialog */
[data-slot="dialog"][data-state="open"] [data-slot="dialog-content"] {
  display: flex;
}
```

With Tailwind:

```html
<button
  data-slot="tabs-trigger"
  class="aria-selected:font-bold aria-selected:border-b-2"
>
  Tab
</button>
```

## Exports

### Functions

| Export | Package |
|--------|---------|
| `createTabs` | @data-slot/tabs |
| `createDialog` | @data-slot/dialog |
| `createAlertDialog` | @data-slot/alert-dialog |
| `createAccordion` | @data-slot/accordion |
| `createPopover` | @data-slot/popover |
| `createHoverCard` | @data-slot/hover-card |
| `createTooltip` | @data-slot/tooltip |
| `createCollapsible` | @data-slot/collapsible |
| `createNavigationMenu` | @data-slot/navigation-menu |
| `createSwitch` | @data-slot/switch |
| `createCombobox` | @data-slot/combobox |
| `createCommand` | @data-slot/command |

### Types

| Export | Package |
|--------|---------|
| `TabsOptions`, `TabsController` | @data-slot/tabs |
| `DialogOptions`, `DialogController` | @data-slot/dialog |
| `AlertDialogOptions`, `AlertDialogController` | @data-slot/alert-dialog |
| `AccordionOptions`, `AccordionController` | @data-slot/accordion |
| `PopoverOptions`, `PopoverController` | @data-slot/popover |
| `HoverCardOptions`, `HoverCardController` | @data-slot/hover-card |
| `TooltipOptions`, `TooltipController` | @data-slot/tooltip |
| `CollapsibleOptions`, `CollapsibleController` | @data-slot/collapsible |
| `NavigationMenuOptions`, `NavigationMenuController` | @data-slot/navigation-menu |
| `SwitchOptions`, `SwitchController` | @data-slot/switch |
| `ComboboxOptions`, `ComboboxController` | @data-slot/combobox |
| `CommandOptions`, `CommandController`, `CommandFilter` | @data-slot/command |

### Core Utilities

From `@data-slot/core`:

- `getPart`, `getParts`, `getRoots` - DOM queries
- `setAria`, `ensureId`, `linkLabelledBy` - ARIA helpers
- `on`, `emit`, `composeHandlers` - Event utilities

## License

MIT
