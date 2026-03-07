export interface InputRow {
  name: string;
  type?: string;
  default?: string;
  description: string;
}

export interface OutputRow {
  name: string;
  values?: string;
  description: string;
}

export interface CssVariableRow {
  name: string;
  availability?: string;
  description: string;
}

export interface SlotReference {
  id: string;
  name: string;
  summary: string;
  status: "required" | "optional" | "generated";
  authored: string;
  element: string;
  inputRows?: InputRow[];
  outputRows?: OutputRow[];
  cssVariables?: CssVariableRow[];
  notes?: string[];
}

export interface ControllerRow {
  name: string;
  kind: "method" | "property";
  description: string;
}

export interface EventRow {
  name: string;
  direction: "outbound" | "inbound";
  detail: string;
  description: string;
}

export interface ReferenceLink {
  label: string;
  href: string;
}

export interface ComponentDoc {
  packageName: string;
  createFn: string;
  overview: string[];
  anatomy: string[];
  anatomyMarkup?: string;
  examples: string[];
  styling: string[];
  accessibility: string[];
  optionPrecedence?: string;
  slots: SlotReference[];
  controller: ControllerRow[];
  events: EventRow[];
  references: ReferenceLink[];
}

const githubReadme = (slug: string, anchor = "") =>
  `https://github.com/bejamas/data-slot/blob/main/packages/${slug}/README.md${anchor}`;

const sourceDir = (slug: string) =>
  `https://github.com/bejamas/data-slot/tree/main/packages/${slug}`;

const npmPackage = (slug: string) =>
  `https://www.npmjs.com/package/@data-slot/${slug}`;

const anatomyMarkupBySlug: Record<string, string> = {
  accordion: String.raw`<div data-slot="accordion">
  <div data-slot="accordion-item" data-value="shipping">
    <button data-slot="accordion-trigger">Shipping</button>
    <div data-slot="accordion-content">...</div>
  </div>

  <div data-slot="accordion-item" data-value="returns">
    <button data-slot="accordion-trigger">Returns</button>
    <div data-slot="accordion-content">...</div>
  </div>
</div>`,
  carousel: String.raw`<section data-slot="carousel">
  <button data-slot="carousel-previous" type="button">Previous</button>

  <div data-slot="carousel-content">
    <article data-slot="carousel-item">...</article>
    <article data-slot="carousel-item">...</article>
    <article data-slot="carousel-item">...</article>
  </div>

  <button data-slot="carousel-next" type="button">Next</button>
</section>`,
  collapsible: String.raw`<section data-slot="collapsible">
  <button data-slot="collapsible-trigger" type="button">
    Toggle details
  </button>

  <div data-slot="collapsible-content">
    ...
  </div>
</section>`,
  combobox: String.raw`<div data-slot="combobox">
  <label data-slot="combobox-label" for="fruit">Fruit</label>

  <div data-slot="combobox-control">
    <input data-slot="combobox-input" id="fruit" />
    <button data-slot="combobox-trigger" type="button">Open</button>
    <button data-slot="combobox-clear" type="button">Clear</button>
  </div>

  <div data-slot="combobox-positioner">
    <div data-slot="combobox-content">
      <div data-slot="combobox-empty">No results</div>
      <div data-slot="combobox-group">
        <div data-slot="combobox-group-label">Fruits</div>
        <div data-slot="combobox-item" data-value="apple">Apple</div>
      </div>
    </div>
  </div>
</div>`,
  dialog: String.raw`<div data-slot="dialog">
  <button data-slot="dialog-trigger" type="button">Open dialog</button>

  <div data-slot="dialog-portal">
    <div data-slot="dialog-overlay"></div>
    <div data-slot="dialog-content">
      <h2 data-slot="dialog-title">Edit profile</h2>
      <p data-slot="dialog-description">Make changes below.</p>
      ...
      <button data-slot="dialog-close" type="button">Close</button>
    </div>
  </div>
</div>`,
  "dropdown-menu": String.raw`<div data-slot="dropdown-menu">
  <button data-slot="dropdown-menu-trigger" type="button">Actions</button>

  <div data-slot="dropdown-menu-portal">
    <div data-slot="dropdown-menu-positioner">
      <div data-slot="dropdown-menu-content">
        <button data-slot="dropdown-menu-item">Edit</button>
        <button data-slot="dropdown-menu-item">Duplicate</button>
        <div data-slot="dropdown-menu-separator"></div>
        <div data-slot="dropdown-menu-group">
          <div data-slot="dropdown-menu-label">View</div>
          <button data-slot="dropdown-menu-checkbox-item">Sidebar</button>
        </div>
      </div>
    </div>
  </div>
</div>`,
  "hover-card": String.raw`<div data-slot="hover-card">
  <a data-slot="hover-card-trigger" href="/profile">Open profile</a>

  <div data-slot="hover-card-portal">
    <div data-slot="hover-card-positioner">
      <div data-slot="hover-card-content">
        ...
        <div data-slot="hover-card-arrow"></div>
      </div>
    </div>
  </div>
</div>`,
  "navigation-menu": String.raw`<nav data-slot="navigation-menu">
  <ul data-slot="navigation-menu-list">
    <li data-slot="navigation-menu-item" data-value="products">
      <button data-slot="navigation-menu-trigger" type="button">
        Products
      </button>
      <div data-slot="navigation-menu-content">...</div>
    </li>

    <li data-slot="navigation-menu-item">
      <a data-slot="navigation-menu-link" href="/pricing">Pricing</a>
    </li>
  </ul>

  <div data-slot="navigation-menu-indicator"></div>

  <div data-slot="navigation-menu-viewport-positioner">
    <div data-slot="navigation-menu-viewport"></div>
  </div>
</nav>`,
  popover: String.raw`<div data-slot="popover">
  <button data-slot="popover-trigger" type="button">Open popover</button>

  <div data-slot="popover-portal">
    <div data-slot="popover-positioner">
      <div data-slot="popover-content">
        ...
        <div data-slot="popover-arrow"></div>
        <button data-slot="popover-close" type="button">Close</button>
      </div>
    </div>
  </div>
</div>`,
  select: String.raw`<div data-slot="select" data-name="framework">
  <button data-slot="select-trigger" type="button">
    <span data-slot="select-value">Choose a framework</span>
  </button>

  <div data-slot="select-portal">
    <div data-slot="select-positioner">
      <div data-slot="select-content">
        <div data-slot="select-group">
          <div data-slot="select-label">Popular</div>
          <div data-slot="select-item" data-value="astro">Astro</div>
          <div data-slot="select-item" data-value="react">React</div>
        </div>
      </div>
    </div>
  </div>
</div>`,
  slider: String.raw`<div data-slot="slider">
  <div data-slot="slider-track">
    <div data-slot="slider-range"></div>
  </div>

  <button data-slot="slider-thumb" type="button"></button>
</div>`,
  tabs: String.raw`<div data-slot="tabs" data-default-value="preview">
  <div data-slot="tabs-list">
    <button data-slot="tabs-trigger" data-value="preview" type="button">
      Preview
    </button>
    <button data-slot="tabs-trigger" data-value="code" type="button">
      Code
    </button>
    <div data-slot="tabs-indicator"></div>
  </div>

  <div data-slot="tabs-content" data-value="preview">...</div>
  <div data-slot="tabs-content" data-value="code">...</div>
</div>`,
  toast: String.raw`<section data-slot="toast">
  <ol data-slot="toast-viewport">
    <li data-slot="toast-item">
      <div data-slot="toast-title">Saved</div>
      <div data-slot="toast-description">Your changes are live.</div>
      <button data-slot="toast-action" type="button">Undo</button>
      <button data-slot="toast-close" type="button">Close</button>
    </li>
  </ol>

  <template data-slot="toast-template">
    <li data-slot="toast-item">...</li>
  </template>
</section>`,
  toggle: String.raw`<button data-slot="toggle" type="button" aria-pressed="false">
  Bold
</button>`,
  "toggle-group": String.raw`<div data-slot="toggle-group">
  <button data-slot="toggle-group-item" data-value="bold" type="button">
    Bold
  </button>
  <button data-slot="toggle-group-item" data-value="italic" type="button">
    Italic
  </button>
  <button data-slot="toggle-group-item" data-value="underline" type="button">
    Underline
  </button>
</div>`,
  tooltip: String.raw`<div data-slot="tooltip">
  <button data-slot="tooltip-trigger" type="button">Hover me</button>

  <div data-slot="tooltip-portal">
    <div data-slot="tooltip-positioner">
      <div data-slot="tooltip-content">Helpful context</div>
    </div>
  </div>
</div>`,
};

const references = (slug: string): ReferenceLink[] => [
  { label: "Package README", href: githubReadme(slug) },
  { label: "Source package", href: sourceDir(slug) },
  { label: "npm package", href: npmPackage(slug) },
];

export const componentDocs: Record<string, ComponentDoc> = {
  accordion: {
    packageName: "@data-slot/accordion",
    createFn: "createAccordion",
    overview: [
      "Accordion is the disclosure primitive for stacked sections of related content. It supports the common single-open pattern as well as multi-open groups without adding opinionated styling.",
    ],
    anatomy: [
      "Author one `accordion-item` per section and give each item a stable `data-value`. The trigger and content pair are the only required children inside an item.",
      "Use the root options to switch between single and multiple expansion modes instead of changing the markup shape.",
    ],
    examples: [
      "The examples show the default single-open behavior first, then the same slots wired for multiple expansion. Both demos use the same `accordion-item` structure and styling hooks.",
    ],
    styling: [
      "Style open and closed states from `data-state` on the item and content. The library does not animate for you, so grid, height, or opacity transitions remain entirely in CSS.",
    ],
    accessibility: [
      "Triggers keep native button semantics and are wired to their panels with `aria-expanded`, `aria-controls`, and `aria-labelledby`. Keyboard navigation follows the standard vertical accordion pattern with Home and End shortcuts.",
    ],
    slots: [
      {
        id: "root",
        name: "accordion",
        summary: "Root container that owns mode selection and the expanded value set.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "multiple / data-multiple", type: "boolean", default: "false", description: "Allow multiple items to stay open at once." },
          { name: "defaultValue / data-default-value", type: "string | string[]", default: "undefined", description: "Initial expanded item or items." },
          { name: "collapsible / data-collapsible", type: "boolean", default: "true", description: "Allow the last open item to collapse in single mode." },
        ],
        outputRows: [],
      },
      {
        id: "item",
        name: "accordion-item",
        summary: "One disclosure row with its own stable value.",
        status: "required",
        authored: "Authored",
        element: "<div data-value=\"…\">",
        inputRows: [
          { name: "data-value", type: "string", default: "—", description: "Required value used by the controller and events." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Expansion state for styling the row wrapper." },
        ],
      },
      {
        id: "trigger",
        name: "accordion-trigger",
        summary: "Interactive button that toggles the owning item.",
        status: "required",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "aria-expanded", values: "\"true\" | \"false\"", description: "Current expanded state." },
          { name: "aria-controls", values: "content id", description: "Links the trigger to its panel." },
        ],
      },
      {
        id: "content",
        name: "accordion-content",
        summary: "Panel region that shows or hides the item body.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Panel state hook for transitions or visibility." },
          { name: "role", values: "\"region\"", description: "Region semantics for the expanded panel." },
          { name: "aria-labelledby", values: "trigger id", description: "Points assistive tech back to the owning trigger." },
        ],
      },
    ],
    controller: [
      { name: "expand(value)", kind: "method", description: "Expand one item by value." },
      { name: "collapse(value)", kind: "method", description: "Collapse one item by value." },
      { name: "toggle(value)", kind: "method", description: "Toggle one item by value." },
      { name: "value", kind: "property", description: "Readonly array of the currently expanded values." },
      { name: "destroy", kind: "method", description: "Remove listeners and observers." },
    ],
    events: [
      { name: "accordion:change", direction: "outbound", detail: "{ value: string[] }", description: "Emitted when the expanded value set changes." },
      { name: "accordion:set", direction: "inbound", detail: "{ value: string | string[] }", description: "Replace the expanded item set programmatically." },
    ],
    references: references("accordion"),
  },
  carousel: {
    packageName: "@data-slot/carousel",
    createFn: "createCarousel",
    overview: [
      "Carousel wraps scroll-snap markup with keyboard, button, drag, and controller APIs. The DOM stays simple: a scroll container, direct slide children, and optional nav buttons.",
    ],
    anatomy: [
      "The root, `carousel-content`, and direct `carousel-item` children are required. Previous and next controls are optional but become part of the managed accessibility surface when present.",
    ],
    examples: [
      "The demo focuses on active-slide state, button controls, and dot syncing layered on top of the controller. The same slot model works for horizontal and vertical layouts.",
    ],
    styling: [
      "Carousel expects CSS to own layout and scroll-snap behavior. Use `data-state` on slides and `data-dragging` on the root to style active items and pointer drag affordances.",
    ],
    accessibility: [
      "The controller applies carousel and slide roles, syncs `aria-hidden` on inactive items, and mirrors button disabled state to scrollability so custom nav controls remain accessible.",
    ],
    slots: [
      {
        id: "root",
        name: "carousel",
        summary: "Root region that owns orientation, drag state, and controller APIs.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultIndex / data-default-index", type: "number", default: "0", description: "Initial active slide index." },
          { name: "orientation / data-orientation", type: "\"horizontal\" | \"vertical\"", default: "\"horizontal\"", description: "Axis used for keyboard navigation and styling." },
          { name: "drag / data-drag", type: "boolean", default: "false", description: "Enable pointer drag and swipe handling." },
          { name: "loop / data-loop", type: "boolean", default: "false", description: "Soft-wrap prev/next and keyboard navigation." },
        ],
        outputRows: [
          { name: "role", values: "\"region\"", description: "Region landmark for the carousel." },
          { name: "aria-roledescription", values: "\"carousel\"", description: "Explicit carousel semantics." },
          { name: "data-orientation", values: "\"horizontal\" | \"vertical\"", description: "Resolved orientation hook for layout." },
          { name: "data-dragging", values: "\"true\"", description: "Present while an active pointer drag is in progress." },
        ],
      },
      {
        id: "content",
        name: "carousel-content",
        summary: "Scrollable snap container that holds slide items directly.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "item",
        name: "carousel-item",
        summary: "One slide inside the scroll container.",
        status: "required",
        authored: "Authored",
        element: "direct child element",
        inputRows: [],
        outputRows: [
          { name: "data-state", values: "\"active\" | \"inactive\"", description: "Marks the active slide for styling." },
          { name: "role", values: "\"group\"", description: "Slide group semantics." },
          { name: "aria-roledescription", values: "\"slide\"", description: "Explicit slide semantics." },
          { name: "aria-hidden", values: "\"true\" | \"false\"", description: "Hidden state for off-screen inactive slides." },
          { name: "aria-label", values: "\"n of m\"", description: "Auto-generated slide position label." },
        ],
      },
      {
        id: "previous",
        name: "carousel-previous",
        summary: "Previous-slide control wired to controller state.",
        status: "optional",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "disabled", values: "native boolean", description: "Disabled when previous navigation is unavailable." },
          { name: "aria-disabled", values: "\"true\" | \"false\"", description: "Mirrors control availability for non-native styling." },
        ],
      },
      {
        id: "next",
        name: "carousel-next",
        summary: "Next-slide control wired to controller state.",
        status: "optional",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "disabled", values: "native boolean", description: "Disabled when next navigation is unavailable." },
          { name: "aria-disabled", values: "\"true\" | \"false\"", description: "Mirrors control availability for non-native styling." },
        ],
      },
    ],
    controller: [
      { name: "prev", kind: "method", description: "Scroll to the previous slide." },
      { name: "next", kind: "method", description: "Scroll to the next slide." },
      { name: "goTo(index)", kind: "method", description: "Jump to a specific slide index." },
      { name: "index", kind: "property", description: "Readonly current active index." },
      { name: "count", kind: "property", description: "Readonly total slide count." },
      { name: "canScrollPrev", kind: "property", description: "Readonly previous-navigation availability." },
      { name: "canScrollNext", kind: "property", description: "Readonly next-navigation availability." },
      { name: "destroy", kind: "method", description: "Remove listeners and observers." },
    ],
    events: [
      { name: "carousel:change", direction: "outbound", detail: "{ index: number }", description: "Emitted when the active slide changes." },
      { name: "carousel:set", direction: "inbound", detail: "{ index?: number, action?: \"next\" | \"prev\" }", description: "Jump to an index or trigger next/previous navigation." },
    ],
    references: references("carousel"),
  },
  collapsible: {
    packageName: "@data-slot/collapsible",
    createFn: "createCollapsible",
    overview: [
      "Collapsible is the simplest show-hide primitive in the library. It gives you a trigger, a content region, and enough state hooks to build disclosure patterns or animated expanders.",
    ],
    anatomy: [
      "Author a root with exactly one trigger and one content element. The content can stay in normal document flow or animate its own dimensions with the exposed CSS variables.",
    ],
    examples: [
      "The demo shows the default toggle flow and the CSS-only transition hooks you can layer onto the content element.",
    ],
    styling: [
      "Use `data-state` on the root and content, `hidden` or `hidden=\"until-found\"` on the panel, and the lifecycle markers for enter/exit transitions. The content element also exposes measured panel size variables.",
    ],
    accessibility: [
      "The controller manages the button-region relationship for you with `aria-expanded`, `aria-controls`, `role=\"region\"`, and `aria-labelledby`.",
    ],
    slots: [
      {
        id: "root",
        name: "collapsible",
        summary: "Root container that owns open state and configuration.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultOpen / data-default-open", type: "boolean", default: "false", description: "Initial open state." },
          { name: "hiddenUntilFound / data-hidden-until-found", type: "boolean", default: "false", description: "Use `hidden=\"until-found\"` while closed." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current root state for styling parent layouts." },
        ],
      },
      {
        id: "trigger",
        name: "collapsible-trigger",
        summary: "Button that toggles the content region.",
        status: "required",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "aria-expanded", values: "\"true\" | \"false\"", description: "Open state exposed to assistive tech." },
          { name: "aria-controls", values: "content id", description: "Links the trigger to the content region." },
        ],
      },
      {
        id: "content",
        name: "collapsible-content",
        summary: "Content region that shows, hides, or animates with measured dimensions.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Panel state hook for visibility and transitions." },
          { name: "hidden", values: "present | \"until-found\"", description: "Hidden when closed; can use until-found mode for find-in-page support." },
          { name: "role", values: "\"region\"", description: "Region semantics for the content." },
          { name: "aria-labelledby", values: "trigger id", description: "Links the region back to the trigger." },
          { name: "data-starting-style", values: "present", description: "Presence lifecycle marker for enter styles." },
          { name: "data-ending-style", values: "present", description: "Presence lifecycle marker for exit styles." },
        ],
        cssVariables: [
          { name: "--collapsible-panel-height", availability: "Direct", description: "Measured panel height during transitions, `auto` at open rest, `0px` when closed." },
          { name: "--collapsible-panel-width", availability: "Direct", description: "Measured panel width during transitions, `auto` at open rest, `0px` when closed." },
        ],
      },
    ],
    controller: [
      { name: "open", kind: "method", description: "Open the collapsible." },
      { name: "close", kind: "method", description: "Close the collapsible." },
      { name: "toggle", kind: "method", description: "Toggle open state." },
      { name: "isOpen", kind: "property", description: "Readonly open-state flag." },
      { name: "destroy", kind: "method", description: "Remove listeners and observers." },
    ],
    events: [
      { name: "collapsible:change", direction: "outbound", detail: "{ open: boolean }", description: "Emitted when open state changes." },
      { name: "collapsible:set", direction: "inbound", detail: "{ open: boolean }", description: "Force the collapsible open or closed." },
    ],
    references: references("collapsible"),
  },
  combobox: {
    packageName: "@data-slot/combobox",
    createFn: "createCombobox",
    overview: [
      "Combobox combines a text input, filtered option list, and optional trigger/clear affordances. It supports inline typing, popup-input composition, and form-friendly hidden input syncing.",
    ],
    anatomy: [
      "The root, input, content, list, and item slots form the core. Optional trigger, clear, value, group, label, separator, empty, portal, and positioner slots let you scale from a minimal autocomplete to a fully composed popup surface.",
    ],
    examples: [
      "The live example demonstrates filtering, highlighted-item movement, placeholder handling, and the optional trigger/value/clear composition in one canonical markup flow.",
    ],
    styling: [
      "Style open state from root, trigger, and content `data-state` / `data-open` / `data-closed`. Style filtering and selection from `data-empty`, `data-highlighted`, `data-selected`, and `data-placeholder` without reading controller state directly.",
      "When a positioner is used, `--transform-origin` is written there and inherited by the content. If no positioner is authored, the content receives the variable directly.",
    ],
    accessibility: [
      "The input carries `role=\"combobox\"`, `aria-autocomplete=\"list\"`, `aria-controls`, and `aria-activedescendant` while navigating. Items are `role=\"option\"`, groups become `role=\"group\"`, and label wiring is handled for grouped lists and native labels.",
    ],
    optionPrecedence:
      "Placement inputs resolve with JavaScript taking highest priority, then `combobox-content`, then `combobox-positioner`, then the `combobox` root as the fallback.",
    slots: [
      {
        id: "root",
        name: "combobox",
        summary: "Root container that owns committed value, popup state, filtering behavior, and form integration.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultValue / data-default-value", type: "string", default: "null", description: "Initial selected value." },
          { name: "placeholder / data-placeholder", type: "string", default: "\"\"", description: "Placeholder text for the input or popup-input composition." },
          { name: "disabled / data-disabled", type: "boolean", default: "false", description: "Disable interaction." },
          { name: "required / data-required", type: "boolean", default: "false", description: "Mark the hidden form field as required." },
          { name: "name / data-name", type: "string", default: "—", description: "Hidden input name for form submission." },
          { name: "openOnFocus / data-open-on-focus", type: "boolean", default: "true", description: "Open the popup when the input receives focus." },
          { name: "autoHighlight / data-auto-highlight", type: "boolean", default: "false", description: "Auto-highlight the first visible item after non-empty input." },
          { name: "filter", type: "function", default: "substring match", description: "Custom filter function for item visibility." },
          { name: "itemToStringValue", type: "(item, value) => string", default: "item label", description: "Resolve the committed text shown after selection." },
          { name: "side / data-side", type: "\"top\" | \"bottom\"", default: "\"bottom\"", description: "Fallback popup placement." },
          { name: "align / data-align", type: "\"start\" | \"center\" | \"end\"", default: "\"start\"", description: "Fallback popup alignment." },
          { name: "sideOffset / data-side-offset", type: "number", default: "4", description: "Fallback distance from the anchor in pixels." },
          { name: "alignOffset / data-align-offset", type: "number", default: "0", description: "Fallback cross-axis offset." },
          { name: "avoidCollisions / data-avoid-collisions", type: "boolean", default: "true", description: "Flip or shift to stay in the viewport." },
          { name: "collisionPadding / data-collision-padding", type: "number", default: "8", description: "Viewport padding used by collision handling." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current popup state on the root." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the root." },
          { name: "data-value", values: "selected value", description: "Committed selected value when one exists." },
        ],
      },
      {
        id: "input",
        name: "combobox-input",
        summary: "Text input used for typing, filtering, and active-descendant navigation.",
        status: "required",
        authored: "Authored",
        element: "<input>",
        inputRows: [],
        outputRows: [
          { name: "role", values: "\"combobox\"", description: "Combobox input semantics." },
          { name: "aria-autocomplete", values: "\"list\"", description: "Signals list-based autocompletion." },
          { name: "aria-controls", values: "list or content id", description: "Points to the controlled popup list." },
          { name: "aria-activedescendant", values: "item id", description: "Highlighted option while navigating with the keyboard." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the combobox is disabled." },
          { name: "aria-required", values: "\"true\"", description: "Present when the combobox participates in required form validation." },
          { name: "aria-labelledby", values: "label id(s)", description: "Extended when grouped labels or native labels are present." },
        ],
      },
      {
        id: "trigger",
        name: "combobox-trigger",
        summary: "Optional button that toggles the popup and can host the committed value.",
        status: "optional",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Mirrors popup state for trigger styling." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the trigger." },
          { name: "data-placeholder", values: "present", description: "Present when the trigger is showing placeholder text." },
          { name: "data-disabled", values: "present", description: "Present when the component is disabled." },
          { name: "aria-disabled", values: "\"true\"", description: "Mirrors disabled state on the optional button." },
        ],
      },
      {
        id: "clear",
        name: "combobox-clear",
        summary: "Optional button that clears the committed value and returns focus to the input.",
        status: "optional",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "value",
        name: "combobox-value",
        summary: "Optional text target for the committed value in popup-input layouts.",
        status: "optional",
        authored: "Authored",
        element: "<span>",
        inputRows: [],
        outputRows: [
          { name: "data-placeholder", values: "present", description: "Present when the slot is showing placeholder text instead of a selection." },
        ],
      },
      {
        id: "content",
        name: "combobox-content",
        summary: "Popup container that owns placement state and empty-state signaling.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"bottom\"", default: "root fallback", description: "Preferred popup side for this instance." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred popup alignment." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the anchor in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport padding used by collision handling." },
        ],
        outputRows: [
          { name: "role", values: "\"listbox\" when no separate list slot is authored", description: "Fallback listbox semantics when the list slot is omitted." },
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current popup state on the content." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the content." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
          { name: "data-empty", values: "present", description: "Present when no visible items match the current query." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Inherited or direct", description: "Available for popup scale and fade animations. Written directly when no positioner is used." },
        ],
      },
      {
        id: "list",
        name: "combobox-list",
        summary: "Optional scroll container for visible options inside the popup.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "role", values: "\"listbox\"", description: "Listbox semantics when the list slot is present." },
          { name: "aria-labelledby", values: "group label ids", description: "Extended when grouped labels are present." },
        ],
      },
      {
        id: "item",
        name: "combobox-item",
        summary: "Selectable option inside the filtered list.",
        status: "required",
        authored: "Authored",
        element: "<div data-value=\"…\">",
        inputRows: [
          { name: "data-value", type: "string", default: "—", description: "Required option value." },
          { name: "data-label", type: "string", default: "textContent", description: "Optional display label used for trigger/value text." },
        ],
        outputRows: [
          { name: "role", values: "\"option\"", description: "Option semantics." },
          { name: "data-selected", values: "present", description: "Present on the committed selected item." },
          { name: "data-highlighted", values: "present", description: "Present on the keyboard-highlighted item." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the option is disabled." },
        ],
      },
      {
        id: "group",
        name: "combobox-group",
        summary: "Group wrapper for related items.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "role", values: "\"group\"", description: "Group semantics for related options." },
          { name: "aria-labelledby", values: "label id", description: "Linked automatically when a combobox-label is present." },
        ],
      },
      {
        id: "label",
        name: "combobox-label",
        summary: "Group label used by the nearest combobox-group.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "separator",
        name: "combobox-separator",
        summary: "Visual divider between items or groups.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "empty",
        name: "combobox-empty",
        summary: "Empty-state element shown when no items match the current query.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "positioner",
        name: "combobox-positioner",
        summary: "Optional authored positioning wrapper reused instead of a generated wrapper.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"bottom\"", default: "root fallback", description: "Preferred side when authored." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the anchor in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport padding used by collision handling." },
        ],
        outputRows: [
          { name: "data-side", values: "resolved side", description: "Resolved side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved alignment after collision handling." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin anchored to the input and resolved placement." },
        ],
      },
      {
        id: "portal",
        name: "combobox-portal",
        summary: "Optional portal wrapper that can contain the positioner.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
    ],
    controller: [
      { name: "value", kind: "property", description: "Readonly committed selected value." },
      { name: "isOpen", kind: "property", description: "Readonly popup visibility state." },
      { name: "open", kind: "method", description: "Open the popup." },
      { name: "close", kind: "method", description: "Close the popup and restore committed value text." },
      { name: "select(value)", kind: "method", description: "Commit a specific option value." },
      { name: "clear", kind: "method", description: "Clear the current selection." },
      { name: "destroy", kind: "method", description: "Remove listeners, generated wrappers, and hidden input sync." },
    ],
    events: [
      { name: "combobox:change", direction: "outbound", detail: "{ value: string | null }", description: "Emitted when the committed value changes." },
      { name: "combobox:open-change", direction: "outbound", detail: "{ open: boolean }", description: "Emitted when popup visibility changes." },
      { name: "combobox:set", direction: "inbound", detail: "{ value?: string | null, open?: boolean }", description: "Set value or popup visibility from outside." },
    ],
    references: references("combobox"),
  },
  dialog: {
    packageName: "@data-slot/dialog",
    createFn: "createDialog",
    overview: [
      "Dialog is the modal surface primitive for overlays that need focus trapping, scroll locking, and background dismissal. The slot model keeps overlay and content styling completely in your hands.",
    ],
    anatomy: [
      "The overlay and content slots are required. Trigger, title, description, close button, and portal wrapper are all optional but integrate directly into the accessibility and portal behavior when authored.",
    ],
    examples: [
      "The demo shows authored overlay and content styling, focus trapping, and the optional close affordance without requiring extra wrapper components.",
    ],
    styling: [
      "Style modal state from the root `data-state` and the hidden state on overlay/content. When multiple dialogs stack, the library exposes stack indexes and CSS variables on the overlay and content instead of imposing z-index values itself.",
    ],
    accessibility: [
      "Dialog manages `role=\"dialog\"` or `role=\"alertdialog\"`, `aria-modal`, title and description wiring, trigger expanded state, focus trapping, and focus restoration on close.",
    ],
    slots: [
      {
        id: "root",
        name: "dialog",
        summary: "Root controller surface for modal state, dismissal, and scroll locking.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultOpen / data-default-open", type: "boolean", default: "false", description: "Initial open state." },
          { name: "closeOnClickOutside / data-close-on-click-outside", type: "boolean", default: "true", description: "Dismiss when clicking outside the content." },
          { name: "closeOnEscape / data-close-on-escape", type: "boolean", default: "true", description: "Dismiss when pressing Escape." },
          { name: "lockScroll / data-lock-scroll", type: "boolean", default: "true", description: "Lock body scroll while open." },
          { name: "alertDialog / data-alert-dialog", type: "boolean", default: "false", description: "Use alert dialog semantics for confirmation flows." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current dialog state on the root." },
        ],
      },
      {
        id: "trigger",
        name: "dialog-trigger",
        summary: "Optional button that opens the dialog.",
        status: "optional",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "aria-haspopup", values: "\"dialog\"", description: "Announces the dialog relationship." },
          { name: "aria-expanded", values: "\"true\" | \"false\"", description: "Mirrors the current open state." },
        ],
      },
      {
        id: "overlay",
        name: "dialog-overlay",
        summary: "Backdrop behind the dialog content.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "hidden", values: "present", description: "Hidden while the dialog is closed." },
          { name: "data-stack-index", values: "number", description: "Stack order when multiple dialogs are open." },
        ],
        cssVariables: [
          { name: "--dialog-stack-index", availability: "Direct", description: "Shared stack index for overlay and content coordination." },
          { name: "--dialog-overlay-stack-index", availability: "Direct", description: "Overlay-specific stack index token." },
        ],
      },
      {
        id: "content",
        name: "dialog-content",
        summary: "Modal panel that holds the dialog body.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "hidden", values: "present", description: "Hidden while the dialog is closed." },
          { name: "role", values: "\"dialog\" | \"alertdialog\"", description: "Resolved dialog semantics." },
          { name: "aria-modal", values: "\"true\"", description: "Marks the content as a modal surface." },
          { name: "aria-labelledby", values: "title id", description: "Linked automatically when a dialog-title is present." },
          { name: "aria-describedby", values: "description id", description: "Linked automatically when a dialog-description is present." },
          { name: "data-stack-index", values: "number", description: "Stack order when multiple dialogs are open." },
        ],
        cssVariables: [
          { name: "--dialog-stack-index", availability: "Direct", description: "Shared stack index for overlay and content coordination." },
          { name: "--dialog-content-stack-index", availability: "Direct", description: "Content-specific stack index token." },
        ],
      },
      {
        id: "title",
        name: "dialog-title",
        summary: "Optional title node used for `aria-labelledby`.",
        status: "optional",
        authored: "Authored",
        element: "<h2>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "description",
        name: "dialog-description",
        summary: "Optional description node used for `aria-describedby`.",
        status: "optional",
        authored: "Authored",
        element: "<p>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "close",
        name: "dialog-close",
        summary: "Optional button that dismisses the dialog.",
        status: "optional",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "portal",
        name: "dialog-portal",
        summary: "Optional wrapper moved to `document.body` on first open.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
        notes: [
          "When authored, the portal wrapper is moved to `document.body` on first open and restored to its authored position on `destroy()`.",
        ],
      },
    ],
    controller: [
      { name: "open", kind: "method", description: "Open the dialog." },
      { name: "close", kind: "method", description: "Close the dialog." },
      { name: "toggle", kind: "method", description: "Toggle the dialog." },
      { name: "isOpen", kind: "property", description: "Readonly open-state flag." },
      { name: "destroy", kind: "method", description: "Remove listeners and restore authored portal placement." },
    ],
    events: [
      { name: "dialog:change", direction: "outbound", detail: "{ open: boolean }", description: "Emitted when dialog state changes." },
      { name: "dialog:set", direction: "inbound", detail: "{ open: boolean }", description: "Set dialog visibility programmatically." },
    ],
    references: references("dialog"),
  },
  "dropdown-menu": {
    packageName: "@data-slot/dropdown-menu",
    createFn: "createDropdownMenu",
    overview: [
      "Dropdown Menu is the anchored action-menu primitive. It handles open state, item highlighting, typeahead, and collision-aware positioning while leaving item styling completely unopinionated.",
    ],
    anatomy: [
      "The core shape is trigger plus content. Groups, labels, shortcuts, separators, positioners, and portals are optional extensions that all stay inside the same slot namespace.",
    ],
    examples: [
      "The example combines destructive items, keyboard shortcuts, grouping, and positioning so you can see the full slot surface in one menu tree.",
    ],
    styling: [
      "Use `data-state`, `data-highlighted`, `data-disabled`, `data-variant`, and `data-inset` for menu item presentation. Placement hooks land on the content and optional positioner, and `--transform-origin` is available for popup animations.",
    ],
    accessibility: [
      "The trigger is wired to a `role=\"menu\"` content surface, items become `role=\"menuitem\"`, and keyboard navigation follows the expected action-menu pattern including typeahead.",
    ],
    optionPrecedence:
      "Positioning inputs resolve with JavaScript first, then `dropdown-menu-content`, then `dropdown-menu-positioner`, then the `dropdown-menu` root as the fallback.",
    slots: [
      {
        id: "root",
        name: "dropdown-menu",
        summary: "Root container that owns open state, selection callbacks, and positioning defaults.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultOpen / data-default-open", type: "boolean", default: "false", description: "Initial open state." },
          { name: "closeOnClickOutside / data-close-on-click-outside", type: "boolean", default: "true", description: "Dismiss when clicking outside." },
          { name: "closeOnEscape / data-close-on-escape", type: "boolean", default: "true", description: "Dismiss when pressing Escape." },
          { name: "closeOnSelect / data-close-on-select", type: "boolean", default: "true", description: "Dismiss after selecting an item." },
          { name: "side / data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "\"bottom\"", description: "Fallback preferred side." },
          { name: "align / data-align", type: "\"start\" | \"center\" | \"end\"", default: "\"start\"", description: "Fallback preferred alignment." },
          { name: "sideOffset / data-side-offset", type: "number", default: "4", description: "Fallback distance from the trigger." },
          { name: "alignOffset / data-align-offset", type: "number", default: "0", description: "Fallback alignment offset." },
          { name: "avoidCollisions / data-avoid-collisions", type: "boolean", default: "true", description: "Flip or shift to stay in the viewport." },
          { name: "collisionPadding / data-collision-padding", type: "number", default: "8", description: "Viewport padding used by collision handling." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current menu state on the root." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the root." },
        ],
      },
      {
        id: "trigger",
        name: "dropdown-menu-trigger",
        summary: "Button that opens or closes the menu.",
        status: "required",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "aria-haspopup", values: "\"menu\"", description: "Announces the controlled menu relationship." },
          { name: "aria-controls", values: "content id", description: "Links the trigger to the menu surface." },
        ],
      },
      {
        id: "content",
        name: "dropdown-menu-content",
        summary: "Menu panel that owns open state and resolved placement.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Preferred side when authored on content." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored on content." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "role", values: "\"menu\"", description: "Menu semantics." },
          { name: "aria-labelledby", values: "trigger id", description: "Links the menu to its trigger." },
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current menu state on the content." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the content." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Inherited or direct", description: "Available for menu open and close animations. Written directly when no positioner is used." },
        ],
      },
      {
        id: "group",
        name: "dropdown-menu-group",
        summary: "Optional grouping wrapper for related menu items.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "label",
        name: "dropdown-menu-label",
        summary: "Non-interactive label for a menu group.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "item",
        name: "dropdown-menu-item",
        summary: "Action item inside the menu.",
        status: "required",
        authored: "Authored",
        element: "focusable element",
        inputRows: [
          { name: "data-value", type: "string", default: "text content", description: "Optional item value emitted on selection." },
          { name: "data-variant", type: "\"default\" | \"destructive\"", default: "\"default\"", description: "Styling intent hook." },
          { name: "data-inset", type: "present", default: "—", description: "Indent the item for aligned submenu-style layouts." },
          { name: "data-disabled", type: "present", default: "—", description: "Disable this item." },
        ],
        outputRows: [
          { name: "role", values: "\"menuitem\"", description: "Menu item semantics." },
          { name: "data-highlighted", values: "present", description: "Present on the keyboard-focused item." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the item is disabled." },
        ],
      },
      {
        id: "separator",
        name: "dropdown-menu-separator",
        summary: "Visual divider between groups of menu items.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "shortcut",
        name: "dropdown-menu-shortcut",
        summary: "Shortcut hint rendered inside an item.",
        status: "optional",
        authored: "Authored",
        element: "<span>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "positioner",
        name: "dropdown-menu-positioner",
        summary: "Optional authored positioning wrapper reused instead of a generated wrapper.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Preferred side when authored." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin anchored to the trigger and resolved placement." },
        ],
      },
      {
        id: "portal",
        name: "dropdown-menu-portal",
        summary: "Optional portal wrapper that can contain the positioner.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
    ],
    controller: [
      { name: "open", kind: "method", description: "Open the menu." },
      { name: "close", kind: "method", description: "Close the menu." },
      { name: "toggle", kind: "method", description: "Toggle menu visibility." },
      { name: "isOpen", kind: "property", description: "Readonly open-state flag." },
      { name: "destroy", kind: "method", description: "Remove listeners and generated positioning wrappers." },
    ],
    events: [
      { name: "dropdown-menu:change", direction: "outbound", detail: "{ open: boolean }", description: "Emitted when menu state changes." },
      { name: "dropdown-menu:select", direction: "outbound", detail: "{ value: string }", description: "Emitted when an item is selected." },
      { name: "dropdown-menu:set", direction: "inbound", detail: "{ open: boolean }", description: "Open or close the menu programmatically." },
    ],
    references: references("dropdown-menu"),
  },
  "hover-card": {
    packageName: "@data-slot/hover-card",
    createFn: "createHoverCard",
    overview: [
      "Hover Card is the delayed preview primitive for richer hover and keyboard-focus disclosures. It supports warm-up timing across instances and collision-aware floating placement.",
    ],
    anatomy: [
      "The trigger and content slots are required. Positioner and portal wrappers are optional authored hooks that let you control markup while still reusing the library's placement logic.",
    ],
    examples: [
      "The example highlights delayed opening, close delay, warm handoff between cards, and the same content slot animated from the resolved anchor side.",
    ],
    styling: [
      "Style visibility from `data-state`, `data-open`, `data-closed`, and `data-instant` on the root, content, and optional positioner. Placement hooks land on content and positioner, and `--transform-origin` is exposed for anchored scale animations.",
    ],
    accessibility: [
      "Hover Card keeps pointer previews accessible to keyboard users by opening from keyboard-intent focus, wiring `aria-controls` and `aria-haspopup`, and exposing stable content ids for linked relationships.",
    ],
    optionPrecedence:
      "Placement inputs resolve with JavaScript first, then `hover-card-content`, then `hover-card-positioner`, then the `hover-card` root as the fallback.",
    slots: [
      {
        id: "root",
        name: "hover-card",
        summary: "Root container that owns open state, timing, dismissal, and fallback placement inputs.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultOpen / data-default-open", type: "boolean", default: "false", description: "Initial open state in uncontrolled mode." },
          { name: "delay / data-delay", type: "number", default: "700", description: "Open delay in milliseconds." },
          { name: "skipDelayDuration / data-skip-delay-duration", type: "number", default: "300", description: "Warm-up window that skips the open delay." },
          { name: "closeDelay / data-close-delay", type: "number", default: "300", description: "Close delay after leave or blur." },
          { name: "side / data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "\"bottom\"", description: "Fallback preferred side." },
          { name: "align / data-align", type: "\"start\" | \"center\" | \"end\"", default: "\"center\"", description: "Fallback preferred alignment." },
          { name: "sideOffset / data-side-offset", type: "number", default: "4", description: "Fallback distance from the trigger." },
          { name: "alignOffset / data-align-offset", type: "number", default: "0", description: "Fallback alignment offset." },
          { name: "avoidCollisions / data-avoid-collisions", type: "boolean", default: "true", description: "Flip or shift to stay in the viewport." },
          { name: "collisionPadding / data-collision-padding", type: "number", default: "8", description: "Viewport edge padding." },
          { name: "portal / data-portal", type: "boolean", default: "true", description: "Portal the content while open." },
          { name: "closeOnClickOutside / data-close-on-click-outside", type: "boolean", default: "true", description: "Dismiss on outside click." },
          { name: "closeOnEscape / data-close-on-escape", type: "boolean", default: "true", description: "Dismiss on Escape." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current root visibility state." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the root." },
          { name: "data-instant", values: "present", description: "Present during warm-up opens and instant closes." },
        ],
      },
      {
        id: "trigger",
        name: "hover-card-trigger",
        summary: "Interactive anchor that opens the preview on pointer or keyboard-intent focus.",
        status: "required",
        authored: "Authored",
        element: "interactive element",
        inputRows: [],
        outputRows: [
          { name: "aria-haspopup", values: "\"dialog\"", description: "Announces the preview relationship." },
          { name: "aria-controls", values: "content id", description: "Links the trigger to the floating content." },
          { name: "aria-expanded", values: "\"true\" | \"false\"", description: "Mirrors the current preview state." },
        ],
      },
      {
        id: "content",
        name: "hover-card-content",
        summary: "Floating preview panel with resolved placement hooks.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Preferred side when authored on content." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored on content." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current content state." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the content." },
          { name: "data-instant", values: "present", description: "Present during warm-up opens and instant closes." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Inherited or direct", description: "Available for preview scale animations. Written directly when no positioner is used." },
        ],
      },
      {
        id: "positioner",
        name: "hover-card-positioner",
        summary: "Optional authored positioning wrapper reused instead of a generated wrapper.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Preferred side when authored." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Mirrors floating visibility state." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the positioner." },
          { name: "data-instant", values: "present", description: "Present during warm-up opens and instant closes." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin anchored to the trigger and resolved placement." },
        ],
      },
      {
        id: "portal",
        name: "hover-card-portal",
        summary: "Optional portal wrapper that can contain the positioner.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
    ],
    controller: [
      { name: "open", kind: "method", description: "Request the preview to open." },
      { name: "close", kind: "method", description: "Request the preview to close." },
      { name: "toggle", kind: "method", description: "Toggle preview state." },
      { name: "setOpen(open)", kind: "method", description: "Force a controlled open or closed update." },
      { name: "isOpen", kind: "property", description: "Readonly visibility flag." },
      { name: "destroy", kind: "method", description: "Remove listeners, timers, and generated wrappers." },
    ],
    events: [
      { name: "hover-card:change", direction: "outbound", detail: "{ open: boolean, reason: string, trigger: HTMLElement, content: HTMLElement }", description: "Emitted when open state changes or is requested in controlled mode." },
      { name: "hover-card:set", direction: "inbound", detail: "{ open: boolean }", description: "Force the hover-card open or closed." },
    ],
    references: references("hover-card"),
  },
  "navigation-menu": {
    packageName: "@data-slot/navigation-menu",
    createFn: "createNavigationMenu",
    overview: [
      "Navigation Menu is the mega-menu primitive for top-level site navigation. It coordinates trigger state, content mounting, animated indicator movement, viewport sizing, and optional hover-safe-triangle behavior.",
    ],
    anatomy: [
      "The core shape is root, list, item, trigger, and content. Optional indicator, viewport, viewport-positioner, portal, bridge, and debug safe-triangle slots expose the rest of the animated menu system as styleable hooks.",
    ],
    examples: [
      "The demo shows directional content transitions, an animated indicator, and an authored viewport. Those are all optional enhancements layered on the same trigger and content parts.",
    ],
    styling: [
      "Navigation Menu exposes the richest styling surface in the docs set. Trigger, item, root, viewport, indicator, and content all publish runtime state, while transform origin, viewport size, motion direction, and indicator geometry land as CSS variables on the relevant slots.",
    ],
    accessibility: [
      "The controller wires top-level triggers to their content with ids and focus management, keeps inactive content `aria-hidden`, and supports keyboard travel across the top row and inside the active panel.",
    ],
    optionPrecedence:
      "Placement inputs resolve with JavaScript first, then `navigation-menu-content`, then `navigation-menu-item`, then the `navigation-menu` root as the fallback. Indicator and safe-triangle features are opt-in through the root options.",
    slots: [
      {
        id: "root",
        name: "navigation-menu",
        summary: "Root container that owns active value, hover timing, safe-triangle behavior, and viewport defaults.",
        status: "required",
        authored: "Authored",
        element: "<nav>",
        inputRows: [
          { name: "delayOpen / data-delay-open", type: "number", default: "0", description: "Hover open delay in milliseconds." },
          { name: "delayClose / data-delay-close", type: "number", default: "0", description: "Hover close delay in milliseconds." },
          { name: "openOnFocus / data-open-on-focus", type: "boolean", default: "false", description: "Open a submenu when its trigger receives focus." },
          { name: "side / data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "\"bottom\"", description: "Fallback viewport side." },
          { name: "align / data-align", type: "\"start\" | \"center\" | \"end\"", default: "\"start\"", description: "Fallback viewport alignment." },
          { name: "sideOffset / data-side-offset", type: "number", default: "0", description: "Distance from trigger to viewport." },
          { name: "alignOffset / data-align-offset", type: "number", default: "0", description: "Cross-axis alignment offset." },
          { name: "safeTriangle / data-safe-triangle", type: "boolean", default: "false", description: "Enable hover-safe-triangle switching guard." },
          { name: "debugSafeTriangle / data-debug-safe-triangle", type: "boolean", default: "false", description: "Render the debug safe-triangle polygon." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Whether any submenu content is currently open." },
          { name: "data-motion", values: "\"from-start\" | \"from-end\" | \"to-start\" | \"to-end\"", description: "Directional root motion hint while switching active items." },
        ],
      },
      {
        id: "list",
        name: "navigation-menu-list",
        summary: "Container for top-level items and the optional indicator.",
        status: "required",
        authored: "Authored",
        element: "<ul>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "item",
        name: "navigation-menu-item",
        summary: "Top-level menu item that owns one trigger/content pair or a plain link.",
        status: "required",
        authored: "Authored",
        element: "<li data-value=\"…\">",
        inputRows: [
          { name: "data-value", type: "string", default: "—", description: "Required submenu identifier for items with content." },
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Placement override for this item's content." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Alignment override for this item's content." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from trigger to viewport for this item." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset for this item's content." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Whether this top-level item is active." },
        ],
      },
      {
        id: "trigger",
        name: "navigation-menu-trigger",
        summary: "Interactive top-level trigger for submenu content.",
        status: "required",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Whether this trigger owns the active submenu." },
          { name: "aria-haspopup", values: "\"true\"", description: "Announces the trigger controls submenu content." },
          { name: "aria-controls", values: "content id", description: "Links the trigger to its submenu content." },
        ],
      },
      {
        id: "content",
        name: "navigation-menu-content",
        summary: "Submenu panel that becomes active inside the viewport.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "item/root fallback", description: "Preferred viewport side for this content." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "item/root fallback", description: "Preferred alignment for this content." },
          { name: "data-side-offset", type: "number", default: "item/root fallback", description: "Distance from trigger to viewport for this content." },
          { name: "data-align-offset", type: "number", default: "item/root fallback", description: "Cross-axis offset for this content." },
        ],
        outputRows: [
          { name: "data-state", values: "\"active\" | \"inactive\"", description: "Whether this panel is the active mounted content." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after viewport positioning." },
          { name: "data-align", values: "resolved align", description: "Resolved alignment after viewport positioning." },
          { name: "data-motion", values: "\"from-right\" | \"from-left\" | \"to-right\" | \"to-left\"", description: "Directional transition hint while switching between active panels." },
          { name: "aria-hidden", values: "\"true\" when inactive", description: "Hidden state for inactive panels." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin scoped to the content coordinate space." },
        ],
      },
      {
        id: "indicator",
        name: "navigation-menu-indicator",
        summary: "Animated highlight that tracks the active top-level trigger.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "data-state", values: "\"visible\" | \"hidden\"", description: "Indicator visibility state." },
          { name: "data-instant", values: "present", description: "Present while skipping the first open transition." },
        ],
        cssVariables: [
          { name: "--indicator-left", availability: "Direct", description: "Left offset from the list." },
          { name: "--indicator-width", availability: "Direct", description: "Active trigger width." },
          { name: "--indicator-top", availability: "Direct", description: "Top offset from the list." },
          { name: "--indicator-height", availability: "Direct", description: "Active trigger height." },
        ],
      },
      {
        id: "viewport",
        name: "navigation-menu-viewport",
        summary: "Mounted viewport that hosts the active submenu content and animates its size.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Viewport visibility state." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
          { name: "data-instant", values: "present", description: "Present on the initial open to skip size animation." },
        ],
        cssVariables: [
          { name: "--viewport-width", availability: "Direct", description: "Width of the active content." },
          { name: "--viewport-height", availability: "Direct", description: "Height of the active content." },
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin scoped to the viewport coordinate space." },
          { name: "--motion-direction", availability: "Direct", description: "`1` or `-1` for directional viewport transitions." },
        ],
      },
      {
        id: "viewport-positioner",
        name: "navigation-menu-viewport-positioner",
        summary: "Positioning wrapper for the viewport, authored or generated as needed.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
          { name: "data-instant", values: "present", description: "Present on the initial open to skip the first transition." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin scoped to the positioner coordinate space." },
        ],
      },
      {
        id: "bridge",
        name: "navigation-menu-bridge",
        summary: "Hover safety shield that covers the gap between trigger and viewport.",
        status: "generated",
        authored: "Generated",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "portal",
        name: "navigation-menu-portal",
        summary: "Optional authored portal wrapper that can contain generated positioners.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "safe-triangle",
        name: "navigation-menu-safe-triangle",
        summary: "Debug-only polygon visualizing the hover safe-triangle corridor.",
        status: "generated",
        authored: "Generated",
        element: "<svg>",
        inputRows: [],
        outputRows: [],
        notes: [
          "Rendered only when `debugSafeTriangle` or `data-debug-safe-triangle` is enabled.",
        ],
      },
    ],
    controller: [
      { name: "open(value)", kind: "method", description: "Open a specific top-level item by value." },
      { name: "close", kind: "method", description: "Close the active menu." },
      { name: "value", kind: "property", description: "Readonly active item value or `null`." },
      { name: "destroy", kind: "method", description: "Remove listeners and generated layers." },
    ],
    events: [
      { name: "navigation-menu:change", direction: "outbound", detail: "{ value: string | null }", description: "Emitted when the active item changes." },
      { name: "navigation-menu:set", direction: "inbound", detail: "{ value: string | null }", description: "Open a specific item or close the menu." },
    ],
    references: references("navigation-menu"),
  },
  popover: {
    packageName: "@data-slot/popover",
    createFn: "createPopover",
    overview: [
      "Popover is the anchored floating-surface primitive for interactive panels. It handles collision-aware placement, optional portals, and outside dismissal without dictating presentation.",
    ],
    anatomy: [
      "Author a trigger and content slot, then add close, positioner, or portal slots only when the interaction or layout needs them. The content can be positioned directly or through a reusable positioner wrapper.",
    ],
    examples: [
      "The example focuses on anchored placement, side-aware animation, and the optional close button inside the panel.",
    ],
    styling: [
      "Use `data-state`, `data-open`, `data-closed`, `data-side`, and `data-align` on the content and optional positioner for animation and placement styling. `--transform-origin` is available for anchored scale and slide effects.",
    ],
    accessibility: [
      "Popover wires the trigger to its content, restores focus on close, and keeps interactive panel content reachable without turning the floating surface into a modal dialog.",
    ],
    optionPrecedence:
      "Placement inputs resolve with JavaScript first, then `popover-content`, then `popover-positioner`, then the `popover` root as the fallback.",
    slots: [
      {
        id: "root",
        name: "popover",
        summary: "Root container that owns open state, dismissal behavior, and fallback placement.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultOpen / data-default-open", type: "boolean", default: "false", description: "Initial open state." },
          { name: "side / data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "\"bottom\"", description: "Fallback preferred side." },
          { name: "align / data-align", type: "\"start\" | \"center\" | \"end\"", default: "\"center\"", description: "Fallback preferred alignment." },
          { name: "sideOffset / data-side-offset", type: "number", default: "4", description: "Fallback distance from the trigger." },
          { name: "alignOffset / data-align-offset", type: "number", default: "0", description: "Fallback alignment offset." },
          { name: "avoidCollisions / data-avoid-collisions", type: "boolean", default: "true", description: "Flip or shift to stay in the viewport." },
          { name: "collisionPadding / data-collision-padding", type: "number", default: "8", description: "Viewport edge padding." },
          { name: "portal / data-portal", type: "boolean", default: "true", description: "Portal the content while open." },
          { name: "closeOnClickOutside / data-close-on-click-outside", type: "boolean", default: "true", description: "Dismiss on outside click." },
          { name: "closeOnEscape / data-close-on-escape", type: "boolean", default: "true", description: "Dismiss on Escape." },
          { name: "position / data-position", type: "\"top\" | \"bottom\" | \"left\" | \"right\"", default: "deprecated", description: "Deprecated alias for `side`." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current root visibility state." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the root." },
        ],
      },
      {
        id: "trigger",
        name: "popover-trigger",
        summary: "Button that toggles the popover panel.",
        status: "required",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "aria-haspopup", values: "\"dialog\"", description: "Announces the floating panel relationship." },
          { name: "aria-controls", values: "content id", description: "Links the trigger to the popover content." },
          { name: "aria-expanded", values: "\"true\" | \"false\"", description: "Mirrors popover state." },
        ],
      },
      {
        id: "content",
        name: "popover-content",
        summary: "Floating panel with resolved placement hooks and optional direct positioning.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Preferred side when authored on content." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored on content." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
          { name: "data-position", type: "\"top\" | \"bottom\" | \"left\" | \"right\"", default: "deprecated", description: "Deprecated alias for `data-side`." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current content state." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the content." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
          { name: "data-position", values: "resolved side", description: "Legacy side alias still written for compatibility." },
          { name: "tabindex", values: "-1", description: "Applied when needed to focus the content container." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Inherited or direct", description: "Available for anchored animations. Written directly when no positioner is used." },
        ],
      },
      {
        id: "close",
        name: "popover-close",
        summary: "Optional button that dismisses the popover.",
        status: "optional",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "positioner",
        name: "popover-positioner",
        summary: "Optional authored positioning wrapper reused instead of a generated wrapper.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Preferred side when authored." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Mirrors popover state." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the positioner." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin anchored to the trigger and resolved placement." },
        ],
      },
      {
        id: "portal",
        name: "popover-portal",
        summary: "Optional portal wrapper that can contain the positioner.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
    ],
    controller: [
      { name: "open", kind: "method", description: "Open the popover." },
      { name: "close", kind: "method", description: "Close the popover." },
      { name: "toggle", kind: "method", description: "Toggle visibility." },
      { name: "isOpen", kind: "property", description: "Readonly visibility flag." },
      { name: "destroy", kind: "method", description: "Remove listeners and generated wrappers." },
    ],
    events: [
      { name: "popover:change", direction: "outbound", detail: "{ open: boolean }", description: "Emitted when popover state changes." },
      { name: "popover:set", direction: "inbound", detail: "{ open: boolean }", description: "Set popover visibility programmatically." },
    ],
    references: references("popover"),
  },
  select: {
    packageName: "@data-slot/select",
    createFn: "createSelect",
    overview: [
      "Select provides a headless single-select input with listbox semantics, optional portal positioning, and built-in form submission via a hidden input.",
    ],
    anatomy: [
      "Author the root, trigger, value, content, and item slots for the basic version. Groups, labels, separators, positioners, and portals are optional composition helpers layered on the same listbox model.",
    ],
    examples: [
      "The example shows a styled trigger/value pair, grouped items, placeholder behavior, and the popup surface in both authored and generated positioning modes.",
    ],
    styling: [
      "Style open state from root, trigger, and content `data-state` / `data-open` / `data-closed`. Style selection and navigation from `data-selected`, `data-highlighted`, `data-placeholder`, `data-label`, and the resolved placement hooks on the popup.",
      "When popper positioning is active, `--transform-origin` is written on the positioner and inherited by the content. In item-aligned mode you can still consume it directly on the positioned element.",
    ],
    accessibility: [
      "The trigger carries combobox semantics, content becomes `role=\"listbox\"`, items are `role=\"option\"`, groups become `role=\"group\"`, and labels are linked automatically. Name and required options also wire hidden-input form participation.",
    ],
    optionPrecedence:
      "Placement inputs resolve with JavaScript first, then `select-content`, then `select-positioner`, then the `select` root as the fallback when `position=\"popper\"` is active.",
    slots: [
      {
        id: "root",
        name: "select",
        summary: "Root container that owns selected value, popup state, positioning mode, and form integration.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultValue / data-default-value", type: "string", default: "null", description: "Initial selected value." },
          { name: "placeholder / data-placeholder", type: "string", default: "\"\"", description: "Placeholder text when no value is selected." },
          { name: "disabled / data-disabled", type: "boolean", default: "false", description: "Disable interaction." },
          { name: "required / data-required", type: "boolean", default: "false", description: "Mark the hidden form field as required." },
          { name: "name / data-name", type: "string", default: "—", description: "Hidden input name for form submission." },
          { name: "position / data-position", type: "\"item-aligned\" | \"popper\"", default: "\"item-aligned\"", description: "Popup positioning mode." },
          { name: "avoidCollisions / data-avoid-collisions", type: "boolean", default: "true", description: "Flip or shift to stay in the viewport in popper mode." },
          { name: "collisionPadding / data-collision-padding", type: "number", default: "8", description: "Viewport edge padding in popper mode." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current popup state on the root." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the root." },
          { name: "data-value", values: "selected value", description: "Current selected value on the root." },
        ],
      },
      {
        id: "trigger",
        name: "select-trigger",
        summary: "Button that opens the popup and displays the current value.",
        status: "required",
        authored: "Authored",
        element: "<button>",
        inputRows: [],
        outputRows: [
          { name: "role", values: "\"combobox\"", description: "Combobox trigger semantics." },
          { name: "aria-haspopup", values: "\"listbox\"", description: "Announces the controlled listbox." },
          { name: "aria-controls", values: "content id", description: "Links the trigger to the popup content." },
          { name: "aria-labelledby", values: "label id(s)", description: "Extended when a native `<label>` or group label is present." },
          { name: "aria-required", values: "\"true\"", description: "Present when the select participates in required form validation." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the select is disabled." },
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Mirrors popup state on the trigger." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the trigger." },
          { name: "data-placeholder", values: "present", description: "Present when the trigger is showing placeholder text." },
          { name: "data-disabled", values: "present", description: "Present when the select is disabled." },
        ],
      },
      {
        id: "value",
        name: "select-value",
        summary: "Text target inside the trigger that displays the selected label.",
        status: "required",
        authored: "Authored",
        element: "<span>",
        inputRows: [
          { name: "data-placeholder", type: "string", default: "root placeholder", description: "Optional per-slot placeholder override." },
        ],
        outputRows: [],
      },
      {
        id: "content",
        name: "select-content",
        summary: "Popup listbox that owns open state and resolved placement.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"bottom\"", default: "root fallback", description: "Preferred side in popper mode." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment in popper mode." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "role", values: "\"listbox\"", description: "Listbox semantics." },
          { name: "aria-labelledby", values: "trigger id", description: "Links the content back to the trigger." },
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current popup state on the content." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the content." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Inherited or direct", description: "Available for popup scale animations. Written directly when no positioner is used." },
        ],
      },
      {
        id: "item",
        name: "select-item",
        summary: "Selectable option inside the listbox.",
        status: "required",
        authored: "Authored",
        element: "<div data-value=\"…\">",
        inputRows: [
          { name: "data-value", type: "string", default: "—", description: "Required option value." },
          { name: "data-label", type: "string", default: "textContent", description: "Optional label used in the trigger display." },
        ],
        outputRows: [
          { name: "role", values: "\"option\"", description: "Option semantics." },
          { name: "data-selected", values: "present", description: "Present on the selected item." },
          { name: "data-highlighted", values: "present", description: "Present on the keyboard-highlighted item." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the item is disabled." },
        ],
      },
      {
        id: "group",
        name: "select-group",
        summary: "Group wrapper for related options.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "role", values: "\"group\"", description: "Group semantics for related options." },
          { name: "aria-labelledby", values: "label id", description: "Linked automatically when a select-label is present." },
        ],
      },
      {
        id: "label",
        name: "select-label",
        summary: "Group label used by the nearest select-group.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "separator",
        name: "select-separator",
        summary: "Visual divider between items or groups.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "positioner",
        name: "select-positioner",
        summary: "Optional authored positioning wrapper reused instead of a generated wrapper.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"bottom\"", default: "root fallback", description: "Preferred side in popper mode when authored." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment in popper mode when authored." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin anchored to the trigger and resolved placement." },
        ],
      },
      {
        id: "portal",
        name: "select-portal",
        summary: "Optional portal wrapper that can contain the positioner.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
    ],
    controller: [
      { name: "select(value)", kind: "method", description: "Select a specific option value." },
      { name: "open", kind: "method", description: "Open the popup." },
      { name: "close", kind: "method", description: "Close the popup." },
      { name: "value", kind: "property", description: "Readonly selected value or `null`." },
      { name: "isOpen", kind: "property", description: "Readonly popup visibility state." },
      { name: "destroy", kind: "method", description: "Remove listeners, generated wrappers, and hidden input sync." },
    ],
    events: [
      { name: "select:change", direction: "outbound", detail: "{ value: string | null }", description: "Emitted when the selected value changes." },
      { name: "select:open-change", direction: "outbound", detail: "{ open: boolean }", description: "Emitted when popup visibility changes." },
      { name: "select:set", direction: "inbound", detail: "{ value?: string, open?: boolean }", description: "Set value or popup state from outside." },
    ],
    references: references("select"),
  },
  slider: {
    packageName: "@data-slot/slider",
    createFn: "createSlider",
    overview: [
      "Slider covers both single-value and range interactions with one slot model. It writes inline geometry for thumbs and ranges while keeping all visual presentation and track layout in CSS.",
    ],
    anatomy: [
      "Author a root, a `slider-track`, an optional `slider-range`, and at least one `slider-thumb`. For range sliders, add a second thumb and keep both thumbs as siblings of the track inside the same control wrapper.",
    ],
    examples: [
      "The examples show both single-value and two-thumb range sliders using the same root options and the same thumb and range styling hooks.",
    ],
    styling: [
      "Slider writes orientation, disabled, and dragging state on the root, plus inline position styles and drag state on thumbs and the range. You control the actual geometry, hit areas, and axis-specific layout in CSS.",
    ],
    accessibility: [
      "Each thumb gets `role=\"slider\"`, roving keyboard focus, current value ARIA, and orientation wiring. Range thumbs also receive generated labels when you do not provide your own.",
    ],
    slots: [
      {
        id: "root",
        name: "slider",
        summary: "Root container that owns value, bounds, orientation, and drag state.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultValue / data-default-value", type: "number | [number, number]", default: "min", description: "Initial value for single or range sliders." },
          { name: "min / data-min", type: "number", default: "0", description: "Minimum value." },
          { name: "max / data-max", type: "number", default: "100", description: "Maximum value." },
          { name: "step / data-step", type: "number", default: "1", description: "Step increment." },
          { name: "largeStep / data-large-step", type: "number", default: "step * 10", description: "PageUp/PageDown and Shift+Arrow increment." },
          { name: "orientation / data-orientation", type: "\"horizontal\" | \"vertical\"", default: "\"horizontal\"", description: "Slider orientation." },
          { name: "disabled / data-disabled", type: "boolean", default: "false", description: "Disable interaction." },
        ],
        outputRows: [
          { name: "data-orientation", values: "\"horizontal\" | \"vertical\"", description: "Resolved orientation hook on the root." },
          { name: "data-disabled", values: "present", description: "Present when the slider is disabled." },
          { name: "data-dragging", values: "present", description: "Present while a pointer drag is active." },
        ],
      },
      {
        id: "track",
        name: "slider-track",
        summary: "Track element used to calculate pointer position and render the rail.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "range",
        name: "slider-range",
        summary: "Optional filled range element positioned between the active value bounds.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
        notes: [
          "The controller writes inline size and offset styles so the range element can be positioned with pure CSS.",
        ],
      },
      {
        id: "thumb",
        name: "slider-thumb",
        summary: "Interactive thumb handle. Author one for a single-value slider or two for a range slider.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "data-label", type: "string", default: "auto-generated for range", description: "Optional accessible label for the thumb." },
        ],
        outputRows: [
          { name: "role", values: "\"slider\"", description: "Slider thumb semantics." },
          { name: "tabindex", values: "0 or -1", description: "Managed focus target for roving interaction." },
          { name: "aria-valuemin", values: "number", description: "Current minimum bound." },
          { name: "aria-valuemax", values: "number", description: "Current maximum bound." },
          { name: "aria-valuenow", values: "number", description: "Current thumb value." },
          { name: "aria-orientation", values: "\"horizontal\" | \"vertical\"", description: "Current slider orientation." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the slider is disabled." },
          { name: "data-dragging", values: "present", description: "Present on the thumb currently being dragged." },
        ],
        notes: [
          "The controller writes inline percentage-based position styles to the thumb for you.",
        ],
      },
    ],
    controller: [
      { name: "setValue(value)", kind: "method", description: "Set a single or range value programmatically." },
      { name: "value", kind: "property", description: "Readonly current value or value tuple." },
      { name: "min", kind: "property", description: "Readonly minimum bound." },
      { name: "max", kind: "property", description: "Readonly maximum bound." },
      { name: "disabled", kind: "property", description: "Readonly disabled flag." },
      { name: "destroy", kind: "method", description: "Remove listeners and pointer handlers." },
    ],
    events: [
      { name: "slider:change", direction: "outbound", detail: "{ value: number | [number, number] }", description: "Emitted while the value is changing." },
      { name: "slider:commit", direction: "outbound", detail: "{ value: number | [number, number] }", description: "Emitted when pointer or keyboard interaction commits." },
      { name: "slider:set", direction: "inbound", detail: "{ value: number | [number, number] }", description: "Set the slider value from outside." },
    ],
    references: references("slider"),
  },
  tabs: {
    packageName: "@data-slot/tabs",
    createFn: "createTabs",
    overview: [
      "Tabs is the view-switching primitive for mutually exclusive panels. It supports automatic or manual activation, horizontal or vertical orientation, and an optional animated indicator.",
    ],
    anatomy: [
      "Author a root, one `tabs-list`, one or more `tabs-trigger` buttons, and matching `tabs-content` panels keyed by the same `data-value`. The indicator slot is optional and only needed when you want animated geometry hooks.",
    ],
    examples: [
      "The examples cover the base pattern first and then the indicator-enhanced version so you can see how the same trigger and panel markup supports both layouts.",
    ],
    styling: [
      "Style selection from `data-state` on triggers and panels, plus `data-activation-direction` on panels after tab changes. If you author the indicator slot, the library exposes the active trigger geometry as CSS variables.",
    ],
    accessibility: [
      "Tabs applies tablist, tab, and tabpanel roles, syncs `aria-selected`, `aria-controls`, and `aria-labelledby`, and keeps only the active tab in the natural tab order.",
    ],
    slots: [
      {
        id: "root",
        name: "tabs",
        summary: "Root container that owns selected value, orientation, and activation mode.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultValue / data-default-value", type: "string", default: "first trigger", description: "Initial selected tab value." },
          { name: "orientation / data-orientation", type: "\"horizontal\" | \"vertical\"", default: "\"horizontal\"", description: "Keyboard and layout orientation." },
          { name: "activationMode / data-activation-mode", type: "\"auto\" | \"manual\"", default: "\"auto\"", description: "Whether focus changes selection immediately." },
        ],
        outputRows: [
          { name: "data-value", values: "selected value", description: "Current selected tab value on the root." },
        ],
      },
      {
        id: "list",
        name: "tabs-list",
        summary: "Container for tab triggers and the optional indicator.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "role", values: "\"tablist\"", description: "Tablist semantics." },
          { name: "aria-orientation", values: "\"horizontal\" | \"vertical\"", description: "Present when the list is vertical." },
        ],
      },
      {
        id: "trigger",
        name: "tabs-trigger",
        summary: "Button that selects a panel by value.",
        status: "required",
        authored: "Authored",
        element: "<button data-value=\"…\">",
        inputRows: [
          { name: "data-value", type: "string", default: "—", description: "Required tab value." },
          { name: "data-disabled", type: "present", default: "—", description: "Disable a specific trigger." },
        ],
        outputRows: [
          { name: "role", values: "\"tab\"", description: "Tab semantics." },
          { name: "aria-selected", values: "\"true\" | \"false\"", description: "Selected state." },
          { name: "aria-controls", values: "panel id", description: "Links the trigger to its panel." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the trigger is disabled." },
          { name: "data-state", values: "\"active\" | \"inactive\"", description: "Selection state for styling." },
        ],
      },
      {
        id: "content",
        name: "tabs-content",
        summary: "Panel matched to a trigger by `data-value`.",
        status: "required",
        authored: "Authored",
        element: "<div data-value=\"…\">",
        inputRows: [
          { name: "data-value", type: "string", default: "—", description: "Required panel value that matches a trigger." },
        ],
        outputRows: [
          { name: "role", values: "\"tabpanel\"", description: "Tabpanel semantics." },
          { name: "aria-labelledby", values: "trigger id", description: "Links the panel back to its trigger." },
          { name: "data-state", values: "\"active\" | \"inactive\"", description: "Selection state for styling." },
          { name: "data-activation-direction", values: "\"left\" | \"right\" | \"up\" | \"down\"", description: "Directional hint after tab changes." },
          { name: "hidden", values: "present when inactive", description: "Inactive panels are hidden from layout and accessibility." },
        ],
      },
      {
        id: "indicator",
        name: "tabs-indicator",
        summary: "Optional geometry-aware indicator that tracks the active trigger.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
        cssVariables: [
          { name: "--active-tab-left", availability: "Direct", description: "Left offset of the active trigger." },
          { name: "--active-tab-width", availability: "Direct", description: "Width of the active trigger." },
          { name: "--active-tab-top", availability: "Direct", description: "Top offset of the active trigger." },
          { name: "--active-tab-height", availability: "Direct", description: "Height of the active trigger." },
        ],
      },
    ],
    controller: [
      { name: "select(value)", kind: "method", description: "Select a specific tab value." },
      { name: "value", kind: "property", description: "Readonly selected tab value." },
      { name: "destroy", kind: "method", description: "Remove listeners and roving tabindex management." },
    ],
    events: [
      { name: "tabs:change", direction: "outbound", detail: "{ value: string }", description: "Emitted when the selected tab changes." },
      { name: "tabs:set", direction: "inbound", detail: "{ value: string }", description: "Select a tab programmatically." },
    ],
    references: references("tabs"),
  },
  toast: {
    packageName: "@data-slot/toast",
    createFn: "createToast",
    overview: [
      "Toast is the notification stack primitive with queue management, promise helpers, swipe-to-dismiss behavior, and a generated fallback template when you do not author your own item markup.",
    ],
    anatomy: [
      "The root and `toast-viewport` are the only pieces you need to start. Template, item, title, description, action, and close slots become the public shape for authored or generated toast instances inside the viewport.",
    ],
    examples: [
      "The example demonstrates manual show calls, promise-driven state changes, action buttons, stacking behavior, and the expanded versus collapsed viewport state.",
    ],
    styling: [
      "Toast exposes most of its animation system as CSS variables. Stack geometry is split between the viewport and each toast item, while swipe offsets, lift direction, and enter or exit direction tokens live on the individual item nodes.",
    ],
    accessibility: [
      "The controller keeps overflow-hidden items inert, preserves viewport focus-pause behavior, and lets you build authored toast item markup without losing queue and dismissal behavior.",
    ],
    slots: [
      {
        id: "root",
        name: "toast",
        summary: "Controller surface for queue limits, default duration, position, and imperative APIs.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "limit / data-limit", type: "number", default: "3", description: "Maximum visible toasts at once." },
          { name: "duration / data-duration", type: "number", default: "5000", description: "Default auto-dismiss duration in milliseconds." },
          { name: "position / data-position", type: "position token", default: "\"bottom-right\"", description: "Placement hint for the stack." },
          { name: "pauseOnHover / data-pause-on-hover", type: "boolean", default: "true", description: "Pause timers while the viewport is hovered." },
          { name: "pauseOnFocus / data-pause-on-focus", type: "boolean", default: "true", description: "Pause timers while the viewport contains focus." },
          { name: "portal / data-portal", type: "boolean", default: "false", description: "Portal the viewport to `document.body`." },
        ],
        outputRows: [
          { name: "data-position", values: "position token", description: "Placement token exposed on the root for styling if desired." },
        ],
      },
      {
        id: "viewport",
        name: "toast-viewport",
        summary: "Stack container that positions and expands or collapses visible toasts.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "data-expanded", values: "\"true\" | \"false\"", description: "Whether the stack is fanned out for interaction." },
          { name: "data-position", values: "position token", description: "Resolved stack placement hint." },
        ],
        cssVariables: [
          { name: "--toast-gap", availability: "Direct", description: "Gap between visible toasts." },
          { name: "--toast-collapsed-peek", availability: "Direct", description: "Visible overlap amount in collapsed stacks." },
          { name: "--toast-frontmost-height", availability: "Direct", description: "Frontmost item height in the current stack." },
          { name: "--toast-expanded-stack-size", availability: "Direct", description: "Total height of the fully expanded stack." },
          { name: "--toast-collapsed-stack-size", availability: "Direct", description: "Total height of the collapsed stack." },
          { name: "--toast-stack-size", availability: "Direct", description: "Active viewport height token, collapsed by default and expanded while `data-expanded`." },
        ],
      },
      {
        id: "template",
        name: "toast-template",
        summary: "Optional `<template>` used to stamp each toast item.",
        status: "optional",
        authored: "Authored",
        element: "<template>",
        inputRows: [],
        outputRows: [],
        notes: [
          "If the slot is missing or invalid, the library generates a fallback template for `toast-item`, `toast-title`, `toast-description`, `toast-action`, and `toast-close`.",
        ],
      },
      {
        id: "item",
        name: "toast-item",
        summary: "One visible or overflow-hidden toast instance inside the viewport.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [],
        outputRows: [
          { name: "data-id", values: "toast id", description: "Stable toast identifier." },
          { name: "data-type", values: "type token", description: "Toast intent type such as success, error, or loading." },
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current item visibility state." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the item." },
          { name: "data-mounted", values: "\"true\"", description: "Present once the item has entered the DOM." },
          { name: "data-removed", values: "\"true\"", description: "Present during exit removal." },
          { name: "data-front", values: "\"true\" | \"false\"", description: "Whether this item is currently frontmost." },
          { name: "data-visible", values: "\"true\" | \"false\"", description: "Whether the item is visually available when the stack is limited." },
          { name: "data-expanded", values: "\"true\" | \"false\"", description: "Whether the parent viewport is in expanded mode." },
          { name: "data-swiping / data-swipe-out", values: "present", description: "Swipe interaction and resolved swipe-out state." },
          { name: "data-dismissible", values: "\"false\"", description: "Present when swipe dismissal is disabled." },
          { name: "aria-hidden", values: "\"true\" while overflow-hidden", description: "Assistive-tech hidden state for invisible overflow items." },
          { name: "inert", values: "present while overflow-hidden", description: "Prevents interaction with invisible overflow items." },
        ],
        cssVariables: [
          { name: "--toast-index", availability: "Direct", description: "Zero-based stack index, where `0` is newest." },
          { name: "--toast-count", availability: "Direct", description: "Total active toast count." },
          { name: "--toast-height", availability: "Direct", description: "Current measured item height." },
          { name: "--toast-initial-height", availability: "Direct", description: "Measured height captured at item mount." },
          { name: "--toast-offset", availability: "Direct", description: "Expanded stack offset for the item." },
          { name: "--toast-expanded-offset-y", availability: "Direct", description: "Expanded vertical offset token." },
          { name: "--toast-collapsed-offset-y", availability: "Direct", description: "Collapsed vertical offset token." },
          { name: "--toast-offset-y", availability: "Direct", description: "Backward-compatible alias of `--toast-expanded-offset-y`." },
          { name: "--toast-lift", availability: "Direct", description: "`1` for top stacks, `-1` for bottom stacks." },
          { name: "--toast-stack-direction", availability: "Direct", description: "Stack direction token used for transforms." },
          { name: "--toast-swipe-movement-x", availability: "Direct", description: "Live horizontal swipe offset." },
          { name: "--toast-swipe-movement-y", availability: "Direct", description: "Live vertical swipe offset." },
          { name: "--toast-swipe-end-x", availability: "Direct", description: "Resolved horizontal swipe-out exit target." },
          { name: "--toast-swipe-end-y", availability: "Direct", description: "Resolved vertical swipe-out exit target." },
          { name: "--toast-enter-direction", availability: "Direct", description: "Enter-direction token for custom animations." },
          { name: "--toast-exit-direction", availability: "Direct", description: "Exit-direction token for custom animations." },
        ],
      },
      {
        id: "title",
        name: "toast-title",
        summary: "Title node inside a toast item.",
        status: "optional",
        authored: "Authored or generated",
        element: "text element",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "description",
        name: "toast-description",
        summary: "Description node inside a toast item.",
        status: "optional",
        authored: "Authored or generated",
        element: "text element",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "action",
        name: "toast-action",
        summary: "Optional action button inside a toast item.",
        status: "optional",
        authored: "Authored or generated",
        element: "<button>",
        inputRows: [],
        outputRows: [],
      },
      {
        id: "close",
        name: "toast-close",
        summary: "Optional close button inside a toast item.",
        status: "optional",
        authored: "Authored or generated",
        element: "<button>",
        inputRows: [],
        outputRows: [],
      },
    ],
    controller: [
      { name: "show(options)", kind: "method", description: "Create and show a toast, returning its id." },
      { name: "update(id, patch)", kind: "method", description: "Patch an existing toast in place." },
      { name: "promise(input, options)", kind: "method", description: "Drive loading, success, and error toasts from a promise." },
      { name: "dismiss(id)", kind: "method", description: "Dismiss one toast by id." },
      { name: "dismissAll", kind: "method", description: "Dismiss all active toasts." },
      { name: "count", kind: "property", description: "Readonly active toast count including overflow-hidden items." },
      { name: "destroy", kind: "method", description: "Remove listeners, timers, observers, and restore any portaled viewport." },
    ],
    events: [
      { name: "toast:change", direction: "outbound", detail: "{ id: string, action: \"show\" | \"dismiss\" }", description: "Emitted when a toast is shown or begins dismissing." },
      { name: "toast:action", direction: "outbound", detail: "{ id: string, value: string | undefined }", description: "Emitted when a toast action button is clicked." },
      { name: "toast:show", direction: "inbound", detail: "ToastShowOptions", description: "Show a new toast from outside the controller." },
      { name: "toast:update", direction: "inbound", detail: "{ id: string } & ToastUpdateOptions", description: "Patch an existing toast from outside the controller." },
      { name: "toast:dismiss", direction: "inbound", detail: "{ id: string } | string", description: "Dismiss one toast by id." },
      { name: "toast:clear", direction: "inbound", detail: "none", description: "Dismiss all active toasts." },
    ],
    references: references("toast"),
  },
  toggle: {
    packageName: "@data-slot/toggle",
    createFn: "createToggle",
    overview: [
      "Toggle is the pressed-state button primitive. It is intentionally a single-slot component, making it the simplest way to expose a binary on or off control with styling hooks.",
    ],
    anatomy: [
      "The component is just the root button. Use a native `<button>` so you inherit correct focus, Enter, and Space behavior without extra keyboard glue.",
    ],
    examples: [
      "The example shows how a single `data-state` hook is enough to build a pressed button with CSS or utility classes.",
    ],
    styling: [
      "Style the button from `data-state`, `aria-pressed`, and `aria-disabled`. No wrappers or helper parts are required.",
    ],
    accessibility: [
      "Toggle keeps native button semantics, adds `aria-pressed`, and mirrors disabled state through both native and ARIA hooks when appropriate.",
    ],
    slots: [
      {
        id: "root",
        name: "toggle",
        summary: "Single button slot that owns pressed state and disabled behavior.",
        status: "required",
        authored: "Authored",
        element: "<button>",
        inputRows: [
          { name: "defaultPressed / data-default-pressed", type: "boolean", default: "false", description: "Initial pressed state." },
          { name: "disabled / data-disabled", type: "boolean", default: "false", description: "Disable user interaction." },
        ],
        outputRows: [
          { name: "aria-pressed", values: "\"true\" | \"false\"", description: "Pressed state for assistive tech and styling." },
          { name: "data-state", values: "\"on\" | \"off\"", description: "Pressed state for styling." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the toggle is disabled." },
          { name: "disabled", values: "native boolean", description: "Applied on native button elements when disabled." },
          { name: "type", values: "\"button\"", description: "Set automatically on native buttons to avoid accidental form submission." },
        ],
      },
    ],
    controller: [
      { name: "toggle", kind: "method", description: "Toggle the pressed state." },
      { name: "press", kind: "method", description: "Set the pressed state to true." },
      { name: "release", kind: "method", description: "Set the pressed state to false." },
      { name: "pressed", kind: "property", description: "Readonly pressed state." },
      { name: "destroy", kind: "method", description: "Remove listeners." },
    ],
    events: [
      { name: "toggle:change", direction: "outbound", detail: "{ pressed: boolean }", description: "Emitted when the pressed state changes." },
      { name: "toggle:set", direction: "inbound", detail: "{ value: boolean }", description: "Set the pressed state programmatically." },
    ],
    references: references("toggle"),
  },
  "toggle-group": {
    packageName: "@data-slot/toggle-group",
    createFn: "createToggleGroup",
    overview: [
      "Toggle Group composes multiple toggle items into a shared selection model. It supports single or multiple selection, roving focus, and a single root event surface for value changes.",
    ],
    anatomy: [
      "Author one root with multiple `toggle-group-item` buttons. Each item must have a stable `data-value`, and the root decides whether selection is single or multiple.",
    ],
    examples: [
      "The demo highlights the same item markup in single and multiple modes so you can see how selection behavior changes without changing the slot structure.",
    ],
    styling: [
      "Style selection from `data-state=\"on\" | \"off\"` and `aria-pressed` on each item. Group-level disabled and orientation settings live on the root.",
    ],
    accessibility: [
      "The root becomes `role=\"group\"`, items expose `aria-pressed`, and the controller handles roving tabindex so keyboard users always land on the active or first enabled item.",
    ],
    slots: [
      {
        id: "root",
        name: "toggle-group",
        summary: "Root container that owns selection mode, orientation, and current value list.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "defaultValue / data-default-value", type: "string | string[]", default: "[]", description: "Initial selected value or values." },
          { name: "multiple / data-multiple", type: "boolean", default: "false", description: "Allow multiple selected items." },
          { name: "orientation / data-orientation", type: "\"horizontal\" | \"vertical\"", default: "\"horizontal\"", description: "Keyboard navigation orientation." },
          { name: "loop", type: "boolean", default: "true", description: "Wrap keyboard focus at the ends." },
          { name: "disabled / data-disabled", type: "boolean", default: "false", description: "Disable the entire group." },
        ],
        outputRows: [
          { name: "role", values: "\"group\"", description: "Group semantics." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the group is disabled." },
          { name: "data-value", values: "space-separated values", description: "Current selected values on the root." },
          { name: "data-multiple", values: "present", description: "Present when multiple selection mode is active." },
          { name: "aria-orientation", values: "\"vertical\"", description: "Present when the group uses vertical orientation." },
        ],
      },
      {
        id: "item",
        name: "toggle-group-item",
        summary: "Interactive item that participates in the shared selection state.",
        status: "required",
        authored: "Authored",
        element: "<button data-value=\"…\">",
        inputRows: [
          { name: "data-value", type: "string", default: "—", description: "Required item value." },
          { name: "data-disabled", type: "present", default: "—", description: "Disable this specific item." },
        ],
        outputRows: [
          { name: "aria-pressed", values: "\"true\" | \"false\"", description: "Pressed state for assistive tech and styling." },
          { name: "data-state", values: "\"on\" | \"off\"", description: "Pressed state for styling." },
          { name: "aria-disabled", values: "\"true\"", description: "Present when the item is disabled." },
          { name: "disabled", values: "native boolean", description: "Applied on native button items when disabled." },
          { name: "tabindex", values: "0 or -1", description: "Managed by roving tabindex." },
        ],
      },
    ],
    controller: [
      { name: "setValue(value)", kind: "method", description: "Replace the current selection set." },
      { name: "toggle(value)", kind: "method", description: "Toggle one item by value." },
      { name: "value", kind: "property", description: "Readonly selected value array." },
      { name: "destroy", kind: "method", description: "Remove listeners and roving tabindex management." },
    ],
    events: [
      { name: "toggle-group:change", direction: "outbound", detail: "{ value: string[] }", description: "Emitted when selection changes." },
      { name: "toggle-group:set", direction: "inbound", detail: "{ value: string | string[] }", description: "Replace the current selection from outside." },
    ],
    references: references("toggle-group"),
  },
  tooltip: {
    packageName: "@data-slot/tooltip",
    createFn: "createTooltip",
    overview: [
      "Tooltip is the lightweight floating-label primitive for hover and focus disclosures. It supports warm-up timing across instances, collision-aware placement, and optional authored positioning wrappers.",
    ],
    anatomy: [
      "Author a trigger and content slot for the basic version. Positioner and portal wrappers are optional authored layers when you need full control over the final floating markup.",
    ],
    examples: [
      "The demo highlights side-aware animation, warm-up behavior between triggers, and the same content slot working with pointer and keyboard focus.",
    ],
    styling: [
      "Style visibility from `data-state`, `data-open`, `data-closed`, and `data-instant` on the root, content, and optional positioner. Placement hooks land on content and positioner, and `--transform-origin` is exposed for anchored scale or fade effects.",
    ],
    accessibility: [
      "Tooltip writes `role=\"tooltip\"`, keeps `aria-describedby` only while open, and manages `aria-hidden` explicitly so screen readers do not announce stale content.",
    ],
    optionPrecedence:
      "Placement inputs resolve with JavaScript first, then `tooltip-content`, then `tooltip-positioner`, then the `tooltip` root as the fallback.",
    slots: [
      {
        id: "root",
        name: "tooltip",
        summary: "Root container that owns open timing and fallback placement settings.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "delay / data-delay", type: "number", default: "300", description: "Open delay in milliseconds." },
          { name: "skipDelayDuration / data-skip-delay-duration", type: "number", default: "300", description: "Warm-up window that skips the open delay." },
          { name: "side / data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "\"top\"", description: "Fallback preferred side." },
          { name: "align / data-align", type: "\"start\" | \"center\" | \"end\"", default: "\"center\"", description: "Fallback preferred alignment." },
          { name: "sideOffset / data-side-offset", type: "number", default: "4", description: "Fallback distance from the trigger." },
          { name: "alignOffset / data-align-offset", type: "number", default: "0", description: "Fallback alignment offset." },
          { name: "avoidCollisions / data-avoid-collisions", type: "boolean", default: "true", description: "Flip or shift to stay in the viewport." },
          { name: "collisionPadding / data-collision-padding", type: "number", default: "8", description: "Viewport edge padding." },
          { name: "portal / data-portal", type: "boolean", default: "true", description: "Portal the content while open." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current tooltip state on the root." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the root." },
          { name: "data-instant", values: "present", description: "Present during warm-up opens and instant closes." },
        ],
      },
      {
        id: "trigger",
        name: "tooltip-trigger",
        summary: "Interactive anchor that owns pointer and focus activation.",
        status: "required",
        authored: "Authored",
        element: "interactive element",
        inputRows: [],
        outputRows: [
          { name: "aria-describedby", values: "content id while open", description: "Linked only while the tooltip is visible." },
        ],
      },
      {
        id: "content",
        name: "tooltip-content",
        summary: "Floating tooltip node with resolved placement hooks.",
        status: "required",
        authored: "Authored",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Preferred side when authored on content." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored on content." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "role", values: "\"tooltip\"", description: "Tooltip semantics." },
          { name: "aria-hidden", values: "\"true\" | \"false\"", description: "Explicit assistive-tech hidden state." },
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Current tooltip state on the content." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the content." },
          { name: "data-instant", values: "present", description: "Present during warm-up opens and instant closes." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Inherited or direct", description: "Available for anchored animations. Written directly when no positioner is used." },
        ],
      },
      {
        id: "positioner",
        name: "tooltip-positioner",
        summary: "Optional authored positioning wrapper reused instead of a generated wrapper.",
        status: "optional",
        authored: "Authored or generated",
        element: "<div>",
        inputRows: [
          { name: "data-side", type: "\"top\" | \"right\" | \"bottom\" | \"left\"", default: "root fallback", description: "Preferred side when authored." },
          { name: "data-align", type: "\"start\" | \"center\" | \"end\"", default: "root fallback", description: "Preferred alignment when authored." },
          { name: "data-side-offset", type: "number", default: "root fallback", description: "Distance from the trigger in pixels." },
          { name: "data-align-offset", type: "number", default: "root fallback", description: "Cross-axis offset in pixels." },
          { name: "data-avoid-collisions", type: "boolean", default: "root fallback", description: "Flip or shift to stay in the viewport." },
          { name: "data-collision-padding", type: "number", default: "root fallback", description: "Viewport edge padding." },
        ],
        outputRows: [
          { name: "data-state", values: "\"open\" | \"closed\"", description: "Mirrors tooltip visibility state." },
          { name: "data-open / data-closed", values: "present", description: "Presence-style state hooks on the positioner." },
          { name: "data-instant", values: "present", description: "Present during warm-up opens and instant closes." },
          { name: "data-side", values: "resolved side", description: "Resolved placement side after collision handling." },
          { name: "data-align", values: "resolved align", description: "Resolved placement alignment." },
        ],
        cssVariables: [
          { name: "--transform-origin", availability: "Direct", description: "Pixel origin anchored to the trigger and resolved placement." },
        ],
      },
      {
        id: "portal",
        name: "tooltip-portal",
        summary: "Optional portal wrapper that can contain the positioner.",
        status: "optional",
        authored: "Authored",
        element: "<div>",
        inputRows: [],
        outputRows: [],
      },
    ],
    controller: [
      { name: "show", kind: "method", description: "Show the tooltip immediately, respecting disabled state." },
      { name: "hide", kind: "method", description: "Hide the tooltip." },
      { name: "isOpen", kind: "property", description: "Readonly visibility flag." },
      { name: "destroy", kind: "method", description: "Remove listeners, timers, and generated wrappers." },
    ],
    events: [
      { name: "tooltip:change", direction: "outbound", detail: "{ open: boolean, reason: string, trigger: HTMLElement, content: HTMLElement }", description: "Emitted when tooltip visibility changes." },
      { name: "tooltip:set", direction: "inbound", detail: "{ open: boolean }", description: "Set tooltip visibility programmatically." },
    ],
    references: references("tooltip"),
  },
};

for (const [slug, anatomyMarkup] of Object.entries(anatomyMarkupBySlug)) {
  const doc = componentDocs[slug];
  if (doc) {
    doc.anatomyMarkup = anatomyMarkup;
  }
}
