import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(resolve(process.cwd(), 'src/app/companies/layout.tsx'), 'utf8');

// Regression guard: /companies is a sibling route tree to (dashboard), not a
// child of it, so it never inherited (dashboard)/layout.tsx's provider. A
// second DebugLaunchPreferenceProvider mounted here would "fix" this route
// in isolation while reproducing the original bug (independent, unshared
// state per route tree) -- the single mount belongs at the true app root
// (src/app/layout.tsx / src/app/layout.test.tsx).
describe('CompaniesLayout debug launch preference boundary', () => {
  it('does not mount its own DebugLaunchPreferenceProvider', () => {
    expect(layoutSource).not.toContain('DebugLaunchPreferenceProvider');
  });

  it('still gates the subtree behind requireStaffAccess and renders the shared AppShellLayout', () => {
    expect(layoutSource).toContain('await requireStaffAccess()');
    expect(layoutSource).toContain('<AppShellLayout>{children}</AppShellLayout>');
  });
});
