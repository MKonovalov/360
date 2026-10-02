'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { humanizeEnum } from '@/components/explorer/explorer-format';
import type { JobLogKind, JobLogOutcome, JobLogRow } from '@/lib/db/queries/jobLogs';

type KindFilter = 'all' | JobLogKind;
type OutcomeFilter = 'all' | JobLogOutcome;

const KIND_FILTERS: readonly (readonly [KindFilter, string])[] = [
  ['all', 'All jobs'],
  ['analyze', 'Analyze'],
  ['search', 'Search'],
];
const OUTCOME_FILTERS: readonly (readonly [OutcomeFilter, string])[] = [
  ['all', 'Any status'],
  ['active', 'In progress'],
  ['success', 'Succeeded'],
  ['failed', 'Failed'],
];

const OUTCOME_CHIP: Readonly<Record<JobLogOutcome, string>> = {
  active: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
};

const EXECUTOR_LABEL: Readonly<Record<JobLogRow['executor'], string>> = {
  internal: 'Internal agent',
  'arc-agentnet': 'Arc Agent Net',
  search: 'Arc Agent Net',
};

// Fixed UTC formatting keeps server and client markup identical (no locale drift).
function formatTime(iso: string | null): string {
  if (iso === null) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function subjectHref(row: JobLogRow): string {
  return row.subjectType === 'company' ? `/companies/${row.subjectId}?tab=analysis` : `/personas/${row.subjectId}`;
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly (readonly [T, string])[];
  readonly value: T;
  readonly onChange: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-full border px-3 py-1 text-[13px] ${
            value === option
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function filterJobLogs(
  rows: readonly JobLogRow[],
  filters: { readonly kind: KindFilter; readonly outcome: OutcomeFilter; readonly query: string },
): JobLogRow[] {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) =>
    (filters.kind === 'all' || row.kind === filters.kind)
    && (filters.outcome === 'all' || row.outcome === filters.outcome)
    && (needle === '' || `${row.subjectName} ${row.template} ${row.runId} ${row.status}`.toLowerCase().includes(needle)));
}

export function JobLogsPanel({ rows, limit }: { readonly rows: readonly JobLogRow[]; readonly limit: number }) {
  const [kind, setKind] = useState<KindFilter>('all');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => filterJobLogs(rows, { kind, outcome, query }), [rows, kind, outcome, query]);

  return (
    <section aria-labelledby="job-logs-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="job-logs-heading" className="text-[18px] font-semibold leading-[1.2] text-slate-900">Job logs</h2>
        <p className="text-sm text-slate-500">
          Every Analyze and Search job, newest first. Showing the latest {limit} of each type.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterGroup label="Job type" options={KIND_FILTERS} value={kind} onChange={setKind} />
        <FilterGroup label="Job status" options={OUTCOME_FILTERS} value={outcome} onChange={setOutcome} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search company, template, run #"
          aria-label="Search job logs"
          className="min-w-56 flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[14px] text-slate-900 placeholder:text-slate-400"
        />
      </div>

      <p className="text-[13px] text-slate-500" aria-live="polite">
        {visible.length} of {rows.length} jobs
      </p>

      {visible.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-[16px] font-semibold text-slate-900">No jobs match</p>
          <p className="text-sm text-slate-500">Change the filters, or launch an Analyze or Search from a company.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
            <li key={row.key} data-job-key={row.key} className="rounded-lg border border-slate-200 bg-white">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3 text-[14px] leading-[1.5] text-slate-900">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    {row.kind}
                  </span>
                  <span className="font-medium">#{row.runId}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${OUTCOME_CHIP[row.outcome]}`}>
                    {humanizeEnum(row.status)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{row.subjectName}</span>
                  <span className="text-[12px] text-slate-500">{formatTime(row.createdAt)}</span>
                </summary>
                <div className="space-y-3 border-t border-slate-100 p-3 text-[13px] leading-[1.5] text-slate-600">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                    <div><dt className="text-slate-400">Subject</dt><dd><Link href={subjectHref(row)} className="text-indigo-600 hover:underline">{humanizeEnum(row.subjectType)} #{row.subjectId}</Link></dd></div>
                    <div><dt className="text-slate-400">Template</dt><dd>{row.template}</dd></div>
                    <div><dt className="text-slate-400">Executor</dt><dd>{EXECUTOR_LABEL[row.executor]}</dd></div>
                    <div><dt className="text-slate-400">Launched by</dt><dd>{row.owner === 'you' ? 'You' : 'A teammate'}</dd></div>
                    <div><dt className="text-slate-400">Started</dt><dd>{formatTime(row.startedAt)}</dd></div>
                    <div><dt className="text-slate-400">Finished</dt><dd>{formatTime(row.finishedAt)}</dd></div>
                    <div><dt className="text-slate-400">Duration</dt><dd>{formatDuration(row.durationSeconds)}</dd></div>
                    {row.summary !== null ? <div><dt className="text-slate-400">Result</dt><dd>{row.summary}</dd></div> : null}
                    {row.reason !== null ? <div><dt className="text-slate-400">Reason</dt><dd>{humanizeEnum(row.reason)}</dd></div> : null}
                  </dl>
                  {row.events.length > 0 ? (
                    <ol className="space-y-0.5 border-t border-slate-100 pt-2">
                      {row.events.map((event, index) => (
                        <li key={`${event.at}-${index}`} className="flex gap-3">
                          <span className="w-36 shrink-0 text-slate-400">{formatTime(event.at)}</span>
                          <span>{event.label}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
