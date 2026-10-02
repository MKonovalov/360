import { humanizeEnum } from '@/components/explorer/explorer-format';
import type { ArcAgentnetDisplayFinding } from '@/lib/analysis/arcAgentnetResultDisplay';
import type { ArcAgentnetRunHistoryRow } from '@/lib/db/queries/arcAgentnetRuns';

const SAFE_REASON_COPY: Readonly<Record<string, string>> = {
  cancelled: 'The analysis was cancelled.',
  execution_failed: 'The analysis did not complete.',
  timed_out: 'The analysis took too long and stopped safely.',
  job_expired: 'The analysis result expired before it could be retrieved.',
};

function statusChipClass(status: string): string {
  switch (status) {
    case 'supported':
      return 'bg-emerald-50 text-emerald-700';
    case 'inconclusive':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function formatDate(iso: string | null): string | null {
  if (iso === null) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

function FindingItem({ finding }: { readonly finding: ArcAgentnetDisplayFinding }) {
  return (
    <details open={finding.status === 'supported'} className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[14px] font-medium leading-[1.5] text-slate-900">
        <span>{finding.label}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusChipClass(finding.status)}`}>
          {humanizeEnum(finding.status)}
        </span>
        {finding.confidence !== null ? (
          <span className="text-[12px] font-normal text-slate-500">{humanizeEnum(finding.confidence)} confidence</span>
        ) : null}
      </summary>
      <div className="mt-2 space-y-2">
        <p className="text-[14px] leading-[1.5] text-slate-700">{finding.claim}</p>
        {finding.reasoning !== null ? (
          <p className="text-[13px] leading-[1.5] text-slate-500">{finding.reasoning}</p>
        ) : null}
        {finding.sources.length > 0 ? (
          <ul className="space-y-1 border-t border-slate-200 pt-2">
            {finding.sources.map((source) => (
              <li key={source.sourceId} className="text-[13px] leading-[1.5] text-slate-600">
                {source.supportRole !== null ? (
                  <span className="mr-1.5 rounded bg-white px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {humanizeEnum(source.supportRole)}
                  </span>
                ) : null}
                {source.url !== null ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline">
                    {source.title}
                  </a>
                ) : (
                  <span>{source.title}</span>
                )}
                {source.publisher !== null ? <span className="text-slate-400"> · {source.publisher}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

export function ArcAgentnetRunCard({ run }: { readonly run: ArcAgentnetRunHistoryRow }) {
  const completedAt = formatDate(run.completedAt);
  const failureCopy = run.status === 'failed' || run.status === 'cancelled'
    ? SAFE_REASON_COPY[run.safeReason ?? ''] ?? (run.status === 'cancelled' ? 'The analysis was cancelled.' : 'The analysis did not complete.')
    : null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <h3 className="text-[14px] font-semibold leading-[1.5] text-slate-900">
          Run #{run.runId} · {run.templateName}
        </h3>
        <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
          {humanizeEnum(run.status)} · {run.practiceAreaName}{completedAt !== null ? ` · ${completedAt}` : ''}
        </p>
      </div>
      {failureCopy !== null ? <p className="text-[14px] leading-[1.5] text-slate-500">{failureCopy}</p> : null}
      {run.status === 'completed' && run.result === null ? (
        <p className="text-[14px] leading-[1.5] text-slate-500">
          This run finished, but its result could not be displayed.
        </p>
      ) : null}
      {run.result?.narrative ? <p className="text-[14px] leading-[1.5] text-slate-600">{run.result.narrative}</p> : null}
      {run.result !== null && run.result.findings.length > 0 ? (
        <div className="space-y-2">
          {run.result.findings.map((finding) => <FindingItem key={finding.findingId} finding={finding} />)}
        </div>
      ) : null}
    </div>
  );
}
