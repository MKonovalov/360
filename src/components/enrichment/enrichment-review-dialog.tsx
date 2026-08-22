'use client';

import { useRef, useState, useTransition } from 'react';
import { EllipsisVerticalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { humanizeEnum } from '@/components/explorer/explorer-format';
import { runEnrichment, commitEnrichment } from '@/app/actions/enrichment';
import { AnalysisMenuAction } from '@/components/analysis/AnalysisMenuAction';
import { AnalysisLauncher } from '@/components/analysis/AnalysisLauncher';
import type { EnrichmentPlanRow } from '@/lib/enrichment/mergePlan';

// Combined detail-panel Menu (Enrich + Analyze) plus the
// enrichment review dialog. Self-contained so it can drop into the two
// server-rendered detail panels (company-detail / persona-detail) in the slot
// the ExplorerMenu icon variant used to occupy. ENRC-01/02/04/05.
//
// Nothing writes until the user clicks Commit — runEnrichment only fetches the
// plan; commitEnrichment writes the checked fields.

const FIELD_LABELS: Record<string, string> = {
  industry: 'Industry',
  employeeCountBand: 'Employees',
  hqLocation: 'HQ Location',
  revenueBand: 'Revenue',
  ownershipType: 'Ownership',
  techStack: 'Tech Stack',
  title: 'Title',
  seniority: 'Seniority',
  linkedinUrl: 'LinkedIn',
};

// Enum-valued fields render through humanizeEnum; free-text/array fields render raw.
const ENUM_FIELDS = new Set(['revenueBand', 'ownershipType', 'seniority']);

function displayValue(field: string, value: string | string[] | null): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (ENUM_FIELDS.has(field)) return humanizeEnum(value);
  return value;
}

type ReviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; reason: string }
  | { status: 'empty' }
  | { status: 'ready'; rows: EnrichmentPlanRow[]; proposalToken: string };

const ERROR_COPY: Record<string, string> = {
  not_configured: "Enrichment isn't configured. Add the enrichment API keys to enable it.",
  no_match_key: 'Add a domain (company) or email (persona) to this record before enriching.',
  no_match: 'No matching record was found for this domain or email.',
  not_found: 'This record could not be loaded.',
  network: 'Enrichment failed to reach the provider. Please try again.',
  invalid_response: 'The provider returned an unexpected response. Please try again later.',
  invalid_request: 'This enrichment request is invalid. Close the dialog and try again.',
  invalid_proposal: 'This review is no longer valid. Close it and run enrichment again.',
  expired_proposal: 'This review expired. Close it and run enrichment again.',
  stale_review: 'This record changed after the review opened. Run enrichment again before saving.',
  action_failed: 'Enrichment could not be completed. Please try again.',
};

function errorMessage(reason: string): string {
  if (ERROR_COPY[reason]) return ERROR_COPY[reason];
  if (reason.startsWith('http_')) return `Enrichment failed (HTTP ${reason.slice(5)}). Try again.`;
  return 'Enrichment failed. Please try again.';
}

export function EnrichMenu({
  entityType,
  recordId,
  canEnrich,
  disabledReason,
  canAnalyze = true,
  analyzeDisabledReason = 'Analysis unavailable',
}: {
  entityType: 'company' | 'persona';
  recordId: number;
  canEnrich: boolean;
  disabledReason: string;
  canAnalyze?: boolean;
  analyzeDisabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [state, setState] = useState<ReviewState>({ status: 'idle' });
  // field → checked; seeded from each row's preAccepted flag when the plan loads
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [commitError, setCommitError] = useState<string | null>(null);
  const requestGeneration = useRef(0);

  function startEnrichment() {
    if (!canEnrich) return;
    const generation = ++requestGeneration.current;
    setMenuOpen(false);
    setOpen(true);
    setState({ status: 'loading' });
    setCommitError(null);
    startTransition(async () => {
      try {
        const result = await runEnrichment({ entityType, recordId });
        if (generation !== requestGeneration.current) return;
        if (!result.ok) {
          setState({ status: 'error', reason: result.reason });
          return;
        }
        if (result.plan.length === 0) {
          setState({ status: 'empty' });
          return;
        }
        setChecked(Object.fromEntries(result.plan.map((row) => [row.field, row.preAccepted])));
        setState({ status: 'ready', rows: result.plan, proposalToken: result.proposalToken });
      } catch {
        if (generation !== requestGeneration.current) return;
        setState({ status: 'error', reason: 'action_failed' });
      }
    });
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      requestGeneration.current++;
    }
    setOpen(nextOpen);
    if (nextOpen) return;
    setState({ status: 'idle' });
    setChecked({});
    setCommitError(null);
  }

  function commit() {
    if (state.status !== 'ready') return;
    const acceptedFields = state.rows.filter((row) => checked[row.field]).map((row) => row.field);
    const proposalToken = state.proposalToken;
    const generation = requestGeneration.current;
    setCommitError(null);
    startTransition(async () => {
      try {
        const result = await commitEnrichment({ token: proposalToken, acceptedFields });
        if (generation !== requestGeneration.current) return;
        if (!result.ok) {
          setCommitError(errorMessage(result.reason));
          return;
        }
        handleDialogOpenChange(false);
      } catch {
        if (generation !== requestGeneration.current) return;
        setCommitError(errorMessage('action_failed'));
      }
    });
  }

  const checkedCount = state.status === 'ready' ? state.rows.filter((r) => checked[r.field]).length : 0;

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Agent menu">
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!canEnrich} onSelect={startEnrichment}>
            {canEnrich ? 'Enrich' : `Enrich — ${disabledReason}`}
          </DropdownMenuItem>
          <AnalysisMenuAction
            canAnalyze={canAnalyze}
            disabledReason={analyzeDisabledReason}
            onAnalyze={() => {
              setMenuOpen(false);
              setAnalysisOpen(true);
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <AnalysisLauncher
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        subjectType={entityType}
        subjectId={recordId}
      />

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review enrichment</DialogTitle>
            <DialogDescription>
              Empty fields are pre-selected to fill. Conflicting values are unchecked — accept them
              per field. Nothing is saved until you commit.
            </DialogDescription>
          </DialogHeader>

          {state.status === 'loading' && (
            <p className="py-8 text-center text-sm text-slate-500">Enriching…</p>
          )}

          {state.status === 'error' && (
            <p className="py-8 text-center text-sm text-red-600">{errorMessage(state.reason)}</p>
          )}

          {state.status === 'empty' && (
            <p className="py-8 text-center text-sm text-slate-500">
              This record is already up to date — the provider returned nothing new.
            </p>
          )}

          {state.status === 'ready' && (
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-8 py-2"></th>
                    <th className="py-2">Field</th>
                    <th className="py-2">Current</th>
                    <th className="py-2">Incoming</th>
                    <th className="py-2 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row) => (
                    <tr key={row.field} className="border-t border-slate-100">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={!!checked[row.field]}
                          onChange={(e) =>
                            setChecked((c) => ({ ...c, [row.field]: e.target.checked }))
                          }
                          aria-label={`Accept ${FIELD_LABELS[row.field] ?? row.field}`}
                        />
                      </td>
                      <td className="py-2 font-medium text-slate-900">
                        {FIELD_LABELS[row.field] ?? row.field}
                        {row.classification === 'conflict' && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                            conflict
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-slate-500">
                        {displayValue(row.field, row.currentValue)}
                      </td>
                      <td className="py-2 text-slate-900">
                        {displayValue(row.field, row.incomingValue)}
                      </td>
                      <td className="py-2 text-right text-slate-500">
                        {row.confidence !== undefined ? `${Math.round(row.confidence * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {commitError && <p className="text-sm text-red-600">{commitError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            {state.status === 'ready' && (
              <Button onClick={commit} disabled={pending || checkedCount === 0}>
                {pending ? 'Saving…' : `Commit ${checkedCount} field${checkedCount === 1 ? '' : 's'}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
