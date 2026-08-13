import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { getModelSettingsForUser } from '@/lib/db/queries/userModelSettings';
import { getServableIdsForProvider, getUnionServableIds, getProviderForModelId, dedupeProviderRows, SERVABLE_PROVIDERS, getModelDisplayName, type ModelProviderId } from '@/lib/models/catalog';
import catalogJson from '@/lib/models/catalog.json';
// D-07 defaults source (reset-to-provider-default). Safe in this server
// component (RESEARCH A6): the module-scope createOpenRouter runs harmlessly
// at request time and this import never reaches a client bundle (T-17-09).
import { PROVIDER_DEFAULT_MODELS } from '@/lib/agents/modelFactory';
import { ModelSettingsForm } from '@/components/settings/model-settings-form';
import { providerName } from '@/components/settings/model-picker-logic';
import type { ServableModel } from '@/components/settings/model-picker-logic';
import { resolveStoredModelRef } from '@/lib/models/modelSettings';
import { getDataSourceSettingsView } from '@/lib/data-sources/settings';
import { DataSourceSettingsForm } from '@/components/settings/data-source-settings-form';
import { SettingsTabs } from '@/components/settings/settings-tabs';

// Belt-and-suspenders alongside the (dashboard) layout's auth gate
// (02-RESEARCH.md Pitfall 4) — every page in the group gates itself too, so
// the check can never be skipped by a future refactor of the layout alone.
// The surrounding AppShellLayout comes from src/app/(dashboard)/layout.tsx.
// T-17-07: per-user config renders only for the authenticated owner — the row
// is keyed by the session userId (settings.ts never accepts a userId from the
// client).
export default async function SettingsPage() {
  const { userId } = await requireStaffAccess();

  // Keep the two tabs independently useful when one backing read is down.
  // `undefined` is a valid model-settings result, so the settled status is the
  // failure discriminator for that tab.
  const [modelResult, dataSourceResult] = await Promise.allSettled([
    getModelSettingsForUser(userId),
    getDataSourceSettingsView(),
  ]);
  const modelReadSucceeded = modelResult.status === 'fulfilled';
  const dataSourceReadSucceeded = dataSourceResult.status === 'fulfilled';
  const settings = modelReadSucceeded ? modelResult.value : undefined;
  const dataSourceSettings = dataSourceReadSucceeded ? dataSourceResult.value : undefined;

  // Server-computed picker data, never client-fetched (17-UI-SPEC §Page) —
  // the client receives props only, so catalog.json (1131 rows, CAT-04
  // server-side source) never enters a client bundle (T-17-09). The props are
  // now provider-aware (21-UI-SPEC §Props & Data Contract): per-provider
  // servable lists (SET-02), the union fallback source (SET-04), D-07 reset
  // defaults (SET-03), and the saved chain's server-resolved provider identity
  // (SET-05). Every row lookup walks the deduped provider pool (D-23-08
  // Zen-wins): the dedup helper IS the provider scope — it filters by
  // SNAPSHOT_PROVIDER_IDS[provider] — so the 5 go-exclusive opencode-go ids
  // (hy3, mimo-v2.5, mimo-v2.5-pro, qwen3.7-max, qwen3.7-plus) resolve their
  // own name/cost instead of the raw-id/0 fallback (research Open Question 4);
  // anthropic/openrouter single-providerID maps and opencode Zen rows are
  // identical to the pre-dedup provider-scoped find (Anti-Pattern 1 intent kept).
  const trimRow = (id: string, provider: ModelProviderId): ServableModel => {
    const m = dedupeProviderRows(catalogJson, provider).find((mm) => mm.id === id);
    return {
      id,
      name: m?.name ?? getModelDisplayName(id),
      family: m?.family ?? '',
      providerID: provider,
      costInput: m?.cost?.input ?? 0,
      costOutput: m?.cost?.output ?? 0,
      // SET-03: only the opencode LOGICAL provider carries a meaningful
      // endpoint — an opencode-go matched row is 'go', any other opencode
      // match is 'zen' (the Zen-wins dedup guarantees a dual-listed id's
      // matched row is never 'opencode-go' unless it's Go-exclusive); every
      // non-opencode provider is null. This single derivation point flows
      // into BOTH servableByProvider and unionServableModels below, since
      // both call this shared trimRow.
      endpoint: provider === 'opencode' ? (m?.providerID === 'opencode-go' ? 'go' : 'zen') : null,
    };
  };

  // SET-02: per-provider servable lists — anthropic 1 row, openrouter 336 rows.
  const servableByProvider = Object.fromEntries(
    SERVABLE_PROVIDERS.map((p) => [
      p,
      getServableIdsForProvider(catalogJson, p).map((id) => trimRow(id, p)),
    ]),
  ) as Record<ModelProviderId, ServableModel[]>;

  // SET-04: the union servable source for the fallback pickers (375 rows —
  // 336 openrouter + 1 anthropic + 39 opencode servable − 1 overlap
  // (claude-sonnet-4-6 is servable under both anthropic and opencode), at the
  // 2026-08-02 snapshot; nousresearch contributes 0 rows until Phase 24 lands
  // them). Union ids are always servable-scoped so the provider lookup is
  // non-null in practice; `?? 'anthropic'` is the documented defensive
  // fallback (RESEARCH A3).
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

  // SET-01: 4-choice provider selector options from the shared registry map
  // (REG-01) — Anthropic, OpenRouter, NousResearch, OpenCode, in
  // SERVABLE_PROVIDERS order. The SAME PROVIDER_NAMES map the client-side
  // providerName() uses — one source, so a fifth provider is one line in
  // model-picker-logic.ts (research Pitfall 4: the old 2-way ternary here
  // would have labeled NousResearch/OpenCode "OpenRouter").
  const providers = SERVABLE_PROVIDERS.map((id) => ({ id, name: providerName(id) }));

  // SET-05: saved primary + fallbacks retain explicit provider metadata when
  // present; only legacy rows use catalog precedence.
  const savedChain = settings
    ? [settings.primaryModel, ...settings.fallbackModels].map((id, index) => ({
        id,
        name: getModelDisplayName(id),
        providerID: resolveStoredModelRef(
          id,
          index === 0 ? settings.primaryProvider : settings.fallbackProviders[index - 1],
          catalogJson,
        )?.provider ?? null,
      }))
    : null;

  const saved = settings
    ? { primaryModel: settings.primaryModel, fallbackModels: settings.fallbackModels }
    : null;

  const modelSettingsContent = modelReadSucceeded ? (
    <ModelSettingsForm
      saved={saved}
      providers={providers}
      servableByProvider={servableByProvider}
      unionServableModels={unionServableModels}
      defaults={defaults}
      savedChain={savedChain}
      catalogGeneratedAt={catalogJson.generatedAt}
    />
  ) : (
    <SettingsReadError label="AI Models" />
  );

  const dataSourceSettingsContent = dataSourceReadSucceeded && dataSourceSettings ? (
    <DataSourceSettingsForm
      selection={dataSourceSettings}
      availability={dataSourceSettings.availability}
    />
  ) : (
    <SettingsReadError label="Data Sources" />
  );

  return (
    <div className="flex flex-col gap-8 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Settings</h1>
      <SettingsTabs
        modelSettings={modelSettingsContent}
        dataSources={dataSourceSettingsContent}
      />
    </div>
  );
}

function SettingsReadError({ label }: { readonly label: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
        Couldn&apos;t load {label}
      </p>
      <p className="text-sm text-slate-500">
        Something went wrong fetching this tab. Try refreshing the page.
      </p>
    </div>
  );
}
