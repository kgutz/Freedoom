import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [
    {
      name: 'freedoom-vite-entry',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return html
            .replace('<base href="./public/">', '')
            .replace('href="../src/styles.css"', 'href="/src/styles.css"')
            .replace(
              '<script src="../app.js"></script>',
              '<script type="module" src="/src/main.js"></script>'
            );
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    environment: 'node'
  }
});
