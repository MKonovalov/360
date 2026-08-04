'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { saveSettingsAction } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { dateFormatter } from '@/components/explorer/explorer-format';
import { ModelPicker } from './model-picker';
// Type-only imports — erased at compile (T-17-09): model-picker-logic is a
// client-safe pure module, and a type-only catalog import never reaches a
// client bundle. ModelProviderId comes from its canonical source (catalog.ts
// declares the union; model-picker-logic does not re-export it).
import {
  optionsForSlot,
  primaryAfterProviderSwitch,
  providerName,
  staleIds as computeStaleIds,
} from './model-picker-logic';
import type { ServableModel } from './model-picker-logic';
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
  // Initial provider = the saved primary's provider (savedChain[0] is the
  // saved primary's chain entry — server-resolved, plan 21-03), else the
  // REG-05 Anthropic fast path.
  const [provider, setProvider] = useState<ModelProviderId>(
    savedChain?.[0]?.providerID ?? 'anthropic',
  );
  const [primary, setPrimary] = useState<string>(saved?.primaryModel ?? defaults[provider].id);
  const [fallbacks, setFallbacks] = useState<string[]>(saved?.fallbackModels ?? []);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Non-blocking provider-switch reset hint (D-21-01, UI-SPEC §Copywriting) —
  // informational slate-600 text under the selector, never red.
  const [resetHint, setResetHint] = useState<string | null>(null);
  // The saved-chain recap gate (D-21-10): records what the last successful
  // Save persisted, so the recap renders only while the draft still equals
  // it — any edit to a slot fails the equality check and hides the recap.
  const [lastSaved, setLastSaved] = useState<{ primary: string; fallbacks: string[] } | null>(
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
  const staleIds = computeStaleIds([primary, ...fallbacks], unionIds);
  const saveDisabled = isPending || staleIds.length > 0;

  function handleSave() {
    setStatus('saving');
    startTransition(async () => {
      // An unfilled fallback row carries no model — drop it before sending so
      // a transient in-progress row never trips the action's invalid_model.
      const result = await saveSettingsAction({
        primaryModel: primary,
        fallbacks: fallbacks.filter((id) => id !== ''),
      });
      if (result.ok) {
        setStatus('saved');
        setErrorMsg(null);
        // Record the persisted chain for the saved-chain recap (D-21-10) and
        // clear the reset hint — the reset is moot once the primary is saved
        // (RESEARCH Open Question 2 — RESOLVED). Unfilled fallback rows are
        // dropped from the record, matching the submitted payload below.
        setLastSaved({ primary, fallbacks: fallbacks.filter((id) => id !== '') });
        setResetHint(null);
      } else {
        // D-13: the draft is preserved verbatim on failure — never reset the
        // useState; retry = press Save again with the draft still staged.
        setStatus('error');
        setErrorMsg(ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed);
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
    setFallbacks((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeFallback(index: number) {
    markDirty();
    setFallbacks((prev) => prev.filter((_, j) => j !== index));
  }

  function addFallback() {
    markDirty();
    setFallbacks((prev) => (prev.length >= 2 ? prev : [...prev, '']));
  }

  // D-21-01/03: provider switch = keep-if-valid → reset-to-provider-default.
  function handleProviderChange(next: ModelProviderId) {
    // A provider switch stages a new primary (draft edit) — clear stale save
    // feedback even when keep-if-valid preserves the value (WR-01).
    markDirty();
    // Fallbacks are NEVER touched on a provider switch (D-21-02): the chain
    // may become cross-provider by design — the union pickers still render
    // them verbatim.
    const result = primaryAfterProviderSwitch(primary, next, servableByProvider, defaults);
    setPrimary(result.primary);
    // The reset is draft-only (D-07) — nothing persists until Save.
    if (result.resetToDefault) {
      setResetHint(
        `Primary model reset to ${defaults[next].name} for ${
          providers.find((p) => p.id === next)?.name ?? next
        }.`,
      );
    } else {
      setResetHint(null);
    }
    setProvider(next);
    // Pitfall 6: if the reset lands on an id a preserved fallback already
    // holds, the server duplicate_model backstop surfaces the existing
    // ERROR_COPY — do NOT clear the fallback (research recommendation).
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
              You're currently using the default model — {defaults[provider].name} — with no
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

        {/* D-21-03: the always-valued provider selector sits directly above
            the Primary model label (SET-01). Stays a shadcn Select (D-21-06) —
            the Combobox swap is scoped to model slots only. */}
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-normal leading-[1.4] text-slate-500">AI provider</p>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger aria-label="AI provider" size="default">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* D-21-01: the non-blocking reset hint — informational slate-600,
              never red (it describes a successful draft reset, not an error). */}
          {resetHint !== null ? (
            <p className="text-[14px] font-normal leading-[1.5] text-slate-600">{resetHint}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-normal leading-[1.4] text-slate-500">Primary model</p>
          {/* D-21-06: the primary slot is a Command Combobox, provider-scoped
              (SET-02). slotIndex -1 = the primary direction: options exclude
              the primary id AND every fallback-chosen id (Open Question 3) so
              Save can never hit duplicate_model. */}
          <ModelPicker
            id="primary-model"
            ariaLabel="Primary model"
            value={primary}
            // CR-01 name seam: the primary id is excluded from its own options
            // by optionsForSlot(slotIndex = -1) dup-chain prevention, so the
            // trigger name resolves from the union instead (the 21-06 valueName
            // prop the wrapper's triggerLabel prefers; a stale id yields
            // undefined → raw-id fallback + staleLabel path unchanged).
            valueName={unionServableModels.find((m) => m.id === primary)?.name}
            options={optionsForSlot(primary, fallbacks, -1, servableByProvider[provider])}
            onChange={(v) => {
              markDirty();
              setPrimary(v);
              // Hint lifecycle (Open Question 2 — RESOLVED): a manual primary
              // edit supersedes the provider-switch reset — clear the hint.
              setResetHint(null);
            }}
            placeholder="Select a model…"
            badge={provider}
            grouped={false}
            staleLabel={
              isStale(primary)
                ? (savedChain?.find((sc) => sc.id === primary)?.name ?? primary)
                : null
            }
          />
          {isStale(primary) ? (
            <p className="text-[14px] font-normal leading-[1.5] text-red-600">
              This model is no longer runnable — pick a replacement before saving.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
          {/* The v1.3 sonnet-only branch (single-model message + stale-row
              only rendering) is gone: the union servable set spans both
              providers (337 rows — never 1), so the full fallback form always
              renders. Stale saved fallbacks are handled by the general path
              below — disabled stale item + red hint + remove button — keeping
              the D-10/D-11 "stale fallback stays renderable and removable"
              contract intact. */}
          <p className="text-[12px] font-normal leading-[1.4] text-slate-500">
            Fallback models
          </p>
          {fallbacks.map((fb, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {/* D-08/D-09, client-enforced via optionsForSlot: a model
                    chosen for one slot disappears from the others, and the
                    primary is never a fallback option — widened to the union
                    servable set (D-21-14). The trigger badge is required on
                    every picker (UI-SPEC §Row Anatomy): closed-state badges
                    disambiguate same-name models at a glance. */}
                <ModelPicker
                  id={`fallback-${i + 1}`}
                  ariaLabel={`Fallback model ${i + 1}`}
                  value={fb}
                  options={optionsForSlot(primary, fallbacks, i, unionServableModels)}
                  onChange={(v) => {
                    markDirty();
                    setFallbacks((prev) => {
                      const next = [...prev];
                      next[i] = v;
                      return next;
                    });
                  }}
                  placeholder="Select a fallback…"
                  grouped
                  badge={unionServableModels.find((m) => m.id === fb)?.providerID ?? undefined}
                  staleLabel={
                    isStale(fb) ? (savedChain?.find((sc) => sc.id === fb)?.name ?? fb) : null
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move fallback up"
                  disabled={i === 0}
                  onClick={() => moveFallback(i, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move fallback down"
                  disabled={i === fallbacks.length - 1}
                  onClick={() => moveFallback(i, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove fallback"
                  onClick={() => removeFallback(i)}
                >
                  <X />
                </Button>
              </div>
              {isStale(fb) ? (
                <p className="text-[14px] font-normal leading-[1.5] text-red-600">
                  This model is no longer runnable — pick a replacement before saving.
                </p>
              ) : null}
            </div>
          ))}
          <Button variant="outline" disabled={fallbacks.length >= 2} onClick={addFallback}>
            <Plus className="size-4" />
            Add fallback
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <Button variant="default" disabled={saveDisabled} onClick={handleSave}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
            {status === 'saved' ? (
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-normal leading-[1.5] text-slate-600">Saved.</p>
                {/* D-21-10: the saved-chain recap — one entry per model in the
                    persisted chain, each with a provider badge. The badges are
                    what disambiguate a saved cross-provider chain at a glance.
                    Saved ids are union-validated, so the union lookup resolves
                    their provider; names come from savedChain (server-resolved)
                    with the raw-id fallback. The recap hides as soon as any
                    slot is edited — the draft no longer equals lastSaved. */}
                {lastSaved &&
                primary === lastSaved.primary &&
                fallbacks.filter((f) => f !== '').join('|') === lastSaved.fallbacks.join('|') ? (
                  <p className="text-[14px] font-normal leading-[1.5] text-slate-600">
                    Saved chain:{' '}
                    {[primary, ...fallbacks.filter((f) => f !== '')].map((id, idx) => (
                      <span key={id}>
                        {idx > 0 ? ' → ' : null}
                        <Badge variant="secondary">
                          {providerName(
                            unionServableModels.find((m) => m.id === id)?.providerID ?? 'anthropic',
                          )}
                        </Badge>{' '}
                        {savedChain?.find((sc) => sc.id === id)?.name ?? id}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : status === 'error' ? (
              <p className="text-[14px] font-normal leading-[1.5] text-red-600">{errorMsg}</p>
            ) : null}
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
