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
    include: [
      'src/lib/agents/structured-outputs-probe.test.ts',
      'src/lib/agents/openrouter-only-chain.test.ts',
      'src/lib/agents/opencode-only-chain.test.ts',
      'src/lib/agents/nousresearch-only-chain.test.ts',
    ],
    setupFiles: ['./vitest.live-provider.setup.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
