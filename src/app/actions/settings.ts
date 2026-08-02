'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { upsertModelSettings } from '@/lib/db/queries/userModelSettings';
import { getAllowlistedServableIds } from '@/lib/models/catalog';
import catalogJson from '@/lib/models/catalog.json';

// Server Action controller for the Settings form (SET-06/SET-07). The order is
// IMMUTABLE (17-UI-SPEC): requireStaffAccess() FIRST — Server Actions gate
// independently of the page (reviews.ts precedent) — then zod-validate the
// unknown input, then check every id against the server-computed servable set
// (allowlist ∩ committed snapshot — the ONLY source of truth, T-17-03), then
// the D-08/D-09 dedupe backstop, then the atomic full-value upsert keyed by
// the SESSION userId (Pitfall 9 — no read-modify-write; the schema declares no
// userId field, so the row key can never come from client input, T-17-02).
// This action NEVER returns stale_primary/stale_fallback: without reading the
// saved row it cannot distinguish a stale-but-once-saved id from any other
// unknown id, and the client-side staleness gate (plan 17-03 Task 2) is the
// primary D-10/D-11 mechanism — a dropped-from-roster id surfaces here as
// invalid_model (T-17-06), and the form's copy map has no stale_* entries.

export type SettingsActionResult = { ok: true } | { ok: false; reason: string };

// The client sends `fallbacks`; the DB column is `fallbackModels` — the map
// happens at the upsert call below. Cap 2 matches SET-04 / Phase 16 D-10.
const settingsInputSchema = z.object({
  primaryModel: z.string(),
  fallbacks: z.array(z.string()).max(2),
});

export async function saveSettingsAction(input: unknown): Promise<SettingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_model' };

  try {
    const servableIds = getAllowlistedServableIds(catalogJson);
    const all = [parsed.data.primaryModel, ...parsed.data.fallbacks];
    if (!all.every((id) => servableIds.includes(id))) {
      return { ok: false, reason: 'invalid_model' };
    }

    // D-08/D-09 backstop: reject primary∈fallbacks and repeated fallbacks even
    // if the client gates are bypassed — the DB can never hold a
    // self-referencing or duplicate chain (T-17-04).
    if (
      parsed.data.fallbacks.includes(parsed.data.primaryModel) ||
      new Set(parsed.data.fallbacks).size !== parsed.data.fallbacks.length
    ) {
      return { ok: false, reason: 'duplicate_model' };
    }

    await upsertModelSettings({
      userId,
      primaryModel: parsed.data.primaryModel,
      fallbackModels: parsed.data.fallbacks,
    });

    revalidatePath('/settings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
