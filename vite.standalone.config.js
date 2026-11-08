import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// <script type="module"> 한 줄용: three 까지 한 파일에 묶는다
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: { entry: resolve('src/standalone.js'), formats: ['es'], fileName: () => 'xmas-tree.standalone.js' },
  },
});
