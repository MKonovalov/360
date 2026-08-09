import { eq } from 'drizzle-orm';
import { db } from '../index';
import { userModelSettings } from '../schema';
import type { ModelProviderId } from '@/lib/models/catalog';

// REG-05: absence is a falsy value (undefined), never a throw — "no saved
// settings" is a valid state meaning "use the default chain" (claude-sonnet-4-6,
// FAST_MODEL_ID in runAgent.ts). The Phase 16 resolver maps the absence to the
// default; no try/catch here — the caller owns error handling (house convention).
export async function getModelSettingsForUser(userId: string) {
  return db.query.userModelSettings.findFirst({
    where: eq(userModelSettings.userId, userId),
  });
}

export class ModelSettingsProviderMetadataError extends Error {
  readonly name = 'ModelSettingsProviderMetadataError';

  constructor(
    readonly fallbackModelCount: number,
    readonly fallbackProviderCount: number,
  ) {
    super('fallback provider/model length mismatch');
  }
}

// Pitfall 9: full-value atomic upsert — every save writes the COMPLETE chain,
// never a merge of the current row + a partial change (no read-modify-write).
// Single insert ... onConflictDoUpdate statement keyed on the user_id PK.
export async function upsertModelSettings(input: {
  readonly userId: string;
  readonly primaryModel: string;
  readonly fallbackModels: readonly string[];
  readonly primaryProvider: ModelProviderId;
  readonly fallbackProviders: readonly ModelProviderId[];
}) {
  if (input.fallbackModels.length !== input.fallbackProviders.length) {
    throw new ModelSettingsProviderMetadataError(
      input.fallbackModels.length,
      input.fallbackProviders.length,
    );
  }

  await db
    .insert(userModelSettings)
    .values({
      userId: input.userId,
      primaryModel: input.primaryModel,
      fallbackModels: [...input.fallbackModels],
      primaryProvider: input.primaryProvider,
      fallbackProviders: [...input.fallbackProviders],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userModelSettings.userId,
      set: {
        primaryModel: input.primaryModel,
        fallbackModels: [...input.fallbackModels],
        primaryProvider: input.primaryProvider,
        fallbackProviders: [...input.fallbackProviders],
        updatedAt: new Date(),
      },
    });
}
