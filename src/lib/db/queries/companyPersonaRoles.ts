import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, companyPersonaRole, companyPersonaRoleBuyerRole, persona } from '../schema';

export interface InsertCompanyPersonaRoleInput {
  companyId: number;
  personaId: number;
  title?: string;
  isCurrent: boolean;
  startDate?: string;
  endDate?: string;
}

export type InsertCurrentCompanyPersonaRoleInput = Omit<InsertCompanyPersonaRoleInput, 'isCurrent'> & {
  isCurrent: true;
};

export async function insertCompanyPersonaRole(row: InsertCompanyPersonaRoleInput) {
  const [inserted] = await db.insert(companyPersonaRole).values(row).returning();
  return inserted;
}

export async function insertCompanyPersonaRoleIfMissing(
  input: InsertCurrentCompanyPersonaRoleInput,
): Promise<{ id: number; created: boolean }> {
  const [inserted] = await db
    .insert(companyPersonaRole)
    .values(input)
    .onConflictDoNothing({
      target: [companyPersonaRole.companyId, companyPersonaRole.personaId],
      where: sql`${companyPersonaRole.isCurrent} = true`,
    })
    .returning({ id: companyPersonaRole.id });
  if (inserted) return { id: inserted.id, created: true };

  const [existing] = await db
    .select({ id: companyPersonaRole.id })
    .from(companyPersonaRole)
    .where(
      and(
        eq(companyPersonaRole.companyId, input.companyId),
        eq(companyPersonaRole.personaId, input.personaId),
        eq(companyPersonaRole.isCurrent, true),
      ),
    )
    .orderBy(asc(companyPersonaRole.id))
    .limit(1);
  if (!existing) throw new Error('Company Persona Role conflict did not resolve to a row');
  return { id: existing.id, created: false };
}

export interface InsertCompanyPersonaRoleBuyerRoleInput {
  companyPersonaRoleId: number;
  buyerRoleId: number;
}

export async function insertCompanyPersonaRoleBuyerRoleIfMissing(
  input: InsertCompanyPersonaRoleBuyerRoleInput,
): Promise<{ created: boolean }> {
  const [inserted] = await db
    .insert(companyPersonaRoleBuyerRole)
    .values(input)
    .onConflictDoNothing({
      target: [companyPersonaRoleBuyerRole.companyPersonaRoleId, companyPersonaRoleBuyerRole.buyerRoleId],
    })
    .returning({ id: companyPersonaRoleBuyerRole.id });
  if (inserted) return { created: true };

  const [existing] = await db
    .select({ id: companyPersonaRoleBuyerRole.id })
    .from(companyPersonaRoleBuyerRole)
    .where(
      and(
        eq(companyPersonaRoleBuyerRole.companyPersonaRoleId, input.companyPersonaRoleId),
        eq(companyPersonaRoleBuyerRole.buyerRoleId, input.buyerRoleId),
      ),
    )
    .orderBy(asc(companyPersonaRoleBuyerRole.id))
    .limit(1);
  if (!existing) throw new Error('Company Persona Role Buyer Role conflict did not resolve to a row');
  return { created: false };
}

// COMP-04: linked personas for a company's detail pane — inner join keeps
// only roles with a resolvable persona (should always be true given FK
// constraints, but inner join is the correct/simplest expression either way).
export async function listPersonasForCompany(companyId: number) {
  return db
    .select({ persona, role: companyPersonaRole })
    .from(companyPersonaRole)
    .innerJoin(persona, eq(companyPersonaRole.personaId, persona.id))
    .where(eq(companyPersonaRole.companyId, companyId));
}

// PERS-02/PERS-03: reverse of listPersonasForCompany — a Persona's current +
// historical company roles for the detail pane's Current Company and Career
// History sections (D-04).
export async function listCompanyRolesForPersona(personaId: number) {
  return db
    .select({ company, role: companyPersonaRole })
    .from(companyPersonaRole)
    .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
    .where(eq(companyPersonaRole.personaId, personaId));
}
