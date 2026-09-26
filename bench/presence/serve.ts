/** bun bench/presence/serve.ts [--baseline] then open http://localhost:4666 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const baseline = process.argv.includes("--baseline");
const build = await Bun.build({
  entrypoints: [join(import.meta.dir, "suite.ts")],
  target: "browser",
  plugins: baseline ? [{
    name: "released-presence",
    setup(build) {
      build.onLoad({ filter: /packages\/core\/src\/popup\.ts$/ }, () => ({
        contents: Bun.spawnSync(["git", "show", "v1.0.1:packages/core/src/popup.ts"]).stdout.toString(),
        loader: "ts",
      }));
    },
  }] : [],
});
if (!build.success) throw new AggregateError(build.logs, "Build failed");
const script = await build.outputs[0]!.text();
const html = readFileSync(join(import.meta.dir, "index.html"), "utf8");
Bun.serve({
  port: 4666,
  fetch: () => new Response(html.replace("<!-- script -->", `<script>${script}</script>`), {
    headers: { "content-type": "text/html" },
  }),
});
console.log(`Presence regression suite (${baseline ? "v1.0.1" : "working tree"}): http://localhost:4666`);
