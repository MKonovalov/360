import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??= 'pk_test_placeholder';
  process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';
});

import { WEB_SEARCH_LIMITS, normalizeSearchResult } from './tools';

describe('normalizeSearchResult', () => {
  it('normalizes a real SearchResultWeb shape', () => {
    const result = normalizeSearchResult({
      url: 'https://example.com/result',
      title: 'Example result',
      description: 'A useful result description.',
      position: 1,
    });

    expect(result).toEqual({
      url: 'https://example.com/result',
      title: 'Example result',
      snippet: 'A useful result description.',
    });
  });

  it('accepts a SearchResultWeb category key', () => {
    expect(
      normalizeSearchResult({
        url: 'https://example.com/result',
        title: 'Example result',
        description: 'Description',
        position: 1,
        category: 'news',
      }),
    ).toEqual({
      url: 'https://example.com/result',
      title: 'Example result',
      snippet: 'Description',
    });
  });

  it('normalizes and truncates a Document markdown body', () => {
    const markdown = 'm'.repeat(WEB_SEARCH_LIMITS.maxSnippetLength + 1);

    const result = normalizeSearchResult({
      url: 'https://example.com/document',
      markdown,
      metadata: { title: 'Document title' },
      extra: { source: 'firecrawl' },
    });

    expect(result).toEqual({
      url: 'https://example.com/document',
      title: 'Document title',
      snippet: markdown.slice(0, WEB_SEARCH_LIMITS.maxSnippetLength),
    });
  });

  it('uses summary as the legacy snippet fallback', () => {
    expect(
      normalizeSearchResult({
        url: 'https://example.com/legacy',
        title: 'Legacy result',
        summary: 'Legacy summary',
      }).snippet,
    ).toBe('Legacy summary');
  });

  it('uses metadata URL and title fallbacks', () => {
    expect(
      normalizeSearchResult({
        metadata: {
          url: 'https://example.com/metadata',
          title: 'Metadata result',
        },
        description: 'Metadata description',
      }),
    ).toEqual({
      url: 'https://example.com/metadata',
      title: 'Metadata result',
      snippet: 'Metadata description',
    });
  });

  it.each([
    ['missing URL', { title: 'Result', description: 'Description' }, 'invalid_firecrawl_result'],
    ['HTTP URL', { url: 'http://example.com', title: 'Result', description: 'Description' }, 'unsupported_source'],
    ['localhost URL', { url: 'https://localhost/result', title: 'Result', description: 'Description' }, 'unsupported_source'],
  ])('rejects %s', (_label, input, errorMessage) => {
    expect(() => normalizeSearchResult(input)).toThrow(errorMessage);
  });

  it('rejects non-object input', () => {
    expect(() => normalizeSearchResult('not an object')).toThrow('invalid_firecrawl_result');
  });

  it('rejects titles over the maximum length', () => {
    expect(() =>
      normalizeSearchResult({
        url: 'https://example.com/result',
        title: 't'.repeat(WEB_SEARCH_LIMITS.maxTitleLength + 1),
        description: 'Description',
      }),
    ).toThrow('invalid_firecrawl_result');
  });
});
