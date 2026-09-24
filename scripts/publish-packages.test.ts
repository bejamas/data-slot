import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { getPublishPackages } from "./publish-packages";

const temporaryRoots: string[] = [];
const repoRoot = join(import.meta.dir, "..");
const workflow = readFileSync(join(repoRoot, ".github/workflows/publish.yml"), "utf8");

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "publish-packages-"));
  temporaryRoots.push(root);
  writeFileSync(join(root, "package.json"), JSON.stringify({ private: true, workspaces: ["packages/*"] }));
  return root;
}

function addPackage(root: string, name: string, overrides: Record<string, unknown> = {}): void {
  const dir = join(root, "packages", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({
    name: `@data-slot/${name}`, version: "1.0.0", ...overrides,
  }));
}

function workflowScript(step: string): string {
  const section = workflow.split(`      - name: ${step}\n`)[1]?.split("\n      - name:")[0];
  const script = section?.split("        run: |\n")[1];
  if (!script) throw new Error(`Missing workflow step: ${step}`);
  return script.replace(/^          /gm, "");
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("new workspaces are discovered and ordered after all internal runtime dependencies", () => {
  const root = fixture();
  addPackage(root, "a-ui", { dependencies: { "@data-slot/new-component": "workspace:*" } });
  addPackage(root, "new-component", { optionalDependencies: { "@data-slot/z-core": "workspace:*" } });
  addPackage(root, "z-core", { peerDependencies: { "@data-slot/zz-base": "workspace:*", external: "^1" } });
  addPackage(root, "zz-base");
  addPackage(root, "private", { private: true, version: "0.0.0" });
  expect(getPublishPackages(root, "1.0.0")).toEqual([
    "packages/zz-base", "packages/z-core", "packages/new-component", "packages/a-ui",
  ]);
});

test("missing or private internal dependencies fail before any package is published", () => {
  const root = fixture();
  addPackage(root, "ui", { dependencies: { "@data-slot/missing": "workspace:*" } });
  expect(() => getPublishPackages(root, "1.0.0")).toThrow("not a public workspace");
  addPackage(root, "missing", { private: true });
  expect(() => getPublishPackages(root, "1.0.0")).toThrow("not a public workspace");
});

test("cyclic dependencies and mismatched release versions fail before publishing", () => {
  const root = fixture();
  addPackage(root, "a", { dependencies: { "@data-slot/b": "workspace:*" } });
  addPackage(root, "b", { dependencies: { "@data-slot/a": "workspace:*" } });
  expect(() => getPublishPackages(root, "1.0.0")).toThrow("Circular package dependency");
  expect(() => getPublishPackages(root, "1.0.1")).toThrow("expected version 1.0.1");
});

test("the real release plan includes the omitted packages and the dry run reads that plan", () => {
  const version = JSON.parse(readFileSync(join(repoRoot, "packages/core/package.json"), "utf8")).version;
  const plan = getPublishPackages(repoRoot, version);
  expect(plan[0]).toBe("packages/core");
  for (const name of ["carousel", "toast", "resizable"]) expect(plan).toContain(`packages/${name}`);
  expect(plan.indexOf("packages/ui")).toBeGreaterThan(plan.indexOf("packages/carousel"));
  expect(plan.indexOf("packages/ui")).toBeGreaterThan(plan.indexOf("packages/toast"));

  const root = fixture();
  const planPath = join(root, "plan.txt");
  writeFileSync(planPath, plan.join("\n") + "\n");
  const result = spawnSync("bash", ["-c", workflowScript("Dry run - show what would be published")], {
    cwd: repoRoot, encoding: "utf8", env: { ...process.env, PUBLISH_PLAN: planPath },
  });
  expect(result.status).toBe(0);
  for (const dir of plan) expect(result.stdout).toContain(`@data-slot/${dir.split("/")[1]}@${version}`);
});

function runPublish(registryStatus: string) {
  const root = fixture();
  addPackage(root, "core");
  // Use an older dependency version to verify the packed manifest is rewritten.
  addPackage(root, "carousel", { dependencies: { "@data-slot/core": "0.9.0" } });
  addPackage(root, "ui", { dependencies: { "@data-slot/carousel": "workspace:*" } });
  const planPath = join(root, "plan.txt");
  writeFileSync(planPath, getPublishPackages(root, "1.0.0").join("\n") + "\n");
  const bin = join(root, "bin");
  mkdirSync(bin);
  const commands = {
    npm: 'case "$*" in "config get registry") echo https://registry.npmjs.org;; "config get dry-run") echo false;; *) exit 90;; esac',
    curl: 'case "$*" in *carousel*) if [ -f "$REGISTRY_STATE" ]; then printf 200; else printf "%s" "$REGISTRY_STATUS"; fi;; *) printf 200;; esac',
    bunx: `set -eu
test "$*" = "npm publish --access public --provenance --registry https://registry.npmjs.org"
test "$(jq -r '.dependencies["@data-slot/core"]' package.json)" = "1.0.0"
jq -r .name package.json >> "$PUBLISHED_LOG"
touch "$REGISTRY_STATE"`,
  };
  for (const [name, script] of Object.entries(commands)) {
    writeFileSync(join(bin, name), `#!/bin/bash\n${script}\n`, { mode: 0o755 });
  }
  const log = join(root, "published.txt");
  writeFileSync(log, "");
  const result = spawnSync("bash", ["-c", workflowScript("Publish packages")], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`, PUBLISH_PLAN: planPath,
      RELEASE_VERSION: "1.0.0", REGISTRY_STATUS: registryStatus,
      REGISTRY_STATE: join(root, "available"), PUBLISHED_LOG: log, PUBLISH_VERIFY_ATTEMPTS: "1",
    },
  });
  return { ...result, published: readFileSync(log, "utf8") };
}

test("a partial release skips existing versions, packs and publishes the missing package, and verifies it", () => {
  const result = runPublish("404");
  expect({ status: result.status, stderr: result.status ? result.stderr : "" }).toEqual({ status: 0, stderr: "" });
  expect(result.published).toBe("@data-slot/carousel\n");
  expect(result.stdout).toContain("Skipping @data-slot/core@1.0.0");
  expect(result.stdout).toContain("Skipping @data-slot/ui@1.0.0");
  expect(result.stdout).toContain("[OK] @data-slot/carousel@1.0.0 is available");
});

test("registry failures abort instead of treating packages as unpublished", () => {
  const result = runPublish("503");
  expect(result.status).not.toBe(0);
  expect(result.published).toBe("");
  expect(result.stdout).toContain("HTTP 503");
});
