import Link from 'next/link';
import { AnalysisRunStatus } from '@/components/analysis/analysis-run-status';
import { RunReviewCard } from '@/components/reviews/run-review-card';
import type { RunReviewCardData } from '@/components/reviews/run-review-card';
import { humanizeEnum } from '@/components/explorer/explorer-format';
import type { AnalysisRunHistoryRow } from '@/lib/analysis/experienceContracts';
import type { AnalysisPacketRead } from '@/lib/db/queries/analysisResults';

type AnalysisHistoryProps = {
  readonly rows: readonly AnalysisRunHistoryRow[] | null;
  readonly reviewCards?: readonly RunReviewCardData[];
};

const SAFE_REASON_COPY: Readonly<Record<string, string>> = {
  cancelled: 'The analysis was cancelled.',
  execution_failed: 'The analysis did not complete.',
  timed_out: 'The analysis took too long and stopped safely.',
  policy_unavailable: 'The analysis policy is not yet available for this run.',
  persona_policy_unavailable: 'Persona analysis is temporarily unavailable while persona data protection is finalized.',
};

function assertNever(value: never): never {
  throw new Error(`Unhandled analysis run status: ${value}`);
}

function lifecycleCopy(status: 'failed' | 'cancelled', safeReason: string | null): string {
  const reasonCopy = SAFE_REASON_COPY[safeReason ?? ''];
  if (reasonCopy) return reasonCopy;
  switch (status) {
    case 'failed':
      return 'The analysis did not complete.';
    case 'cancelled':
      return 'The analysis was cancelled.';
    default:
      return assertNever(status);
  }
}

function sortNewestFirst(rows: readonly AnalysisRunHistoryRow[]): AnalysisRunHistoryRow[] {
  return [...rows].sort((left, right) => {
    const createdAtDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    return createdAtDifference === 0 ? right.runId - left.runId : createdAtDifference;
  });
}

function isEvidenceStatus(status: string): status is 'strong' | 'weak' {
  return status === 'strong' || status === 'weak';
}

export function projectRunReviewCard(
  row: AnalysisRunHistoryRow,
  packet: AnalysisPacketRead | undefined,
): RunReviewCardData | null {
  if (row.packetProjection === null) return null;

  const sourceByRowId = new Map<number, RunReviewCardData['findings'][number]['sources'][number]>();
  const sourceRowIdsByFinding = new Map<number, number[]>();
  if (packet) {
    for (const source of packet.sources) {
      sourceByRowId.set(Number(source.id), {
        sourceKey: String(source.source_id),
        sourceRowId: Number(source.id),
        canonicalUrl: String(source.canonical_url),
        title: String(source.title),
      });
    }
    for (const link of packet.links) {
      const findingRowId = Number(link.finding_id);
      const sourceRowId = Number(link.source_id);
      const sourceRowIds = sourceRowIdsByFinding.get(findingRowId) ?? [];
      if (!sourceRowIds.includes(sourceRowId)) sourceRowIds.push(sourceRowId);
      sourceRowIdsByFinding.set(findingRowId, sourceRowIds);
    }
  }

  const findings = packet
    ? packet.findings.flatMap((finding) => {
        const evidenceStatus = String(finding.status);
        if (!isEvidenceStatus(evidenceStatus)) return [];
        const sources = (sourceRowIdsByFinding.get(Number(finding.id)) ?? [])
          .map((sourceRowId) => sourceByRowId.get(sourceRowId))
          .filter((source): source is RunReviewCardData['findings'][number]['sources'][number] => source !== undefined);
        return [{
          findingKey: String(finding.finding_id),
          findingRowId: Number(finding.id),
          signalName: String(finding.signal_name),
          evidenceStatus,
          sources,
        }];
      })
    : [];
  const result = packet?.result;

  return {
    runId: row.runId,
    status: row.status,
    targetType: row.targetType,
    subjectId: row.subjectId,
    subjectDisplayName: row.subjectDisplayName,
    templateName: row.templateName,
    practiceAreaName: row.practiceAreaName,
    resultId: row.packetProjection.resultId,
    packetHash: row.packetProjection.packetHash,
    findingCount: Number(result?.finding_count ?? 0),
    sourceCount: Number(result?.source_count ?? 0),
    linkCount: Number(result?.link_count ?? 0),
    completedAt: row.completedAt,
    decidedBy: row.review?.decidedBy ?? null,
    decidedAt: row.review?.decidedAt ?? null,
    decision: row.review?.decision ?? null,
    packetMissing: packet === undefined,
    findings,
  };
}

export async function projectRunReviewCards(
  rows: readonly AnalysisRunHistoryRow[],
  getPacket: (runId: number) => Promise<AnalysisPacketRead | undefined>,
): Promise<RunReviewCardData[]> {
  const cards = await Promise.all(
    rows
      .filter((row) => row.packetProjection !== null)
      .map(async (row) => {
        try {
          return projectRunReviewCard(row, await getPacket(row.runId));
        } catch {
          return projectRunReviewCard(row, undefined);
        }
      }),
  );
  return cards.filter((card): card is RunReviewCardData => card !== null);
}

function renderSettledRun(
  row: AnalysisRunHistoryRow,
  reviewCardsByRunId: ReadonlyMap<number, RunReviewCardData>,
) {
  const card = reviewCardsByRunId.get(row.runId);
  if (card) return <RunReviewCard item={card} mode="readonly" />;

  return (
    <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-[14px] font-semibold leading-[1.5] text-slate-900">Run #{row.runId}</h3>
      <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">{humanizeEnum(row.status)}</p>
      <p className="text-[14px] leading-[1.5] text-slate-500">
        This run&apos;s result is not available for display.
      </p>
      {row.status === 'pending_review' ? (
        <Link href="/reviews" className="text-[14px] text-indigo-600 hover:text-indigo-800 hover:underline">
          Review in Reviews →
        </Link>
      ) : null}
    </div>
  );
}

function renderRun(
  row: AnalysisRunHistoryRow,
  reviewCardsByRunId: ReadonlyMap<number, RunReviewCardData>,
) {
  switch (row.status) {
    case 'queued':
    case 'running':
      return <AnalysisRunStatus applicationRunId={row.runId} />;
    case 'failed':
    case 'cancelled':
      return (
        <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-[14px] font-semibold leading-[1.5] text-slate-900">
            Run #{row.runId}
          </h3>
          <p className="text-[14px] leading-[1.5] text-slate-500">
            {lifecycleCopy(row.status, row.safeReason)}
          </p>
        </div>
      );
    case 'completed':
    case 'pending_review':
    case 'confirmed':
    case 'dismissed':
      return renderSettledRun(row, reviewCardsByRunId);
    default:
      return assertNever(row.status);
  }
}

export function AnalysisHistory({ rows, reviewCards = [] }: AnalysisHistoryProps) {
  if (rows === null) {
    return (
      <section aria-labelledby="analysis-history-heading" className="space-y-3">
        <h2 id="analysis-history-heading" className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Analysis
        </h2>
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
            Couldn&apos;t load analysis history
          </p>
          <p className="text-sm text-slate-500">Something went wrong fetching this data. Try refreshing the page.</p>
        </div>
      </section>
    );
  }

  const sortedRows = sortNewestFirst(rows);
  const reviewCardsByRunId = new Map(reviewCards.map((card) => [card.runId, card]));

  return (
    <section aria-labelledby="analysis-history-heading" className="space-y-3">
      <h2 id="analysis-history-heading" className="text-[18px] font-semibold leading-[1.2] text-slate-900">
        Analysis
      </h2>
      {sortedRows.length === 0 ? (
        <p className="text-[14px] font-normal leading-[1.5] text-slate-500">No analysis runs for this record.</p>
      ) : (
        <div className="space-y-3">
          {sortedRows.map((row) => (
            <div key={row.runId} data-run-id={row.runId} data-status={row.status}>
              {renderRun(row, reviewCardsByRunId)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
