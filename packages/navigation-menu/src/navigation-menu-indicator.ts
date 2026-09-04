export function createNavigationMenuIndicator(indicator: HTMLElement | null, list: HTMLElement, viewport: HTMLElement | null, activeTrigger: () => HTMLElement | null) {
  let hovered: HTMLElement | null = null;
  let instantRaf: number | null = null;
  const clearFrame = () => { if (instantRaf !== null) { cancelAnimationFrame(instantRaf); instantRaf = null; } };
  const show = (target: HTMLElement | null) => {
    if (!indicator) return;
    hovered = target;
    if (!target) { clearFrame(); indicator.removeAttribute("data-instant"); indicator.setAttribute("data-state", "hidden"); return; }
    if (indicator.getAttribute("data-state") !== "visible") {
      clearFrame(); indicator.setAttribute("data-instant", "");
      instantRaf = requestAnimationFrame(() => { instantRaf = requestAnimationFrame(() => { indicator?.removeAttribute("data-instant"); instantRaf = null; }); });
    }
    const listRect = list.getBoundingClientRect(); const rect = target.getBoundingClientRect();
    indicator.style.setProperty("--indicator-left", `${rect.left - listRect.left}px`);
    indicator.style.setProperty("--indicator-width", `${rect.width}px`);
    indicator.style.setProperty("--indicator-top", `${rect.top - listRect.top}px`);
    const margin = viewport ? parseFloat(getComputedStyle(viewport).marginTop) || 0 : 0;
    indicator.style.setProperty("--indicator-height", `${rect.height - (margin < 1 ? 1 : 0)}px`);
    indicator.setAttribute("data-state", "visible");
  };
  const sync = (preferred: HTMLElement | null = null) => show(activeTrigger() ?? preferred);
  return { show, sync, get hovered() { return hovered; }, destroy() { clearFrame(); hovered = null; } };
}
