import path from 'node:path';
import { workflow } from '@workflow/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [workflow()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/workflows/**/*.integration.test.ts'],
    testTimeout: 60_000,
  },
});
