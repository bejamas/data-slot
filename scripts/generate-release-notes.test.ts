import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

const scriptPath = join(import.meta.dir, "generate-release-notes.ts");
const temporaryDirectories: string[] = [];

function createRepository(): string {
  const directory = mkdtempSync(join(tmpdir(), "release-notes-test-"));
  temporaryDirectories.push(directory);

  for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "Test User"]]) {
    expect(spawnSync("git", args, { cwd: directory }).status).toBe(0);
  }

  return directory;
}

function runReleaseNotes(tag: string, cwd: string) {
  return spawnSync("bun", [scriptPath, tag], {
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
  const emptyTree = spawnSync("git", ["mktree"], {
    cwd: repository,
    input: "",
    encoding: "utf-8",
  }).stdout.trim();
  expect(spawnSync("git", ["tag", "v1.2.3", emptyTree], { cwd: repository }).status).toBe(0);

  const result = runReleaseNotes("v1.2.3", repository);

  expect(result.status).toBe(0);
  expect(result.stdout).toBe("# v1.2.3\n\nVersion bump release.\n");
}, 15_000);
