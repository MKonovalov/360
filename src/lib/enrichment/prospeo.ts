import { z } from 'zod';
import { env } from '@/lib/env';
import { normalizeEmail } from '@/lib/import/dedupKeys';
import { prospeoMapPersona } from './prospeoMap';
import type { EnrichmentResult } from './apollo';

// Prospeo person enrichment — the persona counterpart to apollo.ts's
// enrichOrganization. Apollo's people/match endpoint requires a paid plan
// scope (people_match) not available on the free tier, so persona enrichment
// routes here; company enrichment stays on Apollo (08-06-UAT.md remediation).
//
// Same failure contract as apollo.ts: a DISCRIMINATED result, never throws,
// HTTP 200 alone is NOT success, and logs carry METADATA only (kind/ok/status)
// — never response bodies, never PII. Prospeo signals no-match with HTTP 400
// + `{"error": true, "error_code": "NO_MATCH"}`; error envelopes carry no PII
// so error_code is safe to read on non-2xx responses.

const PROSPEO_BASE = 'https://api.prospeo.io';

// Permissive schema: person is optional/passthrough so an unexpected or
// renamed vendor field degrades to "not enriched", never a parse crash.
const personResponseSchema = z
  .object({
    error: z.boolean().optional(),
    person: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

async function readErrorCode(response: Response): Promise<string | undefined> {
  const body = await parseJson(response);
  if (!body.ok) return undefined;
  const raw = body.value as Record<string, unknown>;
  return typeof raw?.error_code === 'string' ? raw.error_code : undefined;
}

function logMeta(kind: 'organization' | 'person', ok: boolean, status: number | null) {
  console.info(JSON.stringify({ event: 'enrichment_call', kind, ok, status }));
}

async function parseJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false };
  }
}

export async function enrichPerson(email: string): Promise<EnrichmentResult> {
  if (!env.PROSPEO_API_KEY) return { ok: false, reason: 'not_configured' };
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: 'no_match_key' };

  try {
    const res = await fetch(`${PROSPEO_BASE}/enrich-person`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: {
        'X-KEY': env.PROSPEO_API_KEY,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ data: { email: normalized } }),
    });

    if (!res.ok) {
      if ((await readErrorCode(res)) === 'NO_MATCH') {
        logMeta('person', false, res.status);
        return { ok: false, reason: 'no_match' };
      }
      logMeta('person', false, res.status);
      return { ok: false, reason: `http_${res.status}` };
    }

    const body = await parseJson(res);
    if (!body.ok) {
      logMeta('person', false, res.status);
      return { ok: false, reason: 'invalid_response' };
    }
    const parsed = personResponseSchema.safeParse(body.value);
    if (!parsed.success) {
      logMeta('person', false, res.status);
      return { ok: false, reason: 'invalid_response' };
    }
    // Prospeo flags no-result with error:true ("you won't be charged if no
    // results are found") — same no_match semantics as Apollo's empty envelope.
    if (parsed.data.error) {
      logMeta('person', false, res.status);
      return { ok: false, reason: 'no_match' };
    }
    const person = parsed.data.person;
    if (!person) {
      logMeta('person', false, res.status);
      return { ok: false, reason: 'no_match' };
    }

    const fields = prospeoMapPersona(person);
    if (fields.length === 0) {
      logMeta('person', false, res.status);
      return { ok: false, reason: 'no_match' };
    }
    logMeta('person', true, res.status);
    return { ok: true, fields };
  } catch {
    logMeta('person', false, null);
    return { ok: false, reason: 'network' };
  }
}
