import { eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { companySignal, domain, offering, personaSignal, practiceArea } from '../schema';

// DATA-01/DATA-09: practice_area query module. Pure DB access — the staff-auth
// gate lives at the Server Action boundary (Phase 31/32), never in a query
// module; callers pass the Clerk userId through as createdBy/updatedBy.
// No try/catch — fail-loud, caller owns error handling (house convention,
// proposals.ts:8).

export async function insertPracticeArea(input: {
  name: string;
  shortCode: string;
  sortOrder: number;
  description?: string;
  status?: 'active' | 'draft';
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(practiceArea)
    .values({
      name: input.name,
      shortCode: input.shortCode,
      sortOrder: input.sortOrder,
      description: input.description,
      status: input.status,
      createdBy: input.createdBy,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning();
  return inserted;
}

export async function updatePracticeArea(
  id: number,
  patch: Partial<typeof practiceArea.$inferInsert>,
  updatedBy: string
) {
  const [updated] = await db
    .update(practiceArea)
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — stamp them
    // explicitly even when the patch has no other changes.
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(practiceArea.id, id))
    .returning();
  return updated;
}

// Reorder thin wrapper for the Phase 30 offerings UI — reuses updatePracticeArea
// so the updatedAt/updatedBy stamping convention stays in one place.
export async function updatePracticeAreaSortOrder(id: number, sortOrder: number, updatedBy: string) {
  return updatePracticeArea(id, { sortOrder }, updatedBy);
}

// Admin screens (Phase 32) — every practice area regardless of status.
export async function listAllPracticeAreas() {
  return db.select().from(practiceArea).orderBy(practiceArea.sortOrder);
}

// Pickers (Phase 31) — active only; draft practice areas are hidden from the
// Signals picker per spec Section 2.1.
export async function listActivePracticeAreas() {
  return db
    .select()
    .from(practiceArea)
    .where(eq(practiceArea.status, 'active'))
    .orderBy(practiceArea.sortOrder);
}

// True if any domain, offering, companySignal, or personaSignal row references
// this practice area. Uses LIMIT 1 to short-circuit — we only need existence,
// not a full count. Structural copy of importBatches.ts's hasCompanyDependents.
export async function hasPracticeAreaDependents(id: number): Promise<boolean> {
  const [domainRow] = await db
    .select({ one: sql`1` })
    .from(domain)
    .where(eq(domain.practiceAreaId, id))
    .limit(1);
  if (domainRow) return true;
  const [offeringRow] = await db
    .select({ one: sql`1` })
    .from(offering)
    .where(eq(offering.practiceAreaId, id))
    .limit(1);
  if (offeringRow) return true;
  const [companySignalRow] = await db
    .select({ one: sql`1` })
    .from(companySignal)
    .where(eq(companySignal.practiceAreaId, id))
    .limit(1);
  if (companySignalRow) return true;
  const [personaSignalRow] = await db
    .select({ one: sql`1` })
    .from(personaSignal)
    .where(eq(personaSignal.practiceAreaId, id))
    .limit(1);
  return Boolean(personaSignalRow);
}

export type DeletePracticeAreaResult = { ok: true } | { ok: false; reason: 'has_dependents' };

// DATA-10: guarded delete — never a silent cascade. The pre-check returns the
// discriminated-union rejection; Postgres FK ON DELETE RESTRICT is the hard
// backstop if the pre-check is ever bypassed. Single-statement delete only —
// the neon-http driver has no transaction support. Mirrors proposals.ts's
// AcceptProposalResult shape.
export async function deletePracticeArea(id: number): Promise<DeletePracticeAreaResult> {
  if (await hasPracticeAreaDependents(id)) {
    return { ok: false, reason: 'has_dependents' };
  }
  await db.delete(practiceArea).where(eq(practiceArea.id, id));
  return { ok: true };
}
