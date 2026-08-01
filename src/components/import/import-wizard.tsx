'use client';

import { useState } from 'react';
import { ColumnMappingStep } from '@/components/import/column-mapping-step';
import { DoneStep } from '@/components/import/done-step';
import { ImportStepIndicator, type ImportStep } from '@/components/import/import-step-indicator';
import { UploadStep, type UploadedBatch } from '@/components/import/upload-step';
import {
  ValidationPreviewStep,
  type ImportCounts,
  type ImportRowError,
} from '@/components/import/validation-preview-step';

// Entity type is fixed per route (D-05 — no in-wizard entity switcher), so the
// page title is a lookup rather than `Import ${entityType}s`: 'company' + 's'
// is 'companys', the same pluralization trap the dashboard's
// ROUTE_BY_RECORD_TYPE map already closed.
const PAGE_TITLE = {
  company: 'Import Companies',
  persona: 'Import Personas',
} as const;

interface ValidationResult {
  counts: ImportCounts;
  errorReport: ImportRowError[];
}

// Wizard shell (07-UI-SPEC.md "Wizard shell"): owns `step` and the small
// payloads each Server Action hands back, and nothing else. Every step
// component below is deliberately navigation-free — it reports its outcome
// upward and this component decides where the wizard goes next.
export function ImportWizard({ entityType }: { entityType: 'company' | 'persona' }) {
  const [step, setStep] = useState<ImportStep>('upload');

  // 07-RESEARCH.md Pattern 2 (DB-row-as-wizard-state): the client holds ONLY
  // the batchId plus the small UI-facing result objects. The raw CSV text and
  // the full parsed/validated row set never leave the `import_batch` row —
  // each step's action re-reads them server-side from batchId, so a 5000-row
  // upload costs the browser nothing beyond its headers and a 5-row preview.
  const [uploadResult, setUploadResult] = useState<UploadedBatch | null>(null);
  const [validateResult, setValidateResult] = useState<ValidationResult | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCounts | null>(null);

  // The wizard is forward-only in v1, so a full reset is the ONLY escape hatch
  // (no per-step back button to reconcile stale mapping state against). Every
  // result slice is cleared alongside the step — leaving `uploadResult` behind
  // would let a second upload's Map screen render the first file's headers.
  function handleStartOver() {
    setStep('upload');
    setUploadResult(null);
    setValidateResult(null);
    setCommitResult(null);
  }

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        <h1 className="text-[18px] leading-[1.2] font-semibold text-slate-900">
          {PAGE_TITLE[entityType]}
        </h1>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <ImportStepIndicator currentStep={step} />
          <button
            type="button"
            onClick={handleStartOver}
            className="rounded-lg text-[12px] leading-[1.4] font-normal text-indigo-600 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-indigo-600/50"
          >
            Start over
          </button>
        </div>
      </div>

      {/*
        Every step except Upload was built as a standalone padded screen and
        ships its own `p-8`. The route shell is the single source of page
        padding, so that nested padding is neutralized here instead of being
        double-applied. The `!` important modifier is required — `[&>*]:p-0`
        and the child's own `p-8` carry equal specificity, so source order
        would otherwise decide the winner. Same shape as the vendored Badge's
        `[&>svg]:size-3!`. `mx-auto max-w-xl` on the Upload/Done steps is
        deliberately left intact: that is layout, not padding.
      */}
      <div className="[&>*]:p-0!">
        {step === 'upload' ? (
          <UploadStep
            entityType={entityType}
            onUploaded={(result) => {
              setUploadResult(result);
              setStep('map');
            }}
          />
        ) : null}

        {step === 'map' && uploadResult !== null ? (
          <ColumnMappingStep
            batchId={uploadResult.batchId}
            headers={uploadResult.headers}
            suggestedMapping={uploadResult.suggestedMapping}
            sampleRows={uploadResult.sampleRows}
            // columnValues / suggestedValueMapping carry the COMPLETE distinct
            // value set for every enum-mapped column — the value-mapping
            // sub-table is built from these, never from the 5-row sampleRows
            // preview, so they must survive the handoff intact.
            columnValues={uploadResult.columnValues}
            suggestedValueMapping={uploadResult.suggestedValueMapping}
            entityType={entityType}
            onValidated={(result) => {
              setValidateResult(result);
              setStep('validate');
            }}
          />
        ) : null}

        {step === 'validate' && uploadResult !== null && validateResult !== null ? (
          <ValidationPreviewStep
            batchId={uploadResult.batchId}
            counts={validateResult.counts}
            errorReport={validateResult.errorReport}
            entityType={entityType}
            onCommitted={(result) => {
              setCommitResult(result);
              setStep('done');
            }}
          />
        ) : null}

        {/*
          `commitResult` — the ACTUAL write outcome from commitImportBatch —
          never the validate step's predicted counts (07-RESEARCH.md Pitfall 5).
        */}
        {step === 'done' && commitResult !== null ? (
          <DoneStep result={commitResult} entityType={entityType} />
        ) : null}
      </div>
    </div>
  );
}
