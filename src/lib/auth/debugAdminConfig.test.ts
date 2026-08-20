import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseDebugAdminConfig } from './debugAdminConfig';

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
