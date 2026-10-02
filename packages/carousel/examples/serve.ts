import { resolve } from "node:path";

const build = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "../src/index.ts")],
  target: "browser",
});
if (!build.success) throw new Error(build.logs.join("\n"));
const bundle = build.outputs[0]!;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.CAROUSEL_PORT ?? 4196),
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/carousel.js") return new Response(bundle, { headers: { "Content-Type": "text/javascript" } });
    if (path === "/") return new Response(Bun.file(resolve(import.meta.dir, "index.html")));
    return new Response("Not found", { status: 404 });
  },
});
console.log(`Carousel test page: ${server.url}`);
