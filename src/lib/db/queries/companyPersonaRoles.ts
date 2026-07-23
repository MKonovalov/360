import { eq } from 'drizzle-orm';
import { db } from '../index';
import { companyPersonaRole, persona } from '../schema';

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
