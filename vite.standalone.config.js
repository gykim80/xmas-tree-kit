import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// single <script type="module"> build: bundles three into one file
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: { entry: resolve('src/standalone.js'), formats: ['es'], fileName: () => 'xmas-tree.standalone.js' },
  },
});
