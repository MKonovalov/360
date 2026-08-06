'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { humanizeEnum } from '@/components/explorer/explorer-format';
import { DomainForm } from './domain-form';
import { OfferingForm } from './offering-form';

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

export function ServicePortfolio({
  practiceAreas,
  domainsByPracticeAreaId,
  offeringsByDomainId,
  offeringsWithoutDomainByPracticeAreaId,
  buyerRoles,
  rankedBuyerRolesByOfferingId,
  linkedSignalsByOfferingId,
}: ServicePortfolioProps) {
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
      {practiceAreas.map((practiceArea) => {
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
              {/* Task 2: trailing action cluster (reorder / edit / archive / delete) */}
            </div>

            {isPracticeAreaExpanded && (
              <div>
                {domains.map((domain) => {
                  const isDomainExpanded = expandedDomainIds.has(domain.id);
                  const offerings = offeringsByDomainId[domain.id] ?? [];

                  return (
                    <div key={domain.id}>
                      {/* Domain row — level 2, pl-4. NO status badge: the
                          domain table has no status column (schema.ts:336). */}
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
                        {/* Task 2: trailing action cluster (reorder / edit / delete — NO archive) */}
                      </div>

                      {isDomainExpanded && (
                        <div>
                          {offerings.map((offering) => {
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
                                {/* Task 2: trailing action cluster (reorder / edit / archive / delete) */}
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
                    (OFR-04 "No domain" flow). */}
                {domainlessOfferings.map((offering) => {
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
                      {/* Task 2: trailing action cluster (reorder / edit / archive / delete) */}
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
