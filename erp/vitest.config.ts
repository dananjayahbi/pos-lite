import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'src/generated'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' is not resolvable in a plain node test env; it only
      // carries a runtime guard in bundlers, so stub it out for tests.
      'server-only': path.resolve(__dirname, './vitest.server-only-stub.mjs'),
    },
  },
});
