import { z } from 'zod';

import { getFirecrawlClient, type FirecrawlClient, WEB_SEARCH_LIMITS } from '@/lib/agents/tools';

const MAX_PAGE_BYTES = 200_000;
const MAX_PAGE_EXCERPT_BYTES = 8_000;

const canonicalUrlSchema = z.string().url().max(2_048).refine((value) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hash === '' && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && !hostname.endsWith('.local') && !hostname.endsWith('.internal');
  } catch {
    return false;
  }
}, 'unsupported_source');

const pageResponseSchema = z.object({
  markdown: z.string().min(1).max(MAX_PAGE_BYTES),
}).strict();

type SearchResultSetState = Readonly<{
  readonly urls: ReadonlySet<string>;
}>;

const ownedSearchResults = new WeakMap<object, SearchResultSetState>();

export type ServerOwnedSearchResultSet = Readonly<{ readonly token: object }>;

export type FirecrawlPageResult = Readonly<{
  readonly url: string;
  readonly markdown: string;
  readonly excerpt: string;
  readonly retrievedAt: string;
}>;

export type FirecrawlRetrievalFailure = 'result_not_owned' | 'unsupported_source' | 'invalid_page' | 'timeout' | 'firecrawl_unavailable';

export class FirecrawlRetrievalError extends Error {
  readonly name = 'FirecrawlRetrievalError';

  constructor(readonly reason: FirecrawlRetrievalFailure) {
    super(reason);
  }
}

export function createServerOwnedSearchResultSet(urls: readonly string[]): ServerOwnedSearchResultSet {
  const token = Object.freeze({});
  const canonicalUrls = new Set(urls.map((url) => canonicalizeOwnedUrl(canonicalUrlSchema.parse(url))));
  ownedSearchResults.set(token, { urls: canonicalUrls });
  return Object.freeze({ token });
}

export async function retrieveFirecrawlPage(input: Readonly<{
  readonly url: string;
  readonly searchResults: ServerOwnedSearchResultSet;
  readonly client?: FirecrawlClient;
}>): Promise<FirecrawlPageResult> {
  const parsedUrl = canonicalUrlSchema.safeParse(input.url);
  if (!parsedUrl.success) throw new FirecrawlRetrievalError('unsupported_source');
  const canonicalUrl = canonicalizeOwnedUrl(parsedUrl.data);
  const state = ownedSearchResults.get(input.searchResults.token);
  if (!state?.urls.has(canonicalUrl)) throw new FirecrawlRetrievalError('result_not_owned');
  try {
    const response = await withTimeout(
      (input.client ?? getFirecrawlClient()).scrape(canonicalUrl, { formats: ['markdown'], timeout: WEB_SEARCH_LIMITS.timeoutMs }),
      WEB_SEARCH_LIMITS.timeoutMs,
    );
    const page = pageResponseSchema.safeParse(response);
    if (!page.success) throw new FirecrawlRetrievalError('invalid_page');
    if (Buffer.byteLength(page.data.markdown, 'utf8') > MAX_PAGE_BYTES) throw new FirecrawlRetrievalError('invalid_page');
    const excerpt = page.data.markdown.slice(0, MAX_PAGE_EXCERPT_BYTES);
    return Object.freeze({ url: canonicalUrl, markdown: page.data.markdown, excerpt, retrievedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof FirecrawlRetrievalError) throw error;
    throw new FirecrawlRetrievalError(/api key|not configured/i.test(error instanceof Error ? error.message : '') ? 'firecrawl_unavailable' : 'invalid_page');
  }
}

function canonicalizeOwnedUrl(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  if (url.port === '443') url.port = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FirecrawlRetrievalError('timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
