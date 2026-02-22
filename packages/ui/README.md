# @data-slot/ui

Headless UI components for vanilla JavaScript. Tiny, accessible, unstyled.

**~3KB gzipped** for the full bundle. Zero dependencies. Tree-shakeable.

## Installation

```bash
npm install @data-slot/ui
```

## Packages

This is a convenience package that re-exports all `@data-slot/*` packages:

| Package | Size | Description |
|---------|------|-------------|
| `@data-slot/dialog` | 1.2 KB | Modal dialogs with focus management |
| `@data-slot/tabs` | 1.1 KB | Tabbed interfaces with keyboard nav |
| `@data-slot/accordion` | 938 B | Collapsible content sections |
| `@data-slot/popover` | 856 B | Anchored floating content |
| `@data-slot/hover-card` | 2.1 KB | Hover/focus preview cards |
| `@data-slot/tooltip` | 772 B | Hover/focus tooltips |
| `@data-slot/collapsible` | 710 B | Simple show/hide toggle |
| `@data-slot/navigation-menu` | ~1.5 KB | Mega menus with hover/keyboard |
| `@data-slot/combobox` | ~3 KB | Autocomplete input with filtering |
| `@data-slot/core` | 452 B | Shared utilities |

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
