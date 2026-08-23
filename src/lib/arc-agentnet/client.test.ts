import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createArcAgentnetClient,
  type ArcAgentnetJsonObject,
} from './client';

const submitInput = {
  target: { type: 'company', id: 42 },
  signals: ['cost_pressure'],
} satisfies ArcAgentnetJsonObject;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('arc-agentnet client', () => {
  it('submits without exposing the runtime spec id and sends partner headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({ job_id: 'job-123', status: 'queued', request_id: 'req-123' }, 202),
    );
    const registerJob = vi.fn().mockResolvedValue({ ok: true, mappingId: 1 });
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
      registerJob,
    });

    const result = await client.submit({
      idempotencyKey: 'idempotency-123',
      input: submitInput,
    });

    expect(result).toEqual({
      ok: true,
      value: { jobId: 'job-123', status: 'queued', requestId: 'req-123' },
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://agentnet.example.test/partner/jobs');
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Idempotency-Key')).toBe('idempotency-123');
    expect(headers.get('X-Partner-Key')).toBe('partner-secret');
    expect(init?.redirect).toBe('error');
    expect(JSON.parse(String(init?.body))).toEqual({ input: submitInput });
    expect(registerJob).toHaveBeenCalledWith({
      job: { jobId: 'job-123', status: 'queued', requestId: 'req-123' },
      idempotencyKey: 'idempotency-123',
    });
  });

  it('does not return a successful submit when the local mapping cannot be persisted', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({ job_id: 'job-123', status: 'queued', request_id: 'req-123' }, 202),
    );
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
      registerJob: vi.fn().mockResolvedValue({ ok: false, kind: 'database_failure' }),
    });

    await expect(client.submit({ idempotencyKey: 'idempotency-123', input: submitInput })).resolves.toEqual({
      ok: false,
      kind: 'persistence',
      status: null,
    });
  });

  it('parses authoritative poll statuses and preserves the full result', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        job_id: 'job-123',
        status: 'succeeded',
        request_id: 'req-123',
        result: { findings: [{ id: 'finding-1' }] },
      }),
    );
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
    });

    await expect(client.poll({ jobId: 'job-123' })).resolves.toEqual({
      ok: true,
      value: {
        jobId: 'job-123',
        status: 'succeeded',
        requestId: 'req-123',
        result: { findings: [{ id: 'finding-1' }] },
      },
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://agentnet.example.test/partner/jobs/job-123',
    );
  });

  it('returns job_expired for the authoritative 410 response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({ error: 'job_expired' }, 410),
    );
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
    });

    await expect(client.poll({ jobId: 'job-123' })).resolves.toEqual({
      ok: false,
      kind: 'job_expired',
      status: 410,
    });
  });

  it('treats cancel as best effort when the backend returns a non-2xx response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ error: 'busy' }, 409));
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
    });

    await expect(client.cancel({ jobId: 'job-123' })).resolves.toEqual({
      ok: false,
      kind: 'http_error',
      status: 409,
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://agentnet.example.test/partner/jobs/job-123/cancel',
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', redirect: 'error' });
  });

  it('deletes a job through the exact DELETE endpoint without following redirects', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
    });

    await expect(client.delete({ jobId: 'job-123' })).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://agentnet.example.test/partner/jobs/job-123',
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE', redirect: 'error' });
  });

  it('rejects malformed successful responses instead of trusting HTTP 2xx', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({ job_id: 'job-123', status: 'unknown', request_id: 'req-123' }),
    );
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
    });

    await expect(client.poll({ jobId: 'job-123' })).resolves.toEqual({
      ok: false,
      kind: 'invalid_response',
      status: 200,
    });
  });

  it.each([
    ['timeout', new DOMException('timed out', 'TimeoutError')],
    ['network', new TypeError('network failed')],
  ])('returns a safe network result for a %s failure', async (_label, error) => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(error);
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
    });

    await expect(client.poll({ jobId: 'job-123' })).resolves.toEqual({
      ok: false,
      kind: 'network',
      status: null,
    });
  });
});
