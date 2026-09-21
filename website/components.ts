import { defineComponents } from 'blume';

export default defineComponents({
  mdx: {
    Example: './components/Example.astro',
    PackageInfo: './components/PackageInfo.astro',
  },
  layout: {
    Layout: './components/Layout.astro',
    Logo: './components/Logo.astro',
    PageFooter: './components/PageFooter.astro',
  },
});
