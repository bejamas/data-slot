import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
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
  disclosure: "Simple show/hide toggle",
  core: "Shared utilities",
  "navigation-menu": "Dropdown navigation menus",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getPackageSizes(): PackageInfo[] {
  const distPath = join(process.cwd(), "..", "dist");
  const packages: PackageInfo[] = [];

  if (!existsSync(distPath)) {
    console.error("dist/ folder not found. Run build first.");
    process.exit(1);
  }

  const files = readdirSync(distPath);

  for (const file of files) {
    // Skip non-js files and index.js (the combined bundle)
    if (!file.endsWith(".js") || file === "index.js") continue;

    const name = basename(file, ".js");
    const filePath = join(distPath, file);
    const gzPath = join(distPath, `${file}.gz`);

    let size: number;

    // Use pre-compressed .gz file if available, otherwise compress on the fly
    if (existsSync(gzPath)) {
      size = statSync(gzPath).size;
    } else {
      const content = readFileSync(filePath);
      const compressed = gzipSync(content);
      size = compressed.length;
    }

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

  // Ensure data directory exists
  const dataDir = join(process.cwd(), "src", "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Write JSON file
  const outputPath = join(dataDir, "package-sizes.json");
  writeFileSync(outputPath, JSON.stringify(packages, null, 2));

  console.log("Package sizes:");
  console.log("─".repeat(60));

  let maxNameLen = 0;
  let maxSizeLen = 0;
  for (const pkg of packages) {
    maxNameLen = Math.max(maxNameLen, pkg.name.length);
    maxSizeLen = Math.max(maxSizeLen, pkg.sizeFormatted.length);
  }

  for (const pkg of packages) {
    console.log(
      `${pkg.name.padEnd(maxNameLen)}  ${pkg.sizeFormatted.padStart(maxSizeLen)}  ${pkg.description}`
    );
  }

  console.log("─".repeat(60));
  console.log(`\nWritten to: ${outputPath}`);
}

main();

