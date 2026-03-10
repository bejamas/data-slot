# @data-slot/command

Headless command palette component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/command
```

## Quick Start

```html
<div data-slot="command" data-label="Command Menu">
  <div data-slot="command-input-wrapper">
    <input data-slot="command-input" placeholder="Type a command..." />
  </div>
  <div data-slot="command-list">
    <div data-slot="command-empty" hidden>No results.</div>

    <div data-slot="command-group">
      <div data-slot="command-group-heading">Actions</div>
      <div data-slot="command-item">Open Project</div>
      <div data-slot="command-item">Invite Teammate</div>
    </div>

    <div data-slot="command-separator"></div>

    <div data-slot="command-item" data-value="settings">
      Settings
      <span data-slot="command-shortcut">⌘,</span>
    </div>
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/command";

  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all command palettes in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/command";

const controllers = create();
```

### `createCommand(root, options?)`

Create a controller for a specific element.

```typescript
import { createCommand } from "@data-slot/command";

const command = createCommand(element, {
  defaultSearch: "set",
  onSelect: (value) => console.log("Selected:", value),
});
```

## Slots

| Slot | Description |
|------|-------------|
| `command` | Root container |
| `command-input` | Search input |
| `command-input-wrapper` | Optional wrapper around the input for styling |
| `command-list` | Listbox container for items and groups |
| `command-empty` | Empty state shown when there are no ranked matches |
| `command-group` | Group of related items |
| `command-group-heading` | Optional label for a group |
| `command-item` | Selectable command item |
| `command-shortcut` | Optional shortcut hint inside an item |
| `command-separator` | Visual divider between sections |

## Item and Group Attributes

| Attribute | Applies To | Description |
|-----------|------------|-------------|
| `data-value` | `command-item`, `command-group` | Explicit value. If omitted on an item, value is inferred from `data-label` or text content |
| `data-label` | `command-item` | Alternate text source for value inference |
| `data-keywords` | `command-item` | Comma-separated aliases used during filtering |
| `data-disabled` / `disabled` | `command-item` | Prevents navigation and selection |
| `data-force-mount` | `command-item`, `command-group` | Keeps the node rendered during filtering |
| `data-always-render` | `command-separator` | Keeps the separator visible while searching |

`command-shortcut` text is ignored when inferring an item value, so shadcn-style shortcut hints do not affect search matches.

## Options

Options can be passed via JavaScript or data attributes on the root element. JavaScript options take precedence.

| Option | Data Attribute | Type | Default | Description |
|--------|----------------|------|---------|-------------|
| `label` | `data-label` | `string` | `"Command Menu"` | Accessible label announced for the search input |
| `defaultValue` | `data-default-value` | `string` | `null` | Initial active item value |
| `defaultSearch` | `data-default-search` | `string` | `""` | Initial search text |
| `shouldFilter` | `data-should-filter` | `boolean` | `true` | Disable built-in filtering and sorting |
| `loop` | `data-loop` | `boolean` | `false` | Wrap arrow-key navigation |
| `disablePointerSelection` | `data-disable-pointer-selection` | `boolean` | `false` | Disable hover-driven selection |
| `vimBindings` | `data-vim-bindings` | `boolean` | `true` | Enable `Ctrl+J/K/N/P` shortcuts |
| `filter` | - | `(value, search, keywords?) => number` | `commandScore` | Custom ranking function |
| `onValueChange` | - | `(value: string \| null) => void` | - | Called when the active item changes |
| `onSearchChange` | - | `(search: string) => void` | - | Called when the search query changes |
| `onSelect` | - | `(value: string) => void` | - | Called on click or Enter selection |

## Controller

```typescript
interface CommandController {
  readonly value: string | null;
  readonly search: string;
  select(value: string | null): void;
  setSearch(search: string): void;
  destroy(): void;
}
```

## Events

### Outbound Events

```javascript
root.addEventListener("command:change", (event) => {
  console.log("Active item:", event.detail.value);
});

root.addEventListener("command:search-change", (event) => {
  console.log("Search:", event.detail.search);
});

root.addEventListener("command:select", (event) => {
  console.log("Selected:", event.detail.value);
});
```

### Inbound Event

```javascript
root.dispatchEvent(
  new CustomEvent("command:set", {
    detail: {
      search: "set",
      value: "settings",
    },
  })
);
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `ArrowDown` / `ArrowUp` | Move to the next or previous enabled item |
| `Home` / `End` | Jump to the first or last enabled item |
| `Alt+ArrowDown` / `Alt+ArrowUp` | Jump between groups |
| `Ctrl+J` / `Ctrl+N` | Next item |
| `Ctrl+K` / `Ctrl+P` | Previous item |
| `Enter` | Trigger `command:select` for the active item |

Arrow navigation is handled on the command root like cmdk. Selecting from the input or a focused command root keeps keyboard flow intact, but clicking non-interactive palette chrome does not auto-focus the input.

## Dialog Composition

Use `@data-slot/dialog` when you want modal presentation:

```html
<div data-slot="dialog">
  <button data-slot="dialog-trigger">Open Command Palette</button>
  <div data-slot="dialog-overlay" hidden></div>
  <div data-slot="dialog-content" hidden>
    <h2 data-slot="dialog-title">Command Palette</h2>
    <p data-slot="dialog-description">Search for a command to run.</p>

    <div data-slot="command" data-label="Global Command Palette">
      <input data-slot="command-input" placeholder="Search commands..." />
      <div data-slot="command-list">
        <div data-slot="command-empty" hidden>No results.</div>
        <div data-slot="command-item">New Issue</div>
        <div data-slot="command-item">Open Settings</div>
      </div>
    </div>
  </div>
</div>

<script type="module">
  import { createDialog } from "@data-slot/dialog";
  import { createCommand } from "@data-slot/command";

  document.querySelectorAll('[data-slot="dialog"]').forEach((el) => createDialog(el));
  document.querySelectorAll('[data-slot="command"]').forEach((el) => createCommand(el));
</script>
```

## Styling

```css
[data-slot="command-item"][data-selected] {
  background: #f1f1f1;
}

[data-slot="command-item"][aria-disabled="true"] {
  opacity: 0.5;
  pointer-events: none;
}

[data-slot="command-list"] {
  height: var(--command-list-height);
  transition: height 150ms ease;
}
```

## License

MIT
