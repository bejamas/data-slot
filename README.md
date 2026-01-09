# data-slot

Headless UI components for vanilla JavaScript. Tiny, accessible, unstyled.

Zero dependencies. Tree-shakeable. Install only what you need.

## Packages

| Package                      | Size   | Description                |
| ---------------------------- | ------ | -------------------------- |
| `@data-slot/navigation-menu` | 2.7 KB | Dropdown navigation menus  |
| `@data-slot/tabs`            | 1.7 KB | Tabbed interfaces, kbd nav |
| `@data-slot/dialog`          | 1.4 KB | Modal dialogs, focus trap  |
| `@data-slot/accordion`       | 1.2 KB | Collapsible sections       |
| `@data-slot/tooltip`         | 821 B  | Hover/focus tooltips       |
| `@data-slot/popover`         | 806 B  | Anchored floating content  |
| `@data-slot/disclosure`      | 629 B  | Simple show/hide toggle    |
| `@data-slot/core`            | 409 B  | Shared utilities           |

## Installation

```bash
bun add @data-slot/tabs
bun add @data-slot/dialog
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
  import { create } from "@data-slot/tabs";

  const controllers = create();
  controllers[0]?.select("two");
</script>
```

## API

All components follow the same pattern:

```typescript
// Auto-discover and bind all instances in the DOM
import { create } from "@data-slot/tabs";
const controllers = create(); // Returns TabsController[]

// Or create for a specific element
import { createTabs } from "@data-slot/tabs";
const tabs = createTabs(document.querySelector('[data-slot="tabs"]'));

tabs.select("news"); // Programmatic control
tabs.destroy(); // Cleanup
```

## Styling

Use `data-state` and ARIA attributes for CSS:

```css
/* Active tab trigger */
[data-slot="tabs-trigger"][aria-selected="true"] {
  font-weight: bold;
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

## Development

```bash
bun install
bun test
bun run typecheck
```

## License

MIT
