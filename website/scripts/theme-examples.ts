// Adapt the legacy palette in live examples and their copyable source together.
// Black overlays and shadows intentionally keep their original colors.
const colors: Record<string, string> = {
  '#faf9f7': 'bg', '#1a1a1a': 'text', '#666': 'muted', '#ccc': 'border',
  '#f0eeeb': 'code-bg', '#fff': 'surface', '#0066cc': 'accent',
  '98.5% 0.002 247.839': 'bg', '96.7% 0.003 264.542': 'code-bg',
  '92.8% 0.006 264.531': 'border', '87.2% 0.01 258.338': 'border',
  '70.7% 0.022 261.325': 'muted', '55.1% 0.027 264.364': 'muted',
  '44.6% 0.03 256.802': 'muted', '37.3% 0.034 259.733': 'text',
  '27.8% 0.033 256.848': 'text', '21% 0.034 264.665': 'text',
  '98.5% 0.001 106.423': 'bg', '97% 0.001 106.424': 'code-bg',
  '92.3% 0.003 48.717': 'code-bg', '86.9% 0.005 56.366': 'border',
  '70.9% 0.01 56.259': 'muted', '44.4% 0.011 73.639': 'muted',
  '14.7% 0.004 49.25': 'text',
  '57.7% 0.245 27.325': 'danger', '97.1% 0.013 17.38': 'danger-bg',
};
const utilities: Record<string, string> = {
  white: 'surface', muted: 'muted', border: 'border', accent: 'accent',
  'gray-50': 'bg', 'gray-100': 'code-bg', 'gray-200': 'border',
  'gray-300': 'border', 'gray-400': 'muted', 'gray-500': 'muted',
  'gray-600': 'muted', 'gray-700': 'text', 'gray-800': 'text', 'gray-900': 'text',
  'stone-50': 'bg', 'stone-100': 'code-bg', 'stone-200': 'code-bg',
  'stone-300': 'border', 'stone-400': 'muted', 'stone-600': 'muted', 'stone-950': 'text',
  'red-50': 'danger-bg', 'red-600': 'danger',
};

export function themeExamples(source: string): string {
  return source
    .replace(/#[\da-fA-F]{3,8}\b/g, color => colors[color] ? `var(--${colors[color]})` : color)
    .replace(/oklch\(([^)/]+?)(?:\s*\/\s*([\d.]+))?\)/g, (color, channels, alpha) => {
      const token = colors[channels.trim()];
      if (!token) return color;
      return alpha ? `color-mix(in srgb, var(--${token}) ${Number(alpha) * 100}%, transparent)` : `var(--${token})`;
    })
    .replace(/\b(background|color):\s*white\b/g, '$1: var(--surface)')
    .replace(/\b(bg|text|border|ring|from|to)-(white|muted|border|accent|(?:gray|stone|red)-\d+)\b/g,
      (utility, property, color) => utilities[color] ? `${property}-[var(--${utilities[color]})]` : utility);
}
