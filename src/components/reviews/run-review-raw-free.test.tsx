import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/actions/reviews', () => ({
  confirmRunAction: vi.fn(),
  dismissRunAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { RunReviewCard } from './run-review-card';

describe('ordinary run review surface', () => {
  it('does not render raw-attempt, private validation, or normalized raw-audit fields', () => {
    const html = renderToStaticMarkup(
      <RunReviewCard
        item={{
          runId: 39,
          status: 'pending_review',
          targetType: 'company',
          subjectId: 42,
          subjectDisplayName: 'Acme Corp',
          templateName: 'GBS Cost Pressure',
          practiceAreaName: 'Shared Services',
          resultId: 12,
          packetHash: 'a'.repeat(64),
          findingCount: 0,
          sourceCount: 0,
          linkCount: 0,
          completedAt: null,
          decidedBy: null,
          decidedAt: null,
          decision: null,
          packetMissing: false,
          findings: [],
        }}
      />,
    );

    expect(html).not.toMatch(/analysis_raw_attempt|rawAudit|failureReason|artifact|private validation/i);
  });
});
