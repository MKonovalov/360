import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { parseOfferingsFilters } from '@/lib/params/offeringsFilters';
import { listAllPracticeAreas } from '@/lib/db/queries/practiceAreas';
import { listBuyerRoles } from '@/lib/db/queries/buyerRoles';
import {
  listAllOfferingsForPracticeArea,
  listBuyerRolesForOffering,
  listTriggersForOffering,
} from '@/lib/db/queries/offerings';
import { listDomainsForPracticeArea } from '@/lib/db/queries/domains';
import { listLinksForOffering } from '@/lib/db/queries/signalOfferingLinks';
import {
  listAllCompanySignalsForPracticeArea,
} from '@/lib/db/queries/companySignals';
import {
  listAllPersonaSignalsForPracticeArea,
} from '@/lib/db/queries/personaSignals';
import { OfferingsTabs, type OfferingsTabsProps } from '@/components/offerings/offerings-tabs';
import { type OfferingRow } from '@/components/offerings/service-portfolio';

// Belt-and-suspenders alongside the (dashboard) layout's auth gate (the same
// pattern as signals/page.tsx) — every page in the group gates itself too, so
// the check can never be skipped by a future refactor of the layout alone.
// The route is deliberately placed in the shared (dashboard) group (mirroring
// /reviews, /settings and /signals) so no redundant layout.tsx is required.
export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const filters = parseOfferingsFilters(await searchParams);

  // The page shell is rendered from these typed buckets; every one is assigned
  // inside the try below. The offerings/domains/practice-area rows fetched
  // from the query layer are structurally assignable to the component prop
  // shapes (extra audit columns are simply not projected into the interfaces).
  let practiceAreas: OfferingsTabsProps['practiceAreas'];
  let domainsByPracticeAreaId: OfferingsTabsProps['domainsByPracticeAreaId'];
  let offeringsByDomainId: OfferingsTabsProps['offeringsByDomainId'];
  let offeringsWithoutDomainByPracticeAreaId: OfferingsTabsProps['offeringsWithoutDomainByPracticeAreaId'];
  let buyerRoles: OfferingsTabsProps['buyerRoles'];
  let rankedBuyerRolesByOfferingId: OfferingsTabsProps['rankedBuyerRolesByOfferingId'];
  let triggersByOfferingId: OfferingsTabsProps['triggersByOfferingId'];
  let linkedSignalsByOfferingId: OfferingsTabsProps['linkedSignalsByOfferingId'];
  // Matrix-scoped subset — computed from the selected practice area (GBS
  // default or the ?practiceArea= URL filter).
  let matrixDomains: OfferingsTabsProps['matrixDomains'];
  let matrixOfferingsByDomainId: OfferingsTabsProps['matrixOfferingsByDomainId'];
  let matrixOfferingsWithoutDomain: OfferingsTabsProps['matrixOfferingsWithoutDomain'];
  let hasAnyOfferingsForPracticeArea: boolean;

  // EXPL-06 pattern: a DB-fetch failure degrades to the established per-page
  // error card (same copy shape as signals/page.tsx), never Next.js's default
  // 500. T-30-10-04: the card is generic — no raw DB error text leaks out.
  try {
    // Admin list, not the active-only picker: the Service Portfolio manages
    // drafts too, and the Matrix filter dropdown needs every status.
    practiceAreas = await listAllPracticeAreas();

    // OFR-05 "defaults to GBS": when no ?practiceArea= filter is present the
    // Matrix tab resolves to the GBS practice area. Defensive fallback to the
    // first practice area + undefined-safe lookups below mean an empty
    // practice-area table (should never happen post-seed) degrades to the
    // Matrix zero-state instead of a crash.
    const gbsPracticeArea = practiceAreas.find((pa) => pa.shortCode === 'GBS') ?? practiceAreas[0];
    const selectedPracticeAreaId = filters.practiceAreaId ?? gbsPracticeArea?.id;

    // Build the full Service Portfolio buckets across EVERY practice area:
    // domainsByPracticeAreaId, offeringsByDomainId (offerings bucketed by
    // their non-null domainId), offeringsWithoutDomainByPracticeAreaId
    // (domainId === null, OFR-04 "No domain" flow), plus the flat allOfferings
    // accumulator that feeds the N+1 buyer-role/trigger/link fetches below.
    domainsByPracticeAreaId = {};
    offeringsByDomainId = {};
    offeringsWithoutDomainByPracticeAreaId = {};
    const allOfferings: OfferingRow[] = [];
    await Promise.all(
      practiceAreas.map(async (pa) => {
        const [domains, offerings] = await Promise.all([
          listDomainsForPracticeArea(pa.id),
          listAllOfferingsForPracticeArea(pa.id),
        ]);
        domainsByPracticeAreaId[pa.id] = domains;
        const domainless: OfferingRow[] = [];
        for (const o of offerings) {
          if (o.domainId === null) {
            domainless.push(o);
          } else {
            (offeringsByDomainId[o.domainId] ??= []).push(o);
          }
          allOfferings.push(o);
        }
        offeringsWithoutDomainByPracticeAreaId[pa.id] = domainless;
      })
    );

    buyerRoles = await listBuyerRoles();

    // N+1 per-offering fan-out (ranked buyer roles + triggers + reverse links)
    // accepted at current seed scale (11 GBS offerings, ~39 signal rows total)
    // — mirrors signals/page.tsx's own documented per-row link-fetch precedent
    // (T-30-10-03 accept). Each query is a fast indexed lookup.
    rankedBuyerRolesByOfferingId = {};
    triggersByOfferingId = {};
    const linksByOfferingId: Record<number, Awaited<ReturnType<typeof listLinksForOffering>>> = {};
    await Promise.all(
      allOfferings.map(async (offering) => {
        const [ranked, triggers, links] = await Promise.all([
          listBuyerRolesForOffering(offering.id),
          listTriggersForOffering(offering.id),
          listLinksForOffering(offering.id),
        ]);
        rankedBuyerRolesByOfferingId[offering.id] = ranked;
        triggersByOfferingId[offering.id] = triggers;
        linksByOfferingId[offering.id] = links;
      })
    );

    // OFR-07 reverse lookup: fetch every company + persona signal name across
    // all practice areas up front, then resolve each offering's link rows to
    // names (mirroring signals/page.tsx's fetch-all-then-resolve approach).
    const companySignalNamesById: Record<number, string> = {};
    const personaSignalNamesById: Record<number, string> = {};
    await Promise.all(
      practiceAreas.map(async (pa) => {
        const [companySignals, personaSignals] = await Promise.all([
          listAllCompanySignalsForPracticeArea(pa.id),
          listAllPersonaSignalsForPracticeArea(pa.id),
        ]);
        for (const s of companySignals) companySignalNamesById[s.id] = s.name;
        for (const s of personaSignals) personaSignalNamesById[s.id] = s.name;
      })
    );

    linkedSignalsByOfferingId = {};
    for (const offering of allOfferings) {
      const links = linksByOfferingId[offering.id] ?? [];
      linkedSignalsByOfferingId[offering.id] = links.map((link) => ({
        signalType: link.signalType,
        signalId: link.signalId,
        // Unknown ids (a link whose signal was hard-deleted) degrade to the
        // bare id rather than an undefined name.
        name:
          (link.signalType === 'company'
            ? companySignalNamesById
            : personaSignalNamesById)[link.signalId] ?? `#${link.signalId}`,
      }));
    }

    // Matrix-scoped subset for the selected practice area — the OfferingsTabs
    // Matrix tab renders only this pre-scoped data (OfferingsFilters drives
    // ?practiceArea= which re-fetches this page server-side via shallow:false).
    matrixDomains = domainsByPracticeAreaId[selectedPracticeAreaId!] ?? [];
    matrixOfferingsByDomainId = {};
    for (const domain of matrixDomains) {
      matrixOfferingsByDomainId[domain.id] = offeringsByDomainId[domain.id] ?? [];
    }
    matrixOfferingsWithoutDomain =
      offeringsWithoutDomainByPracticeAreaId[selectedPracticeAreaId!] ?? [];
    hasAnyOfferingsForPracticeArea =
      matrixDomains.some((d) => (offeringsByDomainId[d.id]?.length ?? 0) > 0) ||
      matrixOfferingsWithoutDomain.length > 0;
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Couldn&apos;t load the Service Portfolio
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  const hasActiveFilters = filters.practiceAreaId !== undefined;

  return (
    <div className="flex flex-col gap-12 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Offerings</h1>
      <OfferingsTabs
        practiceAreas={practiceAreas}
        domainsByPracticeAreaId={domainsByPracticeAreaId}
        offeringsByDomainId={offeringsByDomainId}
        offeringsWithoutDomainByPracticeAreaId={offeringsWithoutDomainByPracticeAreaId}
        buyerRoles={buyerRoles}
        rankedBuyerRolesByOfferingId={rankedBuyerRolesByOfferingId}
        linkedSignalsByOfferingId={linkedSignalsByOfferingId}
        matrixDomains={matrixDomains}
        matrixOfferingsByDomainId={matrixOfferingsByDomainId}
        matrixOfferingsWithoutDomain={matrixOfferingsWithoutDomain}
        triggersByOfferingId={triggersByOfferingId}
        hasActiveFilters={hasActiveFilters}
        hasAnyOfferingsForPracticeArea={hasAnyOfferingsForPracticeArea}
      />
    </div>
  );
}
