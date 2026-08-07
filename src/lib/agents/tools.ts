import { tool } from 'ai';
import { z } from 'zod';
import { Firecrawl } from 'firecrawl';
import { env } from '@/lib/env';

export const WEB_SEARCH_LIMITS = Object.freeze({
  maxQueryLength: 400,
  maxResults: 5,
  maxTitleLength: 500,
  maxSnippetLength: 8_000,
  timeoutMs: 15_000,
});

export interface FirecrawlClient {
  search(query: string, options: { limit: number }): Promise<unknown>;
  scrape(url: string, options: { formats: ['markdown']; timeout: number }): Promise<unknown>;
}

// Lazy Firecrawl client. DIVERGES from the arcpedia.ts silent-`[]` envelope
// (D-06/Pitfall 5): an unset key is a misconfiguration and must fail loud —
// the Analyze action surfaces "not configured" instead of silently returning
// empty search results.
let client: Firecrawl | null = null;
export function getFirecrawlClient(): Firecrawl {
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
  inputSchema: z.object({
    query: z
      .string()
      .trim()
      .min(1)
      .max(WEB_SEARCH_LIMITS.maxQueryLength)
      .refine(
        (value) => !/(?:ignore\s+(?:all\s+)?previous|system\s+message|reveal\s+(?:the\s+)?(?:secret|token|api[_ -]?key))/i.test(value),
        'unsafe_search_query',
      ),
  }),
  execute: async ({ query }) => {
    const response = await withTimeout(
      getFirecrawlClient().search(query, { limit: WEB_SEARCH_LIMITS.maxResults }),
      WEB_SEARCH_LIMITS.timeoutMs,
    );
    const web = readWebResults(response);
    return web.map((result) => normalizeSearchResult(result));
  },
});

function readWebResults(response: unknown): readonly unknown[] {
  if (!response || typeof response !== 'object' || !('web' in response)) throw new Error('invalid_firecrawl_response');
  const web = response.web;
  if (!Array.isArray(web) || web.length > WEB_SEARCH_LIMITS.maxResults) throw new Error('invalid_firecrawl_response');
  return web;
}

function normalizeSearchResult(result: unknown): { url: string; title: string; snippet: string } {
  const candidate = z.record(z.string(), z.unknown()).safeParse(result);
  if (!candidate.success) throw new Error('invalid_firecrawl_result');
  const allowedKeys = new Set(['url', 'title', 'description', 'summary', 'metadata']);
  if (Object.keys(candidate.data).some((key) => !allowedKeys.has(key))) throw new Error('invalid_firecrawl_result');
  const metadata = z.record(z.string(), z.unknown()).safeParse(candidate.data.metadata);
  const metadataRecord = metadata.success ? metadata.data : {};
  const url = typeof candidate.data.url === 'string' ? candidate.data.url : metadataRecord.url;
  const title = typeof candidate.data.title === 'string' ? candidate.data.title : metadataRecord.title;
  const snippet = typeof candidate.data.description === 'string' ? candidate.data.description : candidate.data.summary;
  if (typeof url !== 'string' || typeof title !== 'string' || typeof snippet !== 'string') throw new Error('invalid_firecrawl_result');
  if (!isSafePublicHttpsUrl(url)) throw new Error('unsupported_source');
  if (title.length > WEB_SEARCH_LIMITS.maxTitleLength || snippet.length > WEB_SEARCH_LIMITS.maxSnippetLength) throw new Error('invalid_firecrawl_result');
  return { url, title, snippet };
}

function isSafePublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hash === '' && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && !hostname.endsWith('.local') && !hostname.endsWith('.internal');
  } catch {
    return false;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('firecrawl_timeout'), { name: 'TimeoutError' })), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
