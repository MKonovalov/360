'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { saveSettingsAction } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { dateFormatter } from '@/components/explorer/explorer-format';
// Type-only imports — erased at compile (T-17-09): model-picker-logic is a
// client-safe pure module, and a type-only catalog import never reaches a
// client bundle. ModelProviderId comes from its canonical source (catalog.ts
// declares the union; model-picker-logic does not re-export it).
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
  // The provider dimension (selector + reset reducer + hint) lands in plan
  // 21-05; until then the pickers stay on the REG-05 anthropic default so the
  // re-pointed Select-based UI preserves the v1.3 behavior verbatim.
  const provider: ModelProviderId = 'anthropic';
  const [primary, setPrimary] = useState<string>(saved?.primaryModel ?? defaults[provider].id);
  const [fallbacks, setFallbacks] = useState<string[]>(saved?.fallbackModels ?? []);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  const staleIds = [primary, ...fallbacks].filter((id) => id && !unionIds.has(id));
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
      } else {
        // D-13: the draft is preserved verbatim on failure — never reset the
        // useState; retry = press Save again with the draft still staged.
        setStatus('error');
        setErrorMsg(ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed);
      }
    });
  }

  function moveFallback(index: number, dir: -1 | 1) {
    setFallbacks((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeFallback(index: number) {
    setFallbacks((prev) => prev.filter((_, j) => j !== index));
  }

  function addFallback() {
    setFallbacks((prev) => (prev.length >= 2 ? prev : [...prev, '']));
  }

  // D-03 picker row: name + cost caption on one row via the vendored
  // SelectItem span-gap (`*:[span]:last:flex ... gap-2`). A stale id (dropped
  // from the roster) has no snapshot entry the client may read — fall back to
  // the raw id (getModelDisplayName D-06 fallback rule).
  function optionLabel(id: string) {
    const m = unionServableModels.find((mm) => mm.id === id);
    if (!m) return id;
    return `${m.name} · $${m.costInput} / $${m.costOutput} per MTok`;
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

        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-normal leading-[1.4] text-slate-500">Primary model</p>
          <Select value={primary} onValueChange={setPrimary}>
            <SelectTrigger id="primary-model" size="default">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {servableByProvider[provider].map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span>{m.name}</span>
                  <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                    · ${m.costInput} / ${m.costOutput} per MTok
                  </span>
                </SelectItem>
              ))}
              {isStale(primary) ? (
                <SelectItem key={primary} value={primary} disabled>
                  <span>{optionLabel(primary)}</span>
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
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
                <Select
                  value={fb}
                  onValueChange={(v) => {
                    setFallbacks((prev) => {
                      const next = [...prev];
                      next[i] = v;
                      return next;
                    });
                  }}
                >
                  <SelectTrigger id={`fallback-${i + 1}`} className="flex-1 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* D-08/D-09, client-enforced: a model chosen for one
                        slot disappears from the others, and the primary is
                        never a fallback option. Widened to the union
                        servable set (D-21-14) — cross-provider fallbacks
                        are supported by design (D-21-02). */}
                    {unionServableModels
                      .filter(
                        (m) =>
                          m.id !== primary && !fallbacks.some((f, j) => f === m.id && j !== i)
                      )
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span>{m.name}</span>
                          <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                            · ${m.costInput} / ${m.costOutput} per MTok
                          </span>
                        </SelectItem>
                      ))}
                    {/* A stale saved fallback at mount renders as a disabled
                        item appended to the options so the row can display
                        its current value until the user replaces it. */}
                    {isStale(fb) ? (
                      <SelectItem key={fb} value={fb} disabled>
                        <span>{optionLabel(fb)}</span>
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
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
              <p className="text-[14px] font-normal leading-[1.5] text-slate-600">Saved.</p>
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
