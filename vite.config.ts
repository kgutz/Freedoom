import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    environment: 'node'
  }
});
