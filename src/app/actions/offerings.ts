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
import {
  deleteOffering,
  deleteOfferingBuyerRole,
  deleteTrigger,
  insertOffering,
  insertOfferingBuyerRole,
  insertTrigger,
  listAllOfferingsForPracticeArea,
  listBuyerRolesForOffering,
  listTriggersForOffering,
  updateOffering,
  updateOfferingBuyerRoleRank,
  updateOfferingSortOrder,
} from '@/lib/db/queries/offerings';
import {
  catalogStatusEnum,
  offerTypeEnum,
  practiceAreaStatusEnum,
} from '@/lib/db/schema';

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
// has only ['active','draft'] (schema.ts:305). A Domain has NO status column,
// so the Domain surface is create/update/delete/reorder only — its sole
// removal path is the guarded delete (no archive action).

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
    // ['active','draft'] (schema.ts:305), so 'draft' is the archive state for
    // a practice area. The row is hidden from active pickers but never
    // deleted.
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

// OFR-03/OFR-04/OFR-05/OFR-08: Offering + Trigger action surface — the second
// half of this phase's action layer, appended to this same file (30-03).
// createOfferingAction/updateOfferingAction both funnel their ranked buyer-role
// array through the shared syncOfferingBuyerRoles diff-and-sync helper, and
// updateOfferingBuyerRolesAction exposes that SAME helper as a standalone
// staff-gated action — the Matrix tab's inline Popover editor calls it to
// persist a rank change immediately without opening the Offering Sheet
// (T-30-03-01: one diff implementation, two call paths, never divergent).
//
// Pitfalls from the file header apply unchanged; two offering-specific notes:
//  - Offering's archive state is 'retired' — catalogStatusEnum has all three
//    values ['active','draft','retired'] (schema.ts:301), so 'retired' IS
//    valid here, unlike Practice Area's 2-value enum (T-30-03-03 hardcoded
//    literal, never client-supplied).
//  - deleteOfferingAction passes deleteOffering's pre-checked has_dependents
//    result straight through — never a silent cascade (T-30-03-04).

// No sortOrder — server-computed (T-30-02-03). domainId is nullable per
// OFR-04's "No domain" option — the client may omit it or send null.
const offeringInputSchema = z.object({
  practiceAreaId: z.number().int().positive(),
  domainId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  offerType: z.enum(offerTypeEnum.enumValues),
  description: z.string().trim().min(1),
  commercialModelText: z.string().trim().optional(),
  status: z.enum(catalogStatusEnum.enumValues).optional(),
  // Ranked many-to-many: every entry is a positive-integer pair before any
  // DB write (T-30-03-02); a non-existent buyerRoleId still fails at the
  // join table's FK backstop.
  buyerRoles: z
    .array(z.object({ buyerRoleId: z.number().int().positive(), rank: z.number().int().positive() }))
    .default([]),
});

const triggerInputSchema = z.object({
  offeringId: z.number().int().positive(),
  triggerText: z.string().trim().min(1).max(500),
});

// Shared diff-and-sync helper for the ranked offering_buyer_role join table —
// structural copy of syncSignalOfferingLinks (signals.ts:52-76), extended with
// a rank-update path. CREATE inserts every entry (no existing rows to diff);
// UPDATE diffs existing rows against the next ranked array: inserts additions,
// deletes removals, updates rank-only changes. Sequential awaited loops — no
// db.transaction() (neon-http has none). If any join-row write throws
// mid-sync, the outer try/catch returns action_failed with no rollback — the
// same accepted-risk shape as syncSignalOfferingLinks.
async function syncOfferingBuyerRoles(
  offeringId: number,
  nextRanked: Array<{ buyerRoleId: number; rank: number }>,
  userId: string
): Promise<OfferingsActionResult> {
  const existing = await listBuyerRolesForOffering(offeringId);
  const existingIds = existing.map((r) => r.buyerRoleId);
  const nextIds = nextRanked.map((r) => r.buyerRoleId);
  const toAdd = nextRanked.filter((r) => !existingIds.includes(r.buyerRoleId));
  const toRemove = existing.filter((r) => !nextIds.includes(r.buyerRoleId));
  const toUpdateRank = nextRanked.filter((r) => {
    const match = existing.find((e) => e.buyerRoleId === r.buyerRoleId);
    return match !== undefined && match.rank !== r.rank;
  });

  for (const r of toAdd) {
    await insertOfferingBuyerRole({
      offeringId,
      buyerRoleId: r.buyerRoleId,
      rank: r.rank,
      createdBy: userId,
    });
  }
  for (const r of toRemove) {
    await deleteOfferingBuyerRole(offeringId, r.buyerRoleId);
  }
  for (const r of toUpdateRank) {
    await updateOfferingBuyerRoleRank(offeringId, r.buyerRoleId, r.rank, userId);
  }
  return { ok: true };
}

export async function createOfferingAction(input: unknown): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = offeringInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { buyerRoles, ...offeringFields } = parsed.data;

  try {
    // sortOrder is scoped to the offering's own (practiceAreaId, domainId)
    // sibling group — count of existing rows with the same domainId
    // (null-normalized so "No domain" offerings order among themselves),
    // never client-supplied (T-30-02-03).
    const siblings = await listAllOfferingsForPracticeArea(offeringFields.practiceAreaId);
    const sortOrder = siblings.filter(
      (o) => (o.domainId ?? null) === (offeringFields.domainId ?? null)
    ).length;
    const inserted = await insertOffering({
      ...offeringFields,
      sortOrder,
      createdBy: userId,
    });
    const syncResult = await syncOfferingBuyerRoles(inserted.id, buyerRoles, userId);
    if (!syncResult.ok) return syncResult;
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function updateOfferingAction(
  id: number,
  input: unknown
): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = offeringInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { buyerRoles, ...offeringFields } = parsed.data;

  try {
    // No sortOrder in the patch — reordering is a separate action
    // (reorderOfferingsAction), same split as practice area / domain.
    const updated = await updateOffering(id, offeringFields, userId);
    if (!updated) return { ok: false, reason: 'not_found' };
    const syncResult = await syncOfferingBuyerRoles(id, buyerRoles, userId);
    if (!syncResult.ok) return syncResult;
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function archiveOfferingAction(id: number): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  try {
    // Soft status flip to 'retired' — valid for Offering's 3-value
    // catalogStatusEnum (unlike Practice Area's 2-value enum above). The
    // literal is hardcoded server-side, never accepted from client input
    // (T-30-03-03). Row is hidden from active pickers but never deleted.
    const updated = await updateOffering(id, { status: 'retired' }, userId);
    if (!updated) return { ok: false, reason: 'not_found' };
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function deleteOfferingAction(id: number): Promise<OfferingsActionResult> {
  await requireStaffAccess();

  try {
    const result = await deleteOffering(id);
    // Pass the query-layer's has_dependents rejection straight through —
    // never re-implement or re-wrap the DATA-10 guard (T-30-03-04), and
    // never cascade silently.
    if (!result.ok) return result;
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function reorderOfferingsAction(orderedIds: number[]): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  try {
    // Sequential — no db.transaction() (neon-http has none), same house rule
    // as reorderPracticeAreasAction. i-th id gets sortOrder=i.
    for (let i = 0; i < orderedIds.length; i++) {
      await updateOfferingSortOrder(orderedIds[i], i, userId);
    }
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

// Standalone EXPORTED action (not the internal helper) — the Matrix tab's
// inline Popover editor calls this to persist a buyer-role rank change to one
// offering immediately, without opening the Offering Sheet. Staff-gated like
// every other action in this file and routed through the SAME
// syncOfferingBuyerRoles helper, so the diff logic cannot regress in two
// places (T-30-03-01).
export async function updateOfferingBuyerRolesAction(
  offeringId: number,
  buyerRoles: Array<{ buyerRoleId: number; rank: number }>
): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  try {
    const syncResult = await syncOfferingBuyerRoles(offeringId, buyerRoles, userId);
    if (!syncResult.ok) return syncResult;
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function createTriggerAction(input: unknown): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();

  const parsed = triggerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { offeringId, triggerText } = parsed.data;

  try {
    // sortOrder appends after the offering's existing triggers — count of
    // listTriggersForOffering, never client-supplied (T-30-02-03).
    const count = (await listTriggersForOffering(offeringId)).length;
    await insertTrigger({ offeringId, triggerText, sortOrder: count, createdBy: userId });
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

export async function deleteTriggerAction(id: number): Promise<OfferingsActionResult> {
  await requireStaffAccess();

  try {
    // Unconditional leaf-row delete (DATA-10 scope: trigger rows are never
    // referenced elsewhere, so no dependents guard — 30-01's design note).
    // Still wrapped in try/catch because deleteTrigger can throw on a
    // genuine DB error.
    await deleteTrigger(id);
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
