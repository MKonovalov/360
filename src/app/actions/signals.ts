'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { insertCompanySignal, updateCompanySignal } from '@/lib/db/queries/companySignals';
import { insertPersonaSignal, updatePersonaSignal } from '@/lib/db/queries/personaSignals';
import {
  deleteSignalOfferingLink,
  insertSignalOfferingLink,
  listLinksForSignal,
} from '@/lib/db/queries/signalOfferingLinks';
import { catalogStatusEnum } from '@/lib/db/schema';

// SIG-06/SIG-07/SIG-08/SIG-09: Server Action controller for Signals CRUD +
// archive. Every action calls requireStaffAccess() FIRST (independent of the
// page's own gate — a caller invoking the Server Action directly bypasses the
// UI), validates unknown input with zod before any write, and returns a
// discriminated-union result — never throws to the client. Mirrors reviews.ts's
// 4-step shape verbatim.
//
// Pitfall 1: every update routes through the named update* query function so
// updatedAt/updatedBy get stamped — never a raw Drizzle update call here.
// Pitfall 2: no transaction wrapper — the neon-http driver has zero
// transaction support; the create/update-with-links flow is sequential
// dependency-ordered.
// Pitfall 5: status is validated against catalogStatusEnum, never the
// practice-area lifecycle enum (the two live side-by-side in schema.ts).

export type SignalsActionResult = { ok: true } | { ok: false; reason: string };

const companySignalInputSchema = z.object({
  practiceAreaId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1),
  status: z.enum(catalogStatusEnum.enumValues).optional(),
  offeringIds: z.array(z.number().int().positive()).default([]),
});

const personaSignalInputSchema = companySignalInputSchema.extend({
  buyerRoleId: z.number().int().positive(),
});

// Shared link-sync helper for both create and update flows. For CREATE there
// are no existing links — loop insert over every id. For UPDATE, diff the
// existing link rows against the next id set, insert added ids, delete removed
// ones. If any insert rejects with practice_area_mismatch, stop and surface
// that result verbatim (T-29-03-03: the action layer does NOT re-implement the
// query-layer guard). No rollback on mismatch — neon-http has no transactions
// (T-30-08 accepted small race window).
async function syncSignalOfferingLinks(
  signalType: 'company' | 'persona',
  signalId: number,
  nextOfferingIds: number[],
  createdBy: string
): Promise<SignalsActionResult> {
  const existing = await listLinksForSignal(signalType, signalId);
  const existingOfferingIds = existing.map((l) => l.offeringId);
  const toAdd = nextOfferingIds.filter((id) => !existingOfferingIds.includes(id));
  const toRemove = existing.filter((l) => !nextOfferingIds.includes(l.offeringId));

  for (const offeringId of toAdd) {
    const linkResult = await insertSignalOfferingLink({
      signalType,
      signalId,
      offeringId,
      createdBy,
    });
    if (!linkResult.ok) return linkResult;
  }
  for (const link of toRemove) {
    await deleteSignalOfferingLink(link.id);
  }
  return { ok: true };
}

export async function createCompanySignalAction(input: unknown): Promise<SignalsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = companySignalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { practiceAreaId, name, category, description, status, offeringIds } = parsed.data;

  try {
    const inserted = await insertCompanySignal({
      practiceAreaId,
      name,
      category,
      description,
      status,
      createdBy: userId,
    });
    const linkResult = await syncSignalOfferingLinks('company', inserted.id, offeringIds, userId);
    if (!linkResult.ok) return linkResult;
    revalidatePath('/signals');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function updateCompanySignalAction(
  id: number,
  input: unknown
): Promise<SignalsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = companySignalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { practiceAreaId, name, category, description, status, offeringIds } = parsed.data;

  try {
    const updated = await updateCompanySignal(
      id,
      { practiceAreaId, name, category, description, status },
      userId
    );
    if (!updated) return { ok: false, reason: 'not_found' };
    const linkResult = await syncSignalOfferingLinks('company', id, offeringIds, userId);
    if (!linkResult.ok) return linkResult;
    revalidatePath('/signals');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function archiveCompanySignalAction(id: number): Promise<SignalsActionResult> {
  const { userId } = await requireStaffAccess();

  try {
    const updated = await updateCompanySignal(id, { status: 'retired' }, userId);
    if (!updated) return { ok: false, reason: 'not_found' };
    revalidatePath('/signals');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function createPersonaSignalAction(input: unknown): Promise<SignalsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = personaSignalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { practiceAreaId, buyerRoleId, name, category, description, status, offeringIds } =
    parsed.data;

  try {
    const inserted = await insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name,
      category,
      description,
      status,
      createdBy: userId,
    });
    const linkResult = await syncSignalOfferingLinks('persona', inserted.id, offeringIds, userId);
    if (!linkResult.ok) return linkResult;
    revalidatePath('/signals');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function updatePersonaSignalAction(
  id: number,
  input: unknown
): Promise<SignalsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = personaSignalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { practiceAreaId, buyerRoleId, name, category, description, status, offeringIds } =
    parsed.data;

  try {
    const updated = await updatePersonaSignal(
      id,
      { practiceAreaId, buyerRoleId, name, category, description, status },
      userId
    );
    if (!updated) return { ok: false, reason: 'not_found' };
    const linkResult = await syncSignalOfferingLinks('persona', id, offeringIds, userId);
    if (!linkResult.ok) return linkResult;
    revalidatePath('/signals');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function archivePersonaSignalAction(id: number): Promise<SignalsActionResult> {
  const { userId } = await requireStaffAccess();

  try {
    const updated = await updatePersonaSignal(id, { status: 'retired' }, userId);
    if (!updated) return { ok: false, reason: 'not_found' };
    revalidatePath('/signals');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}