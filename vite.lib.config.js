import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// for npm/git installs: three comes from the consumer (peerDependency)
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
