import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { computeCanUseDebugLaunches, parseDebugAdminConfig, type DebugAdminConfig } from './debugAdminConfig';

describe('parseDebugAdminConfig', () => {
  it.each([
    {},
    { ANALYSIS_DEBUG_CAPTURE_ENABLED: 'false', ANALYSIS_DEBUG_ADMIN_USER_IDS: 'user_debug' },
    { ANALYSIS_DEBUG_CAPTURE_ENABLED: 'TRUE', ANALYSIS_DEBUG_ADMIN_USER_IDS: 'user_debug' },
    { ANALYSIS_DEBUG_CAPTURE_ENABLED: 'true', ANALYSIS_DEBUG_ADMIN_USER_IDS: 'staff@example.com' },
    { ANALYSIS_DEBUG_CAPTURE_ENABLED: 'true', ANALYSIS_DEBUG_ADMIN_USER_IDS: 'user_debug,' },
  ])('fails closed when server config is absent or malformed', (input) => {
    const config = parseDebugAdminConfig(input);

    expect(config).toEqual({ captureEnabled: false, adminUserIds: [] });
  });

  it('creates a frozen allowlist only from valid server configuration', () => {
    const config = parseDebugAdminConfig({
      ANALYSIS_DEBUG_CAPTURE_ENABLED: 'true',
      ANALYSIS_DEBUG_ADMIN_USER_IDS: 'user_debug,user_backup',
    });

    expect(config).toEqual({ captureEnabled: true, adminUserIds: ['user_debug', 'user_backup'] });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.adminUserIds)).toBe(true);
  });
});

const ENABLED_CONFIG: DebugAdminConfig = { captureEnabled: true, adminUserIds: ['user_admin1'] };
const DISABLED_CONFIG: DebugAdminConfig = { captureEnabled: false, adminUserIds: ['user_admin1'] };

// Regression coverage for the root-layout capability boundary
// (src/app/layout.tsx / src/app/layout.test.tsx): the root layout wraps
// /sign-in too, so it derives this boolean from a non-redirecting auth()
// call rather than requireStaffAccess -- this is the pure logic that
// derivation delegates to.
describe('computeCanUseDebugLaunches', () => {
  it('is false for an unauthenticated visitor even when capture is enabled', () => {
    expect(computeCanUseDebugLaunches(ENABLED_CONFIG, null)).toBe(false);
  });

  it('is false for an authenticated non-admin staff member', () => {
    expect(computeCanUseDebugLaunches(ENABLED_CONFIG, 'user_staff')).toBe(false);
  });

  it('is true only for an allowlisted admin when capture is enabled', () => {
    expect(computeCanUseDebugLaunches(ENABLED_CONFIG, 'user_admin1')).toBe(true);
  });

  it('is false for an allowlisted admin when capture is globally disabled', () => {
    expect(computeCanUseDebugLaunches(DISABLED_CONFIG, 'user_admin1')).toBe(false);
  });
});
