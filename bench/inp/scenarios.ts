export type Step =
  | { click: string }
  | { press: string }
  | { type: string }
  | { focus: string };

export interface Scenario {
  name: string;
  html: string;
  steps: Step[];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const repeat = <T>(n: number, steps: T[]) => range(n).flatMap(() => steps);
const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"];
const label = (i: number) => `${words[i % words.length]} ${words[(i * 7) % words.length]} ${i}`;

/** A realistic article body so style and layout work has a real cost. */
export const filler = `<main class="filler">${range(60)
  .map(
    (i) => `<section><h2>Section ${i}</h2><p>${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(4)}<a href="#s${i}">link</a> <strong>bold</strong> <em>em</em></p><ul>${range(8)
      .map((j) => `<li><span>Item ${j}</span> <code>code</code></li>`)
      .join("")}</ul><div class="card"><img alt="" width="40" height="40"><div><h3>Card ${i}</h3><p>Body text</p><button>Action</button></div></div></section>`
  )
  .join("")}</main>`;

const accordion = (id: string, n: number) => `<div data-slot="accordion" id="${id}" data-default-value="i0">${range(n)
  .map(
    (i) => `<div data-slot="accordion-item" data-value="i${i}"><h3><button data-slot="accordion-trigger" id="${id}-t${i}">${label(i)}</button></h3><div data-slot="accordion-content"><div class="inner"><p>${"Answer text. ".repeat(12)}</p></div></div></div>`
  )
  .join("")}</div>`;

const tabs = (id: string, n: number) => `<div data-slot="tabs" id="${id}" data-default-value="t0"><div data-slot="tabs-list">${range(n)
  .map((i) => `<button data-slot="tabs-trigger" data-value="t${i}" id="${id}-t${i}">${label(i)}</button>`)
  .join("")}<div data-slot="tabs-indicator"></div></div>${range(n)
  .map((i) => `<div data-slot="tabs-content" data-value="t${i}">${range(10).map(() => `<p>Panel ${i} ${"text ".repeat(20)}</p>`).join("")}</div>`)
  .join("")}</div>`;

const select = (id: string, n: number) => `<div data-slot="select" id="${id}" data-placeholder="Pick one"><button data-slot="select-trigger" id="${id}-trigger"><span data-slot="select-value"></span></button><div data-slot="select-content" hidden><div data-slot="select-viewport">${range(Math.ceil(n / 25))
  .map(
    (g) => `<div data-slot="select-group"><div data-slot="select-label">Group ${g}</div>${range(25)
      .map((j) => g * 25 + j)
      .filter((i) => i < n)
      .map((i) => `<div data-slot="select-item" data-value="v${i}"><span data-slot="select-item-text">${label(i)}</span></div>`)
      .join("")}</div>`
  )
  .join("")}</div></div></div>`;

const combobox = (id: string, n: number) => `<div data-slot="combobox" id="${id}" data-placeholder="Search"><input data-slot="combobox-input" id="${id}-input"><button data-slot="combobox-trigger">v</button><div data-slot="combobox-content" hidden><div data-slot="combobox-list"><div data-slot="combobox-empty">No results</div>${range(n)
  .map((i) => `<div data-slot="combobox-item" data-value="v${i}">${label(i)}<span data-slot="combobox-item-indicator">✓</span></div>`)
  .join("")}</div></div></div>`;

const command = (id: string, n: number) => `<div data-slot="command" id="${id}" data-label="Commands"><input data-slot="command-input" id="${id}-input"><div data-slot="command-list"><div data-slot="command-empty" hidden>No results.</div>${range(Math.ceil(n / 50))
  .map(
    (g) => `<div data-slot="command-group"><div data-slot="command-group-heading">Group ${g}</div>${range(50)
      .map((j) => g * 50 + j)
      .filter((i) => i < n)
      .map((i) => `<div data-slot="command-item" data-value="c${i}">${label(i)}<span data-slot="command-shortcut">⌘${i % 10}</span></div>`)
      .join("")}</div>`
  )
  .join("")}</div></div>`;

const dropdown = (id: string, n: number) => `<div data-slot="dropdown-menu" id="${id}"><button data-slot="dropdown-menu-trigger" id="${id}-trigger">Actions</button><div data-slot="dropdown-menu-content" hidden>${range(n)
  .map((i) => `<button data-slot="dropdown-menu-item" data-value="d${i}">${label(i)}</button>`)
  .join("")}</div></div>`;

const dialog = (id: string) => `<div data-slot="dialog" id="${id}"><button data-slot="dialog-trigger" id="${id}-trigger">Open</button><div data-slot="dialog-overlay" hidden></div><div data-slot="dialog-content" hidden><h2 data-slot="dialog-title">Title</h2><p data-slot="dialog-description">Description</p><input><button>OK</button><button data-slot="dialog-close">Close</button></div></div>`;

const popover = (id: string) => `<div data-slot="popover" id="${id}"><button data-slot="popover-trigger" id="${id}-trigger">Popover</button><div data-slot="popover-content" hidden><p>Popover content</p><button data-slot="popover-close">Close</button></div></div>`;

const tooltip = (id: string) => `<div data-slot="tooltip" id="${id}"><button data-slot="tooltip-trigger" id="${id}-trigger">Tip</button><div data-slot="tooltip-content" hidden>Helpful text</div></div>`;

const radio = (id: string, n: number) => `<div data-slot="radio-group" id="${id}" data-default-value="r0" data-name="${id}">${range(n)
  .map((i) => `<label><span data-slot="radio-group-item" data-value="r${i}" id="${id}-r${i}"><span data-slot="radio-group-indicator"></span></span>${label(i)}</label>`)
  .join("")}</div>`;

const toggleGroup = (id: string, n: number) => `<div data-slot="toggle-group" id="${id}" data-default-value="g0">${range(n)
  .map((i) => `<button data-slot="toggle-group-item" data-value="g${i}" id="${id}-g${i}">${i}</button>`)
  .join("")}</div>`;

const slider = (id: string) => `<div data-slot="slider" id="${id}" data-default-value="20,80"><div data-slot="slider-track"><div data-slot="slider-range"></div></div><div data-slot="slider-thumb" id="${id}-a"></div><div data-slot="slider-thumb" id="${id}-b"></div></div>`;

const switchEl = (id: string) => `<label><span data-slot="switch" id="${id}" data-name="${id}"><span data-slot="switch-thumb"></span></span>Switch</label>`;

const collapsible = (id: string) => `<div data-slot="collapsible" id="${id}"><button data-slot="collapsible-trigger" id="${id}-trigger">Toggle</button><div data-slot="collapsible-content" hidden><p>${"Hidden content. ".repeat(20)}</p></div></div>`;

const navMenu = (id: string, n: number) => `<nav data-slot="navigation-menu" id="${id}"><ul data-slot="navigation-menu-list">${range(n)
  .map(
    (i) => `<li data-slot="navigation-menu-item" data-value="n${i}"><button data-slot="navigation-menu-trigger" id="${id}-t${i}">Menu ${i}</button><div data-slot="navigation-menu-content">${range(8)
      .map((j) => `<a href="#${i}-${j}">Link ${i}.${j}</a>`)
      .join("")}</div></li>`
  )
  .join("")}<li data-slot="navigation-menu-indicator" aria-hidden="true"></li></ul><div data-slot="navigation-menu-portal"><div data-slot="navigation-menu-positioner"><div data-slot="navigation-menu-popup"><div data-slot="navigation-menu-viewport"></div></div></div></div></nav>`;

/** Every component type, many times over, as a busy app page would have. */
const kitchenSink = range(25)
  .map(
    (i) => `<div class="row">${accordion(`ka${i}`, 4)}${tabs(`kt${i}`, 4)}${select(`ks${i}`, 12)}${combobox(`kc${i}`, 12)}${dropdown(`kd${i}`, 6)}${dialog(`kg${i}`)}${popover(`kp${i}`)}${tooltip(`ktt${i}`)}${radio(`kr${i}`, 4)}${toggleGroup(`kx${i}`, 4)}${slider(`kl${i}`)}${switchEl(`kw${i}`)}${collapsible(`ko${i}`)}</div>`
  )
  .join("");

export const scenarios: Scenario[] = [
  {
    name: "accordion",
    html: accordion("a", 60),
    steps: [
      ...range(6).map((i) => ({ click: `#a-t${i * 7}` })),
      { focus: "#a-t0" },
      ...repeat(6, [{ press: "ArrowDown" }]),
      { press: "Enter" },
    ],
  },
  {
    name: "tabs",
    html: tabs("t", 24),
    steps: [...range(6).map((i) => ({ click: `#t-t${i * 3 + 1}` })), ...repeat(6, [{ press: "ArrowRight" }])],
  },
  {
    name: "select",
    html: select("s", 400),
    steps: [
      { click: "#s-trigger" },
      ...repeat(8, [{ press: "ArrowDown" }]),
      { press: "Enter" },
      { click: "#s-trigger" },
      { press: "End" },
      { press: "Escape" },
    ],
  },
  {
    name: "combobox",
    html: combobox("c", 800),
    steps: [{ click: "#c-input" }, { type: "charl" }, ...repeat(4, [{ press: "ArrowDown" }]), ...repeat(3, [{ press: "Backspace" }]), { press: "Escape" }],
  },
  {
    name: "command",
    html: command("m", 800),
    steps: [{ click: "#m-input" }, { type: "echo" }, ...repeat(4, [{ press: "ArrowDown" }]), ...repeat(4, [{ press: "Backspace" }])],
  },
  {
    name: "dropdown-menu",
    html: dropdown("d", 40),
    steps: [
      { click: "#d-trigger" },
      ...repeat(6, [{ press: "ArrowDown" }]),
      { press: "Escape" },
      { click: "#d-trigger" },
      { press: "Escape" },
    ],
  },
  {
    name: "dialog+popover",
    html: `${dialog("g")}${popover("p")}`,
    steps: repeat(3, [{ click: "#g-trigger" }, { press: "Escape" }, { click: "#p-trigger" }, { press: "Escape" }]),
  },
  {
    name: "radio+toggle+switch",
    html: `${radio("r", 30)}${toggleGroup("x", 30)}${switchEl("w")}${collapsible("o")}`,
    steps: [
      ...range(4).map((i) => ({ click: `#r-r${i * 5 + 3}` })),
      ...repeat(4, [{ press: "ArrowDown" }]),
      ...range(4).map((i) => ({ click: `#x-g${i * 5 + 2}` })),
      ...repeat(3, [{ click: "#w" }, { click: "#o-trigger" }]),
    ],
  },
  {
    name: "slider",
    html: slider("l"),
    steps: [{ focus: "#l-a" }, ...repeat(8, [{ press: "ArrowRight" }]), { press: "Home" }, { focus: "#l-b" }, ...repeat(4, [{ press: "ArrowLeft" }])],
  },
  {
    name: "navigation-menu",
    html: navMenu("n", 8),
    steps: [...range(4).map((i) => ({ click: `#n-t${i}` })), { press: "Escape" }, { focus: "#n-t0" }, ...repeat(4, [{ press: "ArrowRight" }])],
  },
  {
    name: "many-instances",
    html: kitchenSink,
    steps: [
      { click: "#ka3-t1" },
      { click: "#kt5-t2" },
      { click: "#ks7-trigger" },
      { press: "ArrowDown" },
      { press: "Escape" },
      { click: "#kd9-trigger" },
      { press: "Escape" },
      { click: "#kp11-trigger" },
      { press: "Escape" },
      { click: "#kr13-r2" },
      { click: "#kx15-g3" },
      { click: "#kw17" },
      { click: "#ko19-trigger" },
      { click: "#kg21-trigger" },
      { press: "Escape" },
      { click: ".filler button" },
    ],
  },
];
