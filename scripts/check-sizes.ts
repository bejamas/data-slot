#!/usr/bin/env bun
/** Measure built ESM entry files. Use `bun run check:sizes` to rebuild first. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const packagesDir = join(import.meta.dir, "..", "packages");

function getPackageSizes() {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(packagesDir, entry.name, "package.json")))
    .map((entry) => {
      const directory = join(packagesDir, entry.name);
      const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      const entryPath = join(directory, "dist", "index.js");
      if (!existsSync(entryPath)) {
        throw new Error(`Missing ${manifest.name}/dist/index.js. Run \`bun run check:sizes\` to build all packages first.`);
      }

      const content = readFileSync(entryPath);
      return {
        name: manifest.name as string,
        bytes: content.length,
        gzipBytes: gzipSync(content).length,
      };
    })
    .sort((a, b) => b.gzipBytes - a.gzipBytes || a.name.localeCompare(b.name));
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} KiB`;
}

function main() {
  const packages = getPackageSizes();
  if (packages.length === 0) throw new Error("No packages found in packages/.");

  const nameWidth = Math.max("Package".length, ...packages.map((pkg) => pkg.name.length));
  const row = (name: string, raw: string, gzip: string) =>
    `${name.padEnd(nameWidth)}  ${raw.padStart(12)}  ${gzip.padStart(12)}`;

  console.log("Package sizes (built ESM entry files: dist/index.js)\n");
  console.log(row("Package", "Minified", "Gzipped"));
  console.log("─".repeat(nameWidth + 28));
  for (const pkg of packages) {
    console.log(row(pkg.name, formatSize(pkg.bytes), formatSize(pkg.gzipBytes)));
  }
  console.log(`\n${packages.length} packages. 1 KiB = 1,024 bytes.`);
  console.log("Imported dependencies, other entry points, and type declarations are excluded.");
  console.log("@data-slot/ui is a re-export entry; its size is not the full library bundle size.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
