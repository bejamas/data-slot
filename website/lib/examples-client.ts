import { copyText } from 'blume/components/copy-feedback.ts';
import { bindToastExample } from '../src/components/examples/toast-example';
import { bindCarouselExample } from '../src/components/examples/carousel-example';

const loaders = {
  accordion: () => import('../../packages/accordion/dist/index.js'),
  'alert-dialog': () => import('../../packages/alert-dialog/dist/index.js'),
  carousel: () => import('../../packages/carousel/dist/index.js'),
  collapsible: () => import('../../packages/collapsible/dist/index.js'),
  combobox: () => import('../../packages/combobox/dist/index.js'),
  command: () => import('../../packages/command/dist/index.js'),
  dialog: () => import('../../packages/dialog/dist/index.js'),
  drawer: () => import('../../packages/drawer/dist/index.js'),
  'dropdown-menu': () => import('../../packages/dropdown-menu/dist/index.js'),
  'hover-card': () => import('../../packages/hover-card/dist/index.js'),
  'navigation-menu': () => import('../../packages/navigation-menu/dist/index.js'),
  popover: () => import('../../packages/popover/dist/index.js'),
  'radio-group': () => import('../../packages/radio-group/dist/index.js'),
  resizable: () => import('../../packages/resizable/dist/index.js'),
  select: () => import('../../packages/select/dist/index.js'),
  slider: () => import('../../packages/slider/dist/index.js'),
  switch: () => import('../../packages/switch/dist/index.js'),
  tabs: () => import('../../packages/tabs/dist/index.js'),
  toast: () => import('../../packages/toast/dist/index.js'),
  toggle: () => import('../../packages/toggle/dist/index.js'),
  'toggle-group': () => import('../../packages/toggle-group/dist/index.js'),
  tooltip: () => import('../../packages/tooltip/dist/index.js'),
};
type Slug = keyof typeof loaders;
type Controller = ReturnType<Awaited<ReturnType<(typeof loaders)[Slug]>>['create']>[number];

/** Demo-only wiring that a component's own create() cannot know about. */
interface Demo {
  /** Other packages whose roots appear in this example's markup. */
  companions?: Slug[];
  /** Runs once per root of the component, paired with the controller create() returned for it. */
  bind?(root: HTMLElement, controller: Controller, signal: AbortSignal): void;
}
const demos: Partial<Record<Slug, Demo>> = {
  command: { companions: ['dialog'] },
  'alert-dialog': {
    bind(root, _controller, signal) {
      root.querySelectorAll('[data-demo-alert-confirm]').forEach(button => {
        button.addEventListener('click', () => root.dispatchEvent(new CustomEvent('alert-dialog:set', { detail: { open: false } })), { signal });
      });
    },
  },
  carousel: {
    bind(root, _controller, signal) {
      bindCarouselExample(root, signal);
    },
  },
  toast: { bind: bindToastExample },
};

class ComponentExample extends HTMLElement {
  private controllers: Controller[] = [];
  private abort?: AbortController;

  async connectedCallback() {
    if (this.abort) return;
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.setStyle('css');
    this.addEventListener('click', this.onClick, { signal });
    this.addEventListener('keydown', this.onKeyDown, { signal });
    const component = this.dataset.component as Slug;
    const demo = demos[component];
    const modules = await Promise.all([component, ...(demo?.companions ?? [])].map(slug => loaders[slug]()));
    if (signal.aborted) return;
    // Popup content can move to document.body; keep its preview theme there.
    this.querySelectorAll<HTMLElement>('.ds-preview-stage [data-slot]').forEach(element => {
      if (/-(portal|positioner|popup|content)$/.test(element.dataset.slot ?? '')) {
        element.dataset.dsPreview = element.closest('.preview-tailwind') ? 'tailwind' : 'css';
      }
    });
    // Scope discovery to this example so page chrome never gets initialized.
    // The component's own controllers come first, one per root in DOM order.
    this.controllers = modules.flatMap(module => module.create(this));
    const bind = demo?.bind;
    if (!bind) return;
    this.querySelectorAll<HTMLElement>(`[data-slot="${component}"]`).forEach((root, index) => {
      const controller = this.controllers[index];
      if (controller) bind(root, controller, signal);
    });
  }

  disconnectedCallback() {
    this.abort?.abort();
    this.abort = undefined;
    this.controllers.forEach(controller => controller.destroy());
    this.controllers = [];
  }

  private setStyle(style: string) {
    this.dataset.styling = style;
    this.querySelectorAll<HTMLElement>('[data-style]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.style === style)));
  }

  private setFile(file: string) {
    this.querySelectorAll<HTMLElement>('[data-file]').forEach(button => {
      const selected = button.dataset.file === file;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    this.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== file; });
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (!target.matches('[data-file]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'html' : event.key === 'End' ? 'js' : target.dataset.file === 'html' ? 'js' : 'html';
    this.setFile(next);
    this.querySelector<HTMLButtonElement>(`[data-file="${next}"]`)?.focus();
  };

  private onClick = async (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.style) {
      this.setStyle(button.dataset.style);
      window.dispatchEvent(new Event('resize'));
    }
    if (button.dataset.file) this.setFile(button.dataset.file);
    if (button.matches('.ds-copy')) {
      const panel = this.querySelector<HTMLElement>('[data-panel]:not([hidden])');
      const selector = panel?.dataset.panel === 'js' ? 'pre code' : `.code-${this.dataset.styling} pre code`;
      const code = panel?.querySelector<HTMLElement>(selector)?.textContent;
      const status = this.querySelector<HTMLElement>('.ds-copy-status');
      if (!code || !status) return;
      status.textContent = await copyText(code) ? 'Copied' : 'Select the code to copy';
      setTimeout(() => { status.textContent = ''; }, 2500);
    }
  };
}

if (!customElements.get('data-slot-example')) {
  // :focus-visible also matches mouse-focused text inputs. Track navigation
  // separately so demo rings reflect keyboard use, including portaled popups.
  const navigationKeys = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Escape']);
  document.addEventListener('pointerdown', () => {
    document.documentElement.dataset.dsInput = 'pointer';
  }, { capture: true });
  document.addEventListener('keydown', event => {
    if (!event.altKey && !event.ctrlKey && !event.metaKey && navigationKeys.has(event.key)) {
      document.documentElement.dataset.dsInput = 'keyboard';
    }
  }, { capture: true });
  customElements.define('data-slot-example', ComponentExample);
}
