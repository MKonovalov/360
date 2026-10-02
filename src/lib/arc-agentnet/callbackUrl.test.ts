import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { VERCEL_ENV: 'preview' } }));

import { partnerCallbackUrl, partnerCallbackUrlFor } from './callbackUrl';

describe('partnerCallbackUrlFor', () => {
  it('targets the production webhook only for production deployments', () => {
    expect(partnerCallbackUrlFor('production')).toBe('https://360.arclumenpartners.com/webhooks/arc-agentnet');
    expect(partnerCallbackUrlFor('preview')).toBeUndefined();
    expect(partnerCallbackUrlFor('development')).toBeUndefined();
    expect(partnerCallbackUrlFor(undefined)).toBeUndefined();
  });

  it('reads the deployment environment from the validated env', () => {
    expect(partnerCallbackUrl()).toBeUndefined();
  });
});
