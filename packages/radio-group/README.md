# @data-slot/radio-group

Headless radio group component for vanilla JavaScript. Accessible, form-ready, and unstyled.

## Installation

```bash
bun add @data-slot/radio-group
# or
npm install @data-slot/radio-group
```

## Usage

### HTML Structure

```html
<div data-slot="radio-group" data-default-value="pro" data-name="plan">
  <label>
    <span data-slot="radio-group-item" data-value="starter">
      <span data-slot="radio-group-indicator"></span>
    </span>
    Starter
  </label>

  <label>
    <span data-slot="radio-group-item" data-value="pro">
      <span data-slot="radio-group-indicator"></span>
    </span>
    Pro
  </label>
</div>
```

### JavaScript

```javascript
import { create, createRadioGroup } from "@data-slot/radio-group";

// Auto-discover and bind all [data-slot="radio-group"] elements
const controllers = create();

// Or target a specific element
const radioGroup = createRadioGroup(element, {
  defaultValue: "pro",
  name: "plan",
  required: true,
  onValueChange: (value) => console.log("Selected:", value),
});

// Programmatic control
radioGroup.select("enterprise");
radioGroup.clear();
console.log(radioGroup.value); // null

// Cleanup
radioGroup.destroy();
```

## Slots

| Slot | Description |
|------|-------------|
| `radio-group` | Root container |
| `radio-group-item` | Individual radio control |
| `radio-group-indicator` | Optional visual indicator inside an item |

## Options

Options can be passed via JavaScript or data attributes (JS takes precedence).

| Option | Data Attribute | Type | Default | Description |
|--------|---------------|------|---------|-------------|
| `defaultValue` | `data-default-value` | `string` | `null` | Initially selected value |
| `name` | `data-name` | `string` | - | Shared form field name for generated radios |
| `disabled` | `data-disabled` | `boolean` | `false` | Disable user interaction and submission |
| `readOnly` | `data-read-only` / `data-readOnly` | `boolean` | `false` | Prevent user interaction while keeping programmatic control |
| `required` | `data-required` | `boolean` | `false` | Require a selected value for native validation |
| `onValueChange` | - | `(value: string \| null) => void` | - | Callback fired when selection changes |

## Controller API

```typescript
interface RadioGroupController {
  readonly value: string | null;
  select(value: string): void;
  clear(): void;
  destroy(): void;
}
```

## Events

### Outbound Events (on root)

| Event | Detail | Description |
|-------|--------|-------------|
| `radio-group:change` | `{ value: string \| null }` | Fires when the selected value changes |

### Inbound Events (on root)

| Event | Detail | Description |
|-------|--------|-------------|
| `radio-group:set` | `{ value: string \| null }` | Select or clear a value programmatically |

```javascript
// Listen for changes
root.addEventListener("radio-group:change", (e) => {
  console.log("Value:", e.detail.value);
});

// Set value from outside
root.dispatchEvent(
  new CustomEvent("radio-group:set", {
    detail: { value: "pro" },
  }),
);

// Clear selection from outside
root.dispatchEvent(
  new CustomEvent("radio-group:set", {
    detail: { value: null },
  }),
);
```

**Note:** Inbound events are blocked when the group is disabled or read-only. Controller methods still work.

## Labeling Patterns

### Wrapping labels

```html
<label>
  <span data-slot="radio-group-item" data-value="starter">
    <span data-slot="radio-group-indicator"></span>
  </span>
  Starter
</label>
```

### Sibling `label[for]`

```html
<label for="plan-pro">Pro</label>
<span id="plan-pro" data-slot="radio-group-item" data-value="pro">
  <span data-slot="radio-group-indicator"></span>
</span>
```

## Styling

The controller mirrors Base/shadcn-style presence attributes onto items and indicators:

```css
[data-slot="radio-group-item"][data-checked] { ... }
[data-slot="radio-group-item"][data-unchecked] { ... }
[data-slot="radio-group-item"][data-disabled] { ... }
[data-slot="radio-group-indicator"][data-checked] { ... }
[data-slot="radio-group-indicator"][data-unchecked] { ... }
```

The root also mirrors the current value:

```css
[data-slot="radio-group"][data-value="pro"] { ... }
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `ArrowRight` / `ArrowDown` | Move to the next enabled item and select it |
| `ArrowLeft` / `ArrowUp` | Move to the previous enabled item and select it |
| `Home` | Select the first enabled item |
| `End` | Select the last enabled item |
| `Space` / `Enter` | Select the focused item |

## Accessibility

- Root gets `role="radiogroup"` plus `aria-disabled`, `aria-readonly`, and `aria-required`
- Items get `role="radio"`, `aria-checked`, `aria-disabled`, and roving `tabindex`
- Disabled items are skipped during keyboard navigation
- Wrapping labels and `label[for]` associations are mirrored to `aria-labelledby`

## Form Integration

The controller generates one visually hidden native radio input per item. When `name` is provided, those inputs share the same field name and participate in native form submission and reset behavior.

```html
<form>
  <div data-slot="radio-group" data-name="plan" data-required>
    <label>
      <span data-slot="radio-group-item" data-value="starter"></span>
      Starter
    </label>
    <label>
      <span data-slot="radio-group-item" data-value="pro"></span>
      Pro
    </label>
  </div>
</form>
```

## License

MIT
