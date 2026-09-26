import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoDir = join(import.meta.dir, "../..");
const websiteDir = join(repoDir, "website");
const astroBin = join(websiteDir, "node_modules/astro/bin/astro.mjs");
assert(existsSync(astroBin), "Astro is missing. Run `bun run install:docs` before this check.");

const components = readdirSync(join(repoDir, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "core" && entry.name !== "ui")
  .map((entry) => entry.name)
  .sort();
const combinations = [
  ["dialog", "alert-dialog", "drawer"],
  ["popover", "tooltip", "hover-card", "dropdown-menu"],
  ["select", "combobox", "command"],
  ["slider", "resizable", "carousel"],
];

function factoryName(component: string): string {
  return `create${component.split("-").map((part) => part[0]!.toUpperCase() + part.slice(1)).join("")}`;
}

function javascriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(path);
    return entry.name.endsWith(".js") ? [readFileSync(path, "utf8")] : [];
  }).sort();
}

const fixture = mkdtempSync(join(websiteDir, ".tmp-ui-astro-tree-shaking-"));
const page = join(fixture, "src/pages/index.astro");
mkdirSync(join(fixture, "src/pages"), { recursive: true });
writeFileSync(join(fixture, "package.json"), '{"name":"ui-tree-shaking-check","private":true,"type":"module"}\n');

function build(usedComponents: readonly string[], fromUi: boolean): string[] {
  const factories = usedComponents.map(factoryName);
  const imports = fromUi
    ? `import { ${factories.join(", ")} } from '@data-slot/ui';`
    : usedComponents.map((component, index) =>
      `import { ${factories[index]} } from '@data-slot/${component}';`).join("\n");
  writeFileSync(page, `<div>Tree-shaking check</div>\n<script>\n${imports}\nwindow.dataSlotFactories = [${factories.join(", ")}];\n</script>\n`);

  const result = spawnSync("node", [astroBin, "build", "--root", fixture], {
    cwd: websiteDir,
    encoding: "utf8",
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `Astro build failed for ${usedComponents.join(", ")}:\n${result.stdout}\n${result.stderr}`);
  const files = javascriptFiles(join(fixture, "dist"));
  const html = readFileSync(join(fixture, "dist/index.html"), "utf8");
  files.push(...[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]!)
    .filter((script) => script.trim().length > 0));
  files.sort();
  assert(files.length > 0, "Astro emitted no browser JavaScript");
  return files;
}

try {
  for (const component of components) {
    const root = build([component], true);
    const direct = build([component], false);
    assert(root.length === direct.length && root.every((code, index) => code === direct[index]),
      `Astro emitted different JavaScript for ${component}`);
    console.log(`${component}: identical Astro bundle (${Buffer.byteLength(root.join(""))} bytes)`);
  }

  for (const combination of combinations) {
    const root = build(combination, true);
    const direct = build(combination, false);
    assert.equal(root.length, direct.length, `Astro emitted a different number of chunks for ${combination.join(", ")}`);
    const rootBytes = Buffer.byteLength(root.join(""));
    const directBytes = Buffer.byteLength(direct.join(""));
    // Multiple imports can change local names and module order during minification.
    assert(Math.abs(rootBytes - directBytes) <= 64,
      `Astro bundle size differs for ${combination.join(", ")}: root ${rootBytes}, direct ${directBytes} bytes`);
    console.log(`${combination.join(" + ")}: Astro bundles ${rootBytes} vs ${directBytes} bytes`);
  }

  console.log(`Verified ${components.length} single components and ${combinations.length} combinations in Astro`);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
