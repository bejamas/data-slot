# @data-slot/carousel

Headless carousel component for vanilla JavaScript. Accessible, unstyled, and built on native scrolling.

## Installation

```bash
bun add @data-slot/carousel
# or
npm install @data-slot/carousel
```

## Quick Start

```html
<div data-slot="carousel" data-default-index="0">
  <div data-slot="carousel-content">
    <div data-slot="carousel-item">Slide 1</div>
    <div data-slot="carousel-item">Slide 2</div>
    <div data-slot="carousel-item">Slide 3</div>
  </div>

  <button data-slot="carousel-previous">Previous</button>
  <button data-slot="carousel-next">Next</button>
</div>

<script type="module">
  import { create } from "@data-slot/carousel";

  const controllers = create();
</script>
```

## API

### `create(scope?)`

Auto-discover and bind all carousel roots in a scope (`document` by default).

```ts
import { create } from "@data-slot/carousel";

const controllers = create(); // CarouselController[]
```

### `createCarousel(root, options?)`

Create a controller for a specific root element.

```ts
import { createCarousel } from "@data-slot/carousel";

const carousel = createCarousel(element, {
  defaultIndex: 1,
  orientation: "horizontal",
  drag: true,
  loop: false,
  onIndexChange: (index) => console.log(index),
});
```

### Data Attributes

JS options take precedence over data attributes.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-index` | number | `0` | Initial active index |
| `data-orientation` | `horizontal \| vertical` | `horizontal` | Carousel orientation |
| `data-drag` | boolean | `false` | Enable pointer drag/swipe navigation |
| `data-slides` | `single \| multiple` | `single` | Keep intersecting slides active in multiple mode |
| `data-loop` | boolean | `false` | Enable soft-wrap loop navigation |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultIndex` | `number` | `0` | Initial active slide index |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Axis used for keyboard navigation and scrolling |
| `drag` | `boolean` | `false` | Enable pointer drag/swipe navigation on the scroll container |
| `slides` | `"single" \| "multiple"` | `"single"` | Choose index-based or visible-slide accessibility |
| `loop` | `boolean` | `false` | Enable soft-wrap for `prev`/`next`/keyboard/API navigation |
| `onIndexChange` | `(index: number) => void` | `undefined` | Called when active slide changes |

## Controller

| Method / Property | Description |
|-------------------|-------------|
| `prev()` | Navigate to previous slide |
| `next()` | Navigate to next slide |
| `goTo(index)` | Navigate to a reachable position |
| `index` | Current reachable position index |
| `count` | Number of distinct reachable scroll positions |
| `canScrollPrev` | Whether previous navigation is available |
| `canScrollNext` | Whether next navigation is available |
| `destroy()` | Cleanup listeners and observers |

## Navigation Animation

Carousel navigation uses native smooth scrolling by default for:

- `prev()` / `next()` / `goTo()`
- keyboard navigation (`Arrow*`, `Home`, `End`)
- inbound `carousel:set` events
- optional `carousel-previous` / `carousel-next` button clicks

When the user prefers reduced motion (`prefers-reduced-motion: reduce`), navigation falls back to instant scroll behavior.

When `drag` is enabled, the carousel also supports pointer drag/swipe gestures and snaps to the nearest slide on release.

## Events

### Outbound (on root)

| Event | Detail | Description |
|-------|--------|-------------|
| `carousel:change` | `{ index: number }` | Fires when active index changes |

### Inbound (on root)

| Event | Detail | Description |
|-------|--------|-------------|
| `carousel:set` | `{ index?: number, action?: "next" \| "prev" }` | Programmatically navigate carousel |

```js
root.addEventListener("carousel:change", (event) => {
  console.log(event.detail.index);
});

root.dispatchEvent(
  new CustomEvent("carousel:set", { detail: { action: "next" } }),
);

root.dispatchEvent(
  new CustomEvent("carousel:set", { detail: { index: 2 } }),
);
```

## Required Slots

- `carousel` (root)
- `carousel-content` (scroll container)
- `carousel-item` (direct slide children)

## Optional Slots

- `carousel-previous`
- `carousel-next`

## Styling

The component is unstyled and relies on CSS hooks:

```css
[data-slot="carousel"] { position: relative; }

[data-slot="carousel-content"] {
  display: flex;
  overflow: auto;
  scroll-snap-type: x mandatory;
}

[data-slot="carousel"][data-dragging="true"] {
  cursor: grabbing;
}

[data-slot="carousel-item"] {
  flex: 0 0 100%;
  scroll-snap-align: start;
}

[data-slot="carousel-item"][data-state="active"] {
  opacity: 1;
}

[data-slot="carousel-item"][data-state="inactive"] {
  opacity: 0.75;
}
```

For vertical carousels, switch `scroll-snap-type` to `y mandatory` and use column layout.

## Accessibility

The carousel shows one slide at a time. Inactive slides are marked `aria-hidden` and `inert`, which removes them and their content from the accessibility tree and the tab order until they become active. Size slides to fill the viewport, as in the styling example above.

For a strip of narrow cards, set `data-slides="multiple"` on the root (or pass
`slides: "multiple"`). Every slide whose box intersects the content viewport,
including partially visible cards, stays `data-state="active"`, without `inert`
or `aria-hidden`. Off-screen slides remain inactive, inert and hidden. Visibility
updates during scrolling, after resize and after slide mutations. Links and buttons
in visible neighbours remain clickable, focusable and available to screen readers.
Focus moves to the content only when its containing slide leaves view. The current
index still drives navigation and `carousel:change`; several active slides do not
emit additional index changes.

```html
<div data-slot="carousel" data-slides="multiple">
  <div data-slot="carousel-content" style="display:flex; overflow:auto; gap:20px">
    <div data-slot="carousel-item" style="flex:0 0 360px"><a href="#one">Card 1</a></div>
    <div data-slot="carousel-item" style="flex:0 0 360px"><a href="#two">Card 2</a></div>
  </div>
</div>
```

The controller automatically sets:

- root: `role="region"`, `aria-roledescription="carousel"`
- item: `role="group"`, `aria-roledescription="slide"`, `aria-label="n of total"`
- item state: `data-state`, `aria-hidden`, `inert`
- root drag state: `data-dragging="true"` during an active pointer drag
- nav controls: `disabled` / `aria-disabled` synced to scrollability

## License

MIT

## Reachable positions

`count`, `index`, `defaultIndex`, `goTo(index)`, keyboard navigation and
`carousel:change` use **reachable position indices**, starting at zero. The runtime
clamps slide starts to the content's scroll range and merges duplicate positions.
For five 360px cards with 20px gaps in a 1280px viewport, positions are
`[0, 380, 600]`, so `count` is 3 and `goTo(2)` reaches the end. Further `next()`
calls do nothing and the next control is disabled (unless soft-wrap `loop` is on).
A strip that fits entirely has one position and both controls are disabled.

Each position is represented by the first slide at its clamped offset. In single
mode that representative slide is active; use `slides: "multiple"` for narrow
cards so every visible card stays accessible. Slide ARIA labels still describe
physical slides (`1 of 5`), while a counter using the controller counts positions.
Full-width slides keep their existing one-position-per-slide indices.
Positions are remeasured on resize and slide mutations; resize selects the position
nearest the previous scroll offset and emits a change if the index changes.
