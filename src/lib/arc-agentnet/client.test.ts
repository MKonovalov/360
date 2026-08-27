import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createArcAgentnetClient,
  type ArcAgentnetJsonObject,
} from './client';

const submitInput = {
  schemaVersion: 1,
  analysis: {
    resolvedInstructions: 'Assess the company using bounded evidence.',
    company: { id: 42, name: 'Acme' },
  },
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
    const body: unknown = JSON.parse(String(init?.body));
    expect(body).toEqual({
      task: 'Assess the company using bounded evidence.',
      context: submitInput,
    });
    expect(body).not.toHaveProperty('input');
    expect(body).not.toHaveProperty('idempotencyKey');
    expect(registerJob).toHaveBeenCalledWith({
      job: { jobId: 'job-123', status: 'queued', requestId: 'req-123' },
      idempotencyKey: 'idempotency-123',
    });
  });

  it('includes the caller-provided spec_id in the outgoing JSON body when specId is supplied', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({ job_id: 'job-search-1', status: 'queued', request_id: 'req-search-1' }, 202),
    );
    const registerJob = vi.fn().mockResolvedValue({ ok: true, mappingId: 1 });
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
      registerJob,
    });

    await client.submit({
      idempotencyKey: 'search-idempotency-1',
      input: submitInput,
      specId: '6f9b69d738a24462b620a3c38968985b',
    });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const body: unknown = JSON.parse(String(init?.body));
    expect(body).toEqual({
      task: 'Assess the company using bounded evidence.',
      context: submitInput,
      spec_id: '6f9b69d738a24462b620a3c38968985b',
    });
  });

  it('sends the Analyze deployment spec_id in the outgoing JSON body, excluding the Search spec_id', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({ job_id: 'job-analyze-1', status: 'queued', request_id: 'req-analyze-1' }, 202),
    );
    const registerJob = vi.fn().mockResolvedValue({ ok: true, mappingId: 1 });
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
      registerJob,
    });

    await client.submit({
      idempotencyKey: 'analyze-idempotency-1',
      input: submitInput,
      specId: '0893dfc5232945f2872fc40ea38146c0',
    });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const body: unknown = JSON.parse(String(init?.body));
    expect(body).toEqual({
      task: 'Assess the company using bounded evidence.',
      context: submitInput,
      spec_id: '0893dfc5232945f2872fc40ea38146c0',
    });
  });

  it('accepts an HTTP 200 running acknowledgement when partner identities are present', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({ job_id: 'job-running', status: 'running', request_id: 'req-running' }),
    );
    const registerJob = vi.fn().mockResolvedValue({ ok: true, mappingId: 1 });
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
      registerJob,
    });

    await expect(client.submit({ idempotencyKey: 'idempotency-running', input: submitInput })).resolves.toEqual({
      ok: true,
      value: { jobId: 'job-running', status: 'running', requestId: 'req-running' },
    });
  });

  it('rejects a status-only HTTP 200 running acknowledgement as a malformed partner response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ status: 'running' }));
    const registerJob = vi.fn();
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
      registerJob,
    });

    await expect(client.submit({ idempotencyKey: 'idempotency-malformed', input: submitInput })).resolves.toEqual({
      ok: false,
      kind: 'invalid_response',
      status: 200,
    });
    expect(registerJob).not.toHaveBeenCalled();
  });

  it('maps a partner validation response to a safe HTTP error without persisting a mapping', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ detail: 'invalid task' }, 422));
    const registerJob = vi.fn();
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
      registerJob,
    });

    await expect(client.submit({ idempotencyKey: 'idempotency-123', input: submitInput })).resolves.toEqual({
      ok: false,
      kind: 'http_error',
      status: 422,
    });
    expect(registerJob).not.toHaveBeenCalled();
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
