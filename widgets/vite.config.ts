import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';

// mode=singlefile собирает демо в один HTML (для публикации прототипа без сервера)
export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@demo-assets': fileURLToPath(new URL('./src/assets/demoAssets.ts', import.meta.url)) } },
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'singlefile' ? 'dist-demo' : 'dist',
    emptyOutDir: true,
  },
}));
