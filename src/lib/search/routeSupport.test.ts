import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { MAX_SEARCH_REQUEST_BYTES, readJsonBody } from './routeSupport';

function streamRequest(chunks: readonly string[]): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  const init = Object.assign({
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  }, { duplex: 'half' as const });
  return new Request('http://localhost/api/search-runs', init);
}

describe('readJsonBody', () => {
  it('parses a valid request from a chunked body without Content-Length', async () => {
    await expect(readJsonBody(streamRequest(['{"subject":', '{"type":"company","id":42}}']))).resolves.toEqual({
      ok: true,
      body: { subject: { type: 'company', id: 42 } },
    });
  });

  it('rejects a body larger than the byte budget before JSON parsing', async () => {
    const oversized = JSON.stringify({ payload: 'x'.repeat(MAX_SEARCH_REQUEST_BYTES) });

    await expect(readJsonBody(new Request('http://localhost/api/search-runs', {
      method: 'POST',
      body: oversized,
      headers: { 'content-type': 'application/json' },
    }))).resolves.toEqual({ ok: false, reason: 'request_too_large' });
  });

  it('rejects an oversized chunked body without retaining unbounded input', async () => {
    const oversizedChunk = 'x'.repeat(MAX_SEARCH_REQUEST_BYTES);

    await expect(readJsonBody(streamRequest(['{"payload":"', oversizedChunk, '"}']))).resolves.toEqual({
      ok: false,
      reason: 'request_too_large',
    });
  });
});
