import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Discover public workspaces and order them after their internal dependencies. */
export function getPublishPackages(root: string, version: string): string[] {
  const workspaces = readManifest(join(root, "package.json")).workspaces;
  if (!workspaces?.length) throw new Error("No workspaces configured");

  const paths = new Set<string>();
  for (const workspace of workspaces) {
    for (const path of new Bun.Glob(`${workspace}/package.json`).scanSync(root)) {
      paths.add(path);
    }
  }

  const packages = new Map<string, { dir: string; manifest: Manifest }>();
  for (const path of [...paths].sort()) {
    const manifest = readManifest(join(root, path));
    if (manifest.private) continue;
    if (manifest.version !== version) {
      throw new Error(`${manifest.name}: expected version ${version}, got ${manifest.version}`);
    }
    if (packages.has(manifest.name)) throw new Error(`Duplicate package: ${manifest.name}`);
    packages.set(manifest.name, { dir: dirname(path), manifest });
  }
  if (!packages.size) throw new Error("No public packages found");

  const ordered: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) throw new Error(`Circular package dependency: ${name}`);
    const pkg = packages.get(name);
    if (!pkg) throw new Error(`Internal dependency is not a public workspace: ${name}`);

    visiting.add(name);
    const dependencies = {
      ...pkg.manifest.dependencies,
      ...pkg.manifest.optionalDependencies,
      ...pkg.manifest.peerDependencies,
    };
    for (const dependency of Object.keys(dependencies).sort()) {
      if (dependency === name) continue;
      if (packages.has(dependency) || dependency.startsWith("@data-slot/")) {
        visit(dependency);
      }
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(pkg.dir);
  }
  for (const name of packages.keys()) visit(name);
  return ordered;
}

if (import.meta.main) {
  const version = process.argv[2];
  if (!version) throw new Error("Usage: bun run scripts/publish-packages.ts <version>");
  console.log(getPublishPackages(join(import.meta.dir, ".."), version).join("\n"));
}
