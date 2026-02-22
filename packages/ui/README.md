# @data-slot/ui

Headless UI components for vanilla JavaScript. Tiny, accessible, unstyled.

**Subpaths range from 614 B to 6.2 KB gzipped** (ESM `dist/index.js`). Zero dependencies. Tree-shakeable.

## Installation

```bash
npm install @data-slot/ui
```

## Packages

This is a convenience package that re-exports all `@data-slot/*` packages:

| Package | Size | Description |
|---------|------|-------------|
| `@data-slot/navigation-menu` | 6.2 KB | Dropdown navigation menus |
| `@data-slot/core` | 4.5 KB | Shared utilities |
| `@data-slot/combobox` | 3.7 KB | Autocomplete input with filtering |
| `@data-slot/select` | 3.7 KB | Select input with keyboard navigation |
| `@data-slot/dropdown-menu` | 2.4 KB | Action menus with keyboard navigation |
| `@data-slot/hover-card` | 2.0 KB | Hover/focus preview cards |
| `@data-slot/tabs` | 1.8 KB | Tabbed interfaces with keyboard nav |
| `@data-slot/popover` | 1.8 KB | Anchored floating content |
| `@data-slot/dialog` | 1.8 KB | Modal dialogs with focus management |
| `@data-slot/toggle-group` | 1.5 KB | Single/multi toggle groups |
| `@data-slot/collapsible` | 1.5 KB | Simple show/hide toggle |
| `@data-slot/accordion` | 1.3 KB | Collapsible content sections |
| `@data-slot/tooltip` | 1.1 KB | Hover/focus tooltips |
| `@data-slot/toggle` | 614 B | Pressed-state toggle button |

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
- `@data-slot/ui/accordion`
- `@data-slot/ui/popover`
- `@data-slot/ui/hover-card`
- `@data-slot/ui/tooltip`
- `@data-slot/ui/collapsible`
- `@data-slot/ui/navigation-menu`
- `@data-slot/ui/dropdown-menu`
- `@data-slot/ui/toggle`
- `@data-slot/ui/toggle-group`
- `@data-slot/ui/select`
- `@data-slot/ui/combobox`

### Direct Package Imports

For the smallest bundle, install and import specific packages:

```bash
npm install @data-slot/tabs @data-slot/dialog
```

```typescript
import { create } from "@data-slot/tabs";
import { createDialog } from "@data-slot/dialog";
```

### Barrel Import

Import everything (larger bundle):

```typescript
import { createTabs, createDialog, createAccordion } from "@data-slot/ui";
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

Components are unstyled. Use `data-state` and ARIA attributes for CSS:

```css
/* Active tab trigger */
[data-slot="tabs-trigger"][aria-selected="true"] {
  font-weight: bold;
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
| `createAccordion` | @data-slot/accordion |
| `createPopover` | @data-slot/popover |
| `createHoverCard` | @data-slot/hover-card |
| `createTooltip` | @data-slot/tooltip |
| `createCollapsible` | @data-slot/collapsible |
| `createNavigationMenu` | @data-slot/navigation-menu |
| `createCombobox` | @data-slot/combobox |

### Types

| Export | Package |
|--------|---------|
| `TabsOptions`, `TabsController` | @data-slot/tabs |
| `DialogOptions`, `DialogController` | @data-slot/dialog |
| `AccordionOptions`, `AccordionController` | @data-slot/accordion |
| `PopoverOptions`, `PopoverController` | @data-slot/popover |
| `HoverCardOptions`, `HoverCardController` | @data-slot/hover-card |
| `TooltipOptions`, `TooltipController` | @data-slot/tooltip |
| `CollapsibleOptions`, `CollapsibleController` | @data-slot/collapsible |
| `NavigationMenuOptions`, `NavigationMenuController` | @data-slot/navigation-menu |
| `ComboboxOptions`, `ComboboxController` | @data-slot/combobox |

### Core Utilities

From `@data-slot/core`:

- `getPart`, `getParts`, `getRoots` - DOM queries
- `setAria`, `ensureId`, `linkLabelledBy` - ARIA helpers
- `on`, `emit`, `composeHandlers` - Event utilities

## License

MIT
