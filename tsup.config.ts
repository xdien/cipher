import { defineConfig } from 'tsup';
export default defineConfig([
  {
    entry: ['src/core/index.ts'],
    format: ['cjs'],
    outDir: 'dist/src/core',
    dts: true,
    shims: true,
    bundle: true,
    noExternal: ['chalk', 'boxen'],
    external: ['better-sqlite3', 'pg', 'redis'],
  },
  {
    entry: ['src/app/index.ts'],
    format: ['cjs', 'esm'],
    outDir: 'dist/src/app',
    shims: true,
    bundle: true,
    platform: 'node',
    external: ['better-sqlite3', 'pg', 'neo4j-driver', 'ioredis'],
    noExternal: ['chalk', 'boxen'],
  },
]);