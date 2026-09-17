# @data-slot/drawer

Accessible, unstyled drawers for vanilla JavaScript. The component supports modal and non-modal behavior, swipe-to-dismiss, a single snap point, detached triggers, and nested drawers.

## Installation

```bash
npm install @data-slot/drawer
```

## Quick start

```html
<div
  id="filters-drawer"
  data-slot="drawer"
  data-swipe-direction="down"
  data-snap-point="0.6"
>
  <button data-slot="drawer-trigger">Edit filters</button>

  <div data-slot="drawer-portal">
    <div data-slot="drawer-backdrop" hidden></div>
    <div data-slot="drawer-viewport" hidden>
      <div data-slot="drawer-popup" hidden>
        <div class="drawer-handle" aria-hidden="true"></div>
        <div data-slot="drawer-content">
          <h2 data-slot="drawer-title">Filters</h2>
          <p data-slot="drawer-description">
            Narrow the results without leaving this page.
          </p>
          <button data-slot="drawer-close">Apply filters</button>
        </div>
      </div>
    </div>
  </div>
</div>

<script type="module">
  import { create } from "@data-slot/drawer";

  create();
</script>
```

`drawer-popup` is the dialog surface. Set its full height or width with CSS. A single optional snap point sets how much of that surface is visible when open. `drawer-content` is an optional inner content or scroll container.

## API

### Initialization

#### `create(scope?)`

Find and bind every `[data-slot="drawer"]` in `scope` (the document by default).

```ts
import { create } from "@data-slot/drawer";

const drawers = create();
```

#### `createDrawer(root, options?)`

Create one drawer controller. JavaScript options take precedence over data attributes.

```ts
import { createDrawer } from "@data-slot/drawer";

const drawer = createDrawer(element, {
  modal: true,
  swipeDirection: "down",
  snapPoint: 0.6,
});

drawer.open();
drawer.setSnapPoint("320px");
```

### Slots

#### Runtime Slots

- `drawer` - Root element that manages the open state and receives drawer events.
- `drawer-trigger` - Optional button that opens or toggles the drawer; can target a root from outside it with `data-drawer-target`.
- `drawer-portal` - Optional wrapper moved to the portal destination while the drawer is open.
- `drawer-backdrop` - Optional backdrop that receives open and swipe state for styling.
- `drawer-viewport` - Optional interaction and measurement wrapper around the popup, typically styled as a fixed viewport.
- `drawer-popup` - Required dialog surface that receives focus management, swipe gestures, and snap-point positioning.
- `drawer-title` - Optional title used for the popup's `aria-labelledby`.
- `drawer-description` - Optional description used for the popup's `aria-describedby`.
- `drawer-close` - Optional button that closes the drawer.
- `drawer-provider` - Optional ancestor wrapper that coordinates the page indentation state for related drawers.
- `drawer-indent` - Optional page surface inside a provider; receives active state and drawer size/swipe variables for a receding-page effect.
- `drawer-indent-background` - Optional background behind that page surface; receives the same provider state and variables.
- `drawer-virtual-keyboard-provider` - Optional wrapper that enables the drawer viewport to adapt to the on-screen keyboard.

#### Style-only Slots

- `drawer-content` - Optional inner wrapper for content layout or scrolling inside the popup.
- `drawer-handle` - Optional visual drag handle. Swipe behavior belongs to the popup and does not require this slot.

#### Detached Triggers

Detached triggers can live outside the root when the root has an ID:

```html
<button
  data-slot="drawer-trigger"
  data-drawer-target="filters-drawer"
  data-payload='{"source":"toolbar"}'
>
  Filters
</button>
```

`data-payload` accepts JSON or a plain string. The parsed value is forwarded in change event details.

Use native `<button>` elements for triggers and close controls. Native `disabled`, `data-disabled`, and `aria-disabled="true"` block their activation.

#### Composition Slots

The package also recognizes `drawer-provider`, `drawer-indent`, `drawer-indent-background`, and `drawer-virtual-keyboard-provider`. They are ordinary DOM wrappers rather than React context providers.

Wrap related drawers in a provider. Put the page surface that should visually recede inside `drawer-indent` and its background behind that surface. A nested drawer remains a complete `drawer` root inside the parent popup.

```html
<div data-slot="drawer-provider">
  <div data-slot="drawer-indent-background"></div>
  <main data-slot="drawer-indent">...</main>

  <div id="parent" data-slot="drawer">
    ...
    <div data-slot="drawer-popup">
      <div id="child" data-slot="drawer">
        <button data-slot="drawer-trigger">Open details</button>
        ...
      </div>
    </div>
  </div>
</div>
```

Wrap the viewport inside `drawer-virtual-keyboard-provider` when form controls in that drawer need the viewport to follow the on-screen keyboard:

```html
<div data-slot="drawer">
  <div data-slot="drawer-virtual-keyboard-provider">
    <div data-slot="drawer-viewport">
      <div data-slot="drawer-popup">...</div>
    </div>
  </div>
</div>
```

### Data Attributes

Root attributes and their JavaScript equivalents are listed in [Options](#options).

Popup-specific attributes:

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `data-initial-focus` | boolean or selector | popup | Use `true` for the first focusable element, a selector for an explicit target, or `false` to skip automatic focus. |
| `data-final-focus` | boolean or selector | `true` | Choose the focus target after close, or set `false` to skip focus restoration. |

Portal-specific attributes:

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `data-container` | selector | `body` | Element that receives the portal. |
| `data-keep-mounted` | boolean | `false` | Keep portal content mounted while closed. |

### Options

| Option | Data attribute | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `open` / `defaultOpen` | `data-default-open` | `boolean` | `false` | Initial open state. `open` and the attribute are initialization values, not controlled state. |
| `modal` | `data-modal` | `boolean \| "trap-focus"` | `true` | `true` makes outside content inert and locks scroll; `"trap-focus"` traps focus without making outside content inert. |
| `disablePointerDismissal` | `data-disable-pointer-dismissal` | `boolean` | `false` | Ignore outside pointer presses. |
| `closeOnEscape` | `data-close-on-escape` | `boolean` | `true` | Close when `Escape` is pressed. |
| `swipeDirection` | `data-swipe-direction` | `"down" \| "up" \| "left" \| "right"` | `"down"` | Direction used to dismiss the drawer. |
| `snapPoint` / `defaultSnapPoint` | `data-snap-point` / `data-default-snap-point` | `DrawerSnapPoint \| null` | `null` | Initial single open position. `snapPoint` takes precedence over the default. `null` uses the full CSS size. |
| `triggerId` / `defaultTriggerId` | `data-trigger-id` / `data-default-trigger-id` | `string \| null` | — | Initial detached trigger identifier. |
| `initialFocus` | popup `data-initial-focus` | `boolean \| string \| HTMLElement` | popup | Choose focus when the drawer opens. |
| `finalFocus` | popup `data-final-focus` | `boolean \| string \| HTMLElement` | trigger or previous focus | Choose focus when the drawer closes. |
| `keepMounted` | portal `data-keep-mounted` | `boolean` | `false` | Keep portal content mounted while closed. |
| `container` | portal `data-container` | `string \| HTMLElement` | `document.body` | Portal destination. |
| `onOpenChange` | — | `(open, details) => void` | — | Called before committing an open-state change. Call `details.cancel()` to stop it. |
| `onSnapPointChange` | — | `(snapPoint, details) => void` | — | Called before replacing the single snap point. Call `details.cancel()` to stop it. |
| `onOpenChangeComplete` | — | `(open) => void` | — | Called when the opening or closing transition completes. |

A snap point is a viewport fraction (`0` to `1`), a pixel number greater than `1`, or a string in `px` or `rem`. It is capped at the popup's CSS size. Only one open position is supported; arrays and sequential snap points are not supported. A swipe returns to that position or dismisses the drawer. Use `setSnapPoint()` or `drawer:set` to replace it at runtime; the value persists across close/open cycles. Options and data attributes are read at initialization.

### Controller

| Method or property | Description |
| --- | --- |
| `open(triggerId?)` | Open the drawer, optionally associating an identified trigger. |
| `close()` | Close the drawer. |
| `toggle()` | Toggle the open state. |
| `setSnapPoint(value)` | Replace the single open position; `null` restores the full CSS size. |
| `snapPoint` | Current snap point (readonly). |
| `unmount()` | Unmount closed portal content. |
| `isOpen` | Current open state (readonly). |
| `triggerId` | Trigger associated with the current open cycle (readonly). |
| `destroy()` | Remove listeners and restore DOM state. |

### Events

Serializable data attributes and DOM events make the component usable directly from Astro markup and across framework boundaries. JavaScript consumers can use the matching callback options.

#### Outbound Events

| Event | Detail | Cancelable | Description |
| --- | --- | --- | --- |
| `drawer:beforechange` | `{ open, reason, trigger, payload, originalEvent?, cancel(), preventUnmountOnClose() }` | yes | Fires before the open state changes. Call `event.preventDefault()` or `detail.cancel()` to cancel it. |
| `drawer:change` | `{ open, reason, trigger, payload, originalEvent?, cancel(), preventUnmountOnClose() }` | no | Fires after the open state changes. The methods have no effect after the change commits. |
| `drawer:change-complete` | `{ open }` | no | Fires after the opening or closing transition completes. |
| `drawer:beforesnapchange` | `{ snapPoint, reason, originalEvent?, cancel() }` | yes | Fires before replacing the single snap point. Cancel with `event.preventDefault()` or `detail.cancel()`. |
| `drawer:snapchange` | `{ snapPoint, reason, originalEvent?, cancel() }` | no | Fires after the snap point changes. |

Reasons are `trigger-press`, `close-press`, `outside-press`, `escape-key`, `focus-out`, `imperative-action`, `swipe`, or `none`.

Open-state requests made inside change listeners or `onOpenChange` run after the current change finishes. If a callback makes several requests, the latest state and trigger win. Requesting the same state and trigger as the current change does not repeat its callbacks; use `details.cancel()` to cancel that change.

`preventUnmountOnClose()` on `drawer:beforechange` keeps the portal mounted for the current close. This is useful when an application needs to coordinate its own exit animation.

```js
root.addEventListener("drawer:beforechange", (event) => {
  if (!event.detail.open && formIsDirty) event.preventDefault();
});
```

#### Inbound Events

| Event | Detail | Description |
| --- | --- | --- |
| `drawer:set` | `{ open?, snapPoint?, triggerId? }` | Set one or more state values. |
| `drawer:open` | — | Open the drawer. |
| `drawer:close` | — | Close the drawer. |
| `drawer:toggle` | — | Toggle the drawer. |
| `drawer:unmount` | — | Unmount closed portal content. |

```js
root.dispatchEvent(new CustomEvent("drawer:set", {
  detail: { open: true, snapPoint: 0.6, triggerId: "toolbar" },
}));
```

### Styling

Root, portal, backdrop, viewport, and popup expose `data-state="open|closed"`, `data-open`, `data-closed`, and `data-swipe-direction`. The active trigger gets `data-popup-open`. During gestures the viewport, backdrop, and popup expose `data-swiping`. Nested popups additionally expose `data-nested`, `data-nested-drawer-open`, and `data-nested-swiping`; indentation parts expose `data-active` or `data-inactive`. A keyboard-aware viewport exposes `data-keyboard-open` while the on-screen keyboard overlaps it.

Popup and backdrop expose `data-starting-style` and `data-ending-style` for entry and exit transitions. The runtime waits for exit transitions before hiding or restoring the portal.

CSS variables include:

- `--drawer-height` and `--drawer-width`
- `--drawer-snap-point-offset` (signed offset for the configured direction)
- `--drawer-swipe-movement-x` and `--drawer-swipe-movement-y`
- `--drawer-swipe-progress` and release `--drawer-swipe-strength` (`0.1` to `1`)
- `--nested-drawers` and `--drawer-frontmost-height`
- `--drawer-keyboard-inset` on `drawer-viewport`

```css
[data-slot="drawer-backdrop"] {
  opacity: calc(1 - var(--drawer-swipe-progress, 0));
}

[data-slot="drawer-popup"] {
  transform: translateY(calc(var(--drawer-snap-point-offset, 0px) + var(--drawer-swipe-movement-y, 0px)));
}
```

### Accessibility

The runtime sets `role="dialog"`, `aria-labelledby`, and `aria-describedby` on the popup, adds `aria-modal="true"` in fully modal mode, and maintains `aria-expanded`, `aria-controls`, and `aria-haspopup="dialog"` on triggers. Modal and `"trap-focus"` drawers trap focus and restore it after close; fully modal drawers also make outside content inert and lock body scroll. `Escape`, close controls, allowed outside presses, and a swipe in the configured direction dismiss the drawer.

### Behavior

#### Base UI Adaptation

The DOM parts and interaction model follow Base UI Drawer where they translate to static HTML. React-only facilities such as JSX render props, React context, controlled `open` values, and React animation internals are represented by ordinary wrappers, data attributes, native pointer gestures, controller methods, callbacks, and cancelable custom events. Initial values in HTML are read once; dispatch `drawer:set` or call the controller to update live state.
