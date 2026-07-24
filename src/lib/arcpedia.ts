import { z } from 'zod';
import { env } from '@/lib/env';

export interface ArcpediaArticle {
  slug: string;
  title: string;
  snippet: string;
}

const ARCPEDIA_BASE_URL = env.ARCPEDIA_BASE_URL ?? 'https://arcpedia.arclumen.de';

const arcpediaSearchResponseSchema = z.object({
  results: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      snippet: z.string(),
    })
  ),
});

// Read-only keyword search against Arcpedia (ARCP-02: GET only, never a
// mutating method). Never throws — any failure (network, timeout, the
// Cloudflare Access login page instead of JSON, or an unexpected response
// shape) degrades to an empty array so the caller can treat "no articles"
// and "couldn't reach Arcpedia" identically, per D-10/D-12.
export async function fetchArcpediaArticles(entityName: string): Promise<ArcpediaArticle[]> {
  // No Access Service Token configured yet (Plan 02 provisions it) — skip
  // the network round-trip entirely rather than making a call guaranteed
  // to hit the Cloudflare Access wall.
  if (!env.ARCPEDIA_ACCESS_CLIENT_ID || !env.ARCPEDIA_ACCESS_CLIENT_SECRET) {
    return [];
  }

  try {
    const url = `${ARCPEDIA_BASE_URL}/api/wiki/search?q=${encodeURIComponent(entityName)}`;
    const res = await fetch(url, {
      cache: 'no-store', // D-04: no caching layer, matches every other query in this app
      signal: AbortSignal.timeout(5000), // bound worst-case detail-pane render time
      headers: {
        'CF-Access-Client-Id': env.ARCPEDIA_ACCESS_CLIENT_ID,
        'CF-Access-Client-Secret': env.ARCPEDIA_ACCESS_CLIENT_SECRET,
      },
    });

    if (!res.ok) {
      return [];
    }

    // Throws SyntaxError if Cloudflare Access served an HTML login page
    // instead of JSON — caught below, degrading to the desired empty state.
    const data = await res.json();
    const parsed = arcpediaSearchResponseSchema.safeParse(data);
    if (!parsed.success) {
      return [];
    }

    return parsed.data.results.slice(0, 3); // D-08 cap (Arcpedia's own default maxResults is 10)
  } catch {
    // D-10/V8: never log the caught error — could leak the CF-Access
    // secret or response body into a server log.
    return [];
  }
}
