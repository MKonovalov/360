import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { getModelSettingsForUser } from '@/lib/db/queries/userModelSettings';
import { getServableIdsForProvider, getUnionServableIds, getProviderForModelId, SERVABLE_PROVIDERS, getModelDisplayName, type ModelProviderId } from '@/lib/models/catalog';
import catalogJson from '@/lib/models/catalog.json';
// D-07 defaults source (reset-to-provider-default). Safe in this server
// component (RESEARCH A6): the module-scope createOpenRouter runs harmlessly
// at request time and this import never reaches a client bundle (T-17-09).
import { PROVIDER_DEFAULT_MODELS } from '@/lib/agents/modelFactory';
import { ModelSettingsForm } from '@/components/settings/model-settings-form';
import type { ServableModel } from '@/components/settings/model-picker-logic';

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
  // server-side source) never enters a client bundle (T-17-09). The props are
  // now provider-aware (21-UI-SPEC §Props & Data Contract): per-provider
  // servable lists (SET-02), the union fallback source (SET-04), D-07 reset
  // defaults (SET-03), and the saved chain's server-resolved provider identity
  // (SET-05). Every row lookup is provider-scoped (Anti-Pattern 1): the
  // snapshot dual-lists ids (claude-sonnet-5 exists as opencode AND anthropic;
  // anthropic/claude-sonnet-5 as openrouter AND vercel) and a bare id find
  // returns the opencode/vercel gateway row (sorts first) with cost 0 / wrong
  // family / wrong provider.
  const trimRow = (id: string, provider: ModelProviderId): ServableModel => {
    const m = catalogJson.models.find((mm) => mm.id === id && mm.providerID === provider);
    return {
      id,
      name: m?.name ?? getModelDisplayName(id),
      family: m?.family ?? '',
      providerID: provider,
      costInput: m?.cost?.input ?? 0,
      costOutput: m?.cost?.output ?? 0,
    };
  };

  // SET-02: per-provider servable lists — anthropic 1 row, openrouter 336 rows.
  const servableByProvider = Object.fromEntries(
    SERVABLE_PROVIDERS.map((p) => [
      p,
      getServableIdsForProvider(catalogJson, p).map((id) => trimRow(id, p)),
    ]),
  ) as Record<ModelProviderId, ServableModel[]>;

  // SET-04: the union servable source for the fallback pickers (337 rows —
  // 336 openrouter + 1 anthropic). Union ids are always servable-scoped so
  // the provider lookup is non-null in practice; `?? 'anthropic'` is the
  // documented defensive fallback (RESEARCH A3).
  const unionServableModels = getUnionServableIds(catalogJson).map((id) =>
    trimRow(id, getProviderForModelId(catalogJson, id) ?? 'anthropic'),
  );

  // D-07: per-provider reset-to-provider-default source (SET-03) — the
  // empty-state prefill and provider-switch reset both read from this map.
  const defaults = Object.fromEntries(
    SERVABLE_PROVIDERS.map((p) => [
      p,
      { id: PROVIDER_DEFAULT_MODELS[p], name: getModelDisplayName(PROVIDER_DEFAULT_MODELS[p]) },
    ]),
  ) as Record<ModelProviderId, { id: string; name: string }>;

  // SET-01: the 2-choice provider selector options.
  const providers = SERVABLE_PROVIDERS.map((id) => ({
    id,
    name: id === 'anthropic' ? 'Anthropic' : 'OpenRouter',
  }));

  // SET-05: saved primary + fallbacks with server-resolved provider identity
  // (trigger badges + stale-row rendering in the form). providerID is null
  // when the id is catalog-absent — the form's raw-id fallback path.
  const savedChain = settings
    ? [settings.primaryModel, ...settings.fallbackModels].map((id) => ({
        id,
        name: getModelDisplayName(id),
        providerID: getProviderForModelId(catalogJson, id),
      }))
    : null;

  const saved = settings
    ? { primaryModel: settings.primaryModel, fallbackModels: settings.fallbackModels }
    : null;

  return (
    <div className="flex flex-col gap-8 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Settings</h1>
      <ModelSettingsForm
        saved={saved}
        providers={providers}
        servableByProvider={servableByProvider}
        unionServableModels={unionServableModels}
        defaults={defaults}
        savedChain={savedChain}
        catalogGeneratedAt={catalogJson.generatedAt}
      />
    </div>
  );
}
