export type ToastPauseReason = "hover" | "focus" | "window" | "document";

/** Reasons that come from the user engaging with the stack; they also expand it. */
const INTERACTION_REASONS: ReadonlySet<ToastPauseReason> = new Set(["hover", "focus"]);

interface ToastInteractionOptions {
  /** Whether any entry is still animating out. */
  hasExitingEntries(): boolean;
  /** Called on every sync with the derived fan-out state. */
  setExpanded(expanded: boolean): void;
  /** Called only when the derived timer pause state changes. */
  setPaused(paused: boolean): void;
}

/**
 * Owns the viewport's pause reasons and the deferred-collapse rule.
 *
 * Any active reason pauses countdowns. Hover and focus additionally expand the
 * stack. When the last interaction reason clears while entries are still
 * exiting, the stack stays expanded until those exits settle so it does not
 * collapse mid-animation.
 */
export function createToastInteraction({ hasExitingEntries, setExpanded, setPaused }: ToastInteractionOptions) {
  const reasons = new Set<ToastPauseReason>();
  let collapseDeferred = false;
  let paused = false;

  const hasInteraction = () => [...reasons].some((reason) => INTERACTION_REASONS.has(reason));

  const sync = () => {
    if (collapseDeferred && (hasInteraction() || !hasExitingEntries())) {
      collapseDeferred = false;
    }
    setExpanded(hasInteraction() || collapseDeferred);

    const nextPaused = reasons.size > 0;
    if (nextPaused === paused) return;
    paused = nextPaused;
    setPaused(paused);
  };

  return {
    get expanded() { return hasInteraction() || collapseDeferred; },
    get paused() { return paused; },
    set(reason: ToastPauseReason, active: boolean) {
      if (active) {
        reasons.add(reason);
      } else if (reasons.delete(reason) && INTERACTION_REASONS.has(reason) && !hasInteraction() && hasExitingEntries()) {
        collapseDeferred = true;
      }
      sync();
    },
    sync,
  };
}
