import { Badge } from '@/components/ui/badge';
import type { DebugAnalysisRunDiagnostic } from '@/lib/analysis/debugDiagnostics';
import { CitationCoveragePanel } from './debug-citation-coverage';
import { RedactedValue } from './debug-redacted-value';

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatTimestamp(value: string | null): string {
  return value === null ? 'Not recorded' : timestampFormatter.format(new Date(value));
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ');
}

function MetricList({
  metrics,
}: {
  readonly metrics: readonly { readonly label: string; readonly value: string | number }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-md border border-border bg-muted p-3">
          <dt className="text-xs text-muted-foreground">{metric.label}</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{metric.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RawAttemptPanel({ diagnostic }: { readonly diagnostic: DebugAnalysisRunDiagnostic }) {
  return (
    <section aria-labelledby="debug-raw-heading" className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="debug-raw-heading" className="text-lg font-semibold text-foreground">Redacted raw attempt</h3>
          <p className="text-sm text-muted-foreground">Only sanitizer-approved fields are shown.</p>
        </div>
        <Badge variant="outline">Attempt {diagnostic.raw.attempt}</Badge>
      </div>

      <MetricList metrics={[
        { label: 'Target', value: humanize(diagnostic.raw.targetType) },
        { label: 'Stage', value: humanize(diagnostic.raw.failureStage) },
        { label: 'Findings', value: `${diagnostic.raw.counts.findings.retained}/${diagnostic.raw.counts.findings.received}` },
        { label: 'Serialized', value: `${diagnostic.raw.bytes.serialized} bytes` },
      ]} />

      {diagnostic.raw.findings.length > 0 ? (
        <ul className="space-y-3" aria-label="Redacted findings">
          {diagnostic.raw.findings.map((finding) => (
            <li key={finding.findingId} className="space-y-2 border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Finding {finding.findingId}</p>
                <Badge variant="secondary">{finding.status}</Badge>
                <span className="text-xs text-muted-foreground">{finding.confidence} confidence</span>
              </div>
              <RedactedValue label="Claim" value={finding.claim} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No redacted findings were retained.</p>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm font-medium text-foreground">Source metadata</p>
        <p className="text-sm text-muted-foreground">
          {diagnostic.raw.counts.citations.retained} citations and {diagnostic.raw.counts.toolResults.retained} tool results retained;
          values remain redacted or metadata-only.
        </p>
      </div>
    </section>
  );
}

function NormalizedPanel({ diagnostic }: { readonly diagnostic: DebugAnalysisRunDiagnostic }) {
  if (diagnostic.normalized === null) {
    return (
      <section aria-labelledby="debug-normalized-heading" className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 id="debug-normalized-heading" className="text-lg font-semibold text-foreground">Normalized result</h3>
          <p className="text-sm text-muted-foreground">No normalized result was committed for this failed run.</p>
        </div>
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          The comparison ends at the captured failed attempt.
        </div>
      </section>
    );
  }

  const normalized = diagnostic.normalized;
  return (
    <section aria-labelledby="debug-normalized-heading" className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="debug-normalized-heading" className="text-lg font-semibold text-foreground">Normalized result</h3>
          <p className="text-sm text-muted-foreground">Persisted summary only; raw normalized payloads stay out of this surface.</p>
        </div>
        <Badge variant="secondary">Result #{normalized.resultId}</Badge>
      </div>
      <MetricList metrics={[
        { label: 'Target', value: humanize(normalized.targetType) },
        { label: 'Findings', value: normalized.findingCount },
        { label: 'Sources', value: normalized.sourceCount },
        { label: 'Links', value: normalized.linkCount },
      ]} />
      <p className="break-all font-mono text-xs text-muted-foreground">packet {normalized.packetHash}</p>
    </section>
  );
}

export function DebugDiagnosticsView({
  diagnostic,
}: {
  readonly diagnostic: DebugAnalysisRunDiagnostic;
}) {
  const headingId = `debug-analysis-heading-${diagnostic.applicationRunId}`;
  return (
    <section aria-labelledby={headingId} className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id={headingId} className="text-2xl font-semibold tracking-tight text-foreground">
            Redacted analysis diagnostics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Run #{diagnostic.applicationRunId} · retained raw attempt #{diagnostic.rawAttemptId}
          </p>
        </div>
        <Badge variant="destructive">{humanize(diagnostic.status)}</Badge>
      </header>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
        Debug-admin surface only. Values below have passed the raw-attempt redaction boundary; private reasoning and provider output are not rendered.
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Private validation reason</dt>
          <dd className="mt-1 break-words font-mono text-sm font-semibold text-foreground">{diagnostic.reason}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Public lifecycle reason</dt>
          <dd className="mt-1 break-words font-mono text-sm text-foreground">{diagnostic.safeReason}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Captured</dt>
          <dd className="mt-1 text-sm text-foreground"><time dateTime={diagnostic.timestamps.capturedAt}>{formatTimestamp(diagnostic.timestamps.capturedAt)}</time></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Expires</dt>
          <dd className="mt-1 text-sm text-foreground"><time dateTime={diagnostic.timestamps.expiresAt}>{formatTimestamp(diagnostic.timestamps.expiresAt)}</time></dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RawAttemptPanel diagnostic={diagnostic} />
        <NormalizedPanel diagnostic={diagnostic} />
      </div>

      <CitationCoveragePanel diagnostic={diagnostic} />

      <section aria-labelledby="debug-timestamps-heading" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 id="debug-timestamps-heading" className="text-lg font-semibold text-foreground">Run timestamps</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Created', diagnostic.timestamps.createdAt],
            ['Started', diagnostic.timestamps.startedAt],
            ['Completed', diagnostic.timestamps.completedAt],
            ['Terminal', diagnostic.timestamps.terminalAt],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm text-foreground">{formatTimestamp(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  );
}
