'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  deleteBuyerRole,
  insertBuyerRole,
  updateBuyerRole,
} from '@/lib/db/queries/buyerRoles';

// OFR-06: Server Action controller for the Buyer Role lookup CRUD panel — the
// SINGLE write surface both Offerings and Signals call for buyer roles
// (30-CONTEXT.md D-05). Every action calls requireStaffAccess() FIRST,
// zod-validates unknown input before any write, and returns a discriminated-
// union result — never throws to the client. Mirrors signals.ts's 4-step
// shape verbatim. BuyerRolesActionResult is intentionally declared
// independently (same shape as OfferingsActionResult) to avoid a cross-import
// between the two action files — mirrors signals.ts's own independent
// SignalsActionResult.
//
// Pitfall 1: every update routes through the named updateBuyerRole query
// function so updatedAt/updatedBy get stamped — never a raw Drizzle update.
// buyer_role has NO status column (schema.ts:367) — the spec's OFR-06
// "archive" wording maps to the guarded hard delete, and its has_dependents
// rejection is surfaced verbatim (T-30-02-04).

export type BuyerRolesActionResult = { ok: true } | { ok: false; reason: string };

const buyerRoleInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().optional(),
});

export async function createBuyerRoleAction(input: unknown): Promise<BuyerRolesActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = buyerRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { name, description } = parsed.data;

  try {
    await insertBuyerRole({
      name,
      description,
      createdBy: userId,
    });
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function updateBuyerRoleAction(
  id: number,
  input: unknown
): Promise<BuyerRolesActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = buyerRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { name, description } = parsed.data;

  try {
    const updated = await updateBuyerRole(id, { name, description }, userId);
    if (!updated) return { ok: false, reason: 'not_found' };
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function deleteBuyerRoleAction(id: number): Promise<BuyerRolesActionResult> {
  await requireStaffAccess();

  try {
    const result = await deleteBuyerRole(id);
    // Pass the query-layer's has_dependents rejection straight through —
    // never re-implement or re-wrap the DATA-10 guard (T-30-02-04).
    if (!result.ok) return result;
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
