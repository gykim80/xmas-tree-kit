import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// 에디터와 예제 페이지 (GitHub Pages 등 정적 호스팅용)
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
      },
    },
  },
});
