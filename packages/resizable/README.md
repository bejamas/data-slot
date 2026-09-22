# @data-slot/resizable

Headless resizable panel groups for vanilla JavaScript. Accessible, unstyled, tiny.

Inspired by [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
so that shadcn/ui-style component libraries can use it as a drop-in primitive.

## Installation

```bash
npm install @data-slot/resizable
```

## Quick Start

```html
<div data-slot="resizable" data-direction="horizontal">
  <div data-slot="resizable-panel" data-default-size="50" data-min-size="20">Left</div>
  <div data-slot="resizable-handle" aria-label="Resize panels"></div>
  <div data-slot="resizable-panel" data-default-size="50">Right</div>
</div>

<script type="module">
  import { create } from "@data-slot/resizable";

  const controllers = create();
</script>
```

## API

### Initialization

#### `create(scope?)`

Auto-discover and bind all resizable groups in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/resizable";

const controllers = create(); // Returns ResizableController[]
```

#### `createResizable(root, options?)`

Create a controller for a specific element.

```typescript
import { createResizable } from "@data-slot/resizable";

const resizable = createResizable(element, {
  direction: "horizontal",
  keyboardResizeBy: 10,
  onLayoutChange: (layout) => console.log(layout),
});
```

### Slots

| Slot | Description |
| ---- | ----------- |
| `resizable` | Root flex container for the group |
| `resizable-panel` | A panel with a percentage size |
| `resizable-handle` | Focusable separator between adjacent panels |

```html
<div data-slot="resizable">
  <div data-slot="resizable-panel">A</div>
  <div data-slot="resizable-handle" aria-label="Resize panels"></div>
  <div data-slot="resizable-panel">B</div>
</div>
```

A group needs at least one `resizable-panel`, and exactly one
`resizable-handle` between each adjacent pair of panes.

### Data Attributes

Options can also be set via data attributes. JS options take precedence.

On the root:

| Attribute                 | Type   | Default      | Description                      |
| ------------------------- | ------ | ------------ | -------------------------------- |
| `data-direction`          | string | `horizontal` | Layout axis                      |
| `data-keyboard-resize-by` | number | `10`         | Percent moved per arrow keypress |

On each `resizable-panel`:

| Attribute             | Type    | Default    | Description             |
| --------------------- | ------- | ---------- | ----------------------- |
| `data-default-size`   | number  | even split | Initial size (%)        |
| `data-min-size`       | number  | `0`        | Minimum size (%)        |
| `data-max-size`       | number  | `100`      | Maximum size (%)        |
| `data-collapsible`    | boolean | `false`    | Pane can collapse       |
| `data-collapsed-size` | number  | `0`        | Size (%) when collapsed |

### Options

| Option             | Type                         | Default        | Description                      |
| ------------------ | ---------------------------- | -------------- | -------------------------------- |
| `direction`        | `"horizontal" \| "vertical"` | `"horizontal"` | Layout axis                      |
| `keyboardResizeBy` | `number`                     | `10`           | Percent moved per arrow keypress |
| `onLayoutChange`   | `(layout: number[]) => void` | `undefined`    | Called when the layout changes   |

### Controller

Pane indices start at zero. `setLayout()` requires one finite, non-negative number
per panel and a positive total; it normalizes the values to 100% and applies the
panel constraints. Invalid layouts throw without changing the current layout.
`resizePane()` requires a finite size. Indexed mutation methods and `getSize()`
throw for an invalid pane index.

| Method/Property           | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `layout`                  | Current layout as `number[]` of percentages (readonly) |
| `setLayout(sizes)`        | Set the full layout (validated/clamped)                |
| `resizePane(index, size)` | Resize a pane to `size`%                               |
| `collapse(index)`         | Collapse a collapsible pane                            |
| `expand(index)`           | Expand a collapsed pane                                |
| `isCollapsed(index)`      | Whether a pane is collapsed                            |
| `isExpanded(index)`       | Whether a pane is expanded                             |
| `getSize(index)`          | Current size (%) of a pane                             |
| `destroy()`               | Cleanup all listeners and global styles                |

### Events

#### Outbound Events

```javascript
element.addEventListener("resizable:change", (e) => {
  console.log("Layout:", e.detail.layout);
});

element.addEventListener("resizable:dragging", (e) => {
  console.log("Dragging:", e.detail.dragging);
});
```

#### Inbound Events

| Event           | Detail                 | Description                     |
| --------------- | ---------------------- | ------------------------------- |
| `resizable:set` | `{ layout: number[] }` | Set the layout programmatically |

```javascript
element.dispatchEvent(new CustomEvent("resizable:set", { detail: { layout: [30, 70] } }));
```

### Styling

The component sets `flex` styles on the root and panels directly. Give the group
a height and the handles a visible width or height. Use `data-*` attributes for
visual styling:

```css
/* Style the handle */
[data-slot="resizable-handle"] {
  width: 4px;
  background: #ccc;
}

[data-slot="resizable"][data-direction="vertical"] [data-slot="resizable-handle"] {
  width: 100%;
  height: 4px;
}

/* Active drag / keyboard focus */
[data-slot="resizable-handle"][data-active] {
  background: #2563eb;
}

/* Collapsed pane */
[data-slot="resizable-panel"][data-collapsed] {
  opacity: 0;
}
```

Add a CSS transition on `flex-grow` for animated collapse/expand:

```css
[data-slot="resizable-panel"] {
  transition: flex-grow 0.2s ease;
}
```

### Keyboard Navigation

Focus a handle with `Tab` before using these keys:

| Key | Action |
| --- | ------ |
| `ArrowLeft` / `ArrowRight` | Resize a horizontal group by `keyboardResizeBy` (10% by default) |
| `ArrowUp` / `ArrowDown` | Resize a vertical group by the same step |
| `Shift` + arrow key | Move to the limit in that direction |
| `Home` / `End` | Minimize / maximize the preceding panel within constraints |
| `Enter` | Toggle collapse of the preceding panel when it is collapsible |
| `F6` / `Shift` + `F6` | Focus the next / previous handle, wrapping within the group |

### Accessibility

The component automatically handles:

- `role="separator"` on each handle
- `aria-orientation` (perpendicular to the layout direction)
- `aria-controls` linking each handle to its preceding pane
- `aria-valuemin` / `aria-valuemax` / `aria-valuenow` reflecting live constraints
- Unique ID generation for the root, panes, and handles

Give each handle an accessible name with `aria-label` or `aria-labelledby`.

### Behavior

#### Persisting Layout

There is no built-in persistence, but reading and restoring the split is a
one-liner:

```javascript
import { createResizable } from "@data-slot/resizable";

const el = document.querySelector('[data-slot="resizable"]');
const saved = localStorage.getItem("layout:sidebar");

const resizable = createResizable(el, {
  onLayoutChange(layout) {
    localStorage.setItem("layout:sidebar", JSON.stringify(layout));
  },
});

if (saved) resizable.setLayout(JSON.parse(saved));
```

## License

MIT
