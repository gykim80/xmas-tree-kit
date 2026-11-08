import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// npm·git 설치용: three 는 쓰는 쪽 것을 쓴다 (peerDependency)
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: {
      entry: { 'xmas-tree-kit': resolve('src/index.js'), element: resolve('src/element-define.js') },
      formats: ['es'],
    },
    rollupOptions: { external: [/^three($|\/)/] },
  },
});
