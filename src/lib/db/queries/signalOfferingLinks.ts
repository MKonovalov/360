import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { companySignal, offering, personaSignal, signalOfferingLink } from '../schema';

// DATA-02/DATA-09: polymorphic signal_offering_link query module. Pure DB
// access — the staff-auth gate lives at the Server Action boundary (Phase
// 31/32), never in a query module; callers pass the Clerk userId through as
// createdBy/updatedBy. No try/catch — the practice-area rejection is an
// expected business-rule outcome (discriminated union), and real DB errors
// fail loud with the caller owning error handling (house convention,
// proposals.ts). signalId is a bare integer (no FK) resolved per signalType
// exactly like importBatches.ts's recordId/entityType branch.

export type InsertSignalOfferingLinkResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'practice_area_mismatch' };

// T-30-01: the SINGLE enforcement point for the cross-practice-area rule — a
// link's offering must share the signal's practice_area_id (spec Section 3).
// Both the future Server Action layer AND the seed script (Plan 06) route
// through this function, so the guard cannot be bypassed by a second call
// site. The two reads (signal practice area, offering practice area) happen
// before the single write; no db.transaction() (neon-http has none) — the
// accepted small race window is documented in 30-RESEARCH.md (T-30-08).
export async function insertSignalOfferingLink(input: {
  signalType: 'company' | 'persona';
  signalId: number;
  offeringId: number;
  relevanceNote?: string;
  createdBy: string;
}): Promise<InsertSignalOfferingLinkResult> {
  const [signalRow] =
    input.signalType === 'company'
      ? await db
          .select({ practiceAreaId: companySignal.practiceAreaId })
          .from(companySignal)
          .where(eq(companySignal.id, input.signalId))
      : await db
          .select({ practiceAreaId: personaSignal.practiceAreaId })
          .from(personaSignal)
          .where(eq(personaSignal.id, input.signalId));
  const [offeringRow] = await db
    .select({ practiceAreaId: offering.practiceAreaId })
    .from(offering)
    .where(eq(offering.id, input.offeringId));

  // Missing signal, missing offering, or a practice-area mismatch all reject
  // with the same reason — before any write happens.
  if (!signalRow || !offeringRow || signalRow.practiceAreaId !== offeringRow.practiceAreaId) {
    return { ok: false, reason: 'practice_area_mismatch' };
  }

  const [inserted] = await db
    .insert(signalOfferingLink)
    .values({
      ...input,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning({ id: signalOfferingLink.id });
  return { ok: true, id: inserted.id };
}

// Every link pointing at the offering, each row carrying its discriminator
// signalType + polymorphic signalId for the UI to resolve the signal side.
export async function listLinksForOffering(offeringId: number) {
  return db
    .select()
    .from(signalOfferingLink)
    .where(eq(signalOfferingLink.offeringId, offeringId));
}

// Every link pointing at ONE specific signal — both the discriminator AND the
// polymorphic id are required so a company signal and a persona signal with
// coincidentally equal ids never collide.
export async function listLinksForSignal(signalType: 'company' | 'persona', signalId: number) {
  return db
    .select()
    .from(signalOfferingLink)
    .where(and(eq(signalOfferingLink.signalType, signalType), eq(signalOfferingLink.signalId, signalId)));
}

// DATA-10 note: signal_offering_link is NOT one of the four dependents-guarded
// entities — nothing references a link row, so removal is unconditional.
export async function deleteSignalOfferingLink(id: number) {
  await db.delete(signalOfferingLink).where(eq(signalOfferingLink.id, id));
}
