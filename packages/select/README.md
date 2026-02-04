# @data-slot/select

A headless, accessible select component for choosing a single value from a dropdown list.

## Installation

```bash
npm install @data-slot/select
```

## Usage

### HTML Structure

```html
<div data-slot="select" data-placeholder="Choose a fruit...">
  <button data-slot="select-trigger">
    <span data-slot="select-value"></span>
    <!-- Add your own chevron icon -->
  </button>
  <div data-slot="select-content" hidden>
    <div data-slot="select-group">
      <div data-slot="select-label">Fruits</div>
      <div data-slot="select-item" data-value="apple">Apple</div>
      <div data-slot="select-item" data-value="banana">Banana</div>
      <div data-slot="select-item" data-value="orange">Orange</div>
    </div>
    <div data-slot="select-separator"></div>
    <div data-slot="select-item" data-value="other">Other</div>
  </div>
</div>
```

### JavaScript

```javascript
import { create, createSelect } from '@data-slot/select';

// Auto-discover and bind all selects
const controllers = create();

// Or bind a specific element
const root = document.querySelector('[data-slot="select"]');
const controller = createSelect(root, {
  defaultValue: 'apple',
  onValueChange: (value) => console.log('Selected:', value),
});

// Programmatic control
controller.open();
controller.close();
controller.select('banana');
console.log(controller.value); // 'banana'

// Cleanup
controller.destroy();
```

## Slots

| Slot | Description |
|------|-------------|
| `select` | Root container |
| `select-trigger` | Button that opens the popup |
| `select-value` | Displays selected value (inside trigger) |
| `select-content` | Popup container for options |
| `select-item` | Individual selectable option |
| `select-group` | Groups related items |
| `select-label` | Label for a group |
| `select-separator` | Visual divider between items/groups |

## Options

Options can be passed via JavaScript or data attributes (JS takes precedence).

| Option | Data Attribute | Type | Default | Description |
|--------|---------------|------|---------|-------------|
| `defaultValue` | `data-default-value` | `string` | `null` | Initial selected value |
| `placeholder` | `data-placeholder` | `string` | `""` | Text when no value selected |
| `disabled` | `data-disabled` | `boolean` | `false` | Disable interaction |
| `required` | `data-required` | `boolean` | `false` | Form validation required |
| `name` | `data-name` | `string` | - | Form field name (creates hidden input) |
| `position` | `data-position` | `"item-aligned" \| "popper"` | `"item-aligned"` | Positioning mode (see below) |
| `avoidCollisions` | `data-avoid-collisions` | `boolean` | `true` | Adjust to stay in viewport |
| `collisionPadding` | `data-collision-padding` | `number` | `8` | Viewport edge padding (px) |

### Positioning Modes

**`item-aligned` (default)**: The popup positions itself so the selected item aligns with the trigger, similar to native `<select>` elements. The popup width matches the trigger width.

**`popper`**: The popup appears below or above the trigger like a dropdown menu. Additional options apply:

| Option | Data Attribute | Type | Default | Description |
|--------|---------------|------|---------|-------------|
| `side` | `data-side` | `"top" \| "bottom"` | `"bottom"` | Popup placement |
| `align` | `data-align` | `"start" \| "center" \| "end"` | `"start"` | Popup alignment |
| `sideOffset` | `data-side-offset` | `number` | `4` | Distance from trigger (px) |
| `alignOffset` | `data-align-offset` | `number` | `0` | Offset from alignment edge (px) |

### Callbacks

| Callback | Type | Description |
|----------|------|-------------|
| `onValueChange` | `(value: string \| null) => void` | Called when selection changes |
| `onOpenChange` | `(open: boolean) => void` | Called when popup opens/closes |

## Controller API

```typescript
interface SelectController {
  readonly value: string | null;   // Current selected value
  readonly isOpen: boolean;        // Current open state
  select(value: string): void;     // Select a value
  open(): void;                    // Open the popup
  close(): void;                   // Close the popup
  destroy(): void;                 // Cleanup
}
```

## Events

### Outbound Events (component emits)

```javascript
root.addEventListener('select:change', (e) => {
  console.log('Value changed:', e.detail.value);
});

root.addEventListener('select:open-change', (e) => {
  console.log('Open state:', e.detail.open);
});
```

### Inbound Events (component listens)

```javascript
// Set value
root.dispatchEvent(new CustomEvent('select:set', {
  detail: { value: 'apple' }
}));

// Set open state
root.dispatchEvent(new CustomEvent('select:set', {
  detail: { open: true }
}));
```

## Data Attributes (State)

The component sets these attributes to reflect state:

| Attribute | Element | Values | Description |
|-----------|---------|--------|-------------|
| `data-state` | root, trigger, content | `"open" \| "closed"` | Open state |
| `data-value` | root | `string` | Current selected value |
| `data-selected` | item | (presence) | Selected item |
| `data-highlighted` | item | (presence) | Keyboard-focused item |
| `data-placeholder` | trigger | (presence) | When showing placeholder |
| `data-label` | item | `string` | Display text for trigger (optional, falls back to textContent) |

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter`, `Space`, `ArrowDown`, `ArrowUp` | Open popup (when trigger focused) |
| `ArrowDown` | Move to next item |
| `ArrowUp` | Move to previous item |
| `Home` | Move to first item |
| `End` | Move to last item |
| `Enter`, `Space` | Select highlighted item |
| `Escape` | Close popup |
| `Tab` | Close popup and move focus |
| Type characters | Jump to matching item |

## Accessibility

- Trigger: `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`
- Content: `role="listbox"`, `aria-labelledby`
- Item: `role="option"`, `aria-selected`, `aria-disabled`
- Group: `role="group"`, `aria-labelledby`
- Disabled items are skipped during keyboard navigation

## Form Integration

When `name` is provided, a hidden input is automatically created for form submission:

```html
<form>
  <div data-slot="select" data-name="fruit">
    <!-- ... -->
  </div>
  <button type="submit">Submit</button>
</form>
```

## License

MIT
