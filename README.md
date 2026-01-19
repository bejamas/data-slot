<a href="https://data-slot">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://assets.bejamas.com/static/image/data-slot/logo-dark.svg">
    <img alt="data-slot logo" src="https://assets.bejamas.com/static/image/data-slot/logo-light.svg" height="64">
  </picture>
</a>

# data-slot

Headless UI components for vanilla JavaScript. Tiny, accessible, unstyled.

## Features

- **Zero dependencies** - No npm package dependencies, works everywhere
- **Tree-shakeable** - Import only what you use, keep bundles small
- **Accessible** - WAI-ARIA compliant with keyboard navigation built-in
- **Tiny** - Individual components range from 409 B to 2.7 KB
- **Framework-agnostic** - Works with vanilla JavaScript, no framework required
- **TypeScript** - Full TypeScript support with type definitions included

## Quick Start

Add `data-slot` attributes to your HTML and initialize with JavaScript:

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
  import { create } from "@data-slot/tabs";

  const controllers = create();
  controllers[0]?.select("two");
</script>
```

The `create()` function auto-discovers all tabs in the DOM and binds them. Use the controller to programmatically control the component.

## Installation

Install individual packages as needed:

```bash
# npm
npm install @data-slot/tabs @data-slot/dialog

# pnpm
pnpm add @data-slot/tabs @data-slot/dialog

# yarn
yarn add @data-slot/tabs @data-slot/dialog

# bun
bun add @data-slot/tabs @data-slot/dialog
```

## Packages

All packages are independently installable. Each package includes its own README with detailed documentation.

| Package                      | Size   | Description                | Documentation                                |
| ---------------------------- | ------ | -------------------------- | -------------------------------------------- |
| `@data-slot/navigation-menu` | 2.7 KB | Dropdown navigation menus  | [README](packages/navigation-menu/README.md) |
| `@data-slot/tabs`            | 1.7 KB | Tabbed interfaces, kbd nav | [README](packages/tabs/README.md)            |
| `@data-slot/dialog`          | 1.4 KB | Modal dialogs, focus trap  | [README](packages/dialog/README.md)          |
| `@data-slot/accordion`       | 1.2 KB | Collapsible sections       | [README](packages/accordion/README.md)       |
| `@data-slot/tooltip`         | 821 B  | Hover/focus tooltips       | [README](packages/tooltip/README.md)         |
| `@data-slot/popover`         | 806 B  | Anchored floating content  | [README](packages/popover/README.md)         |
| `@data-slot/collapsible`     | 629 B  | Simple show/hide toggle    | [README](packages/collapsible/README.md)     |
| `@data-slot/core`            | 409 B  | Shared utilities           | [README](packages/core/README.md)            |

## API

All components follow the same pattern. You can either auto-discover all instances or create controllers for specific elements.

### Auto-discovery

The `create()` function finds all component instances in the DOM (or within a scope):

```typescript
import { create } from "@data-slot/tabs";

// Find all tabs in the document
const controllers = create(); // Returns TabsController[]

// Or scope to a specific element
const controllers = create(document.querySelector(".my-app"));
```

### Manual creation

Create a controller for a specific element with options:

```typescript
import { createTabs } from "@data-slot/tabs";

const tabs = createTabs(document.querySelector('[data-slot="tabs"]'), {
  defaultValue: "news",
  onValueChange: (value) => console.log("Selected:", value),
});

tabs.select("sports"); // Programmatic control
tabs.destroy(); // Cleanup when done
```

### Other components

The same pattern applies to all components:

```typescript
import { createDialog } from "@data-slot/dialog";
import { createAccordion } from "@data-slot/accordion";
import { createPopover } from "@data-slot/popover";

const dialog = createDialog(element);
const accordion = createAccordion(element);
const popover = createPopover(element);
```

## Styling

Components are unstyled by default. Use `data-state` attributes and ARIA attributes for styling.

### CSS

```css
/* Active tab trigger */
[data-slot="tabs-trigger"][aria-selected="true"] {
  font-weight: bold;
  border-bottom: 2px solid currentColor;
}

/* Using data-state */
[data-slot="tabs-trigger"][data-state="active"] {
  color: blue;
}

[data-slot="tabs-trigger"][data-state="inactive"] {
  color: gray;
}

/* Dialog overlay */
[data-slot="dialog"][data-state="open"] [data-slot="dialog-overlay"] {
  background: rgba(0, 0, 0, 0.5);
}

/* Accordion content */
[data-slot="accordion-content"][hidden] {
  display: none;
}
```

### Tailwind CSS

Use Tailwind's `aria-*` and `data-*` variants:

```html
<button
  data-slot="tabs-trigger"
  class="px-4 py-2 aria-selected:font-bold aria-selected:border-b-2 aria-selected:text-blue-600"
>
  Tab
</button>

<div
  data-slot="dialog-content"
  class="data-[state=open]:flex data-[state=closed]:hidden"
>
  Dialog content
</div>
```

## Examples

See live examples and component demos at **[data-slot.com](https://data-slot.com)**.

## Browser Support

data-slot uses ES modules and modern JavaScript features. It works in all modern browsers that support:

- ES modules (`<script type="module">`)
- `querySelector` and DOM APIs
- Modern JavaScript (ES2017+)

For older browsers, use a bundler like Vite, Rollup, or Webpack with appropriate transpilation.

## Development

This is a monorepo managed with Bun workspaces. Each package is independently buildable and testable.

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build all packages
bun run build
```

Each package has its own directory in `packages/` with its own `package.json`, source code, and tests.

## License

MIT
