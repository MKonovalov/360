'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { pollArcAgentnetRun } from '@/components/analysis/analysisLauncherClient';
import { humanizeEnum } from '@/components/explorer/explorer-format';
import type { ArcAgentnetRunHistoryRow } from '@/lib/db/queries/arcAgentnetRuns';

// History polls less aggressively than the launcher: runs take many minutes and
// the webhook usually finishes them first.
const HISTORY_POLL_INTERVAL_MS = 5_000;

// Live card for an in-flight Arc Agent Net run. These runs are only served by
// the partner status route (/api/analysis-runs/arc-agentnet/[id]); the internal
// status panel polls a different endpoint and would 404 for them.
export function ArcAgentnetRunStatus({ run }: { readonly run: ArcAgentnetRunHistoryRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    void pollArcAgentnetRun({
      applicationRunId: run.runId,
      signal: controller.signal,
      intervalMs: HISTORY_POLL_INTERVAL_MS,
    }).then((result) => {
      if (!isActive || result.kind === 'aborted') return;
      if (result.kind === 'error') setError(result.message);
      // Terminal: reload server data so the finished run renders its findings.
      if (result.kind === 'terminal') router.refresh();
    });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [run.runId, router]);

  return (
    <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-[14px] font-semibold leading-[1.5] text-slate-900">
        Run #{run.runId} · {run.templateName}
      </h3>
      <p className="text-[12px] font-medium uppercase tracking-wide text-indigo-700">
        {humanizeEnum(run.status)} · {run.practiceAreaName}
      </p>
      {error === null ? (
        <p role="status" className="text-[14px] leading-[1.5] text-slate-500">
          The analysis is in progress. Findings appear here when it completes.
        </p>
      ) : (
        <p role="alert" className="text-[14px] leading-[1.5] text-red-700">{error}</p>
      )}
    </div>
  );
}
