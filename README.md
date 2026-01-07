# data-slot

Headless UI components for vanilla JavaScript. Tiny, accessible, unstyled.

**~3KB gzipped** for the full bundle. Zero dependencies. Tree-shakeable.

## Packages

| Package                 | Size   | Description                         |
| ----------------------- | ------ | ----------------------------------- |
| `@data-slot/dialog`     | 1.2 KB | Modal dialogs with focus management |
| `@data-slot/tabs`       | 1.1 KB | Tabbed interfaces with keyboard nav |
| `@data-slot/accordion`  | 938 B  | Collapsible content sections        |
| `@data-slot/popover`    | 856 B  | Anchored floating content           |
| `@data-slot/tooltip`    | 772 B  | Hover/focus tooltips                |
| `@data-slot/disclosure` | 710 B  | Simple show/hide toggle             |
| `@data-slot/core`       | 452 B  | Shared utilities                    |

## Installation

Install only what you need:

```bash
bun add @data-slot/tabs
bun add @data-slot/dialog
```

## Quick Start

```html
<div data-slot="tabs" data-default-value="one">
  <div data-slot="tabs-list">
    <button data-slot="tabs-trigger" data-value="one" aria-selected="true">
      Tab One
    </button>
    <button data-slot="tabs-trigger" data-value="two">Tab Two</button>
  </div>
  <div data-slot="tabs-content" data-value="one">Content One</div>
  <div data-slot="tabs-content" data-value="two" hidden>Content Two</div>
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
