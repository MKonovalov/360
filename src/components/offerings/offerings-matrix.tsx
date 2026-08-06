'use client';

import { Fragment, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteTriggerAction,
  updateOfferingBuyerRolesAction,
} from '@/app/actions/offerings';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  RankedBuyerRoleEntry,
  RankedBuyerRolesPicker,
} from './ranked-buyer-roles-picker';
import { TriggerEditor } from './trigger-editor';

export interface OfferingRow {
  id: number;
  name: string;
  commercialModelText: string | null;
  status: 'active' | 'draft' | 'retired';
}

export interface OfferingsMatrixProps {
  domains: Array<{ id: number; name: string }>;
  offeringsByDomainId: Record<number, Array<OfferingRow>>;
  offeringsWithoutDomainForPracticeArea: Array<OfferingRow>;
  buyerRoles: Array<{ id: number; name: string }>;
  rankedBuyerRolesByOfferingId: Record<
    number,
    Array<{ buyerRoleId: number; name: string; rank: number }>
  >;
  triggersByOfferingId: Record<number, Array<{ id: number; triggerText: string }>>;
  hasActiveFilters: boolean;
  hasAnyOfferingsForPracticeArea: boolean;
}

// OFR-05: the Primary Buyer(s) cell is a read-view span that opens the SAME
// RankedBuyerRolesPicker the Offering form uses (D-04) in a Popover for inline
// editing. The picker is a pure controlled component — every change flows out
// through onRankedChange to the parent's immediate-persist path (T-30-03-01),
// never a Server Action call inside this cell.
function PrimaryBuyersCell({
  rankedBuyers,
  buyerRoles,
  onRankedChange,
}: {
  rankedBuyers: Array<{ buyerRoleId: number; name: string; rank: number }>;
  buyerRoles: Array<{ id: number; name: string }>;
  onRankedChange: (next: RankedBuyerRoleEntry[]) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className="cursor-pointer text-sm">
          {rankedBuyers.length === 0
            ? '—'
            : rankedBuyers
                .map((b, i) => `${i + 1}. ${b.name}`)
                .join(', ')}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <RankedBuyerRolesPicker
          buyerRoles={buyerRoles}
          selectedRanked={rankedBuyers}
          onChange={onRankedChange}
        />
      </PopoverContent>
    </Popover>
  );
}

// OFR-05: the Matrix tab — a Practice-Area-filtered Table grouped by Domain
// section headers (Design/Build/Run), where Triggers (add/remove) and ranked
// Primary Buyers are editable inline. Commercial Model stays plain read-only
// text on this tab per D-08 — its edit surface is the Offering Sheet.
export function OfferingsMatrix({
  domains,
  offeringsByDomainId,
  offeringsWithoutDomainForPracticeArea,
  buyerRoles,
  rankedBuyerRolesByOfferingId,
  triggersByOfferingId,
  hasActiveFilters,
  hasAnyOfferingsForPracticeArea,
}: OfferingsMatrixProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (!hasAnyOfferingsForPracticeArea) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          No offerings for this Practice Area yet
        </p>
        <p className="text-sm text-slate-500">
          Switch to the Service Portfolio tab to add offerings, or choose a
          different Practice Area filter.
        </p>
      </div>
    );
  }

  // Defensive filtered-to-zero edge: the practice area HAS offerings (the
  // branch above returned) but none landed in a domain bucket or the
  // domain-less block — show the filtered-empty state rather than an empty
  // table.
  if (domains.length === 0 && offeringsWithoutDomainForPracticeArea.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          No offerings match your filters
        </p>
        <p className="text-sm text-slate-500">
          Try removing a filter or clearing your search.
        </p>
      </div>
    );
  }

  // Trigger remove is a bare inline × (T-30-09-02 accept: triggers are
  // low-stakes, easily-recreated leaf rows, so no confirmation dialog and no
  // destructive styling on this affordance — D-10 keeps destructive red for
  // the guarded hard-delete triggers only).
  function handleDeleteTrigger(triggerId: number) {
    startTransition(async () => {
      try {
        const result = await deleteTriggerAction(triggerId);
        if (!result.ok) return;
        router.refresh();
      } catch {
        // Fail silent toward the known-good list state (house convention).
      }
    });
  }

  // Immediate-persist path (distinct from the Offering form's
  // local-state-then-submit): every picker change writes through the SAME
  // syncOfferingBuyerRoles helper the form path uses (T-30-03-01), then
  // refreshes so the read-view text re-renders from server state.
  function handleRankedChange(offeringId: number, next: RankedBuyerRoleEntry[]) {
    startTransition(async () => {
      try {
        const result = await updateOfferingBuyerRolesAction(offeringId, next);
        if (!result.ok) return;
        router.refresh();
      } catch {
        // Fail silent toward the known-good list state (house convention).
      }
    });
  }

  function renderOfferingRow(offering: OfferingRow) {
    const triggers = triggersByOfferingId[offering.id] ?? [];
    const rankedBuyers = rankedBuyerRolesByOfferingId[offering.id] ?? [];

    return (
      <TableRow
        key={offering.id}
        className={offering.status === 'retired' ? 'opacity-70' : undefined}
      >
        <TableCell className="text-foreground">{offering.name}</TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-1">
            {triggers.map((trigger) => (
              <Badge key={trigger.id} variant="outline" className="gap-1">
                {trigger.triggerText}
                <button
                  aria-label="Remove trigger"
                  onClick={() => handleDeleteTrigger(trigger.id)}
                >
                  ×
                </button>
              </Badge>
            ))}
            {triggers.length === 0 && (
              <span className="text-sm text-slate-500">No triggers yet.</span>
            )}
            <TriggerEditor
              offeringId={offering.id}
              trigger={
                <Button variant="ghost" size="sm">
                  + Add trigger
                </Button>
              }
            />
          </div>
        </TableCell>
        <TableCell>
          <PrimaryBuyersCell
            rankedBuyers={rankedBuyers}
            buyerRoles={buyerRoles}
            onRankedChange={(next) => handleRankedChange(offering.id, next)}
          />
        </TableCell>
        <TableCell>
          {/* Plain truncated text only — no click handler, Popover, Sheet, or
              edit affordance on this tab (D-08: Commercial Model editing stays
              in the Offering Sheet). */}
          <span className="truncate">{offering.commercialModelText ?? '—'}</span>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Offering</TableHead>
            <TableHead>Trigger(s)</TableHead>
            <TableHead>Primary Buyer(s)</TableHead>
            <TableHead>Commercial Model</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {domains.map((domain) => (
            <Fragment key={domain.id}>
              <TableRow className="bg-muted">
                <TableCell colSpan={4} className="font-semibold text-[14px]">
                  {domain.name}
                </TableCell>
              </TableRow>
              {(offeringsByDomainId[domain.id] ?? []).map(renderOfferingRow)}
            </Fragment>
          ))}
          {offeringsWithoutDomainForPracticeArea.length > 0 && (
            <Fragment>
              <TableRow className="bg-muted">
                <TableCell colSpan={4} className="font-semibold text-[14px]">
                  Other
                </TableCell>
              </TableRow>
              {offeringsWithoutDomainForPracticeArea.map(renderOfferingRow)}
            </Fragment>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
