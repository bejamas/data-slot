import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const uiDir = import.meta.dirname;
const packagesDir = join(uiDir, "..");
const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(join(uiDir, "package.json"), "utf8"));
const components = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "core" && entry.name !== "ui")
  .map((entry) => entry.name)
  .sort();

function factoryName(component) {
  return `create${component.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`;
}

const entries = ["core", ...components];
const specifiers = ["@data-slot/ui", ...entries.flatMap((entry) => [
  `@data-slot/ui/${entry}`,
  `@data-slot/${entry}`,
])];

// Resolve the published declarations as a consumer would, without the
// workspace tsconfig paths that point back to source files.
const consumerFile = join(uiDir, "__published-contract__.mts");
const consumerSource = specifiers.map((specifier, index) =>
  `import * as package${index} from ${JSON.stringify(specifier)};`).join("\n");
const compilerOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ESNext,
  noEmit: true,
  strict: true,
  skipLibCheck: true,
  types: [],
};
const host = ts.createCompilerHost(compilerOptions);
const originalGetSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
  fileName === consumerFile
    ? ts.createSourceFile(fileName, consumerSource, languageVersion, true)
    : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
const program = ts.createProgram([consumerFile], compilerOptions, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => uiDir,
  getNewLine: () => "\n",
}));

const checker = program.getTypeChecker();
const source = program.getSourceFile(consumerFile);
assert(source, "TypeScript did not load the consumer fixture");
const typeExports = new Map(source.statements.map((statement, index) => {
  const symbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
  assert(symbol, `Cannot resolve declarations for ${specifiers[index]}`);
  return [specifiers[index], new Set(checker.getExportsOfModule(symbol).map((item) => item.name))];
}));

function assertSameExports(actual, expected, label) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${label} has a different runtime API`);
  for (const key of Object.keys(expected)) {
    assert.equal(actual[key], expected[key], `${label}.${key} is not the direct package export`);
  }
}

const rootEsm = await import("@data-slot/ui");
const rootCjs = require("@data-slot/ui");
const rootTypes = typeExports.get("@data-slot/ui");

for (const entry of entries) {
  const subpath = `@data-slot/ui/${entry}`;
  const direct = `@data-slot/${entry}`;
  assert(manifest.exports[`./${entry}`], `Missing published subpath ${subpath}`);
  assert(manifest.dependencies[direct], `Missing runtime dependency ${direct}`);

  const [subpathEsm, directEsm] = await Promise.all([import(subpath), import(direct)]);
  assertSameExports(subpathEsm, directEsm, subpath);
  assertSameExports(require(subpath), require(direct), `${subpath} (CommonJS)`);
  assert.deepEqual(
    [...typeExports.get(subpath)].sort(),
    [...typeExports.get(direct)].sort(),
    `${subpath} has a different declaration API`,
  );

  if (entry === "core") {
    for (const [name, value] of Object.entries(directEsm)) {
      assert.equal(rootEsm[name], value, `Missing ESM root core export ${name}`);
    }
    for (const [name, value] of Object.entries(require(direct))) {
      assert.equal(rootCjs[name], value, `Missing CommonJS root core export ${name}`);
    }
    for (const name of typeExports.get(direct)) {
      assert(rootTypes.has(name), `Missing root core declaration ${name}`);
    }
    continue;
  }

  const factory = factoryName(entry);
  assert.equal(typeof directEsm[factory], "function", `Missing direct factory ${direct}.${factory}`);
  assert.equal(rootEsm[factory], directEsm[factory], `Missing ESM root export ${factory}`);
  assert.equal(rootCjs[factory], require(direct)[factory], `Missing CommonJS root export ${factory}`);
  for (const name of [factory, `${factory.slice(6)}Options`, `${factory.slice(6)}Controller`]) {
    assert(rootTypes.has(name), `Missing root declaration ${name}`);
  }
}

console.log(`Verified published ESM, CommonJS, and declarations for ${components.length} UI components`);
