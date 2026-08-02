import { eq } from 'drizzle-orm';
import { db } from '../index';
import { userModelSettings } from '../schema';

// REG-05: absence is a falsy value (undefined), never a throw — "no saved
// settings" is a valid state meaning "use the default chain" (claude-sonnet-4-6,
// FAST_MODEL_ID in runAgent.ts). The Phase 16 resolver maps the absence to the
// default; no try/catch here — the caller owns error handling (house convention).
export async function getModelSettingsForUser(userId: string) {
  return db.query.userModelSettings.findFirst({
    where: eq(userModelSettings.userId, userId),
  });
}

// Pitfall 9: full-value atomic upsert — every save writes the COMPLETE chain,
// never a merge of the current row + a partial change (no read-modify-write).
// Single insert ... onConflictDoUpdate statement keyed on the user_id PK.
export async function upsertModelSettings(input: {
  userId: string;
  primaryModel: string;
  fallbackModels: string[];
}) {
  await db
    .insert(userModelSettings)
    .values({ ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userModelSettings.userId,
      set: {
        primaryModel: input.primaryModel,
        fallbackModels: input.fallbackModels,
        updatedAt: new Date(),
      },
    });
}
