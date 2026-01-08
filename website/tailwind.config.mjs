/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: '#faf9f7',
        text: '#1a1a1a',
        muted: '#666',
        border: '#ccc',
        accent: '#0066cc',
        'code-bg': '#f0eeeb',
      },
    },
  },
  plugins: [],
};

