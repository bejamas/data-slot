# data-slot documentation preview

The new documentation site uses Blume 1.6.4. The existing Astro site remains in `../website`, and the production build and Cloudflare deployment commands still target it.

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

The original example components and website styles are read without changing them. Generated examples get unique ID prefixes, CSS/Tailwind controls, and per-example initialization. Package builds run before the root `dev:docs` and `build:docs` commands so the previews use the current local library.

Tailwind previews use Tailwind v4 and `tw-animate-css`. Demos retain their light theme when the documentation chrome is switched to dark mode.

There is deliberately no production deployment command for this preview. Migration of the public site can be handled separately after review.
