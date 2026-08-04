import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { personaSignal } from '../schema';

// DATA-02/DATA-07/DATA-09: persona_signal query module. Pure DB access — the
// staff auth gate lives at the Server Action boundary (Phase 31/32), never in
// a query module; callers pass the Clerk userId through as createdBy/updatedBy.
// No try/catch — fail-loud, caller owns error handling (house convention,
// proposals.ts:8). Same shape as companySignals.ts, extended with the
// required buyerRoleId (DATA-07: every persona signal references a real
// buyer_role — never null, never a placeholder).

export async function insertPersonaSignal(input: {
  practiceAreaId: number;
  buyerRoleId: number;
  name: string;
  category: string;
  description: string;
  status?: 'active' | 'draft' | 'retired';
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(personaSignal)
    .values({
      ...input,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning();
  return inserted;
}

export async function updatePersonaSignal(
  id: number,
  patch: Partial<typeof personaSignal.$inferInsert>,
  updatedBy: string
) {
  const [updated] = await db
    .update(personaSignal)
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — stamp them
    // explicitly even when the patch has no other changes.
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(personaSignal.id, id))
    .returning();
  return updated;
}

// Admin screens (Phase 31/32) — every persona signal for the practice area
// regardless of status (drafts and retired rows visible for management).
export async function listAllPersonaSignalsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(personaSignal)
    .where(eq(personaSignal.practiceAreaId, practiceAreaId));
}

// Pickers (Phase 31 signal-linking UI) — active only. Spec Section 3's
// draft-exclusion rule: status='draft' signals must never surface in a
// picker, so this is the ONLY safe source for persona-signal options.
export async function listActivePersonaSignalsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(personaSignal)
    .where(and(eq(personaSignal.practiceAreaId, practiceAreaId), eq(personaSignal.status, 'active')));
}

// DATA-02: autocomplete suggestions from existing category values — the spec
// keeps `category` free text (explicitly NOT an enum), so the picker reads
// the distinct set currently in use instead of a hardcoded list. Mapped to
// string[] for callers; SQL ORDER BY supplies the sort.
export async function listDistinctPersonaSignalCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: personaSignal.category })
    .from(personaSignal)
    .orderBy(personaSignal.category);
  return rows.map((row) => row.category);
}
