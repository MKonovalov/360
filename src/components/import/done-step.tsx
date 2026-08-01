import Link from 'next/link';
import { CircleCheckIcon } from 'lucide-react';
import type { ImportCounts } from '@/components/import/validation-preview-step';

// Wizard step 4 — Done (07-UI-SPEC.md). Purely presentational: every number
// here comes from `commitImportBatch`'s actual write results threaded down as
// a prop, never a re-display of the validate step's predicted counts
// (07-RESEARCH.md Pitfall 5). No data fetching, no state.
export function DoneStep({
  result,
  entityType,
}: {
  result: ImportCounts;
  entityType: 'company' | 'persona';
}) {
  // Both links are derived from `entityType` rather than hardcoded, so the
  // same component serves the Company and Persona wizards unchanged (D-05:
  // entity type is fixed per route, never switched inside the wizard).
  const listHref = entityType === 'company' ? '/companies' : '/personas';
  const historyHref =
    entityType === 'company' ? '/companies/import/history' : '/personas/import/history';
  const listLabel =
    entityType === 'company' ? 'View imported companies' : 'View imported personas';

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center">
      <CircleCheckIcon className="size-8 text-slate-900" />

      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">Import complete</p>

      <p className="text-[24px] font-semibold leading-[1.2] text-slate-900">
        {`${result.created} created · ${result.updated} updated · ${result.errored} skipped — errored`}
      </p>

      <div className="space-y-2">
        <p>
          <Link href={listHref} className="text-sm text-indigo-600 hover:underline">
            {listLabel}
          </Link>
        </p>
        <p>
          <Link href={historyHref} className="text-sm text-indigo-600 hover:underline">
            View import history
          </Link>
        </p>
      </div>
    </div>
  );
}
