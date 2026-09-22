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
    <div data-slot="select-viewport">
      <div data-slot="select-group">
        <div data-slot="select-label">Fruits</div>
        <div data-slot="select-item" data-value="apple">
          <span data-slot="select-item-text">Apple</span>
        </div>
        <div data-slot="select-item" data-value="banana">
          <span data-slot="select-item-text">Banana</span>
        </div>
        <div data-slot="select-item" data-value="orange">
          <span data-slot="select-item-text">Orange</span>
        </div>
      </div>
      <div data-slot="select-separator"></div>
      <div data-slot="select-item" data-value="other">
        <span data-slot="select-item-text">Other</span>
      </div>
    </div>
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

`createSelect(root)` is idempotent per root. Calling it again for the same element returns the existing controller; destroy it first if you need to rebind with different options.

## API

### Initialization

#### `create(scope?)`

Find and bind uninitialized `[data-slot="select"]` descendants of `scope` (defaults to `document`). Returns `SelectController[]` for newly bound roots. To initialize the scope element itself, use `createSelect`.

```typescript
import { create } from "@data-slot/select";

const controllers = create();
```

#### `createSelect(root, options?)`

Create a `SelectController` for one root element. JavaScript options take precedence over the corresponding data attributes. Calling this again for a bound root returns its existing controller; destroy it before rebinding with new options.

```typescript
import { createSelect } from "@data-slot/select";

const controller = createSelect(element, {});
```

### Slots

#### Runtime Slots

- `select` - Root container.
- `select-trigger` - Required button that opens the popup and anchors its position.
- `select-value` - Optional text target inside the trigger; displays the selected label or placeholder.
- `select-content` - Required popup container for options.
- `select-viewport` - Optional scroll container inside `select-content`; used for item-aligned scrolling when present.
- `select-item` - Individual selectable option.
- `select-item-text` - Optional text anchor inside `select-item`; preferred for exact item-aligned parity with Base/shadcn styles.
- `select-group` - Groups related items.
- `select-label` - Group label (inside a `select-group`).
- `select-positioner` - Optional authored positioning wrapper (reused instead of generated wrapper).
- `select-portal` - Optional authored portal wrapper that can contain `select-positioner`.

#### Style-only Slots

- `select-separator` - Visual divider between items/groups.

Item labels resolve from authored `data-label`, then `select-item-text`, then the item's text content. `data-label` is an input attribute, not generated state.

#### Composed Portal Markup (Optional)

```html
<div data-slot="select">
  <button data-slot="select-trigger">
    <span data-slot="select-value"></span>
  </button>
  <div data-slot="select-portal">
    <div data-slot="select-positioner">
      <div data-slot="select-content" hidden>...</div>
    </div>
  </div>
</div>
```

#### Native Label Support

Use a standard HTML `<label for="...">` element to label the select. The `for` attribute should match the `id` on the trigger button. Clicking the label opens the select, and `aria-labelledby` is set automatically.

```html
<label for="fruit-select">Choose a fruit</label>
<div data-slot="select">
  <button data-slot="select-trigger" id="fruit-select">
    <span data-slot="select-value"></span>
  </button>
  <div data-slot="select-content" hidden>
    <div data-slot="select-group">
      <div data-slot="select-label">Fruits</div>          <!-- group label -->
      <div data-slot="select-item" data-value="apple">Apple</div>
    </div>
  </div>
</div>
```

### Data Attributes

The component sets these attributes to reflect state:

| Attribute | Element | Values | Description |
|-----------|---------|--------|-------------|
| `data-state` | root, trigger, content | `"open" \| "closed"` | Open state |
| `data-position` | content, viewport | `"item-aligned" \| "popper"` | Resolved positioning mode authored by the controller |
| `data-align-trigger` | content | `"true" \| "false"` | Whether the current mode aligns the selected item to the trigger |
| `data-value` | root | `string` | Current selected value |
| `data-selected` | item | (presence) | Selected item |
| `data-highlighted` | item | (presence) | Focused/highlighted item |
| `data-placeholder` | trigger | (presence) | When showing placeholder |

### Options

Options can be passed via JavaScript or data attributes (JS takes precedence).
Placement attributes (`position`, `side`, `align`, `sideOffset`, `alignOffset`, `avoidCollisions`, `collisionPadding`) resolve in this order:

1. JavaScript option
2. `select-content`
3. `select-positioner`
4. `select` root (fallback)

| Option | Data Attribute | Type | Default | Description |
|--------|---------------|------|---------|-------------|
| `defaultValue` | `data-default-value` | `string` | `null` | Initial selected value |
| `defaultOpen` | `data-default-open` | `boolean` | `false` | Initial popup open state |
| `mountStrategy` | Root `data-mount-strategy` | `"lazy" \| "eager"` | `"lazy"` | Detach closed content, or keep it connected and hidden |
| `placeholder` | `data-placeholder` | `string` | `""` | Text when no value selected |
| `disabled` | `data-disabled` | `boolean` | `false` | Disable interaction |
| `required` | `data-required` | `boolean` | `false` | Form validation required |
| `name` | `data-name` | `string` | - | Form field name (creates an internal form control) |
| `position` | `data-position` | `"item-aligned" \| "popper"` | `"item-aligned"` | Positioning mode (see below) |
| `avoidCollisions` | `data-avoid-collisions` | `boolean` | `true` | Adjust to stay in viewport |
| `collisionPadding` | `data-collision-padding` | `number` | `8` | Viewport edge padding (px) |
| `lockScroll` | `data-lock-scroll` | `boolean` | `true` | Lock page scroll while the popup is open |
| `highlightItemOnHover` | `data-highlight-item-on-hover` | `boolean` | `true` | Highlight and focus items on pointer hover |

#### Positioning Modes

**`item-aligned` (default)**: The popup positions itself so the selected item aligns with the trigger, similar to native `<select>` elements. The popup width matches the trigger width.

For the closest Base/shadcn visual parity, wrap the visible label inside each item with `data-slot="select-item-text"`. When absent, the controller falls back to the whole `select-item` box for alignment, trigger display, and typeahead.

**`popper`**: The popup appears below or above the trigger like a dropdown menu. Additional options apply:

| Option | Data Attribute | Type | Default | Description |
|--------|---------------|------|---------|-------------|
| `side` | `data-side` | `"top" \| "bottom"` | `"bottom"` | Popup placement |
| `align` | `data-align` | `"start" \| "center" \| "end"` | `"start"` | Popup alignment |
| `sideOffset` | `data-side-offset` | `number` | `4` | Distance from trigger (px) |
| `alignOffset` | `data-align-offset` | `number` | `0` | Offset from alignment edge (px) |

Both positioning modes set `--transform-origin` on the positioned element (`select-positioner`, or `select-content` when no positioner is used), so content animations can use `transform-origin: var(--transform-origin, center)`.

The controller also mirrors the resolved positioning mode onto the DOM for styling:

- `data-position="item-aligned" | "popper"` on `select-content`
- `data-position="item-aligned" | "popper"` on `select-viewport` when present
- `data-align-trigger="true" | "false"` on `select-content`

Consumers can style against these attributes directly and do not need to author them manually.

#### Callbacks

| Callback | Type | Description |
|----------|------|-------------|
| `onValueChange` | `(value: string \| null) => void` | Called when selection changes |
| `onOpenChange` | `(open: boolean) => void` | Called when popup opens/closes |

### Content mounting and server rendering

Closed popup content and its descendants are detached from the document after
initialization by default. Opening reconnects the same nodes before ARIA linking,
measurement, positioning, and focus. Authored portal/positioner wrappers move with
the content. Dismissal waits for the exit animation before detaching; reopening
cancels pending removal. Selecting an item retains the existing immediate-close
behavior, including focus restoration, and detaches immediately.

Use `createSelect(root, { mountStrategy: "eager" })` or put
`data-mount-strategy="eager"` on the select root to retain hidden content in the
document. JavaScript takes precedence. Default-open selects stay mounted unless
disabled; disabled selects cannot open.

The trigger, displayed value, and generated form control remain connected while
the popup is detached. Programmatic selection, required validation, submission,
and native form reset continue to work while closed. Item nodes and listeners are
preserved across openings. `aria-controls` is present on the trigger only while
open, when the referenced listbox is connected.

Document/root queries no longer find lazy popup content while closed. Retain a
reference before initialization to access it later. The library's `create(scope)`
can discover nested selects in retained content, including inside closed hover
cards. `destroy()` restores authored placement and removes the mounting placeholder,
allowing rebinding; it does not reconnect a root removed from the document.

This reduces live DOM after initialization, **not initial HTML bytes**. Authored
options remain in server-rendered HTML and are still downloaded and parsed. Keep
initial popup markup hidden to avoid a flash before initialization. For a form
that must work without JavaScript, author a native `<select>` fallback and enhance
it deliberately; the generated form control is created by JavaScript and is not
a no-JavaScript fallback. Template content and deferred fetching are not supported
by this mounting option.

### Controller

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

#### Controller Destruction

`destroy()` permanently disposes the controller and hides any open surface without
emitting an additional change event. Repeated destruction is safe; methods on the
old controller become no-ops. Create a new controller on the same root to rebind it.

Focus restoration already queued by a close survives destruction.
Closing with Tab still skips focus restoration to preserve normal Tab navigation.

### Events

#### Outbound Events

```javascript
root.addEventListener('select:change', (e) => {
  console.log('Value changed:', e.detail.value);
});

root.addEventListener('select:open-change', (e) => {
  console.log('Open state:', e.detail.open);
});
```

#### Inbound Events

`select:set` accepts `{ value?: string | null, open?: boolean }`. Use `value: null` to clear the selection. When both fields are supplied, the value is applied before the open state. Programmatic selection works while disabled, but opening is blocked.

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

### Keyboard Navigation

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

### Accessibility

- Trigger: `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls` while open
- Content: `role="listbox"`, `aria-labelledby`
- Item: `role="option"`, `aria-selected`, `aria-disabled`
- Group: `role="group"`, `aria-labelledby`
- Disabled items are skipped during keyboard navigation

### Form Integration

When `name` is provided, an internal control is automatically created for form submission and kept out of the visual and keyboard flow:

```html
<form>
  <div data-slot="select" data-name="fruit">
    <!-- ... -->
  </div>
  <button type="submit">Submit</button>
</form>
```

With `required` / `data-required`, this control participates in native validation. An empty required select blocks form submission and focuses the visible trigger. Disabled selects are excluded from validation and submission. Selected values are preserved exactly, including line breaks.

Resetting the form restores `defaultValue` and its displayed selection without
emitting a value-change event, including when the select has no `name`.
Synchronization happens on the next event-loop task, after the browser resets
native controls. Calling `preventDefault()` on the reset event preserves the current state.

## License

MIT
