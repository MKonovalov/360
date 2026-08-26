import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SearchStatusProjection } from '@/lib/search/contracts';

import { SearchRunStatus, searchRunStatusCopy } from './SearchRunStatus';

function projection(
  status: SearchStatusProjection['status'],
  total = 0,
): SearchStatusProjection {
  return {
    searchRunId: 73,
    status,
    company: { id: 42, name: 'Acme', domain: 'acme.example' },
    template: { id: 5, versionId: 11, name: 'GBS Scout', version: 2 },
    candidateCounts: {
      total,
      pending: total,
      inconclusive: 0,
      ambiguous: 0,
      approved: 0,
      rejected: 0,
    },
    reviewsUrl: total > 0 ? '/reviews?searchRunId=73' : null,
  };
}

describe('SearchRunStatus', () => {
  it('provides safe copy for every Search lifecycle state', () => {
    expect(searchRunStatusCopy('queued')).toContain('queued');
    expect(searchRunStatusCopy('running')).toContain('running');
    expect(searchRunStatusCopy('succeeded')).toContain('completed');
    expect(searchRunStatusCopy('failed')).toContain('failed');
    expect(searchRunStatusCopy('cancelled')).toContain('cancelled');
  });

  it('renders only the safe Company, template, and candidate projection', () => {
    const html = renderToStaticMarkup(<SearchRunStatus projection={projection('running', 3)} />);

    expect(html).toContain('Acme');
    expect(html).toContain('acme.example');
    expect(html).toContain('GBS Scout');
    expect(html).toContain('Run ID');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('sm:grid-cols-3');
    expect(html).toContain('3');
    expect(html).not.toContain('resolvedInstructions');
    expect(html).not.toContain('partnerJobId');
  });

  it('shows Reviews only when the candidate count is positive', () => {
    const withCandidates = renderToStaticMarkup(
      <SearchRunStatus projection={projection('succeeded', 2)} />,
    );
    const withoutCandidates = renderToStaticMarkup(
      <SearchRunStatus
        projection={{ ...projection('succeeded'), reviewsUrl: '/reviews?searchRunId=73' }}
      />,
    );

    expect(withCandidates).toContain('href="/reviews?searchRunId=73"');
    expect(withoutCandidates).not.toContain('href="/reviews?searchRunId=73"');
  });

  it('does not render an unsafe external Reviews URL', () => {
    const html = renderToStaticMarkup(
      <SearchRunStatus
        projection={{
          ...projection('succeeded', 2),
          reviewsUrl: 'https://partner.example/reviews?searchRunId=73',
        }}
      />,
    );

    expect(html).not.toContain('href="https://partner.example/reviews?searchRunId=73"');
  });

  it.each(['queued', 'running', 'failed', 'cancelled'] as const)(
    'does not show Reviews for a %s run even when candidates exist',
    (status) => {
      const html = renderToStaticMarkup(
        <SearchRunStatus projection={projection(status, 2)} />,
      );

      expect(html).not.toContain('href="/reviews?searchRunId=73"');
    },
  );
});
