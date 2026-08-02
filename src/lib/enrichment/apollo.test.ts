import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { APOLLO_API_KEY: 'test-key' } }));

import { enrichOrganization } from './apollo';

describe('Apollo response boundaries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns no_match when Apollo returns an empty no-match envelope', async () => {
    // Given
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    // When
    const result = await enrichOrganization('example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'no_match' });
  });

  it('returns invalid_response when the organization envelope is malformed', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ organization: 'not-an-object' }, { status: 200 }))
    );

    // When
    const result = await enrichOrganization('example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_response' });
  });

  it('returns invalid_response when Apollo returns invalid JSON', async () => {
    // Given
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })));

    // When
    const result = await enrichOrganization('example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_response' });
  });
});
