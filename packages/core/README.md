# @data-slot/core

Shared utilities for data-slot headless UI components.

## Installation

```bash
npm install @data-slot/core
```

## API

### DOM Utilities

#### `getPart(root, slot)`

Query a single part/slot within a component root.

```typescript
const trigger = getPart<HTMLButtonElement>(root, "dialog-trigger");
```

#### `getParts(root, slot)`

Query all parts/slots within a component root.

```typescript
const items = getParts<HTMLElement>(root, "accordion-item");
```

#### `getRoots(scope, slot)`

Find all component roots within a scope by data-slot value.

```typescript
const dialogs = getRoots(document, "dialog");
```

### Focus Utilities

`isFocusable(element)` checks whether an individual element can receive
programmatic focus, using the same eligibility rules as descendant discovery.

`getFocusable(container)` returns programmatically focusable descendants in DOM
order, including elements with a negative `tabindex`. `getTabbables(container)`
returns the subset eligible for Tab navigation, accounting for checked radio
groups. It also returns DOM order rather than sorting positive `tabindex` values.

`getAutofocusOrFirstFocusable(container)` selects an eligible `[autofocus]`
descendant, otherwise the first focusable descendant, or `undefined` if none exist.

Each call reads current DOM state. Hidden, inert, and natively disabled controls
are excluded. `aria-disabled` and `data-disabled` alone do not remove native focus
eligibility. Queries exclude the container itself and do not cross into nested
shadow roots; pass a shadow root directly to query its descendants.

### ARIA Utilities

#### `ensureId(element, prefix)`

Ensure an element has an id, generating one if needed.

```typescript
const id = ensureId(content, "dialog-content");
// Returns existing id or generates "dialog-content-1"
```

#### `setAria(element, name, value)`

Set or remove an ARIA attribute. Boolean values are converted to strings.

```typescript
setAria(trigger, "expanded", true);  // aria-expanded="true"
setAria(trigger, "expanded", null);  // removes aria-expanded
```

#### `linkLabelledBy(content, title, description)`

Link content element to its label and description via ARIA.

```typescript
linkLabelledBy(dialogContent, titleElement, descriptionElement);
// Sets aria-labelledby and aria-describedby
```

### Event Utilities

#### `on(element, type, handler, options?)`

Add an event listener and return a cleanup function.

```typescript
const cleanup = on(button, "click", () => console.log("clicked"));
// Later: cleanup() to remove listener
```

#### `onRoot(root, type, handler)`

Listen for events dispatched directly on a component root. Events bubbling from
descendants are ignored by this handler and continue to propagate. Returns a
cleanup function, like `on`.

Use this for inbound component commands so nested instances cannot change their
parent's state:

```typescript
const cleanup = onRoot(root, "tabs:set", handleSet);
```

#### `emit(element, name, detail?)`

Dispatch a bubbling custom event with optional detail. Outbound component events
can be observed on ancestors; check `event.target` to identify the source root.

```typescript
emit(root, "tabs:change", { value: "tab-2" });
```

#### `composeHandlers(...handlers)`

Compose multiple event handlers into one. Stops if `event.defaultPrevented`.

```typescript
const handler = composeHandlers(onClickProp, internalHandler);
```

### Modal and Dismissal Utilities

#### `createModalStackItem(options)`

Register a surface with the document's modal stack. The controller provides
`open()`, `close()`, `destroy()`, and a readonly `isTopmost` property. Use
`isTopmost` for interaction ownership rather than reading the styling attributes.

Set `isolateOutside: true` to keep background content inert and hidden from
assistive technology while that item is open. Isolation follows the topmost
stack item, including a dialog opened above a drawer, and permits its owned
portals. Closing or destroying items restores the previous isolation and authored
attributes. Items that do not request isolation retain their existing behavior
when no isolating item is open.

#### `createDismissLayer(options)`

Coordinate outside presses, Escape, and focus moving into an outside iframe.
`onDismiss(details)` receives the triggering `originalEvent` and its `reason`:
`"outside-press"`, `"escape-key"`, or `"focus-out"`. Touch dismissal reports the
activation click; iframe dismissal reports the window blur event. Callbacks that
do not need these details can continue to take no arguments.

### Swipe Gesture

#### `createSwipeGesture(options)`

Track one pointer or touch swipe at a time from a press on `element`. Nothing
is reported until movement passes `lockThreshold` (default 8px) on one of the
allowed `axes`; a drag dominated by another axis, or one the `lock` callback
refuses (for example when a scroll container owns it), is left to the page.
`start(event, target)` resolves what a press would swipe or returns `null` to
ignore it. Once locked, the pointer is captured on the element `capture`
returns, `move` receives raw deltas, and `release` adds the press duration for
velocity. `reset` runs when a locked gesture ends without a release. The click
that follows a released swipe is swallowed. The controller offers `cancel()`,
optionally for one target, and `destroy()`.

## Usage in Components

This package is used internally by all `@data-slot/*` component packages. You typically don't need to import it directly unless building custom components.

```typescript
import { getPart, setAria, on } from "@data-slot/core";

function createCustomComponent(root: Element) {
  const trigger = getPart(root, "custom-trigger");
  const content = getPart(root, "custom-content");
  
  const cleanup = on(trigger, "click", () => {
    const isOpen = content.hidden;
    content.hidden = !isOpen;
    setAria(trigger, "expanded", isOpen);
  });
  
  return { destroy: cleanup };
}
```

## Terminal lifecycle

`createTerminalLifecycle()` manages work that must stop permanently when a
controller is destroyed. It returns a `TerminalLifecycleController`:

| Member | Behavior |
| --- | --- |
| `isDestroyed` | Becomes `true` after the before-destroy hooks and before resource cleanup. |
| `trackRaf(callback)` | Schedules an animation frame; returns its handle or `null` once destruction starts. |
| `trackTimeout(callback, delay)` | Schedules a timeout; returns its handle or `null` once destruction starts. |
| `cancelRaf(handle)` / `cancelTimeout(handle)` | Cancel tracked work and immediately release its handle. Null, finished, or already-canceled handles are ignored. Use these methods instead of native cancellation for tracked work. |
| `onBeforeDestroy(callback)` | Registers synchronous preparation after ordinary pending work is canceled, before resource cleanup. |
| `trackFinalRaf(callback)` | Schedules a final frame only from a before-destroy hook. This frame deliberately survives destruction, for example to finish an already-pending focus restoration. Returns `null` outside that phase. |
| `onDestroy(callback)` | Registers synchronous resource cleanup, or runs it immediately if already destroyed. |
| `destroy()` | Cancels pending work and runs hooks once. Returns `true` for the first destruction, `false` for repeated or reentrant calls. |

```typescript
import { createTerminalLifecycle } from "@data-slot/core";

const lifecycle = createTerminalLifecycle();
const frame = lifecycle.trackRaf(() => updatePosition());
lifecycle.cancelRaf(frame);
lifecycle.onDestroy(() => observer.disconnect());
lifecycle.destroy();
```

`registerFloatingTerminalResources(lifecycle, resources)` registers cleanup for
`positionSync`, `presence`, `portal`, a `cleanups` array, and an `unbind` callback,
in that order. The resources use the exported `FloatingTerminalResources` type.
The component remains responsible for its closed state and focus policy.

`registerModalTerminalResources(lifecycle, resources)` optionally registers a
`beforeDestroy` hook, then disposes `modalStack`, each entry in the `presence`
array, calls `reset`, `releaseScrollLock`, and `cleanup`, cleans up the nullable
`portal`, drains listener `cleanups`, and calls `unbind`, in that order.
`ModalTerminalResources` describes these callbacks and resources. Focus policy
and interaction events remain the component's responsibility.

`drainCleanups(cleanups)` removes the current callbacks from an array and invokes
them in order. Repeating the call on the emptied array does nothing. Cleanup
callbacks should complete synchronously without throwing.

## License

MIT

## Retaining closed overlay content

`createContentMount({ root, target, strategy: "lazy" })` retains the same authored
nodes outside the connected document. Pass the outer authored portal/positioner
as `target` when present. `strategy: "eager"` leaves content connected.

- Call `mount()` before portal mounting, positioning, ARIA references, or focus.
- Call `unmount()` after the presence exit completes and the portal is restored.
- Call `cleanup()` after portal cleanup to restore authored placement and remove
  the placeholder. Cleanup is terminal and idempotent.

The helper only owns placement. Components own visibility, animation, focus,
ARIA, and open state. `getRoots(scope, slot)` includes nested component roots in
retained content owned by roots within that scope; regular DOM queries do not.
Detachment reduces live DOM after initialization, not server-rendered HTML bytes.
