import { and, eq, ilike, exists, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, signal, revenueBandEnum, ownershipTypeEnum, signalTypeEnum } from '../schema';

export interface CompanyFilters {
  search?: string;
  industry?: string;
  signalType?: string;
  revenueBand?: string;
  ownershipType?: string;
}

// D-08: search/filters are composed server-side as parameterized Drizzle
// conditions (never raw SQL string interpolation) — this is the query-layer
// contract Plans 03/04's UI-sourced filters rely on (T-2-01).
export async function listCompanies(filters: CompanyFilters = {}) {
  return db
    .select()
    .from(company)
    .where(
      and(
        filters.search ? ilike(company.name, `%${filters.search}%`) : undefined,
        filters.industry ? eq(company.industry, filters.industry) : undefined,
        filters.revenueBand
          ? eq(company.revenueBand, filters.revenueBand as (typeof revenueBandEnum.enumValues)[number])
          : undefined,
        filters.ownershipType
          ? eq(company.ownershipType, filters.ownershipType as (typeof ownershipTypeEnum.enumValues)[number])
          : undefined,
        // signal type lives on a child table — EXISTS avoids duplicate
        // company rows a JOIN would produce when a company has multiple
        // signals of the same type (Pitfall 5).
        filters.signalType
          ? exists(
              db
                .select({ one: sql`1` })
                .from(signal)
                .where(
                  and(
                    eq(signal.companyId, company.id),
                    eq(signal.signalType, filters.signalType as (typeof signalTypeEnum.enumValues)[number])
                  )
                )
            )
          : undefined
      )
    );
}

// Used to resolve a CSV row's plain-text company_name to a generated
// serial id during seeding (the CSV author doesn't know DB ids).
export async function getCompanyByName(name: string) {
  const rows = await db.select().from(company).where(eq(company.name, name));
  return rows[0];
}

// Mirrors getCompanyByName's convention: returns undefined if not found,
// never throws — the detail page decides whether that means notFound().
export async function getCompanyById(id: number) {
  const rows = await db.select().from(company).where(eq(company.id, id));
  return rows[0];
}

export async function listDistinctIndustries() {
  return db.selectDistinct({ industry: company.industry }).from(company);
}
