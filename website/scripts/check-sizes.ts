import {
  readdirSync,
  statSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { gzipSync } from "zlib";
import { readFileSync } from "fs";

interface PackageInfo {
  name: string;
  size: number;
  sizeFormatted: string;
  description: string;
}

// Package descriptions
const descriptions: Record<string, string> = {
  dialog: "Modal dialogs, focus trap",
  tabs: "Tabbed interfaces, kbd nav",
  accordion: "Collapsible sections",
  popover: "Anchored floating content",
  tooltip: "Hover/focus tooltips",
  collapsible: "Simple show/hide toggle",
  core: "Shared utilities",
  "navigation-menu": "Dropdown navigation menus",
  "dropdown-menu": "Action menus, kbd nav",
  select: "Dropdown select, form-ready",
  slider: "Single/range value sliders",
};

// Packages to check (order doesn't matter, we sort by size)
const packageNames = [
  "core",
  "accordion",
  "dialog",
  "collapsible",
  "dropdown-menu",
  "navigation-menu",
  "popover",
  "select",
  "slider",
  "tabs",
  "tooltip",
];

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getPackageSizes(): PackageInfo[] {
  const packagesPath = join(process.cwd(), "..", "packages");
  const packages: PackageInfo[] = [];

  if (!existsSync(packagesPath)) {
    console.error("packages/ folder not found.");
    process.exit(1);
  }

  for (const name of packageNames) {
    const distPath = join(packagesPath, name, "dist");
    const filePath = join(distPath, "index.js");

    if (!existsSync(filePath)) {
      console.warn(
        `Warning: ${name}/dist/index.js not found. Run build first.`
      );
      continue;
    }

    // Read and compress to get gzipped size
    const content = readFileSync(filePath);
    const compressed = gzipSync(content);
    const size = compressed.length;

    packages.push({
      name: `@data-slot/${name}`,
      size,
      sizeFormatted: formatSize(size),
      description: descriptions[name] || "Component",
    });
  }

  // Sort by size descending
  packages.sort((a, b) => b.size - a.size);

  return packages;
}

function main() {
  const packages = getPackageSizes();

  if (packages.length === 0) {
    console.error("No packages found. Run 'bun run build' first.");
    process.exit(1);
  }

  // Ensure data directory exists
  const dataDir = join(process.cwd(), "src", "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Write JSON file
  const outputPath = join(dataDir, "package-sizes.json");
  writeFileSync(outputPath, JSON.stringify(packages, null, 2));

  console.log("Package sizes (gzipped ESM):");
  console.log("─".repeat(60));

  let maxNameLen = 0;
  let maxSizeLen = 0;
  for (const pkg of packages) {
    maxNameLen = Math.max(maxNameLen, pkg.name.length);
    maxSizeLen = Math.max(maxSizeLen, pkg.sizeFormatted.length);
  }

  for (const pkg of packages) {
    console.log(
      `${pkg.name.padEnd(maxNameLen)}  ${pkg.sizeFormatted.padStart(
        maxSizeLen
      )}  ${pkg.description}`
    );
  }

  console.log("─".repeat(60));
  console.log(`\nWritten to: ${outputPath}`);
}

main();
