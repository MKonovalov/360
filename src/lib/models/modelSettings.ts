import { z } from 'zod';
import {
  catalogJson,
  getProviderForModelId,
  getServableIdsForProvider,
  isModelProviderId,
  SERVABLE_PROVIDERS,
  type ModelCatalog,
  type ModelProviderId,
} from './catalog';
import type { ModelRef } from './modelRef';

export type StoredModelSettings = {
  readonly primaryModel: string;
  readonly fallbackModels: readonly string[];
  readonly primaryProvider?: string | null;
  readonly fallbackProviders?: readonly string[];
};

export function resolveStoredModelRef(
  modelId: string,
  explicitProvider: string | null | undefined,
  catalog: ModelCatalog = catalogJson,
): ModelRef | null {
  if (explicitProvider !== null && explicitProvider !== undefined) {
    return isModelProviderId(explicitProvider)
      ? { modelId, provider: explicitProvider }
      : null;
  }

  const provider = getProviderForModelId(catalog, modelId);
  return provider === null ? null : { modelId, provider };
}

export function isServableModelRef(ref: ModelRef, catalog: ModelCatalog = catalogJson): boolean {
  return getServableIdsForProvider(catalog, ref.provider).includes(ref.modelId);
}

export function resolveStoredModelRefs(
  settings: StoredModelSettings,
  catalog: ModelCatalog = catalogJson,
): readonly (ModelRef | null)[] {
  return [settings.primaryModel, ...settings.fallbackModels].map((modelId, index) => {
    const explicitProvider = index === 0
      ? settings.primaryProvider
      : settings.fallbackProviders?.[index - 1];
    return resolveStoredModelRef(modelId, explicitProvider, catalog);
  });
}

export function isValidProviderModelPair(
  provider: ModelProviderId,
  modelId: string,
  catalog: ModelCatalog = catalogJson,
): boolean {
  return getServableIdsForProvider(catalog, provider).includes(modelId);
}

const providerSchema = z.enum(SERVABLE_PROVIDERS);
const explicitSettingsInputSchema = z
  .object({
    primaryModel: z.string().min(1),
    primaryProvider: providerSchema,
    fallbacks: z.array(z.string().min(1)).max(2),
    fallbackProviders: z.array(providerSchema).max(2),
  })
  .strict()
  .refine((value) => value.fallbacks.length === value.fallbackProviders.length, {
    message: 'fallback provider/model length mismatch',
  });

const legacySettingsInputSchema = z
  .object({
    primaryModel: z.string().min(1),
    fallbacks: z.array(z.string().min(1)).max(2),
  })
  .strict();

export type SettingsSavePayload = {
  readonly primaryModel: string;
  readonly primaryProvider: ModelProviderId;
  readonly fallbacks: readonly string[];
  readonly fallbackProviders: readonly ModelProviderId[];
};

export type SettingsValidationResult =
  | { readonly ok: true; readonly value: SettingsSavePayload }
  | { readonly ok: false; readonly reason: 'invalid_model' | 'duplicate_model' };

export function validateSettingsInput(input: unknown): SettingsValidationResult {
  const explicit = explicitSettingsInputSchema.safeParse(input);
  const legacy = legacySettingsInputSchema.safeParse(input);
  let value: SettingsSavePayload;

  if (explicit.success) {
    value = explicit.data;
  } else if (legacy.success) {
    const refs = [legacy.data.primaryModel, ...legacy.data.fallbacks].map((modelId) =>
      resolveStoredModelRef(modelId, undefined, catalogJson),
    );
    if (refs.some((ref) => ref === null)) return { ok: false, reason: 'invalid_model' };
    const [primaryRef, ...fallbackRefs] = refs;
    if (!primaryRef || fallbackRefs.some((ref) => ref === null)) {
      return { ok: false, reason: 'invalid_model' };
    }
    value = {
      primaryModel: primaryRef.modelId,
      primaryProvider: primaryRef.provider,
      fallbacks: fallbackRefs.map((ref) => ref?.modelId ?? ''),
      fallbackProviders: fallbackRefs.flatMap((ref) => (ref ? [ref.provider] : [])),
    };
  } else {
    return { ok: false, reason: 'invalid_model' };
  }

  const pairs = [
    { modelId: value.primaryModel, provider: value.primaryProvider },
    ...value.fallbacks.map((modelId, index) => ({
      modelId,
      provider: value.fallbackProviders[index],
    })),
  ];
  if (
    pairs.some((pair) => pair.provider === undefined || !isValidProviderModelPair(pair.provider, pair.modelId, catalogJson))
  ) {
    return { ok: false, reason: 'invalid_model' };
  }
  if (new Set(value.fallbacks).size !== value.fallbacks.length || value.fallbacks.includes(value.primaryModel)) {
    return { ok: false, reason: 'duplicate_model' };
  }
  return { ok: true, value };
}
