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
  loop: false,
  onIndexChange: (index) => console.log(index),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultIndex` | `number` | `0` | Initial active slide index |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Axis used for keyboard navigation and scrolling |
| `loop` | `boolean` | `false` | Enable soft-wrap for `prev`/`next`/keyboard/API navigation |
| `onIndexChange` | `(index: number) => void` | `undefined` | Called when active slide changes |

## Controller

| Method / Property | Description |
|-------------------|-------------|
| `prev()` | Navigate to previous slide |
| `next()` | Navigate to next slide |
| `goTo(index)` | Navigate to specific slide |
| `index` | Current active index |
| `count` | Total number of slides |
| `canScrollPrev` | Whether previous navigation is available |
| `canScrollNext` | Whether next navigation is available |
| `destroy()` | Cleanup listeners and observers |

## Data Attributes

JS options take precedence over data attributes.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-default-index` | number | `0` | Initial active index |
| `data-orientation` | `horizontal \| vertical` | `horizontal` | Carousel orientation |
| `data-loop` | boolean | `false` | Enable soft-wrap loop navigation |

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

The controller automatically sets:

- root: `role="region"`, `aria-roledescription="carousel"`
- item: `role="group"`, `aria-roledescription="slide"`
- item state: `data-state`, `aria-hidden`
- nav controls: `disabled` / `aria-disabled` synced to scrollability

## License

MIT
