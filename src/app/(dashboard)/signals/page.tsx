import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { parseSignalFilters } from '@/lib/params/signalFilters';
import { listActivePracticeAreas } from '@/lib/db/queries/practiceAreas';
import { listBuyerRoles } from '@/lib/db/queries/buyerRoles';
import {
  listAllCompanySignalsForPracticeArea,
  listDistinctCompanySignalCategories,
} from '@/lib/db/queries/companySignals';
import {
  listAllPersonaSignalsForPracticeArea,
  listDistinctPersonaSignalCategories,
} from '@/lib/db/queries/personaSignals';
import {
  listActiveOfferingsForPracticeArea,
  listAllOfferingsForPracticeArea,
} from '@/lib/db/queries/offerings';
import { listLinksForSignal } from '@/lib/db/queries/signalOfferingLinks';
import { SignalsTabs } from '@/components/signals/signals-tabs';
import { CompanySignalRow, PersonaSignalRow } from '@/components/signals/signal-table';

// Belt-and-suspenders alongside the (dashboard) layout's auth gate
// (29-RESEARCH.md Pitfall 3) — every page in the group gates itself too, so
// the check can never be skipped by a future refactor of the layout alone.
// The route is deliberately placed in the shared (dashboard) group (mirroring
// /reviews and /settings) so no redundant layout.tsx is required.
export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const filters = parseSignalFilters(await searchParams);

  // EXPL-06: a DB-fetch failure degrades to the established per-page error
  // card (same copy shape as reviews/page.tsx), never Next.js's default 500.
  let practiceAreas: Awaited<ReturnType<typeof listActivePracticeAreas>>;
  let companySignalsRaw: CompanySignalRow[];
  let personaSignalsRaw: PersonaSignalRow[];
  let buyerRoles: Awaited<ReturnType<typeof listBuyerRoles>>;
  let companyCategories: string[];
  let personaCategories: string[];
  let activeOfferingsByPracticeAreaId: Record<number, Array<{ id: number; name: string }>>;
  let allOfferingsById: Record<number, { id: number; name: string }>;
  let companyLinkedOfferingIdsByRowId: Record<number, number[]>;
  let personaLinkedOfferingIdsByRowId: Record<number, number[]>;

  try {
    practiceAreas = await listActivePracticeAreas();

    // D-05: when no Practice Area filter is set, fetch and concatenate signals
    // from every active practice area. The query layer is practice-area-scoped,
    // so this loop is the sanctioned "all practice areas" composition.
    const targetPracticeAreaIds =
      filters.practiceAreaId !== undefined
        ? [filters.practiceAreaId]
        : practiceAreas.map((pa) => pa.id);

    companySignalsRaw = (
      await Promise.all(
        targetPracticeAreaIds.map((id) => listAllCompanySignalsForPracticeArea(id))
      )
    ).flat();

    personaSignalsRaw = (
      await Promise.all(
        targetPracticeAreaIds.map((id) => listAllPersonaSignalsForPracticeArea(id))
      )
    ).flat();

    // SIG-03: category/status/search have no query-layer parameter, so they are
    // applied server-side in-memory after the fetch. Safe string comparisons
    // only — no dynamic-code paths, so malformed URL params just yield zero rows.
    const search = filters.search?.toLowerCase();
    companySignalsRaw = companySignalsRaw.filter((s) => {
      if (filters.category && s.category !== filters.category) return false;
      if (filters.status && s.status !== filters.status) return false;
      if (search) {
        const haystack = `${s.name} ${s.description}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    personaSignalsRaw = personaSignalsRaw.filter((s) => {
      if (filters.category && s.category !== filters.category) return false;
      if (filters.status && s.status !== filters.status) return false;
      if (search) {
        const haystack = `${s.name} ${s.description}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    [buyerRoles, companyCategories, personaCategories] = await Promise.all([
      listBuyerRoles(),
      listDistinctCompanySignalCategories(),
      listDistinctPersonaSignalCategories(),
    ]);

    // Open Question 1 resolution: fetch active offerings for ALL practice areas
    // up front and group client-side by practiceAreaId. This avoids a second
    // round-trip when the Practice Area field changes mid-form in SignalForm.
    activeOfferingsByPracticeAreaId = {};
    allOfferingsById = {};
    await Promise.all(
      practiceAreas.map(async (pa) => {
        const active = await listActiveOfferingsForPracticeArea(pa.id);
        activeOfferingsByPracticeAreaId[pa.id] = active;
        const all = await listAllOfferingsForPracticeArea(pa.id);
        for (const o of all) {
          allOfferingsById[o.id] = { id: o.id, name: o.name };
        }
      })
    );

    // Per-row Linked Offerings count. N+1-shaped read accepted at current seed
    // scale (~39 signal rows total); each query is a fast indexed lookup.
    companyLinkedOfferingIdsByRowId = {};
    await Promise.all(
      companySignalsRaw.map(async (s) => {
        const links = await listLinksForSignal('company', s.id);
        companyLinkedOfferingIdsByRowId[s.id] = links.map((l) => l.offeringId);
      })
    );

    personaLinkedOfferingIdsByRowId = {};
    await Promise.all(
      personaSignalsRaw.map(async (s) => {
        const links = await listLinksForSignal('persona', s.id);
        personaLinkedOfferingIdsByRowId[s.id] = links.map((l) => l.offeringId);
      })
    );
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Couldn&apos;t load signals
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  const hasActiveFilters = Boolean(
    filters.search || filters.practiceAreaId !== undefined || filters.category || filters.status
  );

  return (
    <div className="flex flex-col gap-12 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Signals</h1>
      <SignalsTabs
        companySignals={companySignalsRaw}
        personaSignals={personaSignalsRaw}
        hasActiveFilters={hasActiveFilters}
        practiceAreas={practiceAreas}
        buyerRoles={buyerRoles}
        companyCategories={companyCategories}
        personaCategories={personaCategories}
        activeOfferingsByPracticeAreaId={activeOfferingsByPracticeAreaId}
        offeringNamesById={Object.fromEntries(
          Object.entries(allOfferingsById).map(([id, o]) => [id, o.name])
        )}
        companyLinkedOfferingIdsByRowId={companyLinkedOfferingIdsByRowId}
        personaLinkedOfferingIdsByRowId={personaLinkedOfferingIdsByRowId}
      />
    </div>
  );
}
