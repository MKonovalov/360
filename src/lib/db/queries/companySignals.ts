import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { companySignal } from '../schema';

// DATA-02/DATA-09: company_signal query module. Pure DB access — the staff
// auth gate lives at the Server Action boundary (Phase 31/32), never in a
// query module; callers pass the Clerk userId through as createdBy/updatedBy.
// No try/catch — fail-loud, caller owns error handling (house convention,
// proposals.ts:8).

export async function insertCompanySignal(input: {
  practiceAreaId: number;
  name: string;
  category: string;
  description: string;
  status?: 'active' | 'draft' | 'retired';
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(companySignal)
    .values({
      ...input,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning();
  return inserted;
}

export async function updateCompanySignal(
  id: number,
  patch: Partial<typeof companySignal.$inferInsert>,
  updatedBy: string
) {
  const [updated] = await db
    .update(companySignal)
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — stamp them
    // explicitly even when the patch has no other changes.
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(companySignal.id, id))
    .returning();
  return updated;
}

// Admin screens (Phase 31/32) — every company signal for the practice area
// regardless of status (drafts and retired rows visible for management).
export async function listAllCompanySignalsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(companySignal)
    .where(eq(companySignal.practiceAreaId, practiceAreaId));
}

// Pickers (Phase 31 signal-linking UI) — active only. Spec Section 3's
// draft-exclusion rule: status='draft' signals must never surface in a
// picker, so this is the ONLY safe source for company-signal options.
export async function listActiveCompanySignalsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(companySignal)
    .where(and(eq(companySignal.practiceAreaId, practiceAreaId), eq(companySignal.status, 'active')));
}

// DATA-02: autocomplete suggestions from existing category values — the spec
// keeps `category` free text (explicitly NOT an enum), so the picker reads
// the distinct set currently in use instead of a hardcoded list. Mapped to
// string[] for callers; SQL ORDER BY supplies the sort.
export async function listDistinctCompanySignalCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: companySignal.category })
    .from(companySignal)
    .orderBy(companySignal.category);
  return rows.map((row) => row.category);
}
