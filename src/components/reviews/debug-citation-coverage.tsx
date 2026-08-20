import { Badge } from '@/components/ui/badge';
import type { DebugAnalysisRunDiagnostic } from '@/lib/analysis/debugDiagnostics';
import { RedactedValue } from './debug-redacted-value';

type CitationMismatch = DebugAnalysisRunDiagnostic['raw']['citationCoverage']['mismatches'][number];

function assertNever(value: never): never {
  throw new Error(`Unexpected citation mismatch: ${String(value)}`);
}

function citationMismatchCopy(mismatch: CitationMismatch): string {
  switch (mismatch.kind) {
    case 'finding_without_citation':
      return `Finding ${mismatch.findingId} has no retained citation.`;
    case 'citation_without_finding':
      return `Citation points to missing finding ${mismatch.findingId}.`;
    default:
      return assertNever(mismatch);
  }
}

export function CitationCoveragePanel({
  diagnostic,
}: {
  readonly diagnostic: DebugAnalysisRunDiagnostic;
}) {
  const coverage = diagnostic.raw.citationCoverage;
  const hasMismatch = coverage.mismatches.length > 0;

  return (
    <section aria-labelledby="debug-citation-heading" className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 id="debug-citation-heading" className="text-lg font-semibold text-foreground">
          Finding / citation coverage
        </h3>
        <p className="text-sm text-muted-foreground">
          Retained finding identifiers are compared with retained citation identifiers.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Findings</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{coverage.findingCount}</dd>
        </div>
        <div className="rounded-md border border-border bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Cited findings</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{coverage.citedFindingCount}</dd>
        </div>
        <div className="rounded-md border border-border bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Citations</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{coverage.citationCount}</dd>
        </div>
      </dl>

      {hasMismatch ? (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-semibold">Support mismatch detected</p>
          <ul aria-label="Finding and citation mismatches" className="list-inside list-disc space-y-1">
            {coverage.mismatches.map((mismatch) => (
              <li key={`${mismatch.kind}-${mismatch.findingId}`}>{citationMismatchCopy(mismatch)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          Every retained finding has a matching citation, and every citation points to a retained finding.
        </p>
      )}

      {diagnostic.raw.citations.length > 0 ? (
        <ul aria-label="Redacted citations" className="space-y-3">
          {diagnostic.raw.citations.map((citation) => (
            <li
              key={`${citation.findingId}-${citation.sourceId ?? 'unknown'}-${citation.url.sha256}`}
              className="space-y-2 border-t border-border pt-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Finding {citation.findingId}</p>
                <Badge variant="secondary">{citation.supportRole}</Badge>
                <span className="text-xs text-muted-foreground">
                  {citation.sourceId === null ? 'Source id unavailable' : `Source ${citation.sourceId}`}
                </span>
              </div>
              <RedactedValue label="Citation URL" value={citation.url} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No retained citations were captured.</p>
      )}
    </section>
  );
}
