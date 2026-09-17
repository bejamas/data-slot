import { defineComponents } from 'blume';

export default defineComponents({
  mdx: {
    Example: './components/Example.astro',
    PackageInfo: './components/PackageInfo.astro',
  },
  layout: {
    Layout: './components/Layout.astro',
    PageFooter: './components/PageFooter.astro',
  },
});
