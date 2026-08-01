'use client';

import { useState, useTransition } from 'react';
import { DownloadIcon } from 'lucide-react';
import { commitImportBatch } from '@/app/actions/import';
import { StatCard } from '@/components/dashboard/stat-card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface ImportCounts {
  created: number;
  updated: number;
  errored: number;
}

export interface ImportRowError {
  row: number;
  errors: string[];
}

// Outbound CSV-injection guard. The error report is opened in Excel/Sheets by
// staff, so any cell whose text a spreadsheet would evaluate as a formula gets
// a leading apostrophe — the output-side counterpart to `safeCsvString`'s
// inbound guard in `src/lib/validation/seed.ts`.
function guardCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function toCsvCell(value: string): string {
  return `"${guardCsvCell(value).replace(/"/g, '""')}"`;
}

// Built client-side rather than via a Server Action: the error report is
// already fully in memory as a prop, so a round-trip would only re-serialize
// data the browser is holding. `csv-stringify` stays server-only for the same
// reason — no need to ship a parser to the client for two columns.
function buildErrorReportCsv(errorReport: ImportRowError[]): string {
  const lines = ['"Row","Reason"'];
  for (const { row, errors } of errorReport) {
    lines.push(`${toCsvCell(String(row))},${toCsvCell(errors.join('; '))}`);
  }
  return lines.join('\n');
}

// Wizard step 3 — Validate & Confirm (07-UI-SPEC.md). Renders the predicted
// counts, the skipped-row report, and the single write-triggering action of
// the whole flow. Deliberately holds no step-navigation state: the parent
// wizard owns `step`, and this component only reports the commit outcome
// upward via `onCommitted`.
export function ValidationPreviewStep({
  batchId,
  counts,
  errorReport,
  entityType,
  onCommitted,
}: {
  batchId: number;
  counts: ImportCounts;
  errorReport: ImportRowError[];
  entityType: 'company' | 'persona';
  onCommitted: (result: ImportCounts) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [commitFailed, setCommitFailed] = useState(false);

  // IMPT-03 partial commit: a bad row never blocks the rest, so errors alone
  // never disable Commit — only "nothing left to write" does.
  const committableRows = counts.created + counts.updated;
  const canCommit = committableRows > 0;

  function handleDownloadErrorReport() {
    const blob = new Blob([buildErrorReportCsv(errorReport)], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      entityType === 'company'
        ? 'companies-import-errors.csv'
        : 'personas-import-errors.csv';
    anchor.click();
    // Release the blob immediately — the download has already been handed to
    // the browser by the synchronous click above.
    URL.revokeObjectURL(url);
  }

  function handleCommit() {
    setCommitFailed(false);
    startTransition(async () => {
      const result = await commitImportBatch(batchId);
      if ('error' in result) {
        setCommitFailed(true);
        return;
      }
      onCommitted(result);
    });
  }

  return (
    <div className="flex flex-col gap-12 p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Will create" value={counts.created} />
        <StatCard label="Will update" value={counts.updated} />
        <StatCard label="Errors" value={counts.errored} />
      </div>

      {counts.errored > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="text-[18px] font-semibold leading-[1.2]">
              {counts.errored === 1
                ? '1 row will be skipped'
                : `${counts.errored} rows will be skipped`}
            </p>
            <p className="text-sm">
              {
                'Fix these rows in your source file and re-upload, or continue — valid rows will still import.'
              }
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleDownloadErrorReport}>
              <DownloadIcon data-icon="inline-start" />
              Download error report
            </Button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorReport.map((entry) => (
                  <TableRow key={entry.row}>
                    <TableCell className="text-slate-900">{entry.row}</TableCell>
                    <TableCell className="whitespace-normal text-slate-600">
                      {entry.errors.join('; ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col items-start gap-2">
        <Button variant="default" onClick={handleCommit} disabled={!canCommit || isPending}>
          Commit Import
        </Button>
        {!canCommit ? (
          <p className="text-sm text-slate-500">Fix the errors above before importing.</p>
        ) : null}
        {commitFailed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="text-[18px] font-semibold leading-[1.2]">
              {"Couldn't commit this import"}
            </p>
            <p className="text-sm">Something went wrong writing these rows. Try again.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
