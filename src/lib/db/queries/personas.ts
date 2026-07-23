import { and, eq, ilike, exists, or, sql } from 'drizzle-orm';
import { db } from '../index';
import { persona, companyPersonaRole, company, signal, seniorityEnum } from '../schema';

export interface PersonaFilters {
  search?: string;
  seniority?: string;
  currentCompany?: string;
  hasSignals?: boolean;
}

// D-08: search/filters are composed server-side as parameterized Drizzle
// conditions (never raw SQL string interpolation) — mirrors listCompanies's
// contract (T-3-01), extended with a two-hop EXISTS for hasSignals.
export async function listPersonas(filters: PersonaFilters = {}) {
  return db
    .select()
    .from(persona)
    .where(
      and(
        // D-06: search matches name, title, OR the linked CURRENT company's
        // name — three-way OR, the company-name leg needs its own EXISTS
        // subquery since it lives on a joined child table.
        filters.search
          ? or(
              ilike(persona.name, `%${filters.search}%`),
              ilike(persona.title, `%${filters.search}%`),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(companyPersonaRole)
                  .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
                  .where(
                    and(
                      eq(companyPersonaRole.personaId, persona.id),
                      eq(companyPersonaRole.isCurrent, true),
                      ilike(company.name, `%${filters.search}%`)
                    )
                  )
              )
            )
          : undefined,
        filters.seniority
          ? eq(persona.seniority, filters.seniority as (typeof seniorityEnum.enumValues)[number])
          : undefined,
        // D-07: current-company filter — single-hop EXISTS against the
        // isCurrent role row, same shape as the search leg above.
        filters.currentCompany
          ? exists(
              db
                .select({ one: sql`1` })
                .from(companyPersonaRole)
                .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
                .where(
                  and(
                    eq(companyPersonaRole.personaId, persona.id),
                    eq(companyPersonaRole.isCurrent, true),
                    eq(company.name, filters.currentCompany)
                  )
                )
            )
          : undefined,
        // D-07: TWO-HOP EXISTS — persona -> companyPersonaRole(isCurrent)
        // -> company -> signal. Structurally new to this codebase (Phase 2's
        // EXISTS subqueries were single-table); verified against seed data
        // (RESEARCH.md Pitfall 1 / Open Question #1).
        filters.hasSignals
          ? exists(
              db
                .select({ one: sql`1` })
                .from(companyPersonaRole)
                .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
                .innerJoin(signal, eq(signal.companyId, company.id))
                .where(
                  and(
                    eq(companyPersonaRole.personaId, persona.id),
                    eq(companyPersonaRole.isCurrent, true)
                  )
                )
            )
          : undefined
      )
    );
}

// Used to resolve a CSV row's plain-text persona_name to a generated
// serial id during seeding (the CSV author doesn't know DB ids).
export async function getPersonaByName(name: string) {
  const rows = await db.select().from(persona).where(eq(persona.name, name));
  return rows[0];
}

// Mirrors getCompanyById's convention exactly: returns undefined if not
// found, never throws — the detail page decides whether that means
// notFound().
export async function getPersonaById(id: number) {
  const rows = await db.select().from(persona).where(eq(persona.id, id));
  return rows[0];
}

// Mirrors listDistinctIndustries — options for the "current company" filter
// Select must come from the current-role join, not a plain company-table
// distinct (a company must actually have a current persona to appear as a
// filter option).
export async function listDistinctCurrentCompanyNames() {
  return db
    .selectDistinct({ name: company.name })
    .from(companyPersonaRole)
    .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
    .where(eq(companyPersonaRole.isCurrent, true));
}
