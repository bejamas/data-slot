import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const uiDir = import.meta.dir;
const packagesDir = join(uiDir, "..");
const manifest = JSON.parse(readFileSync(join(uiDir, "package.json"), "utf8")) as {
  exports: Record<string, { types: string; import: string; require: string }>;
};

function namedExports(file: string): Set<string> {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, false);
  const names = new Set<string>();

  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    for (const specifier of statement.exportClause.elements) names.add(specifier.name.text);
  }

  return names;
}

const rootJsExports = namedExports(join(uiDir, "dist/index.js"));
const rootTypeExports = namedExports(join(uiDir, "dist/index.d.ts"));
const components = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "core" && entry.name !== "ui")
  .map((entry) => entry.name);

for (const component of components) {
  const factory = `create${component.split("-").map((part) => part[0]!.toUpperCase() + part.slice(1)).join("")}`;
  assert(rootJsExports.has(factory), `Missing JavaScript root export: ${factory}`);
  assert(rootTypeExports.has(factory), `Missing declaration root export: ${factory}`);

  const subpath = manifest.exports[`./${component}`];
  assert(subpath, `Missing package subpath: ${component}`);
  for (const target of [subpath.import, subpath.require, subpath.types]) {
    assert(existsSync(join(uiDir, target)), `Missing built file: ${target}`);
  }
}

console.log(`Verified built @data-slot/ui exports for ${components.length} components`);
