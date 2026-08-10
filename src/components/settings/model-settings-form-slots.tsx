'use client';

import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModelPicker } from './model-picker';
import { optionsForSlot } from './model-picker-logic';
import type { ModelSlot, ServableModel } from './model-picker-logic';
import type { ModelProviderId } from '@/lib/models/catalog';

type ProviderOption = {
  readonly id: ModelProviderId;
  readonly name: string;
};

type SavedChainEntry = {
  readonly id: string;
  readonly name: string;
  readonly providerID: ModelProviderId | null;
};

export function ModelSettingsFormSlots({
  primaryModel,
  primaryProvider,
  fallbackSlots,
  providers,
  servableByProvider,
  unionServableModels,
  savedChain,
  resetHint,
  isStale,
  onPrimaryProviderChange,
  onPrimaryModelChange,
  onFallbackProviderChange,
  onFallbackModelChange,
  onMoveFallback,
  onRemoveFallback,
  onAddFallback,
}: {
  readonly primaryModel: string;
  readonly primaryProvider: ModelProviderId;
  readonly fallbackSlots: readonly ModelSlot[];
  readonly providers: readonly ProviderOption[];
  readonly servableByProvider: Readonly<Record<ModelProviderId, readonly ServableModel[]>>;
  readonly unionServableModels: readonly ServableModel[];
  readonly savedChain: readonly SavedChainEntry[] | null;
  readonly resetHint: string | null;
  readonly isStale: (id: string) => boolean;
  readonly onPrimaryProviderChange: (provider: ModelProviderId) => void;
  readonly onPrimaryModelChange: (model: string) => void;
  readonly onFallbackProviderChange: (index: number, provider: ModelProviderId) => void;
  readonly onFallbackModelChange: (index: number, model: string) => void;
  readonly onMoveFallback: (index: number, direction: -1 | 1) => void;
  readonly onRemoveFallback: (index: number) => void;
  readonly onAddFallback: () => void;
}) {
  const fallbackModels = fallbackSlots.map((slot) => slot.model);

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label htmlFor="primary-provider" className="text-[12px] font-normal leading-[1.4] text-slate-500">
            Primary AI Provider
          </label>
          <Select
            value={primaryProvider}
            onValueChange={(value) => {
              const provider = providers.find((option) => option.id === value)?.id;
              if (provider) onPrimaryProviderChange(provider);
            }}
          >
            <SelectTrigger id="primary-provider" aria-label="Primary AI Provider" size="default">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {resetHint !== null ? (
            <p className="text-[14px] font-normal leading-[1.5] text-slate-600">{resetHint}</p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label htmlFor="primary-model" className="text-[12px] font-normal leading-[1.4] text-slate-500">
            Primary AI Model
          </label>
          <ModelPicker
            id="primary-model"
            ariaLabel="Primary AI Model"
            value={primaryModel}
            valueName={unionServableModels.find((model) => model.id === primaryModel)?.name}
            options={optionsForSlot(
              primaryModel,
              fallbackModels,
              -1,
              servableByProvider[primaryProvider],
            )}
            onChange={onPrimaryModelChange}
            placeholder="Select a model…"
            badge={primaryProvider}
            grouped={false}
            staleLabel={
              isStale(primaryModel)
                ? (savedChain?.find((slot) => slot.id === primaryModel)?.name ?? primaryModel)
                : null
            }
          />
          {isStale(primaryModel) ? (
            <p className="text-[14px] font-normal leading-[1.5] text-red-600">
              This model is no longer runnable — pick a replacement before saving.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
        <p className="text-[12px] font-normal leading-[1.4] text-slate-500">Fallback models</p>
        {fallbackSlots.map((slot, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label
                  htmlFor={`fallback-${index + 1}-provider`}
                  className="text-[12px] font-normal leading-[1.4] text-slate-500"
                >
                  Fallback {index + 1} AI Provider
                </label>
                <Select
                  value={slot.provider}
                  onValueChange={(value) => {
                    const provider = providers.find((option) => option.id === value)?.id;
                    if (provider) onFallbackProviderChange(index, provider);
                  }}
                >
                  <SelectTrigger
                    id={`fallback-${index + 1}-provider`}
                    aria-label={`Fallback ${index + 1} AI Provider`}
                    size="default"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label
                  htmlFor={`fallback-${index + 1}-model`}
                  className="text-[12px] font-normal leading-[1.4] text-slate-500"
                >
                  Fallback {index + 1} AI Model
                </label>
                <ModelPicker
                  id={`fallback-${index + 1}-model`}
                  ariaLabel={`Fallback ${index + 1} AI Model`}
                  value={slot.model}
                  options={optionsForSlot(
                    primaryModel,
                    fallbackModels,
                    index,
                    servableByProvider[slot.provider],
                  )}
                  onChange={(model) => onFallbackModelChange(index, model)}
                  placeholder="Select a model…"
                  grouped={false}
                  badge={slot.provider}
                  staleLabel={
                    isStale(slot.model)
                      ? (savedChain?.find((savedSlot) => savedSlot.id === slot.model)?.name ?? slot.model)
                      : null
                  }
                />
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:pb-0">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move fallback ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => onMoveFallback(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move fallback ${index + 1} down`}
                  disabled={index === fallbackSlots.length - 1}
                  onClick={() => onMoveFallback(index, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove fallback ${index + 1}`}
                  onClick={() => onRemoveFallback(index)}
                >
                  <X />
                </Button>
              </div>
            </div>
            {isStale(slot.model) ? (
              <p className="text-[14px] font-normal leading-[1.5] text-red-600">
                This model is no longer runnable — pick a replacement before saving.
              </p>
            ) : null}
          </div>
        ))}
        <Button variant="outline" disabled={fallbackSlots.length >= 2} onClick={onAddFallback}>
          <Plus className="size-4" />
          Add fallback
        </Button>
      </div>
    </>
  );
}
