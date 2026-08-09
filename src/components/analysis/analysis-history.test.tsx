import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/actions/reviews', () => ({
  confirmRunAction: vi.fn(),
  dismissRunAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import type { RunReviewCardData } from '@/components/reviews/run-review-card';
import type { AnalysisRunHistoryRow } from '@/lib/analysis/experienceContracts';
import type { AnalysisRunStatus } from '@/lib/analysis/contracts';

import { AnalysisHistory, projectRunReviewCard } from './analysis-history';

const PACKET_HASH = 'a'.repeat(64);

function historyRow(
  runId: number,
  status: AnalysisRunStatus,
  createdAt: string,
  safeReason: string | null = null,
): AnalysisRunHistoryRow {
  return {
    runId,
    status,
    targetType: 'company',
    subjectId: 42,
    subjectDisplayName: 'Acme Corp',
    templateVersionId: 1,
    templateName: 'Buying Signal Analysis',
    practiceAreaId: 2,
    practiceAreaName: 'Shared Services',
    safeReason,
    createdAt,
    startedAt: null,
    completedAt: status === 'queued' || status === 'running' ? null : createdAt,
    terminalAt: status === 'queued' || status === 'running' ? null : createdAt,
    updatedAt: createdAt,
    review: status === 'confirmed'
      ? { decision: 'confirmed', decidedBy: 'staff_1', decidedAt: createdAt }
      : null,
    packetProjection: status === 'pending_review' || status === 'confirmed'
      ? { resultId: runId + 100, packetHash: PACKET_HASH }
      : null,
  };
}

const REVIEW_CARD: RunReviewCardData = {
  runId: 2,
  status: 'pending_review',
  targetType: 'company',
  subjectId: 42,
  subjectDisplayName: 'Acme Corp',
  templateName: 'Buying Signal Analysis',
  practiceAreaName: 'Shared Services',
  resultId: 102,
  packetHash: PACKET_HASH,
  findingCount: 1,
  sourceCount: 1,
  linkCount: 1,
  completedAt: '2026-08-08T00:00:00.000Z',
  decidedBy: null,
  decidedAt: null,
  decision: null,
  packetMissing: false,
  findings: [],
};

describe('AnalysisHistory', () => {
  it('renders an explicit empty state when a subject has no runs', () => {
    const html = renderToStaticMarkup(<AnalysisHistory rows={[]} />);
    expect(html).toContain('No analysis runs for this record');
    expect(html).not.toContain('data-run-id');
  });

  it('renders an explicit error state when history loading failed', () => {
    const html = renderToStaticMarkup(<AnalysisHistory rows={null} />);
    expect(html).toContain('load analysis history');
    expect(html).not.toContain('data-run-id');
  });

  it('keeps every lifecycle status and orders rows newest first', () => {
    const rows = [
      historyRow(1, 'failed', '2026-08-01T00:00:00.000Z', 'execution_failed'),
      historyRow(2, 'pending_review', '2026-08-02T00:00:00.000Z'),
      historyRow(3, 'running', '2026-08-03T00:00:00.000Z'),
      historyRow(4, 'queued', '2026-08-04T00:00:00.000Z'),
      historyRow(5, 'cancelled', '2026-08-05T00:00:00.000Z', 'cancelled'),
      historyRow(6, 'confirmed', '2026-08-06T00:00:00.000Z'),
      historyRow(7, 'dismissed', '2026-08-07T00:00:00.000Z'),
      historyRow(8, 'completed', '2026-08-08T00:00:00.000Z'),
    ];
    const html = renderToStaticMarkup(<AnalysisHistory rows={rows} reviewCards={[REVIEW_CARD]} />);
    const runIds = [...html.matchAll(/data-run-id="(\d+)" data-status=/g)].map((match) => match[1]);

    expect(runIds.slice(0, 4)).toEqual(['8', '7', '6', '5']);
    expect(runIds).toHaveLength(8);
    expect(html).toContain('The analysis did not complete.');
    expect(html).toContain('The analysis was cancelled.');
    expect(html).toContain('Review in Reviews');
    expect(html).toContain('data-status="queued"');
    expect(html).toContain('data-status="running"');
    expect(html).toContain('Dismissed');
  });

  it('mounts live status only for queued and running rows', () => {
    const html = renderToStaticMarkup(
      <AnalysisHistory
        rows={[
          historyRow(10, 'queued', '2026-08-10T00:00:00.000Z'),
          historyRow(11, 'running', '2026-08-11T00:00:00.000Z'),
          historyRow(12, 'failed', '2026-08-12T00:00:00.000Z', 'execution_failed'),
        ]}
      />,
    );

    expect(html.match(/Loading analysis run status…/g)).toHaveLength(2);
    expect(html).toContain('The analysis did not complete.');
  });

  it('keeps an expired Persona result visible as unavailable without exposing packet data', () => {
    const row = { ...historyRow(20, 'pending_review', '2026-08-20T00:00:00.000Z'), targetType: 'persona' as const };
    const card = projectRunReviewCard(row, undefined);
    const html = renderToStaticMarkup(<AnalysisHistory rows={[row]} reviewCards={card ? [card] : []} />);

    expect(html).toContain("This run&#x27;s packet is unavailable");
    expect(html).not.toContain('New GBS Head');
    expect(html).toContain('Review in Reviews');
  });
});
