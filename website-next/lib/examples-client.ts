import { copyText } from 'blume/components/copy-feedback.ts';

const loaders = {
  accordion: () => import('../../packages/accordion/dist/index.js'),
  'alert-dialog': () => import('../../packages/alert-dialog/dist/index.js'),
  collapsible: () => import('../../packages/collapsible/dist/index.js'),
  combobox: () => import('../../packages/combobox/dist/index.js'),
  command: () => import('../../packages/command/dist/index.js'),
  dialog: () => import('../../packages/dialog/dist/index.js'),
  'dropdown-menu': () => import('../../packages/dropdown-menu/dist/index.js'),
  'hover-card': () => import('../../packages/hover-card/dist/index.js'),
  'navigation-menu': () => import('../../packages/navigation-menu/dist/index.js'),
  popover: () => import('../../packages/popover/dist/index.js'),
  'radio-group': () => import('../../packages/radio-group/dist/index.js'),
  select: () => import('../../packages/select/dist/index.js'),
  slider: () => import('../../packages/slider/dist/index.js'),
  switch: () => import('../../packages/switch/dist/index.js'),
  tabs: () => import('../../packages/tabs/dist/index.js'),
  toggle: () => import('../../packages/toggle/dist/index.js'),
  'toggle-group': () => import('../../packages/toggle-group/dist/index.js'),
  tooltip: () => import('../../packages/tooltip/dist/index.js'),
};

class ComponentExample extends HTMLElement {
  private controllers: { destroy(): void }[] = [];
  private abort?: AbortController;

  async connectedCallback() {
    if (this.abort) return;
    this.abort = new AbortController();
    const { signal } = this.abort;
    try { this.setStyle(localStorage.getItem('data-slot-docs-style') === 'tailwind' ? 'tailwind' : 'css'); } catch { /* Storage is optional. */ }
    this.addEventListener('click', this.onClick, { signal });
    this.addEventListener('keydown', this.onKeyDown, { signal });
    const component = this.dataset.component as keyof typeof loaders;
    const module = await loaders[component]();
    if (signal.aborted) return;
    // Scope discovery to this example so page chrome never gets initialized.
    this.controllers = module.create(this);
    if (component === 'alert-dialog') {
      this.querySelectorAll<HTMLElement>('[data-slot="alert-dialog"]').forEach(root => {
        root.querySelectorAll('[data-demo-alert-confirm]').forEach(button => {
          button.addEventListener('click', () => root.dispatchEvent(new CustomEvent('alert-dialog:set', { detail: { open: false } })), { signal });
        });
      });
    }
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
      try { localStorage.setItem('data-slot-docs-style', button.dataset.style); } catch { /* Storage is optional. */ }
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

if (!customElements.get('data-slot-example')) customElements.define('data-slot-example', ComponentExample);
