import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { PROSPEO_API_KEY: 'test-key' } }));

import { enrichPerson } from './prospeo';

describe('Prospeo response boundaries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns no_match when Prospeo flags error:true (no result, no credit)', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: true, error_code: 'NO_RESULT' }, { status: 200 }))
    );

    // When
    const result = await enrichPerson('unknown@example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'no_match' });
  });

  it('returns no_match when the person object is absent', async () => {
    // Given
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: false }, { status: 200 })));

    // When
    const result = await enrichPerson('unknown@example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'no_match' });
  });

  it('returns no_match when Prospeo responds 400 with error_code NO_MATCH', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ error: true, error_code: 'NO_MATCH' }, { status: 400 })
      )
    );

    // When
    const result = await enrichPerson('unknown@example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'no_match' });
  });

  it('returns http_429 when Prospeo rate-limits the key', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ error: true, error_code: 'Rate limit exceeded' }, { status: 429 })
      )
    );

    // When
    const result = await enrichPerson('cfo@example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'http_429' });
  });

  it('returns http_403 when the key lacks access', async () => {
    // Given
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 })));

    // When
    const result = await enrichPerson('cfo@example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'http_403' });
  });

  it('returns invalid_response when Prospeo returns invalid JSON', async () => {
    // Given
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })));

    // When
    const result = await enrichPerson('cfo@example.com');

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_response' });
  });

  it('returns no_match_key for an empty email', async () => {
    // Given / When
    const result = await enrichPerson('   ');

    // Then
    expect(result).toEqual({ ok: false, reason: 'no_match_key' });
  });

  it('posts the normalized email and maps a valid person response without identity fields', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        error: false,
        person: {
          full_name: 'Jane Doe',
          email: 'cfo@example.com',
          current_job_title: 'CFO',
          job_history: [{ company_name: 'Acme', current: true, seniority: 'CXO' }],
          linkedin_url: 'https://linkedin.com/in/jane',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    // When
    const result = await enrichPerson('CFO@example.com');

    // Then
    expect(result).toEqual({
      ok: true,
      fields: [
        { field: 'title', incomingValue: 'CFO' },
        { field: 'seniority', incomingValue: 'c_level' },
        { field: 'linkedinUrl', incomingValue: 'https://linkedin.com/in/jane' },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.prospeo.io/enrich-person');
    expect(init.method).toBe('POST');
    expect(init.headers['X-KEY']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual({ data: { email: 'cfo@example.com' } });
  });
});
