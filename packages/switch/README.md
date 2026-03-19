# @data-slot/switch

Headless switch component for vanilla JavaScript. Accessible, form-ready, and unstyled.

## Installation

```bash
npm install @data-slot/switch
```

## Quick Start

```html
<label>
  <span data-slot="switch" data-name="notifications">
    <span data-slot="switch-thumb"></span>
  </span>
  Notifications
</label>

<script type="module">
  import { create } from "@data-slot/switch";

  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all switch instances in a scope (defaults to `document`).

```typescript
import { create } from "@data-slot/switch";

const controllers = create(); // Returns SwitchController[]
```

### `createSwitch(root, options?)`

Create a controller for a specific element.

```typescript
import { createSwitch } from "@data-slot/switch";

const controller = createSwitch(element, {
  defaultChecked: true,
  name: "notifications",
  uncheckedValue: "off",
  onCheckedChange: (checked) => console.log(checked),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultChecked` | `boolean` | `false` | Initial checked state |
| `disabled` | `boolean` | `false` | Disable user interaction and form submission |
| `readOnly` | `boolean` | `false` | Prevent user interaction while keeping the field enabled |
| `required` | `boolean` | `false` | Require the switch to be checked for native form validation |
| `name` | `string` | - | Form field name |
| `value` | `string` | native checkbox `"on"` | Submitted value when checked |
| `uncheckedValue` | `string` | - | Submitted value when unchecked |
| `onCheckedChange` | `(checked: boolean) => void` | `undefined` | Callback when checked state changes |

### Data Attributes

JS options take precedence over data attributes on the root element.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-checked` | `boolean` | `false` | Initial checked state |
| `data-disabled` | `boolean` | `false` | Disable user interaction and form submission |
| `data-read-only` / `data-readOnly` | `boolean` | `false` | Prevent user interaction while keeping the field enabled |
| `data-required` | `boolean` | `false` | Require a checked value |
| `data-name` | `string` | - | Form field name |
| `data-value` | `string` | native checkbox `"on"` | Submitted value when checked |
| `data-unchecked-value` / `data-uncheckedValue` | `string` | - | Submitted value when unchecked |

## Controller

| Method/Property | Description |
|-----------------|-------------|
| `checked` | Current checked state (readonly `boolean`) |
| `toggle()` | Toggle the checked state |
| `check()` | Set checked to `true` |
| `uncheck()` | Set checked to `false` |
| `setChecked(checked)` | Set the checked state explicitly |
| `destroy()` | Remove listeners and generated inputs |

## Markup Structure

The authored API is just a root and an optional thumb:

```html
<span data-slot="switch">
  <span data-slot="switch-thumb"></span>
</span>
```

Use a neutral root element (`span` or `div`) when you want Base UI-style label wrapping and shadcn-like composition. The controller injects a visually hidden checkbox next to the root for form submission, label support, and native validation.

## Styling

### State Attributes

The root and thumb expose presence attributes:

- `data-checked`
- `data-unchecked`
- `data-disabled`
- `data-readonly`
- `data-required`

The root also syncs:

- `role="switch"`
- `aria-checked="true|false"`
- `aria-disabled="true"` when disabled
- `aria-readonly="true"` when read-only
- `aria-required="true"` when required

### Tailwind Example

```html
<label class="inline-flex items-center gap-3">
  <span
    data-slot="switch"
    data-size="default"
    class="data-checked:bg-primary data-unchecked:bg-input
           focus-visible:border-ring focus-visible:ring-ring/50
           shrink-0 rounded-full border border-transparent
           focus-visible:ring-3 peer group/switch relative
           inline-flex items-center transition-all outline-none
           h-[18.4px] w-[32px]"
  >
    <span
      data-slot="switch-thumb"
      class="bg-background rounded-full size-4
             data-checked:translate-x-[calc(100%-2px)]
             data-unchecked:translate-x-0
             pointer-events-none block transition-transform"
    ></span>
  </span>
  Notifications
</label>
```

## Events

### Outbound

```javascript
element.addEventListener("switch:change", (event) => {
  console.log(event.detail.checked);
});
```

### Inbound

```javascript
element.dispatchEvent(
  new CustomEvent("switch:set", { detail: { checked: true } })
);
```

## License

MIT
