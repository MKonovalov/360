'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { upsertModelSettings } from '@/lib/db/queries/userModelSettings';
import { upsertOrganizationDataSourceSettings } from '@/lib/db/queries/organizationDataSourceSettings';
import { dataSourceSelectionSchema } from '@/lib/data-sources/contracts';
import { validateSettingsInput } from '@/lib/models/modelSettings';

// Server Action controller for the Settings form (SET-06/SET-07). The order is
// IMMUTABLE (17-UI-SPEC): requireStaffAccess() FIRST — Server Actions gate
// independently of the page (reviews.ts precedent) — then zod-validate the
// unknown input, then check every id against the union servable set
// (per-provider gates over the committed snapshot — anthropic allowlist ∩
// active + all active openrouter rows — the ONLY source of truth, T-17-03), then
// the D-08/D-09 dedupe backstop, then the atomic full-value upsert keyed by
// the SESSION userId (Pitfall 9 — no read-modify-write; the schema declares no
// userId field, so the row key can never come from client input, T-17-02).
// This action NEVER returns stale_primary/stale_fallback: without reading the
// saved row it cannot distinguish a stale-but-once-saved id from any other
// unknown id, and the client-side staleness gate (plan 17-03 Task 2) is the
// primary D-10/D-11 mechanism — a dropped-from-roster id surfaces here as
// invalid_model (T-17-06), and the form's copy map has no stale_* entries.

export type SettingsActionResult = { ok: true } | { ok: false; reason: string };

export async function saveSettingsAction(input: unknown): Promise<SettingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = validateSettingsInput(input);
  if (!parsed.ok) return parsed;

  try {
    await upsertModelSettings({
      userId,
      primaryModel: parsed.value.primaryModel,
      primaryProvider: parsed.value.primaryProvider,
      fallbackModels: parsed.value.fallbacks,
      fallbackProviders: parsed.value.fallbackProviders,
    });

    revalidatePath('/settings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function saveDataSourceSettingsAction(input: unknown): Promise<SettingsActionResult> {
  await requireStaffAccess();

  const parsed = dataSourceSelectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_data_source' };
  }

  try {
    await upsertOrganizationDataSourceSettings(parsed.data);
    revalidatePath('/settings');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error) return { ok: false, reason: 'action_failed' };
    return { ok: false, reason: 'action_failed' };
  }
}
