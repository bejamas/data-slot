#!/usr/bin/env bun
/**
 * Generate release notes using LLM based on commits and code changes
 *
 * Usage:
 *   bun run scripts/generate-release-notes.ts <tag>
 *
 * Requires:
 *   - OPENAI_API_KEY environment variable
 *   - Git repository with tags
 */

import { execSync } from "child_process";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

function getPreviousTag(currentTag: string): string | null {
  try {
    const tags = execSync("git tag --sort=-version:refname", {
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    const currentIndex = tags.indexOf(currentTag);
    if (currentIndex === -1 || currentIndex === tags.length - 1) {
      return null;
    }
    return tags[currentIndex + 1];
  } catch {
    return null;
  }
}

function getCommitsSinceTag(
  tag: string
): Array<{ hash: string; message: string; author: string }> {
  try {
    const previousTag = getPreviousTag(tag);
    const range = previousTag ? `${previousTag}..${tag}` : tag;

    const log = execSync(
      `git log ${range} --pretty=format:"%H|%s|%an" --no-merges`,
      {
        encoding: "utf-8",
      }
    ).trim();

    if (!log) return [];

    return log.split("\n").map((line) => {
      const [hash, ...rest] = line.split("|");
      const author = rest.pop() || "";
      const message = rest.join("|");
      return { hash, message, author };
    });
  } catch {
    return [];
  }
}

function getChangedFiles(
  tag: string
): Array<{ file: string; changes: string; packageName: string }> {
  try {
    const previousTag = getPreviousTag(tag);
    const range = previousTag ? `${previousTag}..${tag}` : tag;

    const files = execSync(`git diff --name-only ${range}`, {
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    const changes: Array<{
      file: string;
      changes: string;
      packageName: string;
    }> = [];

    for (const file of files) {
      // Only include package source files (skip dist, node_modules, tests, etc.)
      if (
        file.startsWith("packages/") &&
        file.includes("/src/") &&
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        !file.includes(".test.")
      ) {
        // Extract package name from path: packages/<name>/src/...
        const match = file.match(/^packages\/([^/]+)\/src\//);
        if (!match) continue;
        const packageName = match[1];

        try {
          const diff = execSync(
            `git diff ${previousTag || "HEAD~1"}..${tag} -- "${file}"`,
            {
              encoding: "utf-8",
              maxBuffer: 1024 * 1024,
            }
          );

          if (diff.trim()) {
            changes.push({
              file,
              changes: diff.substring(0, 4000),
              packageName,
            });
          }
        } catch {
          // Skip files that can't be diffed
        }
      }
    }

    return changes.slice(0, 20);
  } catch {
    return [];
  }
}

function getChangedPackages(changes: Array<{ packageName: string }>): string[] {
  return [...new Set(changes.map((c) => c.packageName))];
}

function buildPrompt(
  commits: Array<{ hash: string; message: string }>,
  changes: Array<{ file: string; changes: string; packageName: string }>,
  tag: string
): string {
  const commitsText = commits
    .map((c) => `- ${c.message} (${c.hash.substring(0, 7)})`)
    .join("\n");

  const changedPackages = getChangedPackages(changes);
  const packagesList = changedPackages.map((p) => `@data-slot/${p}`).join(", ");

  // Group changes by package
  const changesByPackage: Record<string, string[]> = {};
  for (const change of changes) {
    if (!changesByPackage[change.packageName]) {
      changesByPackage[change.packageName] = [];
    }
    changesByPackage[change.packageName].push(
      `### ${change.file}\n\`\`\`diff\n${change.changes.substring(
        0,
        2000
      )}\n\`\`\``
    );
  }

  const changesText = Object.entries(changesByPackage)
    .map(([pkg, diffs]) => `## @data-slot/${pkg}\n${diffs.join("\n")}`)
    .join("\n\n");

  return `Generate release notes for version ${tag} of the @data-slot UI component library.

IMPORTANT: All packages in this monorepo share the same version number, but only some packages have actual code changes. You MUST clearly indicate which packages received updates.

Packages with actual code changes in this release: ${
    packagesList || "None (version bump only)"
  }

Commits:
${commitsText}

Code Changes (grouped by package):
${changesText || "No source code changes detected."}

Requirements:
- Start with a brief 1-sentence summary of the release
- List changes organized by package (e.g., "### @data-slot/dialog")
- Only mention packages that had actual code changes
- If no packages had code changes, note this is a version bump / maintenance release
- Write in a friendly, professional tone
- Focus on user-facing changes and improvements
- Use emojis sparingly (✨ features, 🐛 fixes, 💥 breaking changes)
- Keep it concise (aim for 5-10 bullet points total)
- Clearly mark any breaking changes
- Format as markdown`;
}

async function main() {
  const tag =
    process.argv[2] || process.env.GITHUB_REF?.replace("refs/tags/", "");

  if (!tag) {
    console.error("Error: Tag not provided");
    console.error("Usage: bun run scripts/generate-release-notes.ts <tag>");
    process.exit(1);
  }

  console.error(`Generating release notes for ${tag}...\n`);

  const commits = getCommitsSinceTag(tag);
  const changes = getChangedFiles(tag);
  const changedPackages = getChangedPackages(changes);

  console.error(
    `Found ${commits.length} commits and ${changes.length} changed files`
  );
  console.error(
    `Packages with changes: ${changedPackages.join(", ") || "none"}\n`
  );

  if (commits.length === 0) {
    console.error("No commits found. Using default release notes.");
    console.log(`# ${tag}\n\nVersion bump release.`);
    process.exit(0);
  }

  const prompt = buildPrompt(commits, changes, tag);

  console.error("Generating with OpenAI gpt-5-mini...\n");

  const { text } = await generateText({
    model: openai("gpt-5-mini"),
    system:
      "You are a technical writer specializing in creating clear, concise release notes for open-source libraries. Output only the release notes markdown, no preamble.",
    prompt,
  });

  // Output only the release notes to stdout (logs go to stderr)
  console.log(text);
}

main().catch((error) => {
  console.error("Error generating release notes:", error.message);
  process.exit(1);
});
