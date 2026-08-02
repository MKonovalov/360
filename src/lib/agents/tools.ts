import { tool } from 'ai';
import { z } from 'zod';
import { Firecrawl } from 'firecrawl';
import { env } from '@/lib/env';

// Lazy Firecrawl client. DIVERGES from the arcpedia.ts silent-`[]` envelope
// (D-06/Pitfall 5): an unset key is a misconfiguration and must fail loud —
// the Analyze action surfaces "not configured" instead of silently returning
// empty search results.
let client: Firecrawl | null = null;
function getFirecrawl(): Firecrawl {
  if (!env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }
  client ??= new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });
  return client;
}

// webSearchTool — the agent's only tool (T-09-02: fetched content enters ONLY
// as tool-call results). Firecrawl v4 returns a union of SearchResultWeb |
// Document in `res.web`; both shapes map to the { url, title, snippet } triple
// the D-02 appendix and the citation gate consume. Tool errors surface to the
// AI SDK tool loop (do NOT swallow).
export const webSearchTool = tool({
  description:
    'Search the public web for evidence of buying-intent signals about a company. Returns up to 5 ranked results with URL, title and snippet.',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const res = await getFirecrawl().search(query, { limit: 5 });
    return (res.web ?? []).map(
      (r): { url: string; title: string; snippet: string } => {
        if ('url' in r) {
          return { url: r.url, title: r.title ?? '', snippet: r.description ?? '' };
        }
        return {
          url: r.metadata?.url ?? '',
          title: r.metadata?.title ?? r.summary ?? '',
          snippet: r.summary ?? '',
        };
      },
    );
  },
});
