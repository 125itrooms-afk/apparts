/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#23262b', soft: '#4a4f57', mute: '#7a7f87' },
        paper: { DEFAULT: '#f4f5f2', card: '#ffffff', line: '#e1e4de', sunk: '#eaece7' },
        brand: { DEFAULT: 'rgb(var(--v125-brand) / <alpha-value>)', ink: 'rgb(var(--v125-brand-ink) / <alpha-value>)' },
        sage: { DEFAULT: '#5e7a6b', soft: '#e6eee9' },
        ok: '#2f7d4f', warn: '#b7791f', bad: '#b4433c',
      },
      fontFamily: {
        display: ['var(--v125-display)', 'Georgia', 'serif'],
        sans: ['var(--v125-font)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        float: '0 10px 30px -10px rgba(35,38,43,.35)',
        card: '0 1px 2px rgba(35,38,43,.06), 0 4px 16px -8px rgba(35,38,43,.12)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { from: { opacity: 0, transform: 'scale(.92)' }, to: { opacity: 1, transform: 'none' } },
        ring: { '0%': { boxShadow: '0 0 0 0 rgb(var(--v125-brand) / .45)' }, '100%': { boxShadow: '0 0 0 14px rgb(var(--v125-brand) / 0)' } },
        dot: { '0%,80%,100%': { opacity: .25 }, '40%': { opacity: 1 } },
      },
      animation: {
        rise: 'rise .28s ease-out both',
        pop: 'pop .22s ease-out both',
        ring: 'ring 1.8s ease-out infinite',
        dot: 'dot 1.2s infinite',
      },
    },
  },
  plugins: [],
};
