import { db } from '../index';
import { companyPersonaRole } from '../schema';

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
