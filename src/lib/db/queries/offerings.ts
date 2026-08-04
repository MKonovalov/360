import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { offering } from '../schema';

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
