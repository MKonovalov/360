'use client';

import { useState, useTransition } from 'react';
import { saveSettingsAction } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { dateFormatter } from '@/components/explorer/explorer-format';
import { ModelSettingsFormSlots } from './model-settings-form-slots';
import { ModelSettingsFormStatus } from './model-settings-form-status';
// Type-only imports — erased at compile (T-17-09): model-picker-logic is a
// client-safe pure module, and a type-only catalog import never reaches a
// client bundle. ModelProviderId comes from its canonical source (catalog.ts
// declares the union; model-picker-logic does not re-export it).
import {
  fallbackSlotAfterProviderSwitch,
  initialModelSlots,
  modelAfterProviderSwitch,
  moveFallbackSlot,
  removeFallbackSlot,
  settingsDraftPayload,
  staleIds as computeStaleIds,
} from './model-picker-logic';
import type { ModelSlot, ServableModel } from './model-picker-logic';
import type { ModelProviderId } from '@/lib/models/catalog';

// Reason-code copy map — exactly the three codes saveSettingsAction can emit
// (17-UI-SPEC lines 132/134/135, apostrophes force double-quoted strings).
// Deliberately NO stale_primary/stale_fallback entries: the action never
// returns them (a dropped-from-roster id fails the servable-set check and
// surfaces as invalid_model, T-17-06) — the client-side staleness gate below
// (staleIds) is the primary D-10/D-11 mechanism.
const ERROR_COPY: Record<string, string> = {
  action_failed: "Couldn't save your changes. Please try again.",
  invalid_model: 'This model is no longer available.',
  duplicate_model: 'Each model can only be used once.',
};

type SavedSettings = { primaryModel: string; fallbackModels: string[] };

export function ModelSettingsForm({
  saved,
  providers,
  servableByProvider,
  unionServableModels,
  defaults,
  savedChain,
  catalogGeneratedAt,
}: {
  saved: SavedSettings | null;
  providers: { id: ModelProviderId; name: string }[];
  servableByProvider: Record<ModelProviderId, ServableModel[]>;
  unionServableModels: ServableModel[];
  defaults: Record<ModelProviderId, { id: string; name: string }>;
  savedChain: { id: string; name: string; providerID: ModelProviderId | null }[] | null;
  catalogGeneratedAt: string;
}) {
  // All edits stage in local draft state (D-07) — nothing persists until Save
  // (D-12). At mount the draft mirrors the saved row; the empty-state prefill
  // is the server-computed default chain head (REG-05).
  const defaultProvider = providers[0]?.id ?? 'anthropic';
  const savedPrimaryModel = saved?.primaryModel ?? '';
  const savedFallbackModels = saved?.fallbackModels ?? [];
  const initialSlots = initialModelSlots({
    modelIds: [savedPrimaryModel, ...savedFallbackModels],
    savedChain,
    catalogModels: unionServableModels,
    defaultProvider,
  });
  const initialPrimaryProvider = initialSlots[0]?.provider ?? defaultProvider;
  const [primaryProvider, setPrimaryProvider] = useState<ModelProviderId>(initialPrimaryProvider);
  const [primary, setPrimary] = useState<string>(saved?.primaryModel ?? defaults[initialPrimaryProvider].id);
  const [fallbackSlots, setFallbackSlots] = useState<ModelSlot[]>(initialSlots.slice(1));
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Non-blocking provider-switch reset hint (D-21-01, UI-SPEC §Copywriting) —
  // informational slate-600 text under the selector, never red.
  const [resetHint, setResetHint] = useState<string | null>(null);
  // The saved-chain recap gate (D-21-10): records what the last successful
  // Save persisted, so the recap renders only while the draft still equals
  // it — any edit to a slot fails the equality check and hides the recap.
  const [lastSaved, setLastSaved] = useState<{
    primary: ModelSlot;
    fallbacks: ModelSlot[];
  } | null>(
    null,
  );

  // Union-wide servable set (D-21-14) — the staleness gate widened from the
  // anthropic-only list to the union servable set (21-UI-SPEC SET-08).

  // Staleness derives from the CURRENT DRAFT, never the immutable `saved` props
  // (they never change — a saved-stale id would block Save forever). An empty
  // fallback row ('') is an in-progress edit, not a stale value (D-10/D-11).
  // At mount the draft mirrors `saved`, so a stale saved value blocks Save
  // immediately; replacing it in a picker (or removing a stale fallback row)
  // clears staleIds and re-enables Save — "replacing the value re-enables
  // Save" (17-UI-SPEC line 192).
  const unionIds = new Set(unionServableModels.map((m) => m.id));
  const fallbackModels = fallbackSlots.map((slot) => slot.model);
  const staleIds = computeStaleIds([primary, ...fallbackModels], unionIds);
  const saveDisabled = isPending || staleIds.length > 0;

  function handleSave() {
    setStatus('saving');
    startTransition(async () => {
      // CR-02: a client-side transport failure invoking the Server Action
      // (offline, dropped connection, RSC/action-encoding error) rejects
      // this promise BEFORE the server's own internal try/catch ever runs —
      // without this try/catch the rejection is unhandled and the form is
      // stranded on 'Saving…' forever. Degrade to the existing error state
      // instead (CLAUDE.md "fail safe, fail silent" convention).
      try {
        // An unfilled fallback row carries no model — drop it before sending
        // so a transient in-progress row never trips the action's
        // invalid_model.
        const payload = settingsDraftPayload({
          primaryModel: primary,
          primaryProvider,
          fallbackSlots,
        });
        const result = await saveSettingsAction(payload);
        if (result.ok) {
          setStatus('saved');
          setErrorMsg(null);
          // Record the persisted chain for the saved-chain recap (D-21-10) and
          // clear the reset hint — the reset is moot once the primary is saved
          // (RESEARCH Open Question 2 — RESOLVED). Unfilled fallback rows are
          // dropped from the record, matching the submitted payload below.
          setLastSaved({
            primary: { model: payload.primaryModel, provider: payload.primaryProvider },
            fallbacks: payload.fallbacks.map((model, index) => ({
              model,
              provider: payload.fallbackProviders[index] ?? defaultProvider,
            })),
          });
          setResetHint(null);
        } else {
          // D-13: the draft is preserved verbatim on failure — never reset the
          // useState; retry = press Save again with the draft still staged.
          setStatus('error');
          setErrorMsg(ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed);
        }
      } catch {
        setStatus('error');
        setErrorMsg(ERROR_COPY.action_failed);
      }
    });
  }

  // WR-01 — after a failed save the red errorMsg must not persist while the
  // user edits, and 'Saved.' must not survive a dirty draft; the 'saving'
  // status is exempt so a just-started save is never relabeled by a concurrent
  // edit (review WR-01's exact fix).
  function markDirty() {
    setStatus((s) => (s === 'saving' ? s : 'idle'));
    setErrorMsg(null);
  }

  function moveFallback(index: number, dir: -1 | 1) {
    markDirty();
    setFallbackSlots((prev) => moveFallbackSlot(prev, index, dir));
  }

  function removeFallback(index: number) {
    markDirty();
    setFallbackSlots((prev) => removeFallbackSlot(prev, index));
  }

  function addFallback() {
    markDirty();
    setFallbackSlots((prev) =>
      prev.length >= 2 ? prev : [...prev, { model: '', provider: defaultProvider }],
    );
  }

  function handlePrimaryProviderChange(nextProvider: ModelProviderId) {
    markDirty();
    const result = modelAfterProviderSwitch({
      currentModel: primary,
      nextProvider,
      servableByProvider,
      defaults,
    });
    setPrimary(result.model);
    setPrimaryProvider(nextProvider);
    setResetHint(null);
  }

  function handleFallbackProviderChange(index: number, nextProvider: ModelProviderId) {
    markDirty();
    setFallbackSlots((prev) =>
      prev.map((slot, slotIndex) =>
        slotIndex === index
          ? fallbackSlotAfterProviderSwitch({
              slot,
              nextProvider,
              servableByProvider,
              defaults,
            })
          : slot,
      ),
    );
  }

  function handleFallbackModelChange(index: number, model: string) {
    markDirty();
    setFallbackSlots((prev) =>
      prev.map((slot, slotIndex) => (slotIndex === index ? { ...slot, model } : slot)),
    );
  }

  const isStale = (id: string) => id !== '' && !unionIds.has(id);

  return (
    <div>
      <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
        {saved === null ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
              No model configuration saved
            </p>
            <p className="text-sm text-slate-500">
              You're currently using the default model — {defaults[primaryProvider].name} — with no
              fallbacks. Choose a primary model below to customize.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
            AI Model Configuration
          </p>
          <p className="text-sm text-slate-500">
            The Analytic Agent uses these models. The primary model runs first; if it fails, the
            agent retries with each fallback in order.
          </p>
        </div>

        <ModelSettingsFormSlots
          primaryModel={primary}
          primaryProvider={primaryProvider}
          fallbackSlots={fallbackSlots}
          providers={providers}
          servableByProvider={servableByProvider}
          unionServableModels={unionServableModels}
          savedChain={savedChain}
          resetHint={resetHint}
          isStale={isStale}
          onPrimaryProviderChange={handlePrimaryProviderChange}
          onPrimaryModelChange={(model) => {
            markDirty();
            setPrimary(model);
            setResetHint(null);
          }}
          onFallbackProviderChange={handleFallbackProviderChange}
          onFallbackModelChange={handleFallbackModelChange}
          onMoveFallback={moveFallback}
          onRemoveFallback={removeFallback}
          onAddFallback={addFallback}
        />

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <Button variant="default" disabled={saveDisabled} onClick={handleSave}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <ModelSettingsFormStatus
              status={status}
              errorMsg={errorMsg}
              primaryModel={primary}
              primaryProvider={primaryProvider}
              fallbackModels={fallbackModels}
              fallbackSlots={fallbackSlots}
              lastSaved={lastSaved}
              unionServableModels={unionServableModels}
              savedChain={savedChain}
            />
          </div>
        </div>
      </div>

      {/* D-04: catalog sync date from the committed snapshot's generatedAt —
          reuses the shared dateFormatter (no new helper, 17-UI-SPEC line 123). */}
      <p className="mt-4 text-[12px] font-normal leading-[1.4] text-slate-500">
        Catalog synced {dateFormatter.format(new Date(catalogGeneratedAt))}
      </p>
    </div>
  );
}
