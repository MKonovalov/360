'use client';

import { Badge } from '@/components/ui/badge';
import { endpointLabel, providerName } from './model-picker-logic';
import type { ModelSlot, ServableModel } from './model-picker-logic';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type SavedChainEntry = {
  readonly id: string;
  readonly name: string;
};

type LastSaved = {
  readonly primary: ModelSlot;
  readonly fallbacks: readonly ModelSlot[];
};

export function ModelSettingsFormStatus({
  status,
  errorMsg,
  primaryModel,
  primaryProvider,
  fallbackModels,
  fallbackSlots,
  lastSaved,
  unionServableModels,
  savedChain,
}: {
  readonly status: SaveStatus;
  readonly errorMsg: string | null;
  readonly primaryModel: string;
  readonly primaryProvider: ModelSlot['provider'];
  readonly fallbackModels: readonly string[];
  readonly fallbackSlots: readonly ModelSlot[];
  readonly lastSaved: LastSaved | null;
  readonly unionServableModels: readonly ServableModel[];
  readonly savedChain: readonly SavedChainEntry[] | null;
}) {
  const draftSlots = [{ model: primaryModel, provider: primaryProvider }, ...fallbackSlots.filter((slot) => slot.model !== '')];
  const draftMatchesLastSaved =
    status === 'saved' &&
    lastSaved !== null &&
    draftSlots.length === lastSaved.fallbacks.length + 1 &&
    draftSlots.every((slot, index) => {
      const saved = index === 0 ? lastSaved.primary : lastSaved.fallbacks[index - 1];
      return saved?.model === slot.model && saved.provider === slot.provider;
    });

  if (draftMatchesLastSaved && lastSaved !== null) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-normal leading-[1.5] text-slate-600">Saved.</p>
        <p className="text-[14px] font-normal leading-[1.5] text-slate-600">
          Saved chain:{' '}
          {draftSlots.map((slot, index) => {
            const resolved = unionServableModels.find(
              (model) => model.id === slot.model && model.providerID === slot.provider,
            );
            return (
              <span key={`${slot.provider}:${slot.model}`}>
                {index > 0 ? ' → ' : null}
                <Badge variant="secondary">{providerName(slot.provider)}</Badge>{' '}
                {savedChain?.[index]?.name ?? slot.model}
                {resolved?.endpoint ? (
                  <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                    {' '}· {endpointLabel(resolved.endpoint)}
                  </span>
                ) : null}
              </span>
            );
          })}
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return <p className="text-[14px] font-normal leading-[1.5] text-red-600">{errorMsg}</p>;
  }

  return null;
}
