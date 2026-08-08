import { execFileSync } from 'node:child_process';

import { describe, it } from 'vitest';

describe('catalog module Node runtime boundary', () => {
  it('loads catalog data without a missing JSON import attribute', () => {
    execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        "const module = await import('./src/lib/models/catalog.ts'); if (!module.getModelDisplayName) throw new Error('catalog module did not load');",
      ],
      { cwd: process.cwd(), stdio: 'pipe' },
    );
  });
});
