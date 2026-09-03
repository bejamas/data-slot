# @data-slot/core

Shared utilities for data-slot headless UI components.

## Installation

```bash
npm install @data-slot/core
```

## API

### Migration: floating position owner

`computeFloatingPosition()` now requires an `owner` node in `ComputeFloatingPositionInput`. Pass the anchor, component root, or document that owns the measured rectangles:

```diff
 computeFloatingPosition({
   ...placementOptions,
+  owner: anchor,
 });
```

`owner` is required even when `viewportWidth` and `viewportHeight` are supplied, because viewport offsets also come from the owning window. This changes direct calls to the core helper, including its re-exports from `@data-slot/ui` and `@data-slot/ui/core`. The supplied components already pass their owner; their markup, options, callbacks, and controller methods are unchanged.

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

#### `getDocument(owner?)` / `getWindow(owner?)`

Resolve the document and window that own a node. Use these when building components that can live inside a same-origin iframe while their JavaScript runs in the parent page.

```typescript
import { getDocument, getWindow } from "@data-slot/core";

const doc = getDocument(root);
const win = getWindow(root);
const input = doc.createElement("input");
const style = win.getComputedStyle(root);
```

Both accept a node, a document, `null`, or no argument. `getDocument()` returns a supplied document directly, otherwise the node's `ownerDocument`, falling back to the global `document`. `getWindow()` returns that document's `defaultView`, falling back to the global `window` when it has no associated window.

### Scroll Lock Utilities

#### `lockScroll(owner?)` / `unlockScroll(owner?)`

Lock scrolling in the owning document while an overlay is open. The optional owner is a node or document; omitting it (or passing `null`) targets the global document, preserving existing calls.

```typescript
import { lockScroll, unlockScroll } from "@data-slot/core";

lockScroll(root);
// When the overlay closes or is destroyed:
unlockScroll(root);
```

Pair each lock with an unlock for the same document. Locks are reference-counted separately per document, so nested overlays keep that document locked until its last lock is released. Locking an iframe's document does not lock its parent. The helper saves and restores the inline `overflow` and `scrollbar-gutter` styles on the document's `<html>` element.

### Popup Utilities

#### `computeFloatingPosition(input)`

Calculate a popup's viewport coordinates, with optional collision avoidance. The return value is `{ x, y, side, align }`; the helper does not change the DOM. Measure the anchor and popup in the same document, with the popup visible for measurement.

```typescript
import { computeFloatingPosition, measurePopupContentRect } from "@data-slot/core";

function positionPopup(anchor: HTMLElement, content: HTMLElement) {
  const { x, y } = computeFloatingPosition({
    owner: anchor,
    anchorRect: anchor.getBoundingClientRect(),
    contentRect: measurePopupContentRect(content),
    side: "bottom",
    align: "start",
    sideOffset: 8,
    alignOffset: 0,
    avoidCollisions: true,
    collisionPadding: 8,
  });

  content.style.position = "fixed";
  content.style.left = `${x}px`;
  content.style.top = `${y}px`;
}
```

| Input | Required | Description |
|-------|----------|-------------|
| `owner` | Yes | Node in the document whose viewport owns the measurements |
| `anchorRect`, `contentRect` | Yes | Rectangles with `top`, `right`, `bottom`, `left`, `width`, and `height` |
| `side` | Yes | `top`, `right`, `bottom`, `left`, `inline-start`, or `inline-end` |
| `align` | Yes | `start`, `center`, or `end` |
| `sideOffset`, `alignOffset` | Yes | Placement offsets in pixels |
| `avoidCollisions` | Yes | Whether to choose a fitting side and clamp to the viewport |
| `collisionPadding` | Yes | Space to keep from viewport edges, in pixels |
| `direction` | No | `ltr` (default) or `rtl` for logical sides |
| `allowedSides` | No | Ordered candidate sides for collision handling |
| `viewportWidth`, `viewportHeight` | No | Override the viewport dimensions in pixels |

By default, dimensions come from the owning window's `visualViewport`, falling back to its `innerWidth` and `innerHeight`. Offsets come from that same `visualViewport`, or are zero when it is unavailable. Coordinates are local to that viewport; this does not position a popup across document boundaries.

#### `createPositionSync(options)`

Call `onUpdate` as scrolling or layout changes require repositioning. Unless `win` is explicitly provided, the helper uses the window of the first entry in `observedElements`; with no elements it falls back to the global window. Supply elements from the same document and, if overriding `win`, use their owning window.

```typescript
import { createPositionSync } from "@data-slot/core";

const sync = createPositionSync({
  observedElements: [anchor, content],
  onUpdate: updatePosition,
});

sync.start();  // Attach listeners and observers when opening
sync.update(); // Request a position update
// When closing or destroying:
sync.stop();
```

Scroll and resize listeners, animation frames, and supported `ResizeObserver` / `IntersectionObserver` constructors use the selected window. Ancestor scroll and resize tracking are enabled by default; layout-shift and animation-frame tracking are opt-in through `layoutShift` and `animationFrame`.

#### `createPresenceLifecycle(options)`

Manage enter/exit markers and call `onExitComplete` after exit completes. The required options are `element` and `onExitComplete`. The optional `win` defaults to the element's owning window; explicit overrides remain supported. Style reads for exit timing use the element's owning window.

```typescript
import { createPresenceLifecycle } from "@data-slot/core";

const presence = createPresenceLifecycle({
  element: content,
  onExitComplete: () => { content.hidden = true; },
});

content.hidden = false;
presence.enter();
// When closing:
presence.exit();
// When destroying:
presence.cleanup();
```

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

#### `emit(element, name, detail?)`

Dispatch a bubbling custom event with optional detail. The event is constructed using the target element's owning window.

```typescript
emit(root, "tabs:change", { value: "tab-2" });
```

#### `composeHandlers(...handlers)`

Compose multiple event handlers into one. Stops if `event.defaultPrevented`.

```typescript
const handler = composeHandlers(onClickProp, internalHandler);
```

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

## License

MIT
