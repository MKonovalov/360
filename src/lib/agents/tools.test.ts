import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  firecrawlClient: { search: vi.fn() },
}));

vi.mock('@/lib/env', () => ({ env: { FIRECRAWL_API_KEY: 'test-key' } }));
vi.mock('firecrawl', () => ({ Firecrawl: vi.fn(function Firecrawl() { return mocks.firecrawlClient; }) }));

import { createGroundedWebSearchTool } from './tools';

const context = { toolCallId: 'test', messages: [], context: {} };
const searchResult = { web: [{ url: 'https://example.com', title: 'Example', description: 'Evidence' }] };

describe('createGroundedWebSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.firecrawlClient.search.mockResolvedValue(searchResult);
  });

  it('caches one resolved external search promise per signal', async () => {
    const groundedSearch = createGroundedWebSearchTool([1]);

    const first = await groundedSearch.tool.execute({ signalId: 1, query: 'first query' }, context);
    const second = await groundedSearch.tool.execute({ signalId: 1, query: 'fallback query' }, context);

    expect(second).toEqual(first);
    expect(mocks.firecrawlClient.search).toHaveBeenCalledTimes(1);
    expect(groundedSearch.externalToolCallCount).toBe(1);
  });

  it('caches rejected promises so a fallback cannot retry externally', async () => {
    const rejection = new Error('firecrawl unavailable');
    mocks.firecrawlClient.search.mockRejectedValueOnce(rejection);
    const groundedSearch = createGroundedWebSearchTool([1]);

    const first = groundedSearch.tool.execute({ signalId: 1, query: 'first query' }, context);
    const second = groundedSearch.tool.execute({ signalId: 1, query: 'fallback query' }, context);

    await expect(first).rejects.toBe(rejection);
    await expect(second).rejects.toBe(rejection);
    expect(mocks.firecrawlClient.search).toHaveBeenCalledTimes(1);
    expect(groundedSearch.externalToolCallCount).toBe(1);
    expect(groundedSearch.isComplete()).toBe(false);
  });

  it('rejects omitted and unknown signal IDs without an external call', async () => {
    const groundedSearch = createGroundedWebSearchTool([1]);

    await expect(Reflect.apply(groundedSearch.tool.execute, groundedSearch.tool, [{ query: 'missing signal' }, context])).rejects.toThrow('invalid_grounded_search_input');
    await expect(groundedSearch.tool.execute({ signalId: 99, query: 'unknown signal' }, context)).rejects.toThrow('unknown_grounded_signal');

    expect(mocks.firecrawlClient.search).not.toHaveBeenCalled();
    expect(groundedSearch.hasPolicyViolation).toBe(true);
  });

  it('fails safely on the seventh distinct signal and reports six external calls', async () => {
    const groundedSearch = createGroundedWebSearchTool([1, 2, 3, 4, 5, 6, 7]);

    for (const signalId of [1, 2, 3, 4, 5, 6]) {
      await groundedSearch.tool.execute({ signalId, query: `signal ${signalId}` }, context);
    }

    await expect(groundedSearch.tool.execute({ signalId: 7, query: 'signal 7' }, context)).rejects.toThrow('grounded_external_tool_call_limit');
    expect(mocks.firecrawlClient.search).toHaveBeenCalledTimes(6);
    expect(groundedSearch.externalToolCallCount).toBe(6);
    expect(groundedSearch.hasPolicyViolation).toBe(true);
    expect(groundedSearch.isComplete()).toBe(false);
  });
});
