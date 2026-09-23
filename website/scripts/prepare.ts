import { mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { components } from '../lib/catalog';
import { themeExamples } from './theme-examples';

const project = resolve(import.meta.dirname, '..');
const repo = resolve(project, '..');
const write = async (path: string, content: string) => writeFile(resolve(project, path), content);
await Promise.all(['.generated/examples', 'content/_generated', 'public/fonts'].map(path => mkdir(resolve(project, path), { recursive: true })));
for (const weight of [400, 500, 700]) {
  await copyFile(resolve(project, `node_modules/@fontsource/geist-mono/files/geist-mono-latin-${weight}-normal.woff2`), resolve(project, `public/fonts/geist-mono-${weight}.woff2`));
}

// Examples import shared styles and setup scripts relative to themselves; mirror those files next to the generated copies.
for (const file of await readdir(resolve(project, 'src/components/examples'))) {
  if (file.endsWith('.astro')) continue;
  const source = await readFile(resolve(project, `src/components/examples/${file}`), 'utf8');
  await write(`.generated/examples/${file}`, file.endsWith('.css') ? themeExamples(source) : source);
}

for (const component of components) {
  for (const variant of ['basic', 'extra'] as const) {
    const filename = variant === 'extra' && 'second' in component ? component.second : component.demo;
    let source = await readFile(resolve(project, `src/components/examples/${filename}.astro`), 'utf8');
    source = source.replace('"../ExampleBlock.astro"', '"../../components/ExampleBlock.astro"');
    source = source.replaceAll('theme="vitesse-light"', 'themes={{ light: "github-light-high-contrast", dark: "github-dark-high-contrast" }} defaultColor={false}');
    // Initialization has its own tab; embedded snippets must not double-bind it.
    source = source.replace(/<script type="module">[\s\S]*?<\/script>/g, '');
    if (filename === 'Slider') {
      const styles = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
      if (!styles) throw new Error('Missing slider example stylesheet');
      source = source.replaceAll('  /* Same styles as basic slider */', styles);
    }
    if (filename === 'Command') {
      // These examples share a stylesheet; include it in both copyable snippets.
      const styles = source.match(/<style>[\s\S]*?<\/style>/)?.[0];
      if (!styles) throw new Error('Missing command example stylesheet');
      source = source.replace(/(const (?:inline|dialog)CssCode = `)([\s\S]*?)(`;)/g,
        (_, start, markup, end) => start + markup + '\n\n' + styles + end);
    }
    // Use the same attribute in both the live markup and displayed source.
    if (variant === 'extra' && 'attrs' in component) {
      source = source.replace(new RegExp(`<[^>]+data-slot="${component.slug}${component.attrs.startsWith('data-side') ? '-content' : ''}"[^>]*>`, 'g'), tag => {
        const name = component.attrs.split('=')[0]!;
        return tag.replace(new RegExp(`\\s${name}(?:="[^"]*")?(?=\\s|>)`, 'g'), '')
          .replace(/data-slot="[^"]+"/, slot => `${slot} ${component.attrs}`);
      });
    }
    if (filename === 'AccordionMultiple') {
      source = source.replaceAll('data-slot="accordion"', 'data-slot="accordion" data-multiple');
    }
    if (filename === 'NavigationMenu') {
      // Distinguish the two navigation landmarks rendered on the same docs page.
      const label = variant === 'basic' ? 'Shared viewport navigation' : 'Fixed positioning navigation';
      source = source.replaceAll('aria-label="Main navigation"', `aria-label="${label}"`);
    }
    // Several original demos use fixed IDs. Each example gets its own namespace.
    source = source.replace(/\b(id|for|aria-labelledby|aria-describedby|aria-controls)="([^"]+)"/g,
      (_, attr, value) => `${attr}="${value.split(' ').map((id: string) => `${component.slug}-${variant}-${id}`).join(' ')}"`);
    source = source.replace(/<ExampleBlock(?=[\s>])/g, `<ExampleBlock component="${component.slug}"`);
    source = source.replace(/<ExampleBlock component="command">(?=\s*<div slot="preview-css" data-slot="dialog")/g, '<ExampleBlock component="command" dialog>');
    if (filename === 'AccordionMultiple') {
      const single = await readFile(resolve(project, 'src/components/examples/AccordionSingle.astro'), 'utf8');
      const styles = single.match(/<style>[\s\S]*?<\/style>/)?.[0];
      if (!styles) throw new Error('Missing accordion example stylesheet');
      source = source.replace(/const cssCode = `([\s\S]*?)`;/, (_, markup) => `const cssCode = ${JSON.stringify(markup.trim() + '\n\n' + styles)};`);
    }
    await write(`.generated/examples/${component.slug}-${variant}.astro`, themeExamples(source));
  }

  const readme = await readFile(resolve(repo, `packages/${component.slug}/README.md`), 'utf8');
  // Retain all reference/behavior sections, but avoid repeating introductory demos.
  const sections = readme.split(/^## /m).slice(1);
  const reference = sections.filter(section => !/^(Installation|Quick Start|Usage|License)\s*\n/i.test(section));
  const demote = (text: string) => {
    let fenced = false;
    return text.split('\n').map(line => {
      if (/^```/.test(line)) fenced = !fenced;
      return !fenced ? line.replace(/^(#{1,5}) /, '#$1 ') : line;
    }).join('\n');
  };
  await write(`content/_generated/${component.slug}-api.md`, reference.map(section => {
    return section.startsWith('API\n') ? section.slice(4).trim() : demote(`## ${section}`).trim();
  }).join('\n\n') + '\n');
}
console.log(`Prepared ${components.length} component references and ${components.length * 2} examples.`);

const previewStyles = await readFile(resolve(project, 'src/styles/demo.css'), 'utf8');
await write('.generated/previews.css', themeExamples(previewStyles).replace(/@import[^;]+;\s*/g, '').replace(/@theme\s*\{[^}]+\}/g, '').replace(/:root\s*\{[^}]+\}/g, ''));
