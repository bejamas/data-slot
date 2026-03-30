# @data-slot/dropdown-menu

Headless dropdown menu for vanilla JavaScript. Supports action items, single-select radio items, and multi-select checkbox items with full keyboard navigation and ARIA support.

## Installation

```bash
npm install @data-slot/dropdown-menu
```

## Usage

### Action Menu

```html
<div data-slot="dropdown-menu">
  <button data-slot="dropdown-menu-trigger">Actions</button>
  <div data-slot="dropdown-menu-content">
    <button data-slot="dropdown-menu-item" data-value="edit">Edit</button>
    <button data-slot="dropdown-menu-item" data-value="copy">Copy</button>
    <button data-slot="dropdown-menu-item" data-variant="destructive" data-value="delete">
      Delete
    </button>
  </div>
</div>
```

### Single-Select Menu

```html
<div data-slot="dropdown-menu" data-default-value="pro">
  <button data-slot="dropdown-menu-trigger">Plan</button>
  <div data-slot="dropdown-menu-content">
    <button data-slot="dropdown-menu-radio-item" data-value="starter">Starter</button>
    <button data-slot="dropdown-menu-radio-item" data-value="pro">Pro</button>
    <button data-slot="dropdown-menu-radio-item" data-value="team">Team</button>
  </div>
</div>
```

### Multi-Select Menu

```html
<div
  data-slot="dropdown-menu"
  data-close-on-select="false"
  data-default-values='["email","push"]'
>
  <button data-slot="dropdown-menu-trigger">Channels</button>
  <div data-slot="dropdown-menu-content">
    <button data-slot="dropdown-menu-checkbox-item" data-value="email">Email</button>
    <button data-slot="dropdown-menu-checkbox-item" data-value="sms">SMS</button>
    <button data-slot="dropdown-menu-checkbox-item" data-value="push">Push</button>
  </div>
</div>
```

### JavaScript

```js
import { create, createDropdownMenu } from "@data-slot/dropdown-menu";

const controllers = create();

const root = document.querySelector('[data-slot="dropdown-menu"]');
const controller = createDropdownMenu(root, {
  onOpenChange: (open) => console.log("open:", open),
  onSelect: (value) => console.log("activation:", value),
  onValueChange: (value) => console.log("radio value:", value),
  onValuesChange: (values) => console.log("checkbox values:", values),
});

controller.set({ value: "pro" });
controller.set({ values: ["email", "push"] });
controller.set({ open: true, highlightedValue: "push" });
controller.destroy();
```

`createDropdownMenu(root)` is idempotent per root. Calling it again for the same element returns the existing controller.

## Controller

```ts
interface DropdownMenuController {
  open(): void;
  close(): void;
  toggle(): void;
  set(detail: DropdownMenuSetDetail): void;
  readonly isOpen: boolean;
  readonly value: string | null;
  readonly values: string[];
  readonly highlightedValue: string | null;
  destroy(): void;
}
```

`set()` applies fields in this order: `value`, `values`, `open`, `highlightedValue`.

- `set({ value })` commits radio selection.
- `set({ values })` commits checkbox selection.
- `set({ open })` opens or closes the menu.
- `set({ highlightedValue })` updates highlight only while the menu is open.
- Programmatic `set()` never emits `dropdown-menu:select`.
- No-op updates are silent.
- Unknown `value` / `values` targets are ignored, not thrown.

## Slots

| Slot | Description |
|------|-------------|
| `dropdown-menu` | Root container |
| `dropdown-menu-trigger` | Button that opens the menu |
| `dropdown-menu-content` | Menu panel |
| `dropdown-menu-item` | Action item with no owned selection state |
| `dropdown-menu-radio-item` | Single-select menu item |
| `dropdown-menu-checkbox-item` | Multi-select menu item |
| `dropdown-menu-group` | Groups related items |
| `dropdown-menu-label` | Non-interactive label |
| `dropdown-menu-separator` | Visual divider |
| `dropdown-menu-shortcut` | Keyboard shortcut hint |
| `dropdown-menu-positioner` | Optional authored positioning wrapper |
| `dropdown-menu-portal` | Optional authored portal wrapper that contains `dropdown-menu-positioner` |

### Composed Portal Markup

```html
<div data-slot="dropdown-menu">
  <button data-slot="dropdown-menu-trigger">Options</button>
  <div data-slot="dropdown-menu-portal">
    <div data-slot="dropdown-menu-positioner">
      <div data-slot="dropdown-menu-content">...</div>
    </div>
  </div>
</div>
```

## State and Data Attributes

### Root and Content

| Attribute | Target | Description |
|-----------|--------|-------------|
| `data-state="open|closed"` | root, content | Current open state |
| `data-open` / `data-closed` | root, content | Presence aliases for state styling |
| `data-value="..."` | root | Current committed radio value only |
| `data-side` | content, positioner | Computed side after collision handling |
| `data-align` | content, positioner | Computed alignment after collision handling |

### Items

| Attribute | Target | Description |
|-----------|--------|-------------|
| `data-highlighted` | item | Current highlighted item |
| `data-checked` | radio, checkbox items | Current committed checked state |
| `data-disabled` | item | Disabled item |
| `data-variant` | item | Styling hook such as `destructive` |
| `data-inset` | item | Styling hook for left padding |

### Defaults and Options

| Attribute | Target | Description |
|-----------|--------|-------------|
| `data-default-open` | root | Initial open state |
| `data-default-value` | root | Initial radio value |
| `data-default-values='["a","b"]'` | root | Initial checkbox values as a JSON array string |
| `data-default-checked` | radio, checkbox item | Item-level default checked state |
| `data-close-on-click-outside` | root | Close on outside interaction |
| `data-close-on-escape` | root | Close on Escape |
| `data-close-on-select` | root | Close after accepted activation |
| `data-highlight-item-on-hover` | root | Highlight and focus items on hover |

Default precedence is:

1. JavaScript options
2. Root data attributes
3. Item `data-default-checked`
4. Empty state

For radio items, root defaults win over item defaults. For checkbox items, root `data-default-values` wins over item `data-default-checked`.

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open menu from trigger, or activate highlighted item |
| `ArrowDown` | Open menu from trigger, or move to next enabled item |
| `ArrowUp` | Move to previous enabled item |
| `Home` | Move to first enabled item |
| `End` | Move to last enabled item |
| `Escape` | Close menu |
| `Tab` | Close menu and continue tab order |
| `A-Z` | Typeahead by item text |

## Events

### Outbound Events

| Event | Detail | Notes |
|-------|--------|-------|
| `dropdown-menu:open-change` | `{ open, previousOpen, source, reason }` | Fires on real open-state changes |
| `dropdown-menu:change` | same detail | Deprecated alias for `open-change`; only `detail.open` is compatibility-guaranteed |
| `dropdown-menu:highlight-change` | `{ value, previousValue, item, previousItem, source }` | `value` and `item` become `null` when highlight clears |
| `dropdown-menu:select` | `{ value, item, itemType, source, checked? }` | Cancelable, user-only, fires before commit |
| `dropdown-menu:value-change` | `{ value, previousValue, item, previousItem, source }` | Radio commits only |
| `dropdown-menu:values-change` | `{ values, previousValues, changedValue, checked, item, source }` | Checkbox commits only |

`dropdown-menu:select` behavior:

- Fires only for user activation attempts. Disabled items and programmatic updates do not emit it.
- If `event.preventDefault()` is called, no selection state changes and no auto-close from selection occur.
- Programmatic updates never emit it.

`dropdown-menu:value-change`, `dropdown-menu:values-change`, `onValueChange`, and `onValuesChange` are silent on:

- initialization
- no-op commits
- ignored unknown targets

For `dropdown-menu:values-change`, `changedValue`, `checked`, and `item` are `null` when one programmatic update changes more than one checkbox at once.

### Inbound Event

| Event | Detail | Description |
|-------|--------|-------------|
| `dropdown-menu:set` | `DropdownMenuSetDetail` | Partial programmatic state update |

```js
root.dispatchEvent(
  new CustomEvent("dropdown-menu:set", {
    detail: { value: "pro", source: "restore" },
  })
);

root.dispatchEvent(
  new CustomEvent("dropdown-menu:set", {
    detail: { values: ["email", "push"], open: true },
  })
);
```

### Event Order

User radio selection:

1. `dropdown-menu:select`
2. `dropdown-menu:value-change`
3. `dropdown-menu:open-change` if the menu closes

User checkbox selection:

1. `dropdown-menu:select`
2. `dropdown-menu:values-change`
3. `dropdown-menu:open-change` if the menu closes

Programmatic selection:

1. `dropdown-menu:set` or `controller.set(...)`
2. `dropdown-menu:value-change` or `dropdown-menu:values-change`
3. No `dropdown-menu:select`

If closing the menu also clears an existing highlight, `dropdown-menu:highlight-change` is emitted before the close-side `dropdown-menu:open-change`.

## Options

```ts
interface DropdownMenuOptions {
  defaultOpen?: boolean;
  defaultValue?: string | null;
  defaultValues?: string[];
  onOpenChange?: (open: boolean) => void;
  onSelect?: (value: string) => void;
  onValueChange?: (value: string | null) => void;
  onValuesChange?: (values: string[]) => void;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  closeOnSelect?: boolean;
  highlightItemOnHover?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
  lockScroll?: boolean;
}
```

Notes:

- `closeOnSelect` defaults to `true`. Multi-select menus usually want `false`.
- `onSelect` tracks accepted user activation. It does not fire for programmatic state changes.
- `onValueChange` and `onValuesChange` follow the same silence rules as their DOM events.

## Downstream Wrapper Contract

This package does not ship Astro components, but downstream wrappers should mirror this authoring model:

- `DropdownMenuItem` renders `data-slot="dropdown-menu-item"`.
- `DropdownMenuRadioItem` renders `data-slot="dropdown-menu-radio-item"` and requires `value`.
- `DropdownMenuCheckboxItem` renders `data-slot="dropdown-menu-checkbox-item"` and requires `value`.
- Radio and checkbox wrappers may expose `defaultChecked`, but root defaults still take precedence over item defaults.

## Deprecated APIs

The following compatibility APIs are deprecated and will be removed in the next major release:

```js
// Deprecated open-state alias
root.addEventListener("dropdown-menu:change", (event) => {
  console.log(event.detail.open);
});

// Deprecated programmatic shape
root.dispatchEvent(
  new CustomEvent("dropdown-menu:set", { detail: { value: true } })
);
```

Use `dropdown-menu:open-change` and `dropdown-menu:set { open: boolean }` instead.

## Migration Notes

If you currently use dropdown-menu as a picker:

- Replace picker-style `dropdown-menu-item` usage with `dropdown-menu-radio-item` or `dropdown-menu-checkbox-item`.
- Stop manually writing `data-selected` or `data-checked`.
- Listen to `dropdown-menu:value-change` or `dropdown-menu:values-change` for committed state.
- Push external restore/randomize/popstate/storage changes back in through `controller.set(...)` or `dropdown-menu:set`.
- Switch open-state listeners from `dropdown-menu:change` to `dropdown-menu:open-change`.

## Positioning

Placement attributes (`data-side`, `data-align`, `data-side-offset`, `data-align-offset`, `data-avoid-collisions`, `data-collision-padding`) resolve in this order:

1. JavaScript option
2. `dropdown-menu-content`
3. `dropdown-menu-positioner`
4. `dropdown-menu` root

The dropdown menu uses `position: fixed` by default and automatically positions itself relative to the trigger:

```js
createDropdownMenu(root, {
  side: "bottom",
  align: "start",
  sideOffset: 4,
  alignOffset: 0,
  avoidCollisions: true,
  collisionPadding: 8,
});
```

When `avoidCollisions` is enabled, the menu may flip sides or shift within the viewport. The positioned element also receives `--transform-origin` for animation origins.

## License

MIT
