import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core.ts",
    "src/tabs.ts",
    "src/dialog.ts",
    "src/accordion.ts",
    "src/popover.ts",
    "src/tooltip.ts",
    "src/disclosure.ts",
    "src/navigation-menu.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  minify: true,
});

