import { and, eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { buyerRole, offering, offeringBuyerRole, signalOfferingLink, trigger } from '../schema';

// DATA-01/DATA-09: offering query module. Pure DB access — the staff-auth gate
// lives at the Server Action boundary (Phase 31/32), never in a query module;
// callers pass the Clerk userId through as createdBy/updatedBy.
// No try/catch — fail-loud, caller owns error handling (house convention,
// proposals.ts:8).

export async function insertOffering(input: {
  practiceAreaId: number;
  domainId?: number;
  name: string;
  offerType:
    | 'entry'
    | 'core'
    | 'programme'
    | 'retainer'
    | 'on_request'
    | 'operator_differentiator'
    | 'productised';
  description: string;
  commercialModelText?: string;
  sortOrder: number;
  status?: 'active' | 'draft' | 'retired';
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(offering)
    .values({
      ...input,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning();
  return inserted;
}

export async function updateOffering(
  id: number,
  patch: Partial<typeof offering.$inferInsert>,
  updatedBy: string
) {
  const [updated] = await db
    .update(offering)
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — stamp them
    // explicitly even when the patch has no other changes.
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(offering.id, id))
    .returning();
  return updated;
}

// Admin screens (Phase 32) — every offering for the practice area regardless of
// status (drafts and retired rows visible for management). Ordered by sortOrder.
export async function listAllOfferingsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(offering)
    .where(eq(offering.practiceAreaId, practiceAreaId))
    .orderBy(offering.sortOrder);
}

// Pickers (Phase 31/32 signal-linking UI) — active only. Spec Section 3's
// draft-exclusion rule: status='draft' offerings must never surface in a
// picker, so this is the ONLY safe source for offering options.
export async function listActiveOfferingsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(offering)
    .where(and(eq(offering.practiceAreaId, practiceAreaId), eq(offering.status, 'active')))
    .orderBy(offering.sortOrder);
}

export async function insertOfferingBuyerRole(input: {
  offeringId: number;
  buyerRoleId: number;
  rank: number;
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(offeringBuyerRole)
    .values({
      ...input,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning();
  return inserted;
}

// DATA-01: one 1-to-many Entry Trigger row per offering (modeled many even
// though catalogues show one today — allows alternate phrasings later).
export async function insertTrigger(input: {
  offeringId: number;
  triggerText: string;
  sortOrder: number;
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(trigger)
    .values({
      ...input,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning();
  return inserted;
}

export async function listTriggersForOffering(offeringId: number) {
  return db
    .select()
    .from(trigger)
    .where(eq(trigger.offeringId, offeringId))
    .orderBy(trigger.sortOrder);
}

// Ranked buyer-role list for an offering's detail view: buyer_role.name inline,
// ordered by the catalogue's primary/secondary rank (CFO first, etc.).
export async function listBuyerRolesForOffering(offeringId: number) {
  return db
    .select({
      buyerRoleId: buyerRole.id,
      name: buyerRole.name,
      rank: offeringBuyerRole.rank,
    })
    .from(offeringBuyerRole)
    .innerJoin(buyerRole, eq(offeringBuyerRole.buyerRoleId, buyerRole.id))
    .where(eq(offeringBuyerRole.offeringId, offeringId))
    .orderBy(offeringBuyerRole.rank);
}

// DATA-10: true if any offeringBuyerRole, trigger, or signalOfferingLink row
// references this offering. Three sequential LIMIT-1 existence checks that
// short-circuit on the first hit — structural copy of importBatches.ts's
// hasCompanyDependents, extended to offering's three dependent tables.
export async function hasOfferingDependents(id: number): Promise<boolean> {
  const [obrRow] = await db
    .select({ one: sql`1` })
    .from(offeringBuyerRole)
    .where(eq(offeringBuyerRole.offeringId, id))
    .limit(1);
  if (obrRow) return true;
  const [triggerRow] = await db
    .select({ one: sql`1` })
    .from(trigger)
    .where(eq(trigger.offeringId, id))
    .limit(1);
  if (triggerRow) return true;
  const [linkRow] = await db
    .select({ one: sql`1` })
    .from(signalOfferingLink)
    .where(eq(signalOfferingLink.offeringId, id))
    .limit(1);
  return Boolean(linkRow);
}

export type DeleteOfferingResult = { ok: true } | { ok: false; reason: 'has_dependents' };

// DATA-10: guarded delete — never a silent cascade. The pre-check returns the
// discriminated-union rejection; Postgres FK ON DELETE RESTRICT is the hard
// backstop if the pre-check is ever bypassed. Single-statement delete only —
// the neon-http driver has no transaction support. Mirrors proposals.ts's
// AcceptProposalResult shape.
export async function deleteOffering(id: number): Promise<DeleteOfferingResult> {
  if (await hasOfferingDependents(id)) {
    return { ok: false, reason: 'has_dependents' };
  }
  await db.delete(offering).where(eq(offering.id, id));
  return { ok: true };
}
