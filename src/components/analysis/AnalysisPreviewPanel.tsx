import type { AnalysisPreview } from './analysisLauncherClient';

export function AnalysisPreviewPanel({ preview }: { readonly preview: AnalysisPreview }) {
  const categoryCopy = (() => {
    switch (preview.checklist.schemaVersion) {
      case 1:
        return {
          selectedCategory: '—',
          emptySignalsMessage: 'No active signals are configured for this Practice Area.',
        };
      case 2:
        return {
          selectedCategory: preview.checklist.selectedCategory,
          emptySignalsMessage: 'No active signals are configured for this Buying Signal Category.',
        };
      default:
        return assertNever(preview.checklist);
    }
  })();

  return (
    <section aria-label="Analysis preview" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p><span className="font-medium">Practice Area:</span> {preview.practiceArea.name}</p>
        <p><span className="font-medium">Buying Signal Category:</span> {categoryCopy.selectedCategory}</p>
        <p><span className="font-medium">Effort:</span> {preview.effort}</p>
        <p><span className="font-medium">Template:</span> {`${preview.template.name} · v${preview.template.version}`}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-900">Resolved instruction</h3>
        <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-slate-600">{preview.instruction}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-900">Signals checked</h3>
        {preview.checklist.items.length > 0 ? <ul className="mt-1 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-slate-600">{preview.checklist.items.map((item) => <li key={item.signalId}>{item.name}</li>)}</ul> : <p className="mt-1 text-sm text-slate-600">{categoryCopy.emptySignalsMessage}</p>}
      </div>
    </section>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unexpected checklist schema: ${String(value)}`);
}
