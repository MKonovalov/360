import { eq } from 'drizzle-orm';
import { db } from '../index';
import { company } from '../schema';

export async function listCompanies() {
  return db.select().from(company);
}

// Used to resolve a CSV row's plain-text company_name to a generated
// serial id during seeding (the CSV author doesn't know DB ids).
export async function getCompanyByName(name: string) {
  const rows = await db.select().from(company).where(eq(company.name, name));
  return rows[0];
}
