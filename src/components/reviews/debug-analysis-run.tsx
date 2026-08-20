'use client';

import { useEffect, useState } from 'react';

import {
  analysisDebugRunDiagnosticSchema,
  type DebugAnalysisRunDiagnostic,
} from '@/lib/analysis/debugDiagnostics';
import { DebugDiagnosticsView } from './debug-analysis-run-view';

type DebugFetchResult =
  | { readonly kind: 'ready'; readonly diagnostic: DebugAnalysisRunDiagnostic }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'aborted' };

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly diagnostic: DebugAnalysisRunDiagnostic }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'error'; readonly message: string };

export async function fetchAnalysisDebugDiagnostics(
  applicationRunId: number,
  signal: AbortSignal,
): Promise<DebugFetchResult> {
  try {
    const response = await fetch(`/api/debug/analysis-runs/${encodeURIComponent(String(applicationRunId))}`, {
      cache: 'no-store',
      signal,
    });
    if (response.status === 404) return { kind: 'unavailable' };
    if (!response.ok) return { kind: 'error', message: 'The debug diagnostic could not be loaded.' };

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error: unknown) {
      if (error instanceof SyntaxError) return { kind: 'error', message: 'The debug diagnostic response was invalid.' };
      throw error;
    }
    const parsed = analysisDebugRunDiagnosticSchema.safeParse(payload);
    return parsed.success
      ? { kind: 'ready', diagnostic: parsed.data }
      : { kind: 'error', message: 'The debug diagnostic response was invalid.' };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return { kind: 'aborted' };
    if (error instanceof Error) return { kind: 'error', message: 'The debug diagnostic could not be loaded.' };
    throw error;
  }
}

export function DebugDiagnosticUnavailable() {
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-border bg-card p-6">
      <h1 className="text-lg font-semibold text-foreground">Diagnostic artifact unavailable</h1>
      <p className="text-sm text-muted-foreground">The run may be missing or its retention window may have expired.</p>
    </div>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unexpected debug diagnostic state: ${String(value)}`);
}

export function DebugAnalysisRun({
  applicationRunId,
  initialDiagnostic,
}: {
  readonly applicationRunId: number;
  readonly initialDiagnostic: DebugAnalysisRunDiagnostic | null;
}) {
  const [state, setState] = useState<LoadState>(() => (
    initialDiagnostic === null
      ? { kind: 'loading' }
      : { kind: 'ready', diagnostic: initialDiagnostic }
  ));

  useEffect(() => {
    if (initialDiagnostic !== null) return;
    const controller = new AbortController();
    let isActive = true;

    void fetchAnalysisDebugDiagnostics(applicationRunId, controller.signal).then((result) => {
      if (!isActive) return;
      switch (result.kind) {
        case 'ready':
          setState({ kind: 'ready', diagnostic: result.diagnostic });
          return;
        case 'unavailable':
          setState({ kind: 'unavailable' });
          return;
        case 'error':
          setState({ kind: 'error', message: result.message });
          return;
        case 'aborted':
          return;
        default:
          return assertNever(result);
      }
    });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [applicationRunId, initialDiagnostic]);

  switch (state.kind) {
    case 'loading':
      return (
        <div role="status" aria-live="polite" className="space-y-3 rounded-lg border border-border bg-card p-6">
          <p className="text-lg font-semibold text-foreground">Loading redacted diagnostics</p>
          <p className="text-sm text-muted-foreground">Checking the short-lived debug artifact.</p>
        </div>
      );
    case 'unavailable':
      return <DebugDiagnosticUnavailable />;
    case 'error':
      return (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/10 p-6">
          <h1 className="text-lg font-semibold text-destructive">Diagnostics could not be loaded</h1>
          <p className="text-sm text-destructive">{state.message}</p>
        </div>
      );
    case 'ready':
      return <DebugDiagnosticsView diagnostic={state.diagnostic} />;
    default:
      return assertNever(state);
  }
}
