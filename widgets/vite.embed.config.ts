import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Сборка одного скрипта для установки на сайт отеля: dist-embed/v125-widgets.js
export default defineConfig({
  resolve: { alias: { '@demo-assets': fileURLToPath(new URL('./src/assets/demoAssets.embed.ts', import.meta.url)) } },
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-embed',
    emptyOutDir: true,
    lib: {
      entry: 'src/embed.tsx',
      name: 'V125Widgets',
      formats: ['iife'],
      fileName: () => 'v125-widgets.js',
    },
  },
});
