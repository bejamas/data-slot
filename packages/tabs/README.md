# @data-slot/tabs

Headless tabs component for vanilla JavaScript. Accessible, unstyled, tiny.

## Installation

```bash
npm install @data-slot/tabs
```

## Quick Start

```html
<div data-slot="tabs" data-default-value="one">
  <div data-slot="tabs-list">
    <button data-slot="tabs-trigger" data-value="one">Tab One</button>
    <button data-slot="tabs-trigger" data-value="two">Tab Two</button>
    <button data-slot="tabs-trigger" data-value="three">Tab Three</button>
    <div data-slot="tabs-indicator"></div>
  </div>
  <div data-slot="tabs-content" data-value="one">Content One</div>
  <div data-slot="tabs-content" data-value="two">Content Two</div>
  <div data-slot="tabs-content" data-value="three">Content Three</div>
</div>

<script type="module">
  import { create } from "@data-slot/tabs";
  
  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all tabs instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/tabs";

const controllers = create(); // Returns TabsController[]
```

### `createTabs(root, options?)`

Create a controller for a specific element.

```typescript
import { createTabs } from "@data-slot/tabs";

const tabs = createTabs(element, {
  defaultValue: "one",
  orientation: "horizontal",
  onValueChange: (value) => console.log(value),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultValue` | `string` | First trigger's value | Initial selected tab |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Tab orientation for keyboard nav |
| `activationMode` | `"auto" \| "manual"` | `"auto"` | How tabs are activated with keyboard |
| `onValueChange` | `(value: string) => void` | `undefined` | Callback when selected tab changes |

### Data Attributes

Options can also be set via data attributes on the root element. JS options take precedence.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-value` | string | first tab | Initial selected tab |
| `data-orientation` | string | `"horizontal"` | Tab orientation: horizontal, vertical |
| `data-activation-mode` | string | `"auto"` | Activation mode: auto, manual |

```html
<!-- Vertical tabs with manual activation -->
<div data-slot="tabs" data-orientation="vertical" data-activation-mode="manual">
  ...
</div>
```

### Controller

| Method/Property | Description |
|-----------------|-------------|
| `select(value)` | Select a tab by value |
| `value` | Currently selected value (readonly `string`) |
| `destroy()` | Cleanup all event listeners |

## Markup Structure

```html
<div data-slot="tabs" data-default-value="initial-tab">
  <div data-slot="tabs-list">
    <button data-slot="tabs-trigger" data-value="unique-id">Label</button>
    <!-- Optional animated indicator -->
    <div data-slot="tabs-indicator"></div>
  </div>
  <div data-slot="tabs-content" data-value="unique-id">Panel content</div>
</div>
```

### Optional Slots

- `tabs-indicator` - Animated highlight that follows the selected tab

## Styling

### Basic Styling

```css
/* Hidden panels */
[data-slot="tabs-content"][hidden] {
  display: none;
}

/* Active trigger */
[data-slot="tabs-trigger"][aria-selected="true"] {
  font-weight: bold;
  border-bottom: 2px solid currentColor;
}

/* Or use data-state */
[data-slot="tabs-trigger"][data-state="active"] {
  color: blue;
}

[data-slot="tabs-trigger"][data-state="inactive"] {
  color: gray;
}
```

### Animated Indicator

The indicator receives CSS variables for positioning:

```css
[data-slot="tabs-indicator"] {
  position: absolute;
  left: var(--active-tab-left);
  width: var(--active-tab-width);
  height: 2px;
  background: currentColor;
  transition: left 0.2s, width 0.2s;
}

/* Vertical orientation */
[data-slot="tabs-list"][aria-orientation="vertical"] [data-slot="tabs-indicator"] {
  top: var(--active-tab-top);
  height: var(--active-tab-height);
  width: 2px;
}
```

### CSS Variables

| Variable | Description |
|----------|-------------|
| `--active-tab-left` | Left offset of active trigger |
| `--active-tab-width` | Width of active trigger |
| `--active-tab-top` | Top offset of active trigger |
| `--active-tab-height` | Height of active trigger |

### Tailwind Example

```html
<div data-slot="tabs">
  <div data-slot="tabs-list" class="relative flex border-b">
    <button 
      data-slot="tabs-trigger" 
      data-value="one"
      class="px-4 py-2 aria-selected:text-blue-600"
    >
      Tab One
    </button>
    <div 
      data-slot="tabs-indicator" 
      class="absolute bottom-0 h-0.5 bg-blue-600 transition-all"
      style="left: var(--active-tab-left); width: var(--active-tab-width)"
    ></div>
  </div>
  <div data-slot="tabs-content" data-value="one" class="p-4">
    Content
  </div>
</div>
```

## Keyboard Navigation

### Horizontal Orientation

| Key | Action |
|-----|--------|
| `ArrowLeft` | Select previous tab |
| `ArrowRight` | Select next tab |
| `Home` | Select first tab |
| `End` | Select last tab |

### Vertical Orientation

| Key | Action |
|-----|--------|
| `ArrowUp` | Select previous tab |
| `ArrowDown` | Select next tab |
| `Home` | Select first tab |
| `End` | Select last tab |

## Accessibility

The component automatically handles:

- `role="tablist"` on list
- `role="tab"` on triggers
- `role="tabpanel"` on content
- `aria-orientation` on list
- `aria-selected` on triggers
- `aria-controls` linking triggers to panels
- `aria-labelledby` linking panels to triggers
- `tabindex` management (only selected tab is in tab order)

## Events

### Outbound Events

Listen for changes via custom events:

```javascript
element.addEventListener("tabs:change", (e) => {
  console.log("Selected tab:", e.detail.value);
});
```

### Inbound Events

Control the tabs via events:

| Event | Detail | Description |
|-------|--------|-------------|
| `tabs:set` | `{ value: string }` | Select a tab programmatically |

```javascript
// Select a tab
element.dispatchEvent(
  new CustomEvent("tabs:set", { detail: { value: "two" } })
);
```

### Deprecated Events

The following event is deprecated and will be removed in v1.0:

```javascript
// Deprecated: tabs:select event
element.dispatchEvent(
  new CustomEvent("tabs:select", { detail: { value: "two" } })
);

// Deprecated: string detail
element.dispatchEvent(
  new CustomEvent("tabs:select", { detail: "two" })
);
```

Use `tabs:set` with `{ value: string }` instead.

## License

MIT

