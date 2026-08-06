'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { humanizeEnum } from '@/components/explorer/explorer-format';
import {
  archiveOfferingAction,
  archivePracticeAreaAction,
  deleteDomainAction,
  deleteOfferingAction,
  deletePracticeAreaAction,
  reorderDomainsAction,
  reorderOfferingsAction,
  reorderPracticeAreasAction,
} from '@/app/actions/offerings';
import { ArchiveEntityDialog } from './archive-entity-dialog';
import { DeleteGuardDialog } from './delete-guard-dialog';
import { DomainForm } from './domain-form';
import { OfferingForm } from './offering-form';
import { PracticeAreaForm } from './practice-area-form';

// OFR-03/OFR-08: the Service Portfolio hierarchy manager — the phase's one
// genuinely new UI pattern (30-PATTERNS.md "No Analog Found"). A hand-rolled
// 3-level useState-driven nested disclosure (D-07: no Accordion primitive is
// vendored and none is being added): Practice Area (pl-0) → Domain (pl-4) →
// Offering (pl-8). Composed FROM the Wave 4/6 row-action components rather
// than any single existing tree component.
//
// Data flows in as server-side props from the page's server component — this
// component never fetches. Reorder buttons persist immediately via the
// reorderXAction Server Actions (T-30-08-01: the actions recompute sortOrder
// purely from array index, scoped to one table each).
//
// Status-badge availability mirrors the schema exactly (schema.ts:303-363):
// Practice Area rows show a 2-value badge, Offering rows a 3-value badge,
// Domain rows show NO badge — the domain table has no status column.
//
// Row actions (T-30-08-02): Edit opens the matching *-form Sheet, Archive
// opens the archive dialog, Delete opens the delete-guard dialog. The Archive
// action exists ONLY where the schema has an archive state — Practice Areas
// and Offerings, never Domains (there is no archiveDomainAction).

export interface OfferingRow {
  id: number;
  practiceAreaId: number;
  domainId: number | null;
  name: string;
  offerType: string;
  description: string;
  commercialModelText: string | null;
  status: 'active' | 'draft' | 'retired';
}

export interface ServicePortfolioProps {
  practiceAreas: Array<{
    id: number;
    name: string;
    shortCode: string;
    description: string | null;
    status: 'active' | 'draft';
  }>;
  domainsByPracticeAreaId: Record<number, Array<{ id: number; name: string }>>;
  offeringsByDomainId: Record<number, OfferingRow[]>;
  offeringsWithoutDomainByPracticeAreaId: Record<number, OfferingRow[]>;
  buyerRoles: Array<{ id: number; name: string }>;
  rankedBuyerRolesByOfferingId: Record<
    number,
    Array<{ buyerRoleId: number; name: string; rank: number }>
  >;
  linkedSignalsByOfferingId: Record<
    number,
    Array<{ signalType: 'company' | 'persona'; signalId: number; name: string }>
  >;
}

// The row's trailing action cluster — reorder arrows (always visible) + a
// MoreVertical overflow menu holding Edit / Archive / Delete. One component
// for all three levels: Domain rows just omit the Archive item (the domain
// table has no status column, so there is no archiveDomainAction).
//
// Menu items that open a Sheet/Dialog keep the dropdown open while the
// overlay mounts (onSelect preventDefault) — the standard Radix composition
// for nesting a trigger inside a menu item.
function RowActions({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  entityLabel,
  disabled,
  children,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  entityLabel: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={disabled || !canMoveUp}
        onClick={onMoveUp}
        aria-label={`Move ${entityLabel} up`}
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={disabled || !canMoveDown}
        onClick={onMoveDown}
        aria-label={`Move ${entityLabel} down`}
      >
        <ArrowDown className="size-3.5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Actions for ${entityLabel}`}
          >
            <MoreVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{children}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ServicePortfolio({
  practiceAreas,
  domainsByPracticeAreaId,
  offeringsByDomainId,
  offeringsWithoutDomainByPracticeAreaId,
  buyerRoles,
  rankedBuyerRolesByOfferingId,
  linkedSignalsByOfferingId,
}: ServicePortfolioProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [expandedPracticeAreaIds, setExpandedPracticeAreaIds] = useState<Set<number>>(
    new Set()
  );
  const [expandedDomainIds, setExpandedDomainIds] = useState<Set<number>>(new Set());

  function togglePracticeArea(id: number) {
    setExpandedPracticeAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleDomain(id: number) {
    setExpandedDomainIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Reorder: compute the new sibling order client-side from the current prop
  // array (array index = new sortOrder), send the full ordered id list to the
  // matching reorderXAction, and refresh on success. Failures surface as a
  // generic banner — never the Server Action's raw reason (house rule).
  function moveWithinScope<T extends { id: number }>(
    items: T[],
    fromIndex: number,
    toIndex: number,
    action: (orderedIds: number[]) => Promise<{ ok: boolean; reason?: string }>
  ) {
    if (toIndex < 0 || toIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setReorderError(null);
    startTransition(async () => {
      const result = await action(next.map((item) => item.id));
      if (!result.ok) {
        setReorderError('Could not reorder. Please try again.');
        return;
      }
      router.refresh();
    });
  }

  if (practiceAreas.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          No Practice Areas yet
        </p>
        <p className="text-sm text-slate-500">
          Practice areas will appear here once your team starts building out the
          service portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {reorderError && (
        <div className="border-b border-slate-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {reorderError}
        </div>
      )}

      {practiceAreas.map((practiceArea, paIndex) => {
        const isPracticeAreaExpanded = expandedPracticeAreaIds.has(practiceArea.id);
        const domains = domainsByPracticeAreaId[practiceArea.id] ?? [];
        const domainlessOfferings =
          offeringsWithoutDomainByPracticeAreaId[practiceArea.id] ?? [];

        return (
          <div key={practiceArea.id}>
            {/* Practice Area row — level 1, pl-0 */}
            <div className="flex items-center gap-2 border-b border-slate-200 py-2 pr-3 pl-0">
              <button
                type="button"
                onClick={() => togglePracticeArea(practiceArea.id)}
                aria-expanded={isPracticeAreaExpanded}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                {isPracticeAreaExpanded ? (
                  <ChevronDown className="size-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-slate-400" />
                )}
                <span className="truncate text-sm text-foreground">
                  {practiceArea.name}
                </span>
              </button>
              <Badge
                variant={practiceArea.status === 'active' ? 'outline' : 'secondary'}
              >
                {humanizeEnum(practiceArea.status)}
              </Badge>
              <RowActions
                canMoveUp={paIndex > 0}
                canMoveDown={paIndex < practiceAreas.length - 1}
                onMoveUp={() =>
                  moveWithinScope(
                    practiceAreas,
                    paIndex,
                    paIndex - 1,
                    reorderPracticeAreasAction
                  )
                }
                onMoveDown={() =>
                  moveWithinScope(
                    practiceAreas,
                    paIndex,
                    paIndex + 1,
                    reorderPracticeAreasAction
                  )
                }
                entityLabel={practiceArea.name}
                disabled={pending}
              >
                <PracticeAreaForm
                  mode="edit"
                  practiceArea={practiceArea}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Edit
                    </DropdownMenuItem>
                  }
                />
                <ArchiveEntityDialog
                  entityLabel={practiceArea.name}
                  onArchive={() => archivePracticeAreaAction(practiceArea.id)}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Archive
                    </DropdownMenuItem>
                  }
                />
                <DropdownMenuSeparator />
                <DeleteGuardDialog
                  entityLabel={practiceArea.name}
                  onDelete={() => deletePracticeAreaAction(practiceArea.id)}
                  trigger={
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      Delete
                    </DropdownMenuItem>
                  }
                />
              </RowActions>
            </div>

            {isPracticeAreaExpanded && (
              <div>
                {domains.map((domain, domainIndex) => {
                  const isDomainExpanded = expandedDomainIds.has(domain.id);
                  const offerings = offeringsByDomainId[domain.id] ?? [];

                  return (
                    <div key={domain.id}>
                      {/* Domain row — level 2, pl-4. NO status badge: the
                          domain table has no status column (schema.ts:336).
                          NO Archive item: no archiveDomainAction. */}
                      <div className="flex items-center gap-2 border-b border-slate-200 py-2 pr-3 pl-4">
                        <button
                          type="button"
                          onClick={() => toggleDomain(domain.id)}
                          aria-expanded={isDomainExpanded}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          {isDomainExpanded ? (
                            <ChevronDown className="size-4 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="size-4 shrink-0 text-slate-400" />
                          )}
                          <span className="truncate text-sm text-foreground">
                            {domain.name}
                          </span>
                        </button>
                        <RowActions
                          canMoveUp={domainIndex > 0}
                          canMoveDown={domainIndex < domains.length - 1}
                          onMoveUp={() =>
                            moveWithinScope(
                              domains,
                              domainIndex,
                              domainIndex - 1,
                              reorderDomainsAction
                            )
                          }
                          onMoveDown={() =>
                            moveWithinScope(
                              domains,
                              domainIndex,
                              domainIndex + 1,
                              reorderDomainsAction
                            )
                          }
                          entityLabel={domain.name}
                          disabled={pending}
                        >
                          <DomainForm
                            mode="edit"
                            practiceAreaId={practiceArea.id}
                            domain={domain}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Edit
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuSeparator />
                          <DeleteGuardDialog
                            entityLabel={domain.name}
                            onDelete={() => deleteDomainAction(domain.id)}
                            trigger={
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                Delete
                              </DropdownMenuItem>
                            }
                          />
                        </RowActions>
                      </div>

                      {isDomainExpanded && (
                        <div>
                          {offerings.map((offering, offeringIndex) => {
                            const isRetired = offering.status === 'retired';
                            return (
                              <div
                                key={offering.id}
                                className={
                                  isRetired
                                    ? 'flex items-center gap-2 border-b border-slate-200 py-2 pr-3 pl-8 opacity-70'
                                    : 'flex items-center gap-2 border-b border-slate-200 py-2 pr-3 pl-8'
                                }
                              >
                                {/* Offering rows are the leaf level — no
                                    chevron, nothing to expand further. */}
                                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                  {offering.name}
                                </span>
                                <Badge
                                  variant={
                                    offering.status === 'active'
                                      ? 'outline'
                                      : 'secondary'
                                  }
                                >
                                  {humanizeEnum(offering.status)}
                                </Badge>
                                <RowActions
                                  canMoveUp={offeringIndex > 0}
                                  canMoveDown={offeringIndex < offerings.length - 1}
                                  onMoveUp={() =>
                                    moveWithinScope(
                                      offerings,
                                      offeringIndex,
                                      offeringIndex - 1,
                                      reorderOfferingsAction
                                    )
                                  }
                                  onMoveDown={() =>
                                    moveWithinScope(
                                      offerings,
                                      offeringIndex,
                                      offeringIndex + 1,
                                      reorderOfferingsAction
                                    )
                                  }
                                  entityLabel={offering.name}
                                  disabled={pending}
                                >
                                  <OfferingForm
                                    mode="edit"
                                    offering={offering}
                                    existingRankedBuyerRoles={
                                      rankedBuyerRolesByOfferingId[offering.id] ?? []
                                    }
                                    linkedSignals={
                                      linkedSignalsByOfferingId[offering.id] ?? []
                                    }
                                    practiceAreas={practiceAreas}
                                    domainsByPracticeAreaId={domainsByPracticeAreaId}
                                    buyerRoles={buyerRoles}
                                    trigger={
                                      <DropdownMenuItem
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        Edit
                                      </DropdownMenuItem>
                                    }
                                  />
                                  <ArchiveEntityDialog
                                    entityLabel={offering.name}
                                    onArchive={() => archiveOfferingAction(offering.id)}
                                    trigger={
                                      <DropdownMenuItem
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        Archive
                                      </DropdownMenuItem>
                                    }
                                  />
                                  <DropdownMenuSeparator />
                                  <DeleteGuardDialog
                                    entityLabel={offering.name}
                                    onDelete={() => deleteOfferingAction(offering.id)}
                                    trigger={
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        Delete
                                      </DropdownMenuItem>
                                    }
                                  />
                                </RowActions>
                              </div>
                            );
                          })}

                          {/* "+ New Offering" — LAST row inside an expanded
                              Domain, dashed-border ghost row (UI-SPEC 166). */}
                          <div className="border-b border-slate-200 py-1.5 pr-3 pl-8">
                            <OfferingForm
                              mode="create"
                              practiceAreas={practiceAreas}
                              domainsByPracticeAreaId={domainsByPracticeAreaId}
                              buyerRoles={buyerRoles}
                              trigger={
                                <Button
                                  variant="ghost"
                                  className="w-full border border-dashed border-slate-300"
                                >
                                  + New Offering
                                </Button>
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* The practice area's OWN domain-less offerings — rendered at
                    the domain nesting level (pl-4) exactly like a domain-owned
                    offering row, but sitting directly under the Practice Area
                    (OFR-04 "No domain" flow). Reorder scope: the practice
                    area's domain-less block only. */}
                {domainlessOfferings.map((offering, offeringIndex) => {
                  const isRetired = offering.status === 'retired';
                  return (
                    <div
                      key={offering.id}
                      className={
                        isRetired
                          ? 'flex items-center gap-2 border-b border-slate-200 py-2 pr-3 pl-4 opacity-70'
                          : 'flex items-center gap-2 border-b border-slate-200 py-2 pr-3 pl-4'
                      }
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {offering.name}
                      </span>
                      <Badge
                        variant={offering.status === 'active' ? 'outline' : 'secondary'}
                      >
                        {humanizeEnum(offering.status)}
                      </Badge>
                      <RowActions
                        canMoveUp={offeringIndex > 0}
                        canMoveDown={offeringIndex < domainlessOfferings.length - 1}
                        onMoveUp={() =>
                          moveWithinScope(
                            domainlessOfferings,
                            offeringIndex,
                            offeringIndex - 1,
                            reorderOfferingsAction
                          )
                        }
                        onMoveDown={() =>
                          moveWithinScope(
                            domainlessOfferings,
                            offeringIndex,
                            offeringIndex + 1,
                            reorderOfferingsAction
                          )
                        }
                        entityLabel={offering.name}
                        disabled={pending}
                      >
                        <OfferingForm
                          mode="edit"
                          offering={offering}
                          existingRankedBuyerRoles={
                            rankedBuyerRolesByOfferingId[offering.id] ?? []
                          }
                          linkedSignals={
                            linkedSignalsByOfferingId[offering.id] ?? []
                          }
                          practiceAreas={practiceAreas}
                          domainsByPracticeAreaId={domainsByPracticeAreaId}
                          buyerRoles={buyerRoles}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Edit
                            </DropdownMenuItem>
                          }
                        />
                        <ArchiveEntityDialog
                          entityLabel={offering.name}
                          onArchive={() => archiveOfferingAction(offering.id)}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Archive
                            </DropdownMenuItem>
                          }
                        />
                        <DropdownMenuSeparator />
                        <DeleteGuardDialog
                          entityLabel={offering.name}
                          onDelete={() => deleteOfferingAction(offering.id)}
                          trigger={
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              Delete
                            </DropdownMenuItem>
                          }
                        />
                      </RowActions>
                    </div>
                  );
                })}

                {/* "+ New Domain" — LAST row inside an expanded Practice Area,
                    dashed-border ghost row (UI-SPEC 166). */}
                <div className="border-b border-slate-200 py-1.5 pr-3 pl-4">
                  <DomainForm
                    mode="create"
                    practiceAreaId={practiceArea.id}
                    trigger={
                      <Button
                        variant="ghost"
                        className="w-full border border-dashed border-slate-300"
                      >
                        + New Domain
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
