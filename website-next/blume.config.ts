import { defineConfig } from 'blume';
import { components } from './lib/catalog';

const mono = { name: 'Geist Mono', variants: [
  { src: './public/fonts/geist-mono-400.woff2', weight: 400 },
  { src: './public/fonts/geist-mono-500.woff2', weight: 500 },
  { src: './public/fonts/geist-mono-700.woff2', weight: 700 },
] };

export default defineConfig({
  title: 'data-slot',
  description: 'Headless UI components for vanilla JavaScript. Tiny, accessible, unstyled.',
  content: { root: 'content' },
  logo: { image: '/logo.svg', text: 'data-slot', href: '/' },
  theme: {
    accent: { light: '#1a1a1a', dark: '#faf9f7' },
    background: { light: '#faf9f7', dark: '#191918' },
    radius: 'none',
    mode: 'light',
    fonts: { display: mono, body: mono, mono },
  },
  navigation: {
    sidebar: [
      { label: 'Overview', items: ['/'] },
      { label: 'Handbook', items: ['/handbook/styling'] },
      { label: 'Components', items: components.map(({ slug }) => `/components/${slug}`) },
    ],
    actions: [{ label: 'Current website ↗', href: 'https://data-slot.com' }],
    repo: 'https://github.com/bejamas/data-slot',
  },
  search: { provider: 'orama' },
  feedback: false,
  lastModified: false,
  toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },
  markdown: { codeBlocks: { theme: { light: 'vitesse-light', dark: 'vitesse-dark' } } },
  seo: { og: { enabled: false } },
});
