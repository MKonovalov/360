import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/scripts/seedGbs.integration.test.ts'],
    setupFiles: ['./vitest.gbs.setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
  },
});
