import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { rehypeHeadingIds } from "@astrojs/markdown-remark";
import tailwindcss from "@tailwindcss/vite";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import theme from "toolbeam-docs-theme";

export default defineConfig({
  site: "https://data-slot.com",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    starlight({
      title: "data-slot",
      description:
        "Headless UI components for vanilla JavaScript. Tiny, accessible, unstyled.",
      tagline: "Headless UI components for vanilla JavaScript.",
      favicon: "/favicon.svg",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/bejamas/data-slot",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/bejamas/data-slot/edit/main/website/src/content/docs/",
      },
      lastUpdated: true,
      pagefind: true,
      customCss: ["/src/styles/demo.css"],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            "getting-started/installation",
            "getting-started/quick-start",
            "getting-started/styling",
            "getting-started/api-patterns",
          ],
        },
        {
          label: "Packages",
          items: ["packages/ui", "packages/core"],
        },
        {
          label: "Components",
          items: [
            { label: "Overview", slug: "components" },
            "components/accordion",
            "components/carousel",
            "components/collapsible",
            "components/combobox",
            "components/dialog",
            "components/dropdown-menu",
            "components/hover-card",
            "components/navigation-menu",
            "components/popover",
            "components/select",
            "components/slider",
            "components/tabs",
            "components/toast",
            "components/toggle",
            "components/toggle-group",
            "components/tooltip",
          ],
        },
      ],
      markdown: {
        headingLinks: false,
        processedDirs: ["../packages"],
      },
      components: {
        Head: "./src/components/starlight/Head.astro",
        Footer: "./src/components/starlight/Footer.astro",
        MobileTableOfContents: "./src/components/starlight/MobileTableOfContents.astro",
        PageFrame: "./src/components/starlight/PageFrame.astro",
        SiteTitle: "./src/components/starlight/SiteTitle.astro",
        TableOfContents: "./src/components/starlight/TableOfContents.astro",
      },
      plugins: [
        theme({
          headerLinks: [
            { name: "Getting Started", url: "/getting-started/installation/" },
            { name: "Components", url: "/components/" },
            { name: "npm", url: "https://npmjs.com/org/data-slot" },
          ],
        }),
      ],
    }),
  ],
  markdown: {
    rehypePlugins: [
      rehypeHeadingIds,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
    ],
    shikiConfig: {
      theme: "vitesse-light",
      wrap: true,
    },
  },
});
