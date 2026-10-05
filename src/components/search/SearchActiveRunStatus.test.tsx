import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/search/searchClient', () => ({ pollSearchRun: vi.fn(() => new Promise(() => undefined)) }));

import { SearchActiveRunStatus } from './SearchActiveRunStatus';

describe('SearchActiveRunStatus', () => {
  it('renders the in-flight run status without needing the launcher dialog', () => {
    const markup = renderToStaticMarkup(
      <SearchActiveRunStatus
        run={{
          schemaVersion: 1,
          searchRunId: 35,
          status: 'running',
          company: { id: 125, name: 'RadiciGroup', domain: null },
          template: { id: 1, versionId: 2, version: 2, name: 'Company Buying Signal Search' },
          candidateCounts: { total: 0, pending: 0, inconclusive: 0, ambiguous: 0, approved: 0, rejected: 0 },
          reviewsUrl: null,
        } as never}
      />,
    );

    expect(markup).toContain('Search is running');
    expect(markup).toContain('RadiciGroup');
  });
});
