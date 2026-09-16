# data-slot documentation preview

The new documentation site uses Blume 1.6.4. The root `build:website` command and Cloudflare asset configuration target this site. The original Astro site remains in `../website` and can be built with `bun run build:website:legacy` from the repository root.

## Run locally

From the repository root, with Bun and Node.js 22.22.2+ (or Node.js 24.15+):

```sh
bun install
bun run install:docs
bun run dev:docs
```

Open http://localhost:4322. Build with `bun run build:docs`, preview that build with `bun run preview:docs`, and check it with `bun run check:docs`.

This directory has an independent npm lockfile and dependency installation. Blume uses Astro 7 and Zod 4; the current website uses Astro 5. Keeping the installations separate avoids hoisting incompatible framework dependencies into either site. The direct `js-yaml` dependency keeps Blume’s emitted imports on YAML 5 rather than a transitive YAML 4 copy. In CI, use `npm ci --prefix website-next --workspaces=false` to install the new site's locked dependencies.

## Content and examples

- `content/index.mdx`: quick start.
- `content/handbook/`: shared guides.
- `content/components/`: one MDX page per component, ordered as Anatomy, Examples, API reference.
- `lib/catalog.ts`: sidebar ordering and example variants.
- `components/ExampleBlock.astro`: accessible styling controls, live previews, source tabs, and copying.
- `lib/examples-client.ts`: scoped component initialization and teardown.
- `theme.css`: the warm, monochrome theme and responsive documentation layout.

`prepare` runs before development, builds, and type checks. It adapts existing Astro examples into ignored `.generated/` files and imports reference sections from package READMEs into ignored `content/_generated/` includes. Generated references participate in Blume's search, table of contents, and Markdown exports. Edit the package README to change an API reference. Edit `lib/catalog.ts` to change a variant. Restart the dev command after changing those sources to regenerate them.

### API reference structure

Keep each component's reference inside the package README's `## API` section. Use these H3 headings in this order, including only sections with documented content:

1. Initialization
2. Slots
3. Options
4. Data Attributes
5. Controller
6. Events
7. Styling
8. Keyboard Navigation
9. Accessibility
10. Form Integration
11. Behavior
12. Migration Notes

Use H4 for details within a section, and H5 for their children. For example, put `create(scope?)` and the component constructor under Initialization, Controller Destruction under Controller, and Outbound Events / Inbound Events under Events. Keep component-specific topics under the relevant shared heading, such as CSS Variables under Styling or Warm-up Behavior under Behavior. The website includes this hierarchy under `## API reference`; its table of contents shows the shared H3 sections.

The original example components and website styles are read without changing them. Generated examples get unique ID prefixes, CSS/Tailwind controls, and per-example initialization. Package builds run before the root `dev:docs` and `build:docs` commands so the previews use the current local library.

Tailwind previews use Tailwind v4 and `tw-animate-css`. Demos retain their light theme when the documentation chrome is switched to dark mode.

## Deployment

The existing Cloudflare Workers Builds integration runs `bun run build:website`, which installs this directory's locked dependencies and builds the local packages and Blume site. Wrangler serves `website-next/dist`. The repository's `.node-version` pins a compatible Node.js runtime.

Non-production branches use `wrangler versions upload`, so this PR's preview shows Blume for team review. The live site stays on its current version until the PR is merged into `main`, whose build deploys Blume to production. The original website source is retained.
