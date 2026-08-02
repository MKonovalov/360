import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { getModelSettingsForUser } from '@/lib/db/queries/userModelSettings';
import { getServableIdsForProvider, FAST_MODEL_ID, getModelDisplayName } from '@/lib/models/catalog';
import catalogJson from '@/lib/models/catalog.json';
import { ModelSettingsForm } from '@/components/settings/model-settings-form';

// Belt-and-suspenders alongside the (dashboard) layout's auth gate
// (02-RESEARCH.md Pitfall 4) — every page in the group gates itself too, so
// the check can never be skipped by a future refactor of the layout alone.
// The surrounding AppShellLayout comes from src/app/(dashboard)/layout.tsx.
// T-17-07: per-user config renders only for the authenticated owner — the row
// is keyed by the session userId (settings.ts never accepts a userId from the
// client).
export default async function SettingsPage() {
  const { userId } = await requireStaffAccess();

  // Same failure mode as every dashboard widget: a DB-fetch failure degrades
  // to the established per-widget error card, never Next.js's default 500
  // page. getModelSettingsForUser returns undefined for "no saved settings"
  // (REG-05: use the default chain) — absence is data, not an error.
  let settings: Awaited<ReturnType<typeof getModelSettingsForUser>>;
  try {
    settings = await getModelSettingsForUser(userId);
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Couldn't load your settings
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  // Server-computed picker data, never client-fetched (17-UI-SPEC §Page) —
  // the client receives props only, so catalog.json (1131 rows, CAT-04
  // server-side source) never enters a client bundle (T-17-09).
  // getServableIdsForProvider(catalogJson, 'anthropic') = anthropic allowlist ∩ snapshot — the runnable set
  // (SET-07 / Phase 15 D-03), never raw catalog rows. Costs read from the
  // snapshot's anthropic entry by id (first-match lookup like
  // getModelDisplayName) — the snapshot holds dual opencode/anthropic entries
  // for the same id and the opencode gateway row is not the cost source
  // (17-PATTERNS lines 26-29).
  const servableIds = getServableIdsForProvider(catalogJson, 'anthropic');
  const servableModels = servableIds.map((id) => {
    const m = catalogJson.models.find((mm) => mm.id === id && mm.providerID === 'anthropic');
    return {
      id,
      name: m?.name ?? getModelDisplayName(id),
      costInput: m?.cost?.input ?? 0,
      costOutput: m?.cost?.output ?? 0,
    };
  });

  // Computed server-side and passed as a prop so the client never imports
  // catalog.ts (17-UI-SPEC: props-only is the contract). REG-05: the default
  // chain head (FAST_MODEL_ID) is the empty-state prefill.
  const defaultPrimary = { id: FAST_MODEL_ID, name: getModelDisplayName(FAST_MODEL_ID) };

  const saved = settings
    ? { primaryModel: settings.primaryModel, fallbackModels: settings.fallbackModels }
    : null;

  return (
    <div className="flex flex-col gap-8 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Settings</h1>
      <ModelSettingsForm
        saved={saved}
        servableModels={servableModels}
        defaultPrimary={defaultPrimary}
        catalogGeneratedAt={catalogJson.generatedAt}
      />
    </div>
  );
}
