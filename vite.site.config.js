import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Editor and example pages (for static hosting such as GitHub Pages)
export default defineConfig({
  base: './',
  server: { port: 5320, open: '/editor/' },
  build: {
    outDir: 'site-dist',
    rollupOptions: {
      input: {
        index: resolve('index.html'),
        editor: resolve('editor/index.html'),
        basic: resolve('examples/basic.html'),
        embed: resolve('examples/embed.html'),
        game: resolve('examples/game.html'),
        adopt: resolve('examples/adopt/index.html'),
      },
    },
  },
});
