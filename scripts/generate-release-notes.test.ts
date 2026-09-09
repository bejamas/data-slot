import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

const scriptPath = join(import.meta.dir, "generate-release-notes.ts");
const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  expect(result.status).toBe(0);
  return result.stdout.trim();
}

function createRepository(): string {
  const directory = mkdtempSync(join(tmpdir(), "release-notes-test-"));
  temporaryDirectories.push(directory);

  for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "Test User"]]) {
    git(directory, ...args);
  }

  return directory;
}

function runReleaseNotes(tag: string, cwd: string, preload?: string) {
  return spawnSync("bun", [...(preload ? ["--preload", preload] : []), scriptPath, tag], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, OPENAI_API_KEY: "" },
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("treats a metacharacter-containing tag as a literal Git revision", () => {
  const repository = createRepository();
  const marker = join(repository, "shell-command-ran");
  const result = runReleaseNotes(`missing-tag; touch ${marker}; #`, repository);

  expect(existsSync(marker)).toBe(false);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Version bump release.");
}, 15_000);

test("generates default notes for a normal tag with no commits", () => {
  const repository = createRepository();
  git(repository, "commit", "--allow-empty", "-m", "Initial commit");
  git(repository, "tag", "v1.2.2");
  git(repository, "tag", "v1.2.3");

  const result = runReleaseNotes("v1.2.3", repository);

  expect(result.status).toBe(0);
  expect(result.stdout).toBe("# v1.2.3\n\nVersion bump release.\n");
}, 15_000);

test("generates notes from only the commits and source changes between two tags", () => {
  const repository = createRepository();
  const sourceFile = "packages/core/src/index.ts";
  mkdirSync(join(repository, "packages/core/src"), { recursive: true });
  writeFileSync(join(repository, sourceFile), "export const count = 1;\n");
  git(repository, "add", ".");
  git(repository, "commit", "-m", "Initial implementation before release");
  git(repository, "tag", "v1.2.2");

  writeFileSync(join(repository, sourceFile), "export const count = 2;\n");
  writeFileSync(join(repository, "packages/core/src/index.test.ts"), "// Test-only change\n");
  writeFileSync(join(repository, "README.md"), "Documentation-only change\n");
  git(repository, "add", ".");
  git(repository, "commit", "-m", "feat: update count | preserve delimiter");
  const releaseCommit = git(repository, "rev-parse", "HEAD");
  git(repository, "tag", "-a", "v1.2.3", "-m", "Release 1.2.3");

  writeFileSync(join(repository, sourceFile), "export const count = 3;\n");
  git(repository, "add", ".");
  git(repository, "commit", "-m", "Later change after release");

  // Keep real Git and CLI execution; replace only the external text generator.
  const preload = join(repository, "mock-ai.ts");
  writeFileSync(preload, `
    import { mock } from "bun:test";
    mock.module(${JSON.stringify(import.meta.resolve("ai"))}, () => ({
      generateText: async ({ prompt }) => ({ text: prompt }),
    }));
  `);

  const result = runReleaseNotes("v1.2.3", repository, preload);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Generate release notes for version v1.2.3");
  expect(result.stdout).toContain(`- feat: update count | preserve delimiter (${releaseCommit.substring(0, 7)})`);
  expect(result.stdout).not.toContain("Initial implementation before release");
  expect(result.stdout).not.toContain("Later change after release");
  expect(result.stdout).toContain("Packages with actual code changes in this release: @data-slot/core");
  expect(result.stdout).toContain(`### ${sourceFile}`);
  expect(result.stdout).toContain("-export const count = 1;");
  expect(result.stdout).toContain("+export const count = 2;");
  expect(result.stdout).not.toContain("export const count = 3;");
  expect(result.stdout).not.toContain("index.test.ts");
  expect(result.stdout).not.toContain("README.md");
}, 15_000);
