import { afterAll, afterEach, beforeAll, expect, it } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Two copies of core happen when components pin different core versions or a
// bundler inlines core into separate chunks. A query suffix on the entry would
// still share every transitive module, so each copy imports its own copy of src.
type Core = typeof import('./index');
type Scroll = typeof import('./scroll');
interface Copy { core: Core; scroll: Scroll }

const dirs: string[] = [];
let a: Copy;
let b: Copy;

const loadCopy = async (): Promise<Copy> => {
  const dir = mkdtempSync(join(tmpdir(), 'data-slot-core-copy-'));
  dirs.push(dir);
  cpSync(import.meta.dir, dir, { recursive: true, filter: (src) => !src.endsWith('.test.ts') });
  return { core: await import(join(dir, 'index.ts')), scroll: await import(join(dir, 'scroll.ts')) };
};

beforeAll(async () => {
  a = await loadCopy();
  b = await loadCopy();
});
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
  a.scroll.resetScrollLock();
  document.documentElement.removeAttribute('style');
  document.body.innerHTML = '';
});

it('loads two distinct module instances', () => {
  expect(a.core.createDismissLayer).not.toBe(b.core.createDismissLayer);
  expect(a.scroll.lockScroll).not.toBe(b.scroll.lockScroll);
});

it('restores the original scroll styles once when locks from two copies interleave', () => {
  const html = document.documentElement;
  html.style.overflow = 'auto';
  html.style.scrollbarGutter = 'auto';

  a.core.lockScroll(); // e.g. a dropdown
  b.core.lockScroll(); // a dialog opened from one of its items
  expect(b.scroll.getScrollLockCount()).toBe(2);

  a.core.unlockScroll();
  expect(html.style.overflow).toBe('hidden');
  expect(html.style.scrollbarGutter).toBe('stable');

  b.core.unlockScroll();
  expect(html.style.overflow).toBe('auto');
  expect(html.style.scrollbarGutter).toBe('auto');
  expect(a.scroll.getScrollLockCount()).toBe(0);
});

it('generates unique ids across copies', () => {
  const first = document.createElement('h2');
  const second = document.createElement('h2');
  const content = document.createElement('div');
  const other = document.createElement('div');
  a.core.linkLabelledBy(content, first);
  b.core.linkLabelledBy(other, second);
  expect(first.id).not.toBe(second.id);
  expect(content.getAttribute('aria-labelledby')).not.toBe(other.getAttribute('aria-labelledby'));
});

it('orders dismiss layers from both copies in one stack and cleans up after the last one', () => {
  document.body.innerHTML = '<section id="menu"></section><section id="dialog"></section>';
  const dismissed: string[] = [];
  let menuOpen = true;
  let dialogOpen = false;
  const removeMenu = a.core.createDismissLayer({
    root: document.getElementById('menu')!, isOpen: () => menuOpen,
    onDismiss: () => { dismissed.push('menu'); menuOpen = false; },
  });
  dialogOpen = true;
  const removeDialog = b.core.createDismissLayer({
    root: document.getElementById('dialog')!, isOpen: () => dialogOpen,
    onDismiss: () => { dismissed.push('dialog'); dialogOpen = false; },
  });
  cleanups.push(removeMenu, removeDialog);

  const escape = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
  escape();
  expect(dismissed).toEqual(['dialog']);
  escape();
  expect(dismissed).toEqual(['dialog', 'menu']);

  // The copy that created the store owns its listeners; removing its layer first
  // must leave the other copy's layer working.
  menuOpen = true;
  removeMenu();
  dialogOpen = true;
  escape();
  expect(dismissed).toEqual(['dialog', 'menu', 'dialog']);

  removeDialog();
  dialogOpen = true;
  escape();
  expect(dismissed).toEqual(['dialog', 'menu', 'dialog']);
  const stores = Reflect.get(globalThis, Symbol.for('data-slot.dismiss-layer-stores.v1')) as WeakMap<Document, unknown>;
  expect(stores.has(document)).toBe(false);
});

it('keeps modal items from both copies in one stack', () => {
  document.body.innerHTML = '<section id="drawer"></section><section id="dialog"></section>';
  const drawerContent = document.getElementById('drawer')!;
  const dialogContent = document.getElementById('dialog')!;
  const tabs: string[] = [];
  const drawer = a.core.createModalStackItem({
    content: drawerContent, cssVarPrefix: 'drawer', onTabKeydown: () => tabs.push('drawer'),
  });
  const dialog = b.core.createModalStackItem({
    content: dialogContent, cssVarPrefix: 'dialog', onTabKeydown: () => tabs.push('dialog'),
  });
  cleanups.push(() => drawer.destroy(), () => dialog.destroy());

  drawer.open();
  dialog.open();
  expect(drawer.isTopmost).toBe(false);
  expect(dialog.isTopmost).toBe(true);
  expect(drawerContent.getAttribute('data-stack-index')).toBe('0');
  expect(dialogContent.getAttribute('data-stack-index')).toBe('1');

  document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
  expect(tabs).toEqual(['dialog']);

  dialog.close();
  expect(drawer.isTopmost).toBe(true);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
  expect(tabs).toEqual(['dialog', 'drawer']);

  drawer.close();
  const stores = Reflect.get(globalThis, Symbol.for('data-slot.modal-stack-stores.v1')) as WeakMap<Document, unknown>;
  expect(stores.has(document)).toBe(false);
});
