'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';

// Analyze run-status strip (UI-SPEC §2). Owns the run-state machine for ONE
// company's Analyze run and renders the feedback strip between the detail
// panel's header block and the Firmographics section.
//
// The trigger (EnrichMenu's Analyze item) and this strip are sibling client
// components under a Server Component parent (company-detail.tsx), so a
// callback prop cannot cross that boundary. They communicate via a scoped
// window CustomEvent — the menu dispatches, this strip listens (UI-SPEC §1:
// "a sibling client component owning the run-status state"). Persona-detail
// never mounts this component and never dispatches the event.
export const ANALYZE_START_EVENT = 'arclumen:analyze:start';

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'success'; proposalCount: number }
  | { status: 'successNoNew' }
  | { status: 'failure'; reason: string; errors?: string[] };

// D-06 fail-loud copy table (mirrors Phase 8's ERROR_COPY pattern): every
// Route Handler error body reason maps to a staff-facing reason line.
const ERROR_COPY: Record<string, string> = {
  invalid_id: 'This request is invalid',
  company_not_found: 'This company could not be loaded',
  not_configured: 'Analysis is not configured — contact admin',
  gate_failed: "The company data doesn't meet the requirements for analysis",
  analysis_failed: 'The analysis failed',
  persist_failed: 'The analysis could not be saved',
  network: 'The analysis service could not be reached',
  action_failed: 'The analysis could not be started',
};

function errorMessage(reason: string): string {
  return ERROR_COPY[reason] ?? 'The analysis failed';
}

export function AnalyzeRunStatus({
  companyId,
  companyName,
}: {
  companyId: number;
  companyName: string;
}) {
  const [state, setState] = useState<RunState>({ status: 'idle' });
  const router = useRouter();
  // Guards against a stale run's response overwriting a newer run's state if
  // staff triggers Analyze twice in quick succession (same guard pattern as
  // enrichment-review-dialog.tsx's requestGeneration).
  const requestGeneration = useRef(0);

  useEffect(() => {
    function handleStart(event: Event) {
      const detail = (event as CustomEvent<{ companyId: number }>).detail;
      if (detail.companyId !== companyId) return;
      void run();
    }
    window.addEventListener(ANALYZE_START_EVENT, handleStart);
    return () => window.removeEventListener(ANALYZE_START_EVENT, handleStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function run() {
    const generation = ++requestGeneration.current;
    setState({ status: 'running' });
    try {
      const res = await fetch(`/api/companies/${companyId}/analyze`, { method: 'POST' });
      if (generation !== requestGeneration.current) return;

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { proposalCount?: number };
        const proposalCount = data.proposalCount ?? 0;
        if (proposalCount > 0) {
          setState({ status: 'success', proposalCount });
        } else {
          // D-11: run completed but produced zero NEW proposals — state WHY,
          // don't silently succeed (UI-SPEC §2).
          setState({ status: 'successNoNew' });
        }
        // D-09: re-render the server tree so the new pending badge and any
        // newly-live signals reflect the run.
        router.refresh();
        return;
      }

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        errors?: string[];
      };
      if (generation !== requestGeneration.current) return;
      setState({ status: 'failure', reason: body.error ?? 'action_failed', errors: body.errors });
    } catch {
      if (generation !== requestGeneration.current) return;
      setState({ status: 'failure', reason: 'network' });
    }
  }

  if (state.status === 'idle') return null; // no empty chrome (UI-SPEC §2)

  if (state.status === 'running') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Loader2Icon className="size-4 animate-spin text-slate-500" />
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
            {`Analyzing ${companyName}…`}
          </p>
        </div>
        <p className="text-[12px] font-normal leading-[1.4] text-slate-500">
          This can take up to a minute.
        </p>
      </div>
    );
  }

  if (state.status === 'success') {
    return (
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-semibold leading-[1.5] text-slate-900">Analysis complete</p>
        <Link href="/reviews" className="text-[14px] font-normal leading-[1.5] text-indigo-600">
          {`Review ${state.proposalCount} proposal${state.proposalCount === 1 ? '' : 's'}`}
        </Link>
      </div>
    );
  }

  if (state.status === 'successNoNew') {
    return (
      <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
        {`No new proposals — ${companyName}'s signal types are already covered.`}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[14px] font-semibold leading-[1.5] text-slate-900">Analysis failed</p>
      <p className="text-[14px] font-normal leading-[1.5] text-red-600">
        {`${errorMessage(state.reason)}. Try again.`}
      </p>
      {state.errors && state.errors.length > 0 && (
        <ul className="list-inside list-disc space-y-1">
          {state.errors.map((err, index) => (
            <li key={index} className="text-[14px] font-normal leading-[1.5] text-red-600">
              {err}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
