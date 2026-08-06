import { eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { domain, offering } from '../schema';

// DATA-01/DATA-09: domain query module, one level down from practice_area.
// Pure DB access — the staff-auth gate lives at the Server Action boundary
// (Phase 31/32), never in a query module; callers pass the Clerk userId
// through as createdBy/updatedBy. No try/catch — fail-loud, caller owns error
// handling (house convention, proposals.ts:8).

export async function insertDomain(input: {
  practiceAreaId: number;
  name: string;
  sortOrder: number;
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(domain)
    .values({
      practiceAreaId: input.practiceAreaId,
      name: input.name,
      sortOrder: input.sortOrder,
      createdBy: input.createdBy,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning();
  return inserted;
}

export async function updateDomain(
  id: number,
  patch: Partial<typeof domain.$inferInsert>,
  updatedBy: string
) {
  const [updated] = await db
    .update(domain)
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — stamp them
    // explicitly even when the patch has no other changes.
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(domain.id, id))
    .returning();
  return updated;
}

// Reorder thin wrapper for the Phase 30 offerings UI — reuses updateDomain
// so the updatedAt/updatedBy stamping convention stays in one place.
export async function updateDomainSortOrder(id: number, sortOrder: number, updatedBy: string) {
  return updateDomain(id, { sortOrder }, updatedBy);
}

export async function listDomainsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(domain)
    .where(eq(domain.practiceAreaId, practiceAreaId))
    .orderBy(domain.sortOrder);
}

// True if any offering row references this domain. Uses LIMIT 1 to
// short-circuit — we only need existence, not a full count. Structural copy
// of importBatches.ts's single-table hasPersonaDependents.
export async function hasDomainDependents(id: number): Promise<boolean> {
  const [offeringRow] = await db
    .select({ one: sql`1` })
    .from(offering)
    .where(eq(offering.domainId, id))
    .limit(1);
  return Boolean(offeringRow);
}

export type DeleteDomainResult = { ok: true } | { ok: false; reason: 'has_dependents' };

// DATA-10: guarded delete — never a silent cascade. The pre-check returns the
// discriminated-union rejection; Postgres FK ON DELETE RESTRICT is the hard
// backstop if the pre-check is ever bypassed. Single-statement delete only —
// the neon-http driver has no transaction support. Mirrors proposals.ts's
// AcceptProposalResult shape.
export async function deleteDomain(id: number): Promise<DeleteDomainResult> {
  if (await hasDomainDependents(id)) {
    return { ok: false, reason: 'has_dependents' };
  }
  await db.delete(domain).where(eq(domain.id, id));
  return { ok: true };
}
