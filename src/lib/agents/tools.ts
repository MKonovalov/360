import { tool, type FlexibleSchema } from 'ai';
import { z } from 'zod';
import { Firecrawl } from 'firecrawl';
import { env } from '@/lib/env';

export const WEB_SEARCH_LIMITS = Object.freeze({
  maxQueryLength: 400,
  maxResults: 3,
  maxTitleLength: 500,
  maxSnippetLength: 8_000,
  timeoutMs: 15_000,
});

export const GROUNDED_SEARCH_LIMITS = Object.freeze({
  maxExternalToolCalls: 6,
});

export const SUBMIT_GROUNDED_REPORT_TOOL_NAME = 'submit_grounded_report' as const;

const searchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(WEB_SEARCH_LIMITS.maxQueryLength)
  .refine(
    (value) => !/(?:ignore\s+(?:all\s+)?previous|system\s+message|reveal\s+(?:the\s+)?(?:secret|token|api[_ -]?key))/i.test(value),
    'unsafe_search_query',
  );
const legacySearchInputSchema = z.object({ query: searchQuerySchema });

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

async function executeWebSearch(query: string): Promise<readonly { url: string; title: string; snippet: string }[]> {
  const response = await withTimeout(
    getFirecrawlClient().search(query, { limit: WEB_SEARCH_LIMITS.maxResults }),
    WEB_SEARCH_LIMITS.timeoutMs,
  );
  const web = readWebResults(response);
  return web.map((result) => normalizeSearchResult(result));
}

// webSearchTool — the agent's only tool (T-09-02: fetched content enters ONLY
// as tool-call results). Firecrawl v4 returns a union of SearchResultWeb |
// Document in `res.web`; known fields from both shapes map to the { url, title,
// snippet } triple the D-02 appendix and citation gate consume. Tool errors
// surface to the AI SDK tool loop (do NOT swallow).
export const webSearchTool = tool({
  description:
    'Search the public web for evidence of buying-intent signals about a company. Returns up to 3 ranked results with URL, title and snippet.',
  inputSchema: legacySearchInputSchema,
  execute: async (input) => executeWebSearch(legacySearchInputSchema.parse(input).query),
});

const groundedSearchInputSchema = z
  .object({
    signalId: z.number().int().positive(),
    query: searchQuerySchema,
  })
  .strict();

export function createGroundedWebSearchTool(allowedSignalIds: readonly number[]) {
  const allowed = new Set(allowedSignalIds);
  const cachedSearches = new Map<number, Promise<readonly { url: string; title: string; snippet: string }[]>>();
  const searchedSignalIds = new Set<number>();
  let externalToolCallCount = 0;
  let hasPolicyViolation = false;

  const groundedTool = tool({
    description:
      'Search the public web for evidence for one allowed buying-intent signal. Provide the signal ID and a focused query.',
    inputSchema: groundedSearchInputSchema,
    execute: async (input) => {
      const parsed = groundedSearchInputSchema.safeParse(input);
      if (!parsed.success) {
        hasPolicyViolation = true;
        throw new Error('invalid_grounded_search_input');
      }
      if (!allowed.has(parsed.data.signalId)) {
        hasPolicyViolation = true;
        throw new Error('unknown_grounded_signal');
      }

      const cached = cachedSearches.get(parsed.data.signalId);
      if (cached) {
        const results = await cached;
        searchedSignalIds.add(parsed.data.signalId);
        return results;
      }

      if (externalToolCallCount >= GROUNDED_SEARCH_LIMITS.maxExternalToolCalls) {
        hasPolicyViolation = true;
        throw new Error('grounded_external_tool_call_limit');
      }

      externalToolCallCount += 1;
      const search = Promise.resolve()
        .then(() => executeWebSearch(parsed.data.query))
        .then((results) => {
          searchedSignalIds.add(parsed.data.signalId);
          return results;
        });
      cachedSearches.set(parsed.data.signalId, search);
      return search;
    },
  });

  return {
    tool: groundedTool,
    get externalToolCallCount() {
      return externalToolCallCount;
    },
    get searchedSignalIds() {
      return [...searchedSignalIds];
    },
    get hasPolicyViolation() {
      return hasPolicyViolation;
    },
    startAttempt() {
      searchedSignalIds.clear();
    },
    isComplete() {
      return [...allowed].every((signalId) => searchedSignalIds.has(signalId));
    },
  };
}

export type GroundedWebSearchTool = ReturnType<typeof createGroundedWebSearchTool>['tool'];

export function createSubmitGroundedReportTool(inputSchema: FlexibleSchema) {
  return tool({
    description: 'Submit the final grounded analysis report after all required searches are complete.',
    inputSchema,
    execute: async () => ({ submitted: true as const }),
  });
}

function readWebResults(response: unknown): readonly unknown[] {
  if (!response || typeof response !== 'object' || !('web' in response)) throw new Error('invalid_firecrawl_response');
  const web = response.web;
  if (!Array.isArray(web) || web.length > WEB_SEARCH_LIMITS.maxResults) throw new Error('invalid_firecrawl_response');
  return web;
}

export function normalizeSearchResult(result: unknown): { url: string; title: string; snippet: string } {
  const candidate = z.record(z.string(), z.unknown()).safeParse(result);
  if (!candidate.success) throw new Error('invalid_firecrawl_result');
  const metadata = z.record(z.string(), z.unknown()).safeParse(candidate.data.metadata);
  const metadataRecord = metadata.success ? metadata.data : {};
  const url = typeof candidate.data.url === 'string' ? candidate.data.url : metadataRecord.url;
  const title = typeof candidate.data.title === 'string' ? candidate.data.title : metadataRecord.title;
  const rawSnippet =
    typeof candidate.data.description === 'string'
      ? candidate.data.description
      : typeof candidate.data.summary === 'string'
        ? candidate.data.summary
        : candidate.data.markdown;
  if (typeof url !== 'string' || typeof title !== 'string' || typeof rawSnippet !== 'string') throw new Error('invalid_firecrawl_result');
  if (!isSafePublicHttpsUrl(url)) throw new Error('unsupported_source');
  if (title.length > WEB_SEARCH_LIMITS.maxTitleLength) throw new Error('invalid_firecrawl_result');
  const snippet = rawSnippet.slice(0, WEB_SEARCH_LIMITS.maxSnippetLength);
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
