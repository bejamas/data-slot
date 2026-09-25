import { expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { rolldown } from "rolldown";

const packagesDir = join(import.meta.dir, "..");
const uiDir = import.meta.dir;
const manifest = JSON.parse(readFileSync(join(uiDir, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  exports: Record<string, { types: string; import: string; require: string; default: string }>;
  sideEffects: boolean;
};
const buildConfig = readFileSync(join(uiDir, "tsdown.config.ts"), "utf8");
const rootSource = readFileSync(join(uiDir, "src/index.ts"), "utf8");
const components = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "core" && entry.name !== "ui")
  .map((entry) => entry.name)
  .sort();

function factoryName(component: string): string {
  return `create${component.split("-").map((part) => part[0]!.toUpperCase() + part.slice(1)).join("")}`;
}

test("root exports every component factory and every component has a complete subpath", () => {
  expect(manifest.sideEffects).toBe(false);

  for (const component of components) {
    const packageName = `@data-slot/${component}`;
    const name = factoryName(component);
    const componentSource = readFileSync(join(packagesDir, component, "src/index.ts"), "utf8");
    const componentManifest = JSON.parse(readFileSync(join(packagesDir, component, "package.json"), "utf8"));

    expect(componentSource).toContain(`export function ${name}(`);
    expect(rootSource).toContain(`export { ${name} } from "${packageName}"`);
    expect(manifest.dependencies[packageName]).toBeDefined();
    expect(componentManifest.sideEffects).toBe(false);
    expect(readFileSync(join(uiDir, `src/${component}.ts`), "utf8")).toContain(`export * from "${packageName}"`);
    expect(buildConfig).toContain(`"src/${component}.ts"`);

    const subpath = manifest.exports[`./${component}`];
    expect(subpath).toEqual({
      types: `./dist/${component}.d.ts`,
      import: `./dist/${component}.js`,
      require: `./dist/${component}.cjs`,
      default: `./dist/${component}.js`,
    });
  }

  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "@data-slot/core",
    ...components.map((component) => `@data-slot/${component}`),
  ].sort());
  expect(Object.keys(manifest.exports).sort()).toEqual([
    ".",
    "./core",
    ...components.map((component) => `./${component}`),
  ].sort());
  expect(existsSync(join(uiDir, "src/core.ts"))).toBe(true);
  expect(buildConfig).toContain('"src/core.ts"');
});

type ComponentImport = { specifier: string; factory: string };

async function productionBundle(imports: ComponentImport[]) {
  const entryId = "\0ui-integration-entry";
  const entrySource = [
    ...imports.map(({ specifier, factory }, index) =>
      `import { ${factory} as component${index} } from "${specifier}";`),
    `globalThis.components = [${imports.map((_, index) => `component${index}`).join(", ")}];`,
  ].join("\n");
  const bundle = await rolldown({
    input: entryId,
    // Every package in this workspace declares sideEffects: false. Apply that
    // package-level setting to its source modules in this in-memory build.
    treeshake: { moduleSideEffects: false },
    plugins: [{
      name: "ui-integration-resolve",
      resolveId(source) {
        if (source === entryId) return entryId;
        const match = /^@data-slot\/([^/]+)(?:\/(.+))?$/.exec(source);
        if (match) return join(packagesDir, match[1]!, "src", `${match[2] ?? "index"}.ts`);
      },
      load(id) {
        if (id === entryId) return entrySource;
      },
    }],
  });

  try {
    const generated = await bundle.generate({ format: "es" });
    const chunk = generated.output.find((output) => output.type === "chunk");
    if (!chunk || chunk.type !== "chunk") throw new Error("No JavaScript output from Rolldown");
    const renderedPackages = new Set<string>();
    const renderedModuleLengths: Record<string, number> = {};
    for (const [id, module] of Object.entries(chunk.modules)) {
      if (module.renderedLength === 0) continue;
      const relative = id.split(`${packagesDir}${sep}`)[1];
      if (relative) {
        renderedPackages.add(relative.split(sep)[0]!);
        renderedModuleLengths[relative] = module.renderedLength;
      }
    }
    return { code: chunk.code, renderedPackages: [...renderedPackages].sort(), renderedModuleLengths };
  } finally {
    await bundle.close();
  }
}

test.each(components)("a root import of %s bundles only that component and core", async (component) => {
  const factory = factoryName(component);
  const root = await productionBundle([{ specifier: "@data-slot/ui", factory }]);
  const subpath = await productionBundle([{ specifier: `@data-slot/ui/${component}`, factory }]);
  const direct = await productionBundle([{ specifier: `@data-slot/${component}`, factory }]);

  expect(root.renderedPackages).toEqual([component, "core"].sort());
  expect(root.code).toBe(direct.code);
  expect(subpath.code).toBe(direct.code);
});

const combinations = [
  { name: "modal components", components: ["dialog", "alert-dialog", "drawer"] },
  { name: "popup components", components: ["popover", "tooltip", "hover-card", "dropdown-menu"] },
  { name: "form components", components: ["select", "combobox", "command"] },
  { name: "interaction components", components: ["slider", "resizable", "carousel"] },
] as const;

for (const { name, components: combination } of combinations) {
  test(`root imports of ${name} match direct imports`, async () => {
    const root = await productionBundle(combination.map((component) => ({
      specifier: "@data-slot/ui",
      factory: factoryName(component),
    })));
    const direct = await productionBundle(combination.map((component) => ({
      specifier: `@data-slot/${component}`,
      factory: factoryName(component),
    })));

    expect(root.renderedPackages).toEqual(["core", ...combination].sort());
    expect(Object.keys(root.renderedModuleLengths).sort()).toEqual(Object.keys(direct.renderedModuleLengths).sort());
    // Shared helpers can receive different local names when import order changes.
    expect(Math.abs(root.code.length - direct.code.length)).toBeLessThanOrEqual(64);
  });
}
