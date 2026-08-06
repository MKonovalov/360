'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  deletePracticeArea,
  insertPracticeArea,
  listAllPracticeAreas,
  updatePracticeArea,
  updatePracticeAreaSortOrder,
} from '@/lib/db/queries/practiceAreas';
import {
  deleteDomain,
  insertDomain,
  listDomainsForPracticeArea,
  updateDomain,
  updateDomainSortOrder,
} from '@/lib/db/queries/domains';
import { practiceAreaStatusEnum } from '@/lib/db/schema';

// OFR-03/OFR-06/OFR-08: Server Action controller for Practice Area + Domain
// CRUD/archive/delete/reorder — the first half of this phase's action layer
// (Offering + Trigger actions land in 30-03, appended to this same file).
// Every action calls requireStaffAccess() FIRST (independent of the page's own
// gate — a caller invoking the Server Action directly bypasses the UI),
// validates unknown input with zod before any write, and returns a
// discriminated-union result — never throws to the client. Mirrors signals.ts's
// 4-step shape verbatim.
//
// Pitfall 1: every update routes through the named update* query function so
// updatedAt/updatedBy get stamped — never a raw Drizzle update call here.
// Pitfall 2: no transaction wrapper — the neon-http driver has zero
// transaction support; reorder loops are sequential dependency-ordered.
// Pitfall 3: sortOrder is NEVER accepted from client input — create actions
// compute it server-side by counting existing sibling rows (T-30-02-03).
// Archive for a practice area is a soft flip to 'draft' — practiceAreaStatusEnum
// has only ['active','draft'] (schema.ts:305); a Domain has NO status column,
// so there is deliberately NO archiveDomainAction — its only removal path is
// the guarded delete.

export type OfferingsActionResult = { ok: true } | { ok: false; reason: string };

// Deliberately no sortOrder field — server-computed (T-30-02-03). A client-
// supplied sortOrder key is stripped by zod's default unknown-key handling.
const practiceAreaInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  shortCode: z.string().trim().min(1).max(50),
  description: z.string().trim().optional(),
  status: z.enum(practiceAreaStatusEnum.enumValues).optional(),
});

// No sortOrder, no status — domain has neither a sort-order-input contract nor
// a status column.
const domainInputSchema = z.object({
  practiceAreaId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
});

export async function createPracticeAreaAction(input: unknown): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = practiceAreaInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { name, shortCode, description, status } = parsed.data;

  try {
    const sortOrder = (await listAllPracticeAreas()).length;
    await insertPracticeArea({ name, shortCode, description, status, sortOrder, createdBy: userId });
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function updatePracticeAreaAction(
  id: number,
  input: unknown
): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = practiceAreaInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { name, shortCode, description, status } = parsed.data;

  try {
    const updated = await updatePracticeArea(id, { name, shortCode, description, status }, userId);
    if (!updated) return { ok: false, reason: 'not_found' };
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function archivePracticeAreaAction(id: number): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  try {
    // Soft status flip to 'draft' — practiceAreaStatusEnum has only
    // ['active','draft'] (schema.ts:305), there is no 'retired' state for a
    // practice area. The row is hidden from active pickers but never deleted.
    const updated = await updatePracticeArea(id, { status: 'draft' }, userId);
    if (!updated) return { ok: false, reason: 'not_found' };
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function deletePracticeAreaAction(id: number): Promise<OfferingsActionResult> {
  await requireStaffAccess();

  try {
    const result = await deletePracticeArea(id);
    // Pass the query-layer's has_dependents rejection straight through —
    // never re-implement or re-wrap the DATA-10 guard (T-30-02-04).
    if (!result.ok) return result;
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function reorderPracticeAreasAction(
  orderedIds: number[]
): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  try {
    // Sequential — no db.transaction() (neon-http has none), same house rule
    // as syncSignalOfferingLinks (signals.ts:24-26). i-th id gets sortOrder=i.
    for (let i = 0; i < orderedIds.length; i++) {
      await updatePracticeAreaSortOrder(orderedIds[i], i, userId);
    }
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function createDomainAction(input: unknown): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = domainInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { practiceAreaId, name } = parsed.data;

  try {
    // sortOrder is scoped to the domain's own practice area — sibling count
    // within the same area, never client-supplied (T-30-02-03).
    const sortOrder = (await listDomainsForPracticeArea(practiceAreaId)).length;
    await insertDomain({ practiceAreaId, name, sortOrder, createdBy: userId });
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function updateDomainAction(
  id: number,
  input: unknown
): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = domainInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { practiceAreaId, name } = parsed.data;

  try {
    const updated = await updateDomain(id, { practiceAreaId, name }, userId);
    if (!updated) return { ok: false, reason: 'not_found' };
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function deleteDomainAction(id: number): Promise<OfferingsActionResult> {
  await requireStaffAccess();

  try {
    const result = await deleteDomain(id);
    // Pass the query-layer's has_dependents rejection straight through —
    // never re-implement or re-wrap the DATA-10 guard (T-30-02-04).
    if (!result.ok) return result;
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function reorderDomainsAction(orderedIds: number[]): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  try {
    // Sequential — no db.transaction() (neon-http has none), same house rule
    // as reorderPracticeAreasAction. i-th id gets sortOrder=i.
    for (let i = 0; i < orderedIds.length; i++) {
      await updateDomainSortOrder(orderedIds[i], i, userId);
    }
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
