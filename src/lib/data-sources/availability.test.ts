import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const envMock = vi.hoisted(() => ({
  FIRECRAWL_API_KEY: 'firecrawl-test',
  APOLLO_API_KEY: undefined as string | undefined,
  PROSPEO_API_KEY: 'prospeo-test',
}));

vi.mock('@/lib/env', () => ({ env: envMock }));

import { resolveDataSourceAvailability } from './availability';

describe('resolveDataSourceAvailability', () => {
  beforeEach(() => {
    envMock.FIRECRAWL_API_KEY = 'firecrawl-test';
    envMock.APOLLO_API_KEY = undefined;
    envMock.PROSPEO_API_KEY = 'prospeo-test';
  });

  it('returns statuses without exposing credential values', () => {
    const availability = resolveDataSourceAvailability();

    expect(availability).toEqual([
      { provider: 'firecrawl', status: 'available' },
      { provider: 'exa', status: 'unavailable' },
      { provider: 'apollo', status: 'not_configured' },
      { provider: 'prospeo', status: 'available' },
    ]);
    expect(JSON.stringify(availability)).not.toContain('firecrawl-test');
    expect(JSON.stringify(availability)).not.toContain('prospeo-test');
  });
});
