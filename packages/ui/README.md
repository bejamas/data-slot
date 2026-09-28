# @data-slot/ui

One package for the Data Slot headless components. The components are accessible, unstyled, and work with vanilla JavaScript and Astro.

## Install

```bash
npm install @data-slot/ui
```

The package installs its `@data-slot/*` component and core dependencies. You do not need to install those packages separately.

## Use in Astro

Render the component markup in an `.astro` file and initialize it in a client-side `<script>`:

```astro
<div data-slot="accordion" data-default-value="first">
  <div data-slot="accordion-item" data-value="first">
    <button data-slot="accordion-trigger">First section</button>
    <div data-slot="accordion-content">First section content</div>
  </div>
</div>

<script>
  import { createAccordion } from '@data-slot/ui';

  const root = document.querySelector('[data-slot="accordion"]');
  if (root) createAccordion(root);
</script>
```

Astro bundles the `<script>` for the browser. A named ESM import such as `createAccordion` lets Astro's bundler keep that component and its shared core code while removing unused component exports. Astro frontmatter runs during server rendering, where `document` is unavailable; use a client-side `<script>` to initialize DOM components.

You can also import from a component subpath. Each subpath exports its named constructor, types, and `create(scope?)` function for discovering matching roots:

```astro
<script>
  import { create } from '@data-slot/ui/accordion';

  create(); // Initializes accordion roots in document
</script>
```

Tree shaking applies to ESM builds. The package declares `sideEffects: false` and publishes ESM entries for the root and every subpath. CommonJS entries are also available for environments that require them; use ESM for Astro's client bundle.

## Components

All named constructors below are available from `@data-slot/ui`. Each row also has a dedicated subpath. Import options and controller types by their component-prefixed names from the root or by their original names from the subpath.

| Component | Root export | Subpath |
| --- | --- | --- |
| Accordion | `createAccordion` | `@data-slot/ui/accordion` |
| Alert dialog | `createAlertDialog` | `@data-slot/ui/alert-dialog` |
| Carousel | `createCarousel` | `@data-slot/ui/carousel` |
| Collapsible | `createCollapsible` | `@data-slot/ui/collapsible` |
| Combobox | `createCombobox` | `@data-slot/ui/combobox` |
| Command | `createCommand` | `@data-slot/ui/command` |
| Dialog | `createDialog` | `@data-slot/ui/dialog` |
| Drawer | `createDrawer` | `@data-slot/ui/drawer` |
| Dropdown menu | `createDropdownMenu` | `@data-slot/ui/dropdown-menu` |
| Hover card | `createHoverCard` | `@data-slot/ui/hover-card` |
| Navigation menu | `createNavigationMenu` | `@data-slot/ui/navigation-menu` |
| Popover | `createPopover` | `@data-slot/ui/popover` |
| Radio group | `createRadioGroup` | `@data-slot/ui/radio-group` |
| Resizable panels | `createResizable` | `@data-slot/ui/resizable` |
| Select | `createSelect` | `@data-slot/ui/select` |
| Slider | `createSlider` | `@data-slot/ui/slider` |
| Switch | `createSwitch` | `@data-slot/ui/switch` |
| Tabs | `createTabs` | `@data-slot/ui/tabs` |
| Toast | `createToast` | `@data-slot/ui/toast` |
| Toggle group | `createToggleGroup` | `@data-slot/ui/toggle-group` |
| Toggle | `createToggle` | `@data-slot/ui/toggle` |
| Tooltip | `createTooltip` | `@data-slot/ui/tooltip` |

Shared helpers and types from `@data-slot/core` are available from `@data-slot/ui` and `@data-slot/ui/core`.

Each component package also remains available directly, for example `@data-slot/accordion`. See its README for markup, options, events, and styling hooks.

## License

MIT
