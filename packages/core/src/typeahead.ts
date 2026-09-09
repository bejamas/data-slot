export interface TypeaheadOptions {
  /** Milliseconds of inactivity before the typed buffer resets. Defaults to 500. */
  resetDelayMs?: number;
  /** Window used for timers. Defaults to the global window. */
  win?: Window;
}

export interface TypeaheadController {
  /**
   * Feed one typed character and find the item it should highlight.
   *
   * The character is appended to the buffer (restarting the reset timer). The first
   * label that starts with the whole buffer wins. If nothing matches and the buffer is a
   * single character, a wrap-around search runs forward from `currentIndex + 1` for a
   * label starting with that character. Pass `-1` for `currentIndex` when nothing is
   * highlighted (the wrap-around then starts from the first label).
   *
   * Matching is case-insensitive. Returns the matched index or -1.
   */
  match(char: string, labels: readonly string[], currentIndex: number): number;
  /** Clear the buffer and cancel the pending reset timer. */
  reset(): void;
  /** Alias of `reset`, for cleanup arrays. */
  destroy(): void;
}

export function createTypeahead(options: TypeaheadOptions = {}): TypeaheadController {
  const resetDelayMs = options.resetDelayMs ?? 500;
  const win = options.win ?? window;

  let buffer = "";
  let timeoutId: number | null = null;

  const reset = () => {
    if (timeoutId !== null) {
      win.clearTimeout(timeoutId);
      timeoutId = null;
    }
    buffer = "";
  };

  const match = (char: string, labels: readonly string[], currentIndex: number): number => {
    if (timeoutId !== null) win.clearTimeout(timeoutId);
    timeoutId = win.setTimeout(() => {
      buffer = "";
      timeoutId = null;
    }, resetDelayMs);

    const needle = char.toLowerCase();
    buffer += needle;

    const lowered = labels.map((label) => label.toLowerCase());
    let matchIndex = lowered.findIndex((label) => label.startsWith(buffer));

    if (matchIndex === -1 && buffer.length === 1) {
      const start = currentIndex + 1;
      for (let i = 0; i < lowered.length; i++) {
        const index = (start + i) % lowered.length;
        if (lowered[index]!.startsWith(needle)) {
          matchIndex = index;
          break;
        }
      }
    }

    return matchIndex;
  };

  return { match, reset, destroy: reset };
}
