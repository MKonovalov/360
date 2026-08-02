import { z } from 'zod';
import { env } from '@/lib/env';
import { normalizeDomain } from '@/lib/import/dedupKeys';
import { apolloMapCompany, type EnrichedField } from './apolloMap';

// The first PAID, write-adjacent external integration in this codebase.
//
// Deliberately DIVERGES from arcpedia.ts's "any failure → [] / never log" shape
// (Pitfall 5): a paid call that silently fails must be distinguishable from a
// genuine no-match, and enrichment responses contain real PII (never log bodies).
//
//  - Returns a DISCRIMINATED result — never throws, never returns [].
//  - HTTP 200 alone is NOT success: Apollo returns 200 with no matched object
//    when it can't identify the record (08-RESEARCH critical gotcha). We inspect
//    the payload (.organization) before declaring ok.
//  - Logs call METADATA only (kind, ok, http status) — never the response body,
//    never the caught error object, never PII fields.

export type EnrichmentResult =
  | { ok: true; fields: EnrichedField[] }
  | { ok: false; reason: string };

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

// Permissive schemas: every mapped field is optional/passthrough so an
// unexpected or renamed vendor field degrades to "not enriched for that column"
// rather than a parse crash (08-RESEARCH watch-item 1).
const orgResponseSchema = z
  .object({ organization: z.record(z.string(), z.unknown()).nullable().optional() })
  .passthrough();

function logMeta(kind: 'organization' | 'person', ok: boolean, status: number | null) {
  // Metadata only — deliberate departure from Arcpedia's "log nothing" (Pitfall 5).
  console.info(JSON.stringify({ event: 'enrichment_call', kind, ok, status }));
}

async function parseJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false };
  }
}

export async function enrichOrganization(domain: string): Promise<EnrichmentResult> {
  if (!env.APOLLO_API_KEY) return { ok: false, reason: 'not_configured' };
  const normalized = normalizeDomain(domain);
  if (!normalized) return { ok: false, reason: 'no_match_key' };

  try {
    const res = await fetch(
      `${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(normalized)}`,
      {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
        headers: {
          'X-Api-Key': env.APOLLO_API_KEY,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      }
    );

    if (!res.ok) {
      logMeta('organization', false, res.status);
      return { ok: false, reason: `http_${res.status}` };
    }

    const body = await parseJson(res);
    if (!body.ok) {
      logMeta('organization', false, res.status);
      return { ok: false, reason: 'invalid_response' };
    }
    const parsed = orgResponseSchema.safeParse(body.value);
    if (!parsed.success) {
      logMeta('organization', false, res.status);
      return { ok: false, reason: 'invalid_response' };
    }
    const org = parsed.data.organization;
    if (!org) {
      logMeta('organization', false, res.status);
      return { ok: false, reason: 'no_match' };
    }

    const fields = apolloMapCompany(org);
    if (fields.length === 0) {
      logMeta('organization', false, res.status);
      return { ok: false, reason: 'no_match' };
    }
    logMeta('organization', true, res.status);
    return { ok: true, fields };
  } catch {
    // Never log the caught error — could contain the API key or a PII body.
    logMeta('organization', false, null);
    return { ok: false, reason: 'network' };
  }
}
