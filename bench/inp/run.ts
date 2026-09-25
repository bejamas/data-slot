#!/usr/bin/env bun
/**
 * Interaction benchmark for the built packages (packages/<name>/dist).
 *
 *   bun run bench:inp [--rounds 5] [--cpu 4] [--only select,tabs] [--save base] [--compare base | --ab base]
 *
 * Every step is one user interaction sent through Chrome's real input pipeline
 * while a performance trace records. Per interaction, the trace's EventTiming
 * entries give:
 *   inp   the longest event duration, input timestamp to next paint (what INP reports)
 *   work  main-thread busy time inside those event windows: handlers, style,
 *         layout and paint. Unlike inp it is not rounded up to the next vsync,
 *         so it is the number that moves when component code gets cheaper.
 * --save writes bench/inp/results/<name>.json and the bundle as <name>.js.
 * --compare diffs against a saved result. --ab reruns the saved bundle
 * interleaved with the current one, so both see the same machine load.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import { filler, scenarios, type Step } from "./scenarios";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const rounds = Number(flag("rounds") ?? 5);
const cpu = Number(flag("cpu") ?? 4);
const only = flag("only")?.split(",");
const resultsDir = join(import.meta.dir, "results");

const build = await Bun.build({
  entrypoints: [join(import.meta.dir, "entry.ts")],
  target: "browser",
  format: "iife",
  minify: true,
});
if (!build.success) throw new AggregateError(build.logs, "bundle failed");
const bundle = await build.outputs[0]!.text();
const bundleGzip = gzipSync(bundle).length;
const abName = flag("ab");
const bundles: Record<string, string> = { current: bundle };
if (abName) bundles.base = readFileSync(join(resultsDir, `${abName}.js`), "utf8");

const css = readFileSync(join(import.meta.dir, "page.css"), "utf8");
const page = (html: string, script: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}${filler}<script>${script}</script></body></html>`;

const selected = scenarios.filter((s) => !only || only.includes(s.name));
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const [variant, name] = decodeURIComponent(new URL(request.url).pathname.slice(1)).split("/");
    const scenario = scenarios.find((s) => s.name === name);
    return scenario && bundles[variant!]
      ? new Response(page(scenario.html, bundles[variant!]!), { headers: { "content-type": "text/html" } })
      : new Response("not found", { status: 404 });
  },
});

type TraceEvent = {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: { name?: string; data?: { interactionId?: number; duration?: number } };
};
type Interaction = { inp: number; work: number };

/** Group EventTiming entries by interaction and measure main-thread work inside their windows. */
function readInteractions(events: TraceEvent[]): Interaction[] {
  const timings = events.filter((e) => e.name === "EventTiming" && e.ph === "b" && e.args?.data?.interactionId);
  if (timings.length === 0) return [];
  const pid = timings[0]!.pid;
  const mainThread = events.find(
    (e) => e.pid === pid && e.name === "thread_name" && e.args?.name === "CrRendererMain"
  )?.tid;
  const tasks = events.filter((e) => e.pid === pid && e.tid === mainThread && e.name === "RunTask" && e.ph === "X");

  const byId = new Map<number, Array<[number, number]>>();
  for (const e of timings) {
    const { interactionId, duration } = e.args!.data! as { interactionId: number; duration: number };
    const windows = byId.get(interactionId) ?? [];
    windows.push([e.ts, e.ts + duration * 1000]);
    byId.set(interactionId, windows);
  }

  return [...byId.keys()].sort((a, b) => a - b).map((id) => {
    const windows = byId.get(id)!.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const [start, end] of windows) {
      const last = merged.at(-1);
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    }
    let busy = 0;
    for (const task of tasks) {
      for (const [start, end] of merged) {
        busy += Math.max(0, Math.min(end, task.ts + task.dur!) - Math.max(start, task.ts));
      }
    }
    return { inp: Math.max(...windows.map(([s, e]) => e - s)) / 1000, work: busy / 1000 };
  });
}

const expand = (steps: Step[]) =>
  steps.flatMap((step) => ("type" in step ? [...step.type].map((key) => ({ press: key })) : [step]));

const samples = new Map<string, Map<string, { init: number[]; steps: Interaction[][] }>>();
const browser = await chromium.launch({ channel: process.env.BENCH_CHROME_CHANNEL ?? "chrome", headless: true });

try {
  for (let round = 0; round < rounds; round++) {
    const variants = Object.keys(bundles);
    if (round % 2) variants.reverse();
    for (const [scenario, variant] of selected.flatMap((s) => variants.map((v) => [s, v] as const))) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const tab = await context.newPage();
      const cdp = await context.newCDPSession(tab);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
      await tab.goto(`${server.url}${variant}/${encodeURIComponent(scenario.name)}`);
      await tab.waitForTimeout(300);

      const variantSamples = samples.get(variant) ?? new Map();
      samples.set(variant, variantSamples);
      const entry = variantSamples.get(scenario.name) ?? { init: [], steps: [] };
      variantSamples.set(scenario.name, entry);
      entry.init.push(await tab.evaluate(() => (window as unknown as { __initMs: number }).__initMs));

      const steps = expand(scenario.steps);
      await browser.startTracing(tab, {
        categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "toplevel"],
      });
      for (const step of steps) {
        if ("focus" in step) await tab.focus(step.focus);
        else if ("click" in step) await tab.click(step.click);
        else if ("press" in step) await tab.keyboard.press(step.press);
        await tab.waitForTimeout(150);
      }
      const trace = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: TraceEvent[] };
      await context.close();

      const interactions = readInteractions(trace.traceEvents);
      const expected = steps.filter((s) => !("focus" in s)).length;
      if (interactions.length !== expected) {
        throw new Error(`${scenario.name}: expected ${expected} interactions, trace has ${interactions.length}`);
      }
      interactions.forEach((interaction, index) => (entry.steps[index] ??= []).push(interaction));
    }
    process.stdout.write(`round ${round + 1}/${rounds}\r`);
  }
} finally {
  await browser.close();
  server.stop(true);
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
const sumOf = (values: number[]) => values.reduce((a, b) => a + b, 0);

type ScenarioResult = { init: number; work: number; inp: number; steps: Interaction[] };
const summarize = (variant: string, script: string) => {
  const results: Record<string, ScenarioResult> = {};
  for (const [name, { init, steps }] of samples.get(variant)!) {
    const perStep = steps.map((step) => ({
      inp: median(step.map((s) => s.inp)),
      work: median(step.map((s) => s.work)),
    }));
    results[name] = {
      init: median(init),
      work: sumOf(perStep.map((s) => s.work)),
      inp: Math.max(...perStep.map((s) => s.inp)),
      steps: perStep,
    };
  }
  const totals = {
    work: sumOf(Object.values(results).map((s) => s.work)),
    inp: sumOf(Object.values(results).map((s) => s.inp)),
    init: sumOf(Object.values(results).map((s) => s.init)),
  };
  return { cpu, rounds, bundleBytes: script.length, bundleGzip: gzipSync(script).length, totals, scenarios: results };
};
const report = summarize("current", bundle);
const results = report.scenarios;
const totals = report.totals;

const baseName = flag("compare");
const basePath = baseName && join(resultsDir, `${baseName}.json`);
const base = abName
  ? summarize("base", bundles.base!)
  : basePath && existsSync(basePath)
    ? (JSON.parse(readFileSync(basePath, "utf8")) as typeof report)
    : undefined;

const delta = (now: number, before?: number) =>
  before === undefined ? "" : `${now >= before ? "+" : ""}${(((now - before) / before) * 100).toFixed(0)}%`;
const cell = (now: number, before?: number) => `${now.toFixed(1)} ${delta(now, before)}`.trim().padStart(16);

console.log(`\nCPU ${cpu}x slowdown, ${rounds} rounds, per-step medians in ms.${abName ? ` Interleaved A/B against ${abName}.js.` : ""}`);
console.log(`Bundle (all components): ${bundle.length} B, ${bundleGzip} B gzip ${delta(bundleGzip, base?.bundleGzip)}\n`);
console.log(`${"scenario".padEnd(22)}${"steps".padStart(6)}${"work".padStart(16)}${"inp".padStart(16)}${"init".padStart(16)}`);
for (const [name, s] of Object.entries(results)) {
  const b = base?.scenarios[name];
  console.log(`${name.padEnd(22)}${String(s.steps.length).padStart(6)}${cell(s.work, b?.work)}${cell(s.inp, b?.inp)}${cell(s.init, b?.init)}`);
}
const t = base && {
  work: sumOf(Object.keys(results).map((name) => base.scenarios[name]?.work ?? NaN)),
  inp: sumOf(Object.keys(results).map((name) => base.scenarios[name]?.inp ?? NaN)),
  init: sumOf(Object.keys(results).map((name) => base.scenarios[name]?.init ?? NaN)),
};
console.log(`${"TOTAL".padEnd(28)}${cell(totals.work, t?.work)}${cell(totals.inp, t?.inp)}${cell(totals.init, t?.init)}`);

const saveName = flag("save");
if (saveName) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, `${saveName}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(resultsDir, `${saveName}.js`), bundle);
}
