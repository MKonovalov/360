import { eq } from 'drizzle-orm';
import { db } from '../index';
import { companyPersonaRole, persona, company } from '../schema';

export interface InsertCompanyPersonaRoleInput {
  companyId: number;
  personaId: number;
  title?: string;
  isCurrent: boolean;
  startDate?: string;
  endDate?: string;
}

export async function insertCompanyPersonaRole(row: InsertCompanyPersonaRoleInput) {
  const [inserted] = await db.insert(companyPersonaRole).values(row).returning();
  return inserted;
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
