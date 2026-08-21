import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
// Strip full-line comments so assertions check executable code, not prose —
// this file's own explanatory comments legitimately mention the names below.
const layoutCode = layoutSource
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');

// Regression coverage for the Settings->Companies preference-reset bug: the
// single DebugLaunchPreferenceProvider must mount here, at the true app
// root, because /companies and /personas are sibling route trees to
// (dashboard) (see src/app/(dashboard)/layout.test.tsx and
// src/app/companies/layout.test.tsx for the "no second mount" guards).
describe('RootLayout debug launch preference boundary', () => {
  it('mounts the DebugLaunchPreferenceProvider with only a capability-derived remount key and boolean', () => {
    // Given / When
    const providerOpening = layoutSource.match(/<DebugLaunchPreferenceProvider[^>]*>/u)?.[0] ?? '';

    // Then
    expect(providerOpening).toContain("key={canUseDebugLaunches ? 'debug-enabled' : 'debug-disabled'}");
    expect(providerOpening).toContain('canUseDebugLaunches={canUseDebugLaunches}');
    expect(providerOpening).not.toContain('userId');
    expect(providerOpening).not.toContain('debugAdminConfig');
  });

  it('derives the capability boolean from a non-redirecting auth() call, since this layout also renders /sign-in', () => {
    // Given / When / Then
    expect(layoutCode).toContain("from '@clerk/nextjs/server'");
    expect(layoutCode).toContain('await auth()');
    expect(layoutCode).not.toContain('requireStaffAccess');
  });

  it('wraps {children} so one provider instance survives client navigation across every route group', () => {
    // Given / When / Then
    expect(layoutSource).toMatch(
      /<DebugLaunchPreferenceProvider[\s\S]*\{children\}[\s\S]*<\/DebugLaunchPreferenceProvider>/u,
    );
  });
});
