# @data-slot/combobox

A headless, accessible combobox component with autocomplete/typeahead filtering.

## Installation

```bash
npm install @data-slot/combobox
```

## Usage

### HTML Structure

```html
<div data-slot="combobox" data-placeholder="Search fruits...">
  <input data-slot="combobox-input" />
  <button data-slot="combobox-trigger">▼</button>
  <div data-slot="combobox-content" hidden>
    <div data-slot="combobox-list">
      <div data-slot="combobox-empty">No results found</div>
      <div data-slot="combobox-group">
        <div data-slot="combobox-label">Fruits</div>
        <div data-slot="combobox-item" data-value="apple">
          Apple
          <span data-slot="combobox-item-indicator">✓</span>
        </div>
        <div data-slot="combobox-item" data-value="banana">
          Banana
          <span data-slot="combobox-item-indicator">✓</span>
        </div>
      </div>
      <div data-slot="combobox-separator"></div>
      <div data-slot="combobox-item" data-value="other">Other</div>
    </div>
  </div>
</div>
```

### JavaScript

```javascript
import { create, createCombobox } from '@data-slot/combobox';

// Auto-discover and bind all comboboxes
const controllers = create();

// Or bind a specific element
const root = document.querySelector('[data-slot="combobox"]');
const controller = createCombobox(root, {
  defaultValue: 'apple',
  onValueChange: (value) => console.log('Selected:', value),
});

// Programmatic control
controller.open();
controller.close();
controller.select('banana');
controller.clear();
console.log(controller.value); // 'banana'

// Cleanup
controller.destroy();
```

## Slots

| Slot | Description |
|------|-------------|
| `combobox` | Root container |
| `combobox-input` | Text input for filtering |
| `combobox-trigger` | Optional button that toggles the popup |
| `combobox-clear` | Optional button that clears the current value and focuses input |
| `combobox-value` | Optional selected-value text target (typically inside `combobox-trigger`) |
| `combobox-content` | Popup container |
| `combobox-list` | Scrollable list wrapper |
| `combobox-item` | Individual selectable option |
| `combobox-item-indicator` | Optional selected-state indicator inside `combobox-item`; hidden automatically for unselected items |
| `combobox-group` | Groups related items |
| `combobox-label` | Group label (inside a `combobox-group`) |
| `combobox-separator` | Visual divider between items/groups |
| `combobox-empty` | Message shown when no items match filter |
| `combobox-positioner` | Optional authored positioning wrapper (reused instead of generated wrapper) |
| `combobox-portal` | Optional authored portal wrapper that can contain `combobox-positioner` |

### Composed Portal Markup (Optional)

```html
<div data-slot="combobox">
  <input data-slot="combobox-input" />
  <button data-slot="combobox-trigger">▼</button>
  <div data-slot="combobox-portal">
    <div data-slot="combobox-positioner">
      <div data-slot="combobox-content" hidden>...</div>
    </div>
  </div>
</div>
```

### Popup-Input Composition (Optional)

Use this when you want a trigger with committed value text and a separate search input inside the popup.

```html
<div data-slot="combobox">
  <button data-slot="combobox-trigger">
    <span data-slot="combobox-value">Select country...</span>
  </button>
  <div data-slot="combobox-content" hidden>
    <input data-slot="combobox-input" placeholder="Search countries..." />
    <div data-slot="combobox-list">...</div>
  </div>
</div>
```

In popup-input mode (`combobox-input` inside `combobox-content`):
- Selection text is synced to `combobox-value`.
- Search input is cleared each time the popup opens.
- Closing keeps the popup input empty.

### Clear Button (Optional)

```html
<div data-slot="combobox">
  <input data-slot="combobox-input" />
  <button data-slot="combobox-clear">Clear</button>
  <div data-slot="combobox-content" hidden>...</div>
</div>
```

When `combobox-clear` is clicked:
- Current value is cleared.
- Input is focused.
- If popup is closed, it remains closed.
- If popup is open, it remains open.
- By default it is out of keyboard tab order (`tabindex="-1"` behavior). Set `tabindex="0"` to make it tabbable.

### Keyboard Tab Stops

- `combobox-input` is the primary keyboard tab stop.
- `combobox-trigger` and `combobox-clear` are out of tab order by default.
- To opt into keyboard tabbing for either control, author `tabindex="0"` on that element.

### Native Label Support

Use a standard HTML `<label for="...">` element to label the combobox. The `for` attribute should match the `id` on the input. Clicking the label focuses the input, and `aria-labelledby` is set automatically.

```html
<label for="fruit-input">Choose a fruit</label>
<div data-slot="combobox">
  <input data-slot="combobox-input" id="fruit-input" />
  <div data-slot="combobox-content" hidden>
    <div data-slot="combobox-list">
      <div data-slot="combobox-item" data-value="apple">Apple</div>
    </div>
  </div>
</div>
```

## Options

Options can be passed via JavaScript or data attributes (JS takes precedence).

| Option | Data Attribute | Type | Default | Description |
|--------|---------------|------|---------|-------------|
| `defaultValue` | `data-default-value` | `string` | `null` | Initial selected value |
| `placeholder` | `data-placeholder` | `string` | `""` | Input placeholder text |
| `disabled` | `data-disabled` | `boolean` | `false` | Disable interaction |
| `required` | `data-required` | `boolean` | `false` | Form validation required |
| `name` | `data-name` | `string` | - | Form field name (creates hidden input) |
| `openOnFocus` | `data-open-on-focus` | `boolean` | `true` | Open popup when input is focused |
| `autoHighlight` | `data-auto-highlight` | `boolean` | `false` | Auto-highlight first visible item after non-whitespace query input |
| `filter` | - | `function` | substring | Custom filter function |
| `itemToStringValue` | - | `(item: HTMLElement \| null, value: string \| null) => string` | item label | Custom text resolver for committed selected-value text (input in inline mode, `combobox-value` in popup-input mode) |
| `side` | `data-side` | `"top" \| "bottom"` | `"bottom"` | Popup placement |
| `align` | `data-align` | `"start" \| "center" \| "end"` | `"start"` | Popup alignment |
| `sideOffset` | `data-side-offset` | `number` | `4` | Distance from input (px) |
| `alignOffset` | `data-align-offset` | `number` | `0` | Offset from alignment edge (px) |
| `avoidCollisions` | `data-avoid-collisions` | `boolean` | `true` | Adjust to stay in viewport |
| `collisionPadding` | `data-collision-padding` | `number` | `8` | Viewport edge padding (px) |

Placement attributes (`data-side`, `data-align`, `data-side-offset`, `data-align-offset`, `data-avoid-collisions`, `data-collision-padding`) resolve in this order:

1. JavaScript option
2. `combobox-content`
3. `combobox-positioner`
4. `combobox` root (fallback)

The positioned element (`combobox-positioner`, or `combobox-content` when no positioner is used) receives these CSS variables for styling:

- `--transform-origin`
- `--available-width`
- `--available-height`
- `--anchor-width`
- `--anchor-height`

When a separate `combobox-positioner` is present, the same values are also mirrored onto `combobox-content` so copied style packs can branch from either element.

### Mobile Behavior

- On touch/coarse-pointer environments, outside `pointerdown` (for example during scroll gestures) does not dismiss the popup.
- Outside tap/click still dismisses the popup.
- While open, popup position tracks scroll so the popup stays anchored.
- On touch/coarse-pointer environments, combobox always positions on the `bottom` side.
- On touch/coarse-pointer environments, collision side-flipping is disabled to avoid jumpy repositioning.

### Callbacks

| Callback | Type | Description |
|----------|------|-------------|
| `onValueChange` | `(value: string \| null) => void` | Called when selection changes |
| `onOpenChange` | `(open: boolean) => void` | Called when popup opens/closes |
| `onInputValueChange` | `(inputValue: string) => void` | Called when user types in the input |

## Controller API

```typescript
interface ComboboxController {
  readonly value: string | null;      // Current selected value
  readonly inputValue: string;        // Current input text
  readonly isOpen: boolean;           // Current open state
  select(value: string): void;        // Select a value
  clear(): void;                      // Clear selection
  open(): void;                       // Open the popup
  close(): void;                      // Close the popup
  setItemToStringValue(itemToStringValue: ((item: HTMLElement | null, value: string | null) => string) | null): void;
  destroy(): void;                    // Cleanup
}
```

## Events

### Outbound Events (component emits)

```javascript
root.addEventListener('combobox:change', (e) => {
  console.log('Value changed:', e.detail.value);
});

root.addEventListener('combobox:open-change', (e) => {
  console.log('Open state:', e.detail.open);
});

root.addEventListener('combobox:input-change', (e) => {
  console.log('Input changed:', e.detail.inputValue);
});
```

### Inbound Events (component listens)

```javascript
// Set value
root.dispatchEvent(new CustomEvent('combobox:set', {
  detail: { value: 'apple' }
}));

// Set open state
root.dispatchEvent(new CustomEvent('combobox:set', {
  detail: { open: true }
}));

// Set runtime selected-value text formatter
root.dispatchEvent(new CustomEvent('combobox:set', {
  detail: { itemToStringValue: (item, value) => value ? value.toUpperCase() : '' }
}));
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `ArrowDown` | Open popup (when closed); move to next visible item |
| `ArrowUp` | Open popup (when closed); move to previous visible item |
| `Home` | Move to first visible item |
| `End` | Move to last visible item |
| `Enter` | Select highlighted item |
| `Escape` | Close popup, restore input to committed value |
| `Tab` | Close popup, restore input, allow normal tab flow |

## Accessibility

- Input: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-autocomplete="list"`
- List: `role="listbox"`, `aria-labelledby`
- Item: `role="option"`, `aria-selected`, `aria-disabled`
- Group: `role="group"`, `aria-labelledby`
- Disabled items are skipped during keyboard navigation

## Form Integration

When `name` is provided, a hidden input is automatically created for form submission:

```html
<form>
  <div data-slot="combobox" data-name="fruit">
    <input data-slot="combobox-input" />
    <div data-slot="combobox-content" hidden>
      <div data-slot="combobox-list">
        <div data-slot="combobox-item" data-value="apple">Apple</div>
      </div>
    </div>
  </div>
  <button type="submit">Submit</button>
</form>
```

## License

MIT
