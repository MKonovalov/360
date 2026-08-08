import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listPendingProposals } from '@/lib/db/queries/proposals';
import { listRunReviewItems } from '@/lib/db/queries/analysisReviews';
import { getAnalysisPacket } from '@/lib/db/queries/analysisResults';
import { ReviewQueue } from '@/components/reviews/review-queue';
import { RunReviewSection } from '@/components/reviews/run-review-section';
import type { RunReviewCardData, RunReviewFinding, RunReviewSource } from '@/components/reviews/run-review-card';

// Belt-and-suspenders alongside the (dashboard) layout's auth gate
// (02-RESEARCH.md Pitfall 4) — every page in the group gates itself too, so
// the check can never be skipped by a future refactor of the layout alone.
// The surrounding AppShellLayout comes from src/app/(dashboard)/layout.tsx.
//
// T-09-06: the queue is read-only for non-staff — accept/reject are separate
// staff-gated Server Actions (reviews.ts), so a layout-only bypass still
// cannot mutate anything.

// v1.7 additive composition: the legacy proposal queue renders unchanged above
// a separately labeled run-level section (REV-01). Run cards are fed from a
// server-only packet projection — only strong/weak findings (D-34-03,
// T-34-11) with their persisted source links and provenance ids cross the
// server boundary; reasoning/narrative/raw content never leaves the server.
const CANDIDATE_EVIDENCE_STATUSES: ReadonlySet<string> = new Set(['strong', 'weak']);

async function projectRunReviewItem(
  item: Awaited<ReturnType<typeof listRunReviewItems>>[number],
): Promise<RunReviewCardData> {
  const packet = await getAnalysisPacket(item.runId);

  const findings: RunReviewFinding[] = [];
  if (packet) {
    const sourceByRowId = new Map<number, RunReviewSource>();
    for (const source of packet.sources) {
      sourceByRowId.set(Number(source.id), {
        sourceKey: String(source.source_id),
        sourceRowId: Number(source.id),
        canonicalUrl: String(source.canonical_url),
        title: String(source.title),
      });
    }
    const sourceRowIdsByFinding = new Map<number, number[]>();
    for (const link of packet.links) {
      const findingRowId = Number(link.finding_id);
      const sourceRowId = Number(link.source_id);
      const existing = sourceRowIdsByFinding.get(findingRowId) ?? [];
      if (!existing.includes(sourceRowId)) existing.push(sourceRowId);
      sourceRowIdsByFinding.set(findingRowId, existing);
    }
    for (const finding of packet.findings) {
      if (!CANDIDATE_EVIDENCE_STATUSES.has(String(finding.status))) continue;
      const sources = (sourceRowIdsByFinding.get(Number(finding.id)) ?? [])
        .map((rowId) => sourceByRowId.get(rowId))
        .filter((source): source is RunReviewSource => source !== undefined);
      findings.push({
        findingKey: String(finding.finding_id),
        findingRowId: Number(finding.id),
        signalName: String(finding.signal_name),
        evidenceStatus: String(finding.status) as 'strong' | 'weak',
        sources,
      });
    }
  }

  return {
    runId: item.runId,
    status: item.status,
    targetType: item.targetType,
    subjectId: item.subjectId,
    subjectDisplayName: item.subjectDisplayName,
    templateName: item.templateName,
    practiceAreaName: item.practiceAreaName,
    resultId: item.resultId,
    packetHash: item.packetHash,
    findingCount: item.findingCount,
    sourceCount: item.sourceCount,
    linkCount: item.linkCount,
    completedAt: item.completedAt,
    decidedBy: item.decidedBy ?? null,
    decidedAt: item.decidedAt ?? null,
    decision: item.decision ?? null,
    packetMissing: !packet,
    findings,
  };
}

export default async function ReviewsPage() {
  await requireStaffAccess();

  // EXPL-06: a DB-fetch failure degrades to the established per-widget error
  // card (same copy shape as every dashboard widget), never Next.js's default
  // 500 page.
  let proposals: Awaited<ReturnType<typeof listPendingProposals>>;
  try {
    proposals = await listPendingProposals();
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Couldn't load proposals
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  // The run section has its own per-widget error card: a failure here degrades
  // just that section (items = null) while the legacy queue above stays intact.
  let runItems: RunReviewCardData[] | null;
  try {
    const items = await listRunReviewItems();
    runItems = await Promise.all(items.map(projectRunReviewItem));
  } catch {
    runItems = null;
  }

  return (
    <div className="flex flex-col gap-12 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Review Proposals</h1>
      <ReviewQueue proposals={proposals} />
      <RunReviewSection items={runItems} />
    </div>
  );
}
