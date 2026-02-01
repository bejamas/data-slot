# @data-slot/toggle-group

A group of toggle buttons with shared state, supporting single or multiple selection.

## Installation

```bash
bun add @data-slot/toggle-group
```

## Usage

### Basic Markup

```html
<!-- Single selection (default) -->
<div data-slot="toggle-group" data-default-value="center">
  <button data-slot="toggle-group-item" data-value="left">Left</button>
  <button data-slot="toggle-group-item" data-value="center">Center</button>
  <button data-slot="toggle-group-item" data-value="right">Right</button>
</div>

<!-- Multiple selection -->
<div data-slot="toggle-group" data-multiple data-default-value="bold italic">
  <button data-slot="toggle-group-item" data-value="bold">B</button>
  <button data-slot="toggle-group-item" data-value="italic">I</button>
  <button data-slot="toggle-group-item" data-value="underline">U</button>
</div>
```

### JavaScript

```javascript
import { create, createToggleGroup } from "@data-slot/toggle-group";

// Auto-discover and bind all toggle-group elements
const controllers = create();

// Or target a specific element
const group = createToggleGroup(element, {
  defaultValue: "center",
  multiple: false,
  orientation: "horizontal",
  loop: true,
  onValueChange: (value) => console.log(value),
});

// Programmatic control
group.setValue("left");
group.toggle("bold");
console.log(group.value); // ["left"]

// Cleanup
group.destroy();
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultValue` | `string \| string[]` | `[]` | Initial selected value(s). For multiple values, use array or space-separated string. |
| `multiple` | `boolean` | `false` | Allow multiple selections. |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Orientation for keyboard navigation. |
| `loop` | `boolean` | `true` | Wrap keyboard focus at ends. |
| `disabled` | `boolean` | `false` | Disable the entire group. |
| `onValueChange` | `(value: string[]) => void` | - | Callback when selection changes. |

## Data Attributes

### Root Element

| Attribute | Description |
|-----------|-------------|
| `data-slot="toggle-group"` | Required. Identifies the root element. |
| `data-default-value` | Initial selected value(s). Space-separated for multiple values. |
| `data-multiple` | Enable multiple selection mode. |
| `data-orientation` | `"horizontal"` or `"vertical"` for keyboard navigation. |
| `data-disabled` | Disable the entire group. |

### Item Elements

| Attribute | Description |
|-----------|-------------|
| `data-slot="toggle-group-item"` | Required. Identifies an item. |
| `data-value` | Required. The value associated with this item. |
| `data-disabled` | Disable this specific item. |

### State Attributes (set by component)

| Attribute | Values | Description |
|-----------|--------|-------------|
| `aria-pressed` | `"true"` \| `"false"` | Whether item is pressed. |
| `data-state` | `"on"` \| `"off"` | Visual state for styling. |
| `data-value` (on root) | Space-separated values | Current selection. |

## Events

### Outbound

```javascript
// Listen for changes
root.addEventListener("toggle-group:change", (e) => {
  console.log(e.detail.value); // string[]
});
```

### Inbound

```javascript
// Set selection from outside
root.dispatchEvent(new CustomEvent("toggle-group:set", {
  detail: { value: "bold" }
}));

// Or with array
root.dispatchEvent(new CustomEvent("toggle-group:set", {
  detail: ["bold", "italic"]
}));
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `ArrowRight` / `ArrowDown` | Move to next item (based on orientation) |
| `ArrowLeft` / `ArrowUp` | Move to previous item (based on orientation) |
| `Home` | Move to first item |
| `End` | Move to last item |
| `Enter` / `Space` | Toggle current item |

## Styling

```css
/* Style pressed items */
[data-slot="toggle-group-item"][data-state="on"] {
  background: #333;
  color: white;
}

/* Style disabled items */
[data-slot="toggle-group-item"][aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## Accessibility

- Root has `role="group"`
- Items have `aria-pressed` attribute
- Disabled items have `aria-disabled="true"` and native `disabled`
- Supports roving tabindex for keyboard navigation
- Add `aria-label` or `aria-labelledby` to root for context
