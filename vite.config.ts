import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  server: {
    port: 5173,
    proxy: {
      '/tpbi-api': {
        target: 'https://maps.mo-bi.ro/api',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/tpbi-api/, '')
      }
    }
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096
  }
});
