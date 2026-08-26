import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './vitest.server-only.mock.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    exclude: ['src/workflows/**/*.integration.test.ts', 'src/scripts/seedGbs.integration.test.ts'],
    setupFiles: ['./vitest.integration.setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
  },
});
