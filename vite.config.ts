/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes a normal static site in dist/ (for Cloudflare Pages).
// `npm run build:single` makes one self-contained HTML file (handy for quick previews).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', target: 'es2020' },
  test: { include: ['tests/**/*.test.ts'] },
}));
