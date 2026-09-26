import { createDialog } from "../../packages/dialog/src/index";
import { createAccordion } from "../../packages/accordion/src/index";
import { createPresenceLifecycle } from "../../packages/core/src/popup";

const required = (id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing ${id}`);
  return el;
};
const fixtures = required("fixtures");
const results = required("results");
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
// Reproduce handlers running partway through a rendering frame. CSS animation
// start times and performance.now() need not share the handler's timestamp.
const offsetFrame = async () => {
  await frame();
  const start = performance.now();
  while (performance.now() - start < 8) { /* simulate work before close */ }
};

async function measureClose(element: HTMLElement, close: () => void, property: "opacity" | "height") {
  let minimum = Infinity;
  let rebound = false;
  await offsetFrame();
  close();
  const deadline = performance.now() + 1000;
  while (!element.hidden && performance.now() < deadline) {
    const value = parseFloat(getComputedStyle(element)[property]);
    if (value > minimum + (property === "height" ? 2 : 0.05)) rebound = true;
    minimum = Math.min(minimum, value);
    await frame();
  }
  return !rebound && element.hidden;
}

required("run").addEventListener("click", async () => {
  results.textContent = "Running";
  fixtures.innerHTML = `
    <div data-slot="dialog" id="dialog">
      <button data-slot="dialog-trigger">Manage Cookies</button>
      <div data-slot="dialog-overlay" hidden></div>
      <div data-slot="dialog-content" id="dialog-content" hidden><h2 data-slot="dialog-title">Cookies</h2><button data-slot="dialog-close">Close</button></div>
    </div>
    <div data-slot="accordion" id="accordion" data-collapsible>
      <div data-slot="accordion-item" data-value="one">
        <button data-slot="accordion-trigger">Is it accessible?</button>
        <div data-slot="accordion-content" id="panel" hidden><div><p>Yes. It adheres to the WAI-ARIA design pattern.</p></div></div>
      </div>
    </div>
    <div id="mixed" style="opacity:1;transform:translateX(0);transition:opacity 60ms,transform 180ms">Mixed transitions</div>
  `;
  const dialog = createDialog(required("dialog"));
  const accordion = createAccordion(required("accordion"));
  const checks: Array<{ name: string; passed: boolean }> = [];
  try {
    for (let i = 0; i < 12; i++) {
      dialog.open();
      await sleep(150);
      checks.push({ name: `dialog close ${i + 1}`, passed: await measureClose(required("dialog-content"), () => dialog.close(), "opacity") });
      accordion.expand("one");
      await sleep(250);
      checks.push({ name: `accordion close ${i + 1}`, passed: await measureClose(required("panel"), () => accordion.collapse("one"), "height") });
    }
    const mixed = required("mixed");
    let firstEndStayedVisible = false;
    const presence = createPresenceLifecycle({ element: mixed, onExitComplete: () => { mixed.hidden = true; } });
    getComputedStyle(mixed).opacity;
    mixed.style.opacity = "0";
    mixed.style.transform = "translateX(80px)";
    presence.exit();
    mixed.addEventListener("transitionend", (event) => {
      if (event.propertyName === "opacity") firstEndStayedVisible = !mixed.hidden;
    });
    await sleep(240);
    checks.push({ name: "short transition does not end longer exit", passed: firstEndStayedVisible && mixed.hidden });
    presence.cleanup();
    dialog.open();
    await sleep(150);
    dialog.close();
    await sleep(20);
    dialog.open();
    await sleep(180);
    checks.push({ name: "reopen cancels pending exit", passed: !required("dialog-content").hidden });
  } finally {
    dialog.destroy();
    accordion.destroy();
  }
  results.textContent = JSON.stringify({ passed: checks.filter(c => c.passed).length, total: checks.length, failures: checks.filter(c => !c.passed) }, null, 2);
});
