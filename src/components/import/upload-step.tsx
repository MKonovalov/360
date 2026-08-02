'use client';

import { useRef, useState } from 'react';
import { DownloadIcon, UploadIcon } from 'lucide-react';
import { downloadImportTemplate, uploadImportFile } from '@/app/actions/import';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// The full success payload of `uploadImportFile`. Exported so the wizard shell
// can hold it as step state and hand it straight to `ColumnMappingStep` —
// `columnValues` and `suggestedValueMapping` in particular must survive the
// handoff, since the enum sub-mapping UI is built from the COMPLETE distinct
// value set, never from the 5-row `sampleRows` preview.
export interface UploadedBatch {
  batchId: number;
  headers: string[];
  suggestedMapping: Record<string, string | null>;
  sampleRows: Record<string, string>[];
  columnValues: Record<string, string[]>;
  suggestedValueMapping: Record<string, Record<string, string | null>>;
}

// Whole-file parse failure copy (07-UI-SPEC.md Copywriting Contract) —
// deliberately distinct from the per-row validation errors surfaced later in
// the wizard. The action returns this exact string for a csv-parse throw, so
// it doubles as the discriminator for "show the generic guidance body".
const PARSE_FAILURE_HEADING = "Couldn't read this CSV file";
const PARSE_FAILURE_BODY = "Check that it's a valid CSV export and try again.";

interface UploadError {
  heading: string;
  body: string;
}

export function UploadStep({
  entityType,
  onUploaded,
}: {
  entityType: 'company' | 'persona';
  onUploaded: (result: UploadedBatch) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadImportFile(entityType, formData);

      // TypeScript normalizes this action's multi-return union so BOTH members
      // declare `error` (optional/undefined on the success side) — `'error' in
      // result` therefore does not discriminate. Compare against undefined.
      if (result.error !== undefined) {
        // Row-cap and missing-file errors carry their own actionable message;
        // only a genuine parse throw gets the generic "is it a valid CSV?"
        // guidance, which would be misleading for e.g. a 6000-row file.
        setError({
          heading: PARSE_FAILURE_HEADING,
          body: result.error === PARSE_FAILURE_HEADING ? PARSE_FAILURE_BODY : result.error,
        });
        return;
      }

      // Step navigation is owned by the wizard shell — this component only
      // reports what it produced.
      onUploaded(result);
    } catch {
      // Network/serialization failure degrades to the same known-good UI state
      // as a parse failure rather than an unhandled rejection.
      setError({ heading: PARSE_FAILURE_HEADING, body: PARSE_FAILURE_BODY });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownloadTemplate() {
    setError(null);
    setIsDownloading(true);
    try {
      const { filename, csv } = await downloadImportTemplate(entityType);

      // The action returns the CSV as a string, so the download is assembled
      // client-side rather than served from a route.
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError({
        heading: "Couldn't download the template",
        body: 'Something went wrong generating the CSV template. Try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col">
      {error ? (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-[18px] leading-[1.2] font-semibold text-amber-800">{error.heading}</p>
          <p className="text-[14px] leading-[1.5] font-normal text-amber-800">{error.body}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        aria-busy={isUploading}
        // The inner content carries `pointer-events-none`, so dragenter /
        // dragleave only ever fire for this element — no child-crossing
        // flicker, and no drag-depth counter needed.
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          const file = event.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          'flex min-h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center transition-colors outline-none',
          'hover:border-slate-400',
          'focus-visible:border-indigo-600 focus-visible:ring-3 focus-visible:ring-indigo-600/50',
          'disabled:pointer-events-none disabled:opacity-60',
          // The one deliberate accent moment on this step: direct feedback
          // that releasing here will register a drop.
          isDragActive && 'border-indigo-600 bg-indigo-50/50 hover:border-indigo-600'
        )}
      >
        <span className="pointer-events-none flex flex-col items-center gap-2">
          <UploadIcon className="size-8 text-slate-400" aria-hidden="true" />
          <span className="text-[14px] leading-[1.5] font-normal text-slate-900">
            {isUploading ? 'Reading your CSV…' : 'Drag and drop your CSV, or click to browse'}
          </span>
          <span className="text-[12px] leading-[1.4] font-normal text-slate-500">
            Only .csv files, up to 5MB.
          </span>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear the input so re-picking the SAME file after a failed parse
          // still fires onChange.
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      <Button
        type="button"
        variant="outline"
        className="mt-4 self-center"
        disabled={isDownloading}
        onClick={() => void handleDownloadTemplate()}
      >
        <DownloadIcon data-icon="inline-start" />
        Download template
      </Button>
    </div>
  );
}
