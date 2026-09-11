# @data-slot/drawer

Accessible, unstyled drawers for vanilla JavaScript. The component supports modal and non-modal behavior, swipe-to-dismiss, snap points, detached triggers, and nested drawers.

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
  data-snap-points='["160px",0.6,1]'
  data-default-snap-point="0.6"
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

`drawer-popup` is the dialog surface. `drawer-content` is an optional inner content or scroll container.

## API

### `create(scope?)`

Find and bind every `[data-slot="drawer"]` in `scope` (the document by default).

```ts
import { create } from "@data-slot/drawer";

const drawers = create();
```

### `createDrawer(root, options?)`

Create one drawer controller. JavaScript options take precedence over data attributes.

```ts
import { createDrawer } from "@data-slot/drawer";

const drawer = createDrawer(element, {
  modal: true,
  swipeDirection: "down",
  snapPoints: ["160px", 0.6, 1],
  defaultSnapPoint: 0.6,
  snapToSequentialPoints: true,
});

drawer.open();
drawer.setSnapPoint(1);
```

### Options and root attributes

| Option | Data attribute | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `open` / `defaultOpen` | `data-default-open` | `boolean` | `false` | Initial open state. `open` and the attribute are initialization values, not controlled state. |
| `modal` | `data-modal` | `boolean \| "trap-focus"` | `true` | `true` makes outside content inert and locks scroll; `"trap-focus"` traps focus without making outside content inert. |
| `disablePointerDismissal` | `data-disable-pointer-dismissal` | `boolean` | `false` | Ignore outside pointer presses. |
| `closeOnEscape` | `data-close-on-escape` | `boolean` | `true` | Close when `Escape` is pressed. |
| `swipeDirection` | `data-swipe-direction` | `"down" \| "up" \| "left" \| "right"` | `"down"` | Direction used to dismiss the drawer. |
| `snapPoints` | `data-snap-points` | `DrawerSnapPoint[]` | — | Snap points as JSON. Numbers from `0` to `1` are viewport fractions, numbers over `1` are pixels, and strings accept `px` or `rem`. |
| `snapPoint` / `defaultSnapPoint` | `data-default-snap-point` | `DrawerSnapPoint \| null` | first snap point | Initial active snap point. |
| `snapToSequentialPoints` | `data-snap-to-sequential-points` | `boolean` | `false` | Settle on snap points in sequence instead of skipping points based on release velocity. A sufficiently long drag can still cross more than one point. |
| `triggerId` / `defaultTriggerId` | `data-default-trigger-id` | `string \| null` | — | Initial detached trigger identifier. |
| `initialFocus` | popup `data-initial-focus` | `boolean \| string \| HTMLElement` | popup | Choose focus when the drawer opens. |
| `finalFocus` | popup `data-final-focus` | `boolean \| string \| HTMLElement` | trigger or previous focus | Choose focus when the drawer closes. |
| `keepMounted` | portal `data-keep-mounted` | `boolean` | `false` | Keep portal content mounted while closed. |
| `container` | portal `data-container` | `string \| HTMLElement` | `document.body` | Portal destination. |
| `onOpenChange` | — | `(open, details) => void` | — | Called before committing an open-state change. Call `details.cancel()` to stop it. |
| `onOpenChangeComplete` | — | `(open) => void` | — | Called when the opening or closing transition completes. |
| `onSnapPointChange` | — | `(snapPoint, details) => void` | — | Called before committing a snap-point change. Call `details.cancel()` to stop it. |

At runtime a snap point is a number or string. Supported strings use `px` or `rem`. Keep `data-snap-points` valid JSON; for example, `data-snap-points='["160px",0.6,1]'`.

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

### Controller

| Method or property | Description |
| --- | --- |
| `open(triggerId?)` | Open the drawer, optionally associating an identified trigger. |
| `close()` | Close the drawer. |
| `toggle()` | Toggle the open state. |
| `setSnapPoint(value)` | Move to a configured snap point. |
| `unmount()` | Unmount closed portal content. |
| `isOpen` | Current open state (readonly). |
| `snapPoint` | Current snap point (readonly). |
| `triggerId` | Trigger associated with the current open cycle (readonly). |
| `destroy()` | Remove listeners and restore DOM state. |

## Slots

### Core structure

- `drawer` — root and event target
- `drawer-trigger` — opens or toggles the drawer
- `drawer-portal` — optional portal container
- `drawer-backdrop` — optional modal backdrop
- `drawer-viewport` — fixed interaction and measurement viewport
- `drawer-popup` — required dialog surface
- `drawer-content` — optional inner content or scroll container
- `drawer-title` — supplies `aria-labelledby`
- `drawer-description` — supplies `aria-describedby`
- `drawer-close` — closes the drawer
- `drawer-swipe-area` — edge gesture surface that can open a closed drawer; it is commonly detached from the root with `data-drawer-target` and may override the root with its own `data-swipe-direction`

Detached triggers and swipe areas can live outside the root when the root has an ID:

```html
<button
  data-slot="drawer-trigger"
  data-drawer-target="filters-drawer"
  data-payload='{"source":"toolbar"}'
>
  Filters
</button>

<div
  data-slot="drawer-swipe-area"
  data-drawer-target="filters-drawer"
  data-swipe-direction="up"
></div>
```

`data-payload` accepts JSON or a plain string. The parsed value is forwarded in change event details.

SwipeArea's direction describes the opening gesture and defaults to the opposite of the root's dismissal direction. The popup follows the drag; releasing commits the opening or returns it to closed. Keep a normal trigger available for keyboard users. Use native `<button>` elements for triggers and close controls.

### Composition slots

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

## Events

Serializable data attributes and DOM events make the component usable directly from Astro markup and across framework boundaries. JavaScript consumers can use the matching callback options.

### Outbound events

| Event | Detail | Cancelable | Description |
| --- | --- | --- | --- |
| `drawer:beforechange` | `{ open, reason, trigger, payload, originalEvent?, cancel(), preventUnmountOnClose() }` | yes | Fires before the open state changes. Call `event.preventDefault()` or `detail.cancel()` to cancel it. |
| `drawer:change` | `{ open, reason, trigger, payload, originalEvent?, cancel(), preventUnmountOnClose() }` | no | Fires after the open state changes. The methods have no effect after the change commits. |
| `drawer:change-complete` | `{ open }` | no | Fires after the opening or closing transition completes. |
| `drawer:beforesnapchange` | `{ snapPoint, reason, originalEvent?, cancel() }` | yes | Fires before the snap point changes. Call `event.preventDefault()` or `detail.cancel()` to cancel it. |
| `drawer:snapchange` | `{ snapPoint, reason, originalEvent?, cancel() }` | no | Fires after the snap point changes. `cancel()` has no effect after the change commits. |

Reasons are `trigger-press`, `close-press`, `outside-press`, `escape-key`, `focus-out`, `imperative-action`, `swipe`, or `none`.

`preventUnmountOnClose()` on `drawer:beforechange` keeps the portal mounted for the current close. This is useful when an application needs to coordinate its own exit animation.

```js
root.addEventListener("drawer:beforechange", (event) => {
  if (!event.detail.open && formIsDirty) event.preventDefault();
});

root.addEventListener("drawer:snapchange", (event) => {
  console.log(event.detail.snapPoint);
});
```

### Inbound events

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

## State and styling

Root, portal, backdrop, viewport, and popup expose `data-state="open|closed"`, `data-open`, `data-closed`, and `data-swipe-direction`. The active trigger gets `data-popup-open`. Swipe areas expose `data-open`, `data-closed`, and their resolved `data-swipe-direction`. During gestures the viewport, backdrop, and popup expose `data-swiping`. Nested popups additionally expose `data-nested`, `data-nested-drawer-open`, and `data-nested-swiping`; indentation parts expose `data-active` or `data-inactive`. A keyboard-aware viewport exposes `data-keyboard-open` while the on-screen keyboard overlaps it.

Popup and backdrop expose `data-starting-style` and `data-ending-style` for entry and exit transitions. The runtime waits for exit transitions before hiding or restoring the portal.

CSS variables include:

- `--drawer-height` and `--drawer-width`
- `--drawer-snap-point-offset`
- `--drawer-swipe-movement-x` and `--drawer-swipe-movement-y`
- `--drawer-swipe-progress` and release `--drawer-swipe-strength` (`0.1` to `1`)
- `--nested-drawers` and `--drawer-frontmost-height`
- `--drawer-keyboard-inset` on `drawer-viewport`

```css
[data-slot="drawer-backdrop"] {
  opacity: calc(1 - var(--drawer-swipe-progress, 0));
}

[data-slot="drawer-popup"] {
  transform: translateY(
    calc(var(--drawer-snap-point-offset, 0px) + var(--drawer-swipe-movement-y, 0px))
  );
}
```

## Accessibility and interaction

The runtime sets `role="dialog"`, `aria-labelledby`, and `aria-describedby` on the popup, adds `aria-modal="true"` in fully modal mode, and maintains `aria-expanded`, `aria-controls`, and `aria-haspopup="dialog"` on triggers. Modal and `"trap-focus"` drawers trap focus and restore it after close; fully modal drawers also make outside content inert and lock body scroll. `Escape`, close controls, allowed outside presses, and a swipe in the configured direction dismiss the drawer.

## Base UI adaptation

The DOM parts and interaction model follow Base UI Drawer where they translate to static HTML. React-only facilities such as JSX render props, React context, controlled `open`/`snapPoint` values, and React animation internals are represented by ordinary wrappers, data attributes, native pointer gestures, controller methods, callbacks, and cancelable custom events. Initial values in HTML are read once; dispatch `drawer:set` or call the controller to update live state.
