#!/usr/bin/env bun
/**
 * Simple version management script
 * 
 * Usage:
 *   bun run scripts/version.ts patch   # 0.1.0 -> 0.1.1
 *   bun run scripts/version.ts minor   # 0.1.0 -> 0.2.0
 *   bun run scripts/version.ts major   # 0.1.0 -> 1.0.0
 *   bun run scripts/version.ts 0.2.0   # Set exact version
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const packagesDir = join(import.meta.dir, "..", "packages");
const websiteSettingsPath = join(import.meta.dir, "..", "website", "src", "components", "SettingsPanel.astro");

function getPackages(): string[] {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function readPackageJson(pkgName: string): { path: string; json: any } {
  const path = join(packagesDir, pkgName, "package.json");
  const content = readFileSync(path, "utf-8");
  return { path, json: JSON.parse(content) };
}

function writePackageJson(path: string, json: any) {
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
}

function bumpVersion(current: string, type: string): string {
  const [major, minor, patch] = current.split(".").map(Number);
  
  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      // Assume it's an exact version
      if (/^\d+\.\d+\.\d+/.test(type)) {
        return type;
      }
      throw new Error(`Invalid version type: ${type}. Use patch, minor, major, or an exact version like 0.2.0`);
  }
}

function updateWebsiteVersion(version: string) {
  try {
    let content = readFileSync(websiteSettingsPath, "utf-8");
    content = content.replace(
      /const version = "[^"]+"/,
      `const version = "${version}"`
    );
    writeFileSync(websiteSettingsPath, content);
    console.log(`  Updated website settings panel`);
  } catch {
    // Website might not exist, that's fine
  }
}

function main() {
  const type = process.argv[2];
  
  if (!type) {
    console.log("Usage: bun run scripts/version.ts <patch|minor|major|x.y.z>");
    process.exit(1);
  }

  const packages = getPackages();
  
  // Get current version from first package
  const firstPkg = readPackageJson(packages[0]);
  const currentVersion = firstPkg.json.version;
  const newVersion = bumpVersion(currentVersion, type);

  console.log(`\nBumping version: ${currentVersion} → ${newVersion}\n`);

  // Update all packages
  for (const pkgName of packages) {
    const { path, json } = readPackageJson(pkgName);
    json.version = newVersion;
    
    // Also update workspace dependencies to use the new version
    if (json.dependencies) {
      for (const [dep, ver] of Object.entries(json.dependencies)) {
        if (dep.startsWith("@data-slot/") && ver === "workspace:*") {
          // Keep workspace:* for local development
          // npm publish will resolve this automatically
        }
      }
    }
    
    writePackageJson(path, json);
    console.log(`  Updated ${json.name} to ${newVersion}`);
  }

  // Update website version display
  updateWebsiteVersion(newVersion);

  console.log(`
Done! Next steps:
  1. Commit: git add -A && git commit -m "chore: bump version to ${newVersion}"
  2. Tag:    git tag v${newVersion}
  3. Push:   git push && git push --tags

This will trigger the GitHub Action to publish to npm.
`);
}

main();

