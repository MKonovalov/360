'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SearchRunStatus } from '@/components/search/SearchRunStatus';
import { pollSearchRun } from '@/components/search/searchClient';
import type { SearchStatusProjection } from '@/lib/search/contracts';

// Slower than the launcher dialog: runs take minutes and the webhook usually
// finishes them first. The poll is what reconciles a run when it does not.
const ACTIVE_POLL_INTERVAL_MS = 5_000;

// Passive status for an in-flight Search run on the company card. The launcher
// dialog only polls while it is open, so closing it left the run unreconciled
// and the finished candidates never appeared.
export function SearchActiveRunStatus({ run }: { readonly run: SearchStatusProjection }) {
  const router = useRouter();
  const [projection, setProjection] = useState(run);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    void pollSearchRun({
      searchRunId: run.searchRunId,
      signal: controller.signal,
      intervalMs: ACTIVE_POLL_INTERVAL_MS,
      onUpdate: (next) => {
        if (isActive) setProjection(next);
      },
    }).then((result) => {
      if (!isActive || result.kind === 'aborted') return;
      if (result.kind === 'error') setError(result.message);
      // Terminal: reload server data so the new candidates render.
      if (result.kind === 'terminal') router.refresh();
    });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [run.searchRunId, router]);

  return (
    <div className="space-y-2">
      <SearchRunStatus projection={projection} />
      {error === null ? null : <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
