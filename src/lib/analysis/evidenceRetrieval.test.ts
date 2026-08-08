import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getFirecrawlClient: vi.fn() }));

vi.mock('@/lib/agents/tools', () => ({
  getFirecrawlClient: mocks.getFirecrawlClient,
  WEB_SEARCH_LIMITS: { timeoutMs: 15_000 },
}));

import {
  createServerOwnedSearchResultSet,
  FirecrawlRetrievalError,
  retrieveFirecrawlPage,
} from './evidenceRetrieval';

describe('retrieveFirecrawlPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retrieves only a canonical URL present in the server-owned search set', async () => {
    const client = {
      search: vi.fn(),
      scrape: vi.fn().mockResolvedValue({ markdown: 'Evidence from the public page.' }),
    };
    const searchResults = createServerOwnedSearchResultSet(['https://Example.com/results/']);

    const page = await retrieveFirecrawlPage({
      url: 'https://example.com/results',
      searchResults,
      client,
    });

    expect(page).toMatchObject({ url: 'https://example.com/results', excerpt: 'Evidence from the public page.' });
    expect(client.scrape).toHaveBeenCalledWith('https://example.com/results', { formats: ['markdown'], timeout: 15_000 });
  });

  it('rejects arbitrary, private, and malformed URLs before Firecrawl', async () => {
    const client = { search: vi.fn(), scrape: vi.fn() };
    const searchResults = createServerOwnedSearchResultSet(['https://example.com/results']);

    await expect(retrieveFirecrawlPage({ url: 'https://example.com/other', searchResults, client })).rejects.toMatchObject({ reason: 'result_not_owned' });
    await expect(retrieveFirecrawlPage({ url: 'http://127.0.0.1/results', searchResults, client })).rejects.toMatchObject({ reason: 'unsupported_source' });
    expect(client.scrape).not.toHaveBeenCalled();
  });

  it('maps malformed Firecrawl output without exposing the provider error', async () => {
    const client = {
      search: vi.fn(),
      scrape: vi.fn().mockResolvedValue({ markdown: 42, rawError: 'secret' }),
    };
    const searchResults = createServerOwnedSearchResultSet(['https://example.com/results']);

    await expect(retrieveFirecrawlPage({ url: 'https://example.com/results', searchResults, client })).rejects.toEqual(
      new FirecrawlRetrievalError('invalid_page'),
    );
  });

  it('bounds returned markdown and excerpt size', async () => {
    const markdown = 'x'.repeat(200_000);
    const client = { search: vi.fn(), scrape: vi.fn().mockResolvedValue({ markdown }) };
    const searchResults = createServerOwnedSearchResultSet(['https://example.com/results']);

    const page = await retrieveFirecrawlPage({ url: 'https://example.com/results', searchResults, client });

    expect(page.markdown).toHaveLength(200_000);
    expect(page.excerpt).toHaveLength(8_000);
  });
});
