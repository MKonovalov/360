import type { DebugAnalysisRunDiagnostic } from '@/lib/analysis/debugDiagnostics';

export function RedactedValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: DebugAnalysisRunDiagnostic['raw']['findings'][number]['claim'];
}) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm text-foreground">
        {value.value ?? 'Value redacted; metadata retained.'}
      </p>
      <p className="break-all font-mono text-xs text-muted-foreground">
        sha256 {value.sha256} · {value.originalLength} characters · {value.redaction}
        {value.truncated ? ' · truncated' : ''}
      </p>
    </div>
  );
}
