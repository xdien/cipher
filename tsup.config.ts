import { defineConfig } from 'tsup';
export default defineConfig([
  // Core entry: bundle CJS, external ESM
  {
    entry: ['src/core/index.ts'],
    format: ['cjs', 'esm'],
    outDir: 'dist/src/core',
    dts: true,
    shims: true,
    bundle: true,
  },
  // App entry: only ESM, bundle all dependencies except commander
  {
    entry: ['src/app/index.ts'],
    format: ['esm'],
    outDir: 'dist/src/app',
    shims: true,
    bundle: true,
    platform: 'node',
    external: ['events', 'fs', 'path', 'child_process', 'process', 'commander'],
  },
]);