import type { WholeRunDecision } from '@/lib/analysis/reviewContracts';
import { dateFormatter, humanizeEnum } from '@/components/explorer/explorer-format';
import { RunReviewActions } from './run-review-actions';

// Server component: the card renders ONLY the server-projected review surface.
// No chain-of-thought, reasoning, narrative, or raw claim fields are part of
// the projection type (T-34-11) — the page fetches the packet server-side and
// passes down normalized strong/weak findings with persisted source links.

export type RunReviewSource = {
  readonly sourceKey: string;
  readonly sourceRowId: number;
  readonly canonicalUrl: string;
  readonly title: string;
};

export type RunReviewFinding = {
  readonly findingKey: string;
  readonly findingRowId: number;
  readonly signalName: string;
  readonly evidenceStatus: 'strong' | 'weak';
  readonly sources: readonly RunReviewSource[];
};

export type RunReviewCardData = {
  readonly runId: number;
  readonly status: string;
  readonly targetType: string;
  readonly subjectId: number;
  readonly subjectDisplayName: string;
  readonly templateName: string;
  readonly practiceAreaName: string;
  readonly resultId: number;
  readonly packetHash: string;
  readonly findingCount: number;
  readonly sourceCount: number;
  readonly linkCount: number;
  readonly completedAt: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly decision: WholeRunDecision | null;
  readonly packetMissing: boolean;
  readonly findings: readonly RunReviewFinding[];
};

export function RunReviewCard({ item }: { item: RunReviewCardData }) {
  const decided = item.decision !== null;
  return (
    <div data-run-id={item.runId} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold leading-[1.5] text-slate-900">Run #{item.runId}</h3>
          <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {humanizeEnum(item.status)}
          </span>
        </div>
        <span className="text-[12px] text-slate-500">
          {item.completedAt ? dateFormatter.format(new Date(item.completedAt)) : '—'}
        </span>
      </div>

      <div>
        <p className="text-[14px] font-normal leading-[1.5] text-slate-900">{item.subjectDisplayName}</p>
        <p className="text-[12px] text-slate-500">
          {humanizeEnum(item.targetType)} #{item.subjectId} · {item.templateName} · {item.practiceAreaName}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
        <span>{item.findingCount} findings</span>
        <span>{item.sourceCount} sources</span>
        <span>{item.linkCount} links</span>
        <span className="font-mono">packet {item.packetHash.slice(0, 12)}…</span>
      </div>

      {item.packetMissing ? (
        <p className="text-[14px] text-amber-700">This run&apos;s packet is unavailable, so it cannot be reviewed.</p>
      ) : item.findings.length === 0 ? (
        <p className="text-[14px] text-slate-500">No source-backed findings in this packet.</p>
      ) : (
        <div className="space-y-2">
          {item.findings.map((finding) => (
            <div key={finding.findingRowId} className="rounded-md border border-slate-100 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-normal text-slate-900">{finding.signalName}</p>
                <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {finding.evidenceStatus}
                </span>
                <span className="text-[12px] text-slate-400">
                  finding #{finding.findingRowId} ({finding.findingKey})
                </span>
              </div>
              {finding.sources.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {finding.sources.map((source) => (
                    <li key={source.sourceRowId} className="flex flex-wrap items-center gap-2 text-[13px]">
                      <a
                        href={source.canonicalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {source.title}
                      </a>
                      <span className="text-slate-400">
                        source #{source.sourceRowId} ({source.sourceKey})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        {item.packetMissing ? (
          <p className="text-[14px] text-slate-500">Decision unavailable — packet missing.</p>
        ) : decided ? (
          <p className="text-[14px] text-slate-600">
            {item.decision === 'confirmed' ? 'Confirmed' : 'Dismissed'} by {item.decidedBy} at{' '}
            {item.decidedAt ? dateFormatter.format(new Date(item.decidedAt)) : '—'}.
          </p>
        ) : (
          <RunReviewActions runId={item.runId} />
        )}
      </div>
    </div>
  );
}
