import { eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { buyerRole, offeringBuyerRole, personaSignal } from '../schema';

// DATA-01/DATA-09: buyer_role query module — the flat, reusable lookup table
// for Key Personas. Pure DB access — the staff-auth gate lives at the Server
// Action boundary (Phase 31/32), never in a query module; callers pass the
// Clerk userId through as createdBy/updatedBy. No try/catch — fail-loud,
// caller owns error handling (house convention, proposals.ts:8).

export async function insertBuyerRole(input: {
  name: string;
  // Optional description per OFR-06 — buyer roles are created with
  // "name + description" (30-02). The column is already nullable in
  // schema.ts; only this input type was too narrow.
  description?: string;
  departments?: readonly string[] | null;
  functions?: readonly string[] | null;
  seniorities?: readonly string[] | null;
  geographies?: readonly string[] | null;
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(buyerRole)
    .values({
      name: input.name,
      description: input.description,
      ...(input.departments !== undefined ? { departments: input.departments === null ? null : [...input.departments] } : {}),
      ...(input.functions !== undefined ? { functions: input.functions === null ? null : [...input.functions] } : {}),
      ...(input.seniorities !== undefined ? { seniorities: input.seniorities === null ? null : [...input.seniorities] } : {}),
      ...(input.geographies !== undefined ? { geographies: input.geographies === null ? null : [...input.geographies] } : {}),
      createdBy: input.createdBy,
      // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
      updatedBy: input.createdBy,
    })
    .returning();
  return inserted;
}

export async function updateBuyerRole(
  id: number,
  patch: Partial<typeof buyerRole.$inferInsert>,
  updatedBy: string
) {
  const [updated] = await db
    .update(buyerRole)
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — stamp them
    // explicitly even when the patch has no other changes.
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(buyerRole.id, id))
    .returning();
  return updated;
}

// Plain reusable lookup — all buyer roles, no status filter. Order is
// deterministic by id (stable insert order).
const buyerRoleListProjection = {
  id: buyerRole.id,
  name: buyerRole.name,
  description: buyerRole.description,
  departments: buyerRole.departments,
  functions: buyerRole.functions,
  seniorities: buyerRole.seniorities,
  geographies: buyerRole.geographies,
  createdBy: buyerRole.createdBy,
  updatedBy: buyerRole.updatedBy,
  createdAt: buyerRole.createdAt,
  updatedAt: buyerRole.updatedAt,
};

export async function listBuyerRoles() {
  return db.select(buyerRoleListProjection).from(buyerRole).orderBy(buyerRole.id);
}

// True if this buyer role is referenced by either dependent table. Uses LIMIT 1
// to short-circuit — we only need existence, not a full count. Structural copy
// of importBatches.ts's two-table hasCompanyDependents.
export async function hasBuyerRoleDependents(id: number): Promise<boolean> {
  const [obl] = await db
    .select({ one: sql`1` })
    .from(offeringBuyerRole)
    .where(eq(offeringBuyerRole.buyerRoleId, id))
    .limit(1);
  if (obl) return true;
  const [ps] = await db
    .select({ one: sql`1` })
    .from(personaSignal)
    .where(eq(personaSignal.buyerRoleId, id))
    .limit(1);
  return Boolean(ps);
}

export type DeleteBuyerRoleResult = { ok: true } | { ok: false; reason: 'has_dependents' };

// DATA-10: guarded delete — never a silent cascade. The pre-check returns the
// discriminated-union rejection; Postgres FK ON DELETE RESTRICT is the hard
// backstop if the pre-check is ever bypassed. Single-statement delete only —
// the neon-http driver has no transaction support. Mirrors proposals.ts's
// AcceptProposalResult shape.
export async function deleteBuyerRole(id: number): Promise<DeleteBuyerRoleResult> {
  if (await hasBuyerRoleDependents(id)) {
    return { ok: false, reason: 'has_dependents' };
  }
  await db.delete(buyerRole).where(eq(buyerRole.id, id));
  return { ok: true };
}
