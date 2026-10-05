import { and, eq, ilike, exists, not, or, sql } from 'drizzle-orm';
import { db } from '../index';
import {
  persona,
  companyPersonaRole,
  companyPersonaRoleBuyerRole,
  company,
  signal,
  seniorityEnum,
  recentlyViewed,
  searchCandidate,
} from '../schema';
import { normalizeEmail, buildUpdatePatch } from '@/lib/import/dedupKeys';
import type { PersonaAcceptedValues } from '@/lib/enrichment/reviewProposal';

export interface PersonaFilters {
  search?: string;
  seniority?: string;
  currentCompany?: string;
  // Tri-state, not a plain boolean: `true` = staff explicitly chose "Yes",
  // `false` = staff explicitly chose "No", `undefined` = filter not applied
  // at all — three distinct states that must stay distinct all the way
  // down to the WHERE composition below.
  hasSignals?: boolean;
}

// D-08: search/filters are composed server-side as parameterized Drizzle
// conditions (never raw SQL string interpolation) — mirrors listCompanies's
// contract (T-3-01), extended with a two-hop EXISTS for hasSignals.
export async function listPersonas(filters: PersonaFilters = {}) {
  // D-07: TWO-HOP EXISTS — persona -> companyPersonaRole(isCurrent) ->
  // company -> signal. Built once and reused for both the true and false
  // hasSignals branches below so the subquery body isn't duplicated.
  const hasSignalsExistsSubquery = db
    .select({ one: sql`1` })
    .from(companyPersonaRole)
    .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
    .innerJoin(signal, eq(signal.companyId, company.id))
    .where(
      and(eq(companyPersonaRole.personaId, persona.id), eq(companyPersonaRole.isCurrent, true))
    );

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
        // Tri-state branch keyed on the three PersonaFilters.hasSignals
        // states: explicit true -> EXISTS, explicit false -> NOT EXISTS,
        // unset -> undefined (no filtering), mirroring the seniority and
        // currentCompany legs above. Structurally new to this codebase
        // (Phase 2's EXISTS subqueries were single-table); verified against
        // seed data (RESEARCH.md Pitfall 1 / Open Question #1).
        filters.hasSignals === true
          ? exists(hasSignalsExistsSubquery)
          : filters.hasSignals === false
            ? not(exists(hasSignalsExistsSubquery))
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

// D-04/D-09/D-10 (Phase 7): upsert by normalized email, mirroring
// upsertCompanyByDomain exactly. Blank email → always insert (D-04).
// Non-blank email → normalize, select existing; if none → insert; if found →
// build patch from non-blank fields only (D-10) and update by id.
// No try/catch — same never-throw-internally convention as functions above.
export interface UpsertPersonaInput {
  name: string;
  title?: string;
  seniority?: (typeof seniorityEnum.enumValues)[number];
  email?: string;
  linkedinUrl?: string;
}

const PERSONA_PROVENANCE_FIELDS = ['title', 'seniority', 'linkedinUrl'] as const;

function manualSources(input: UpsertPersonaInput): Record<string, 'manual'> {
  return Object.fromEntries(
    PERSONA_PROVENANCE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [
      field,
      'manual' as const,
    ])
  );
}

export async function upsertPersonaByEmail(
  row: UpsertPersonaInput
): Promise<{ record: typeof persona.$inferSelect; action: 'created' | 'updated' }> {
  if (!row.email) {
    // D-04: blank email cell ALWAYS inserts a new persona — no dedup fallback
    const [inserted] = await db
      .insert(persona)
      .values({ ...row, email: undefined, fieldSources: manualSources(row) })
      .returning();
    return { record: inserted, action: 'created' };
  }
  const normalized = normalizeEmail(row.email);
  const existing = (await db.select().from(persona).where(eq(persona.email, normalized)))[0];
  if (!existing) {
    const [inserted] = await db
      .insert(persona)
      .values({ ...row, email: normalized, fieldSources: manualSources(row) })
      .returning();
    return { record: inserted, action: 'created' };
  }
  // D-09/D-10: full overwrite EXCEPT blank/undefined fields — buildUpdatePatch
  // strips those so existing data is never cleared by a blank CSV cell.
  const patch = buildUpdatePatch({ ...row, email: normalized });
  const sources = manualSources(row);
  const [updated] = await db
    .update(persona)
    .set({
      ...patch,
      fieldSources: sql`coalesce(${persona.fieldSources}, '{}'::jsonb) || ${JSON.stringify(sources)}::jsonb`,
      version: sql`${persona.version} + 1`,
    })
    .where(eq(persona.id, existing.id))
    .returning();
  return { record: updated, action: 'updated' };
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

// Phase 8 (ENRC-02/ENRC-03): committed enrichment write for persona — mirrors
// applyCompanyEnrichment. Writable columns are title/seniority/linkedinUrl;
// name/email are never in `accepted` (the Server Action allowlist enforces it).
export async function applyPersonaEnrichment(
  id: number,
  baseVersion: number,
  accepted: PersonaAcceptedValues
): Promise<boolean> {
  const sources = Object.fromEntries(Object.keys(accepted).map((field) => [field, 'prospeo']));
  const [updated] = await db
    .update(persona)
    .set({
      ...accepted,
      fieldSources: sql`coalesce(${persona.fieldSources}, '{}'::jsonb) || ${JSON.stringify(sources)}::jsonb`,
      lastEnrichedAt: new Date(),
      version: sql`${persona.version} + 1`,
    })
    .where(and(eq(persona.id, id), eq(persona.version, baseVersion)))
    .returning({ id: persona.id });
  return updated !== undefined;
}

export interface PersonaEditValues {
  readonly name: string;
  readonly title: string | null;
  readonly seniority: (typeof seniorityEnum.enumValues)[number] | null;
  readonly email: string | null;
  readonly linkedinUrl: string | null;
}

export type UpdatePersonaResult = 'updated' | 'stale' | 'email_conflict';

// Optimistic update keyed on the version the editor loaded, mirroring
// applyPersonaEnrichment. Only fields whose value changed are re-marked
// 'manual' in fieldSources, so untouched enriched fields keep their badge.
export async function updatePersonaFields(
  id: number,
  baseVersion: number,
  values: PersonaEditValues,
  changedFields: readonly (keyof PersonaEditValues)[],
): Promise<UpdatePersonaResult> {
  const sources = Object.fromEntries(changedFields.map((field) => [field, 'manual']));
  try {
    const [updated] = await db
      .update(persona)
      .set({
        ...values,
        fieldSources: sql`coalesce(${persona.fieldSources}, '{}'::jsonb) || ${JSON.stringify(sources)}::jsonb`,
        version: sql`${persona.version} + 1`,
      })
      .where(and(eq(persona.id, id), eq(persona.version, baseVersion)))
      .returning({ id: persona.id });
    return updated !== undefined ? 'updated' : 'stale';
  } catch (error) {
    // 23505 = unique_violation on persona_email_unique.
    if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505') {
      return 'email_conflict';
    }
    throw error;
  }
}

// Hard delete. neon-http has no transactions, so this runs in FK-dependency
// order: role->buyer-role links, roles, Search candidate match pointers, the
// per-user recently-viewed rows, then the persona itself. Analysis runs and
// import logs reference personas by an untyped id and are kept as history.
export async function deletePersonaById(id: number): Promise<boolean> {
  const roleIds = db.select({ id: companyPersonaRole.id }).from(companyPersonaRole).where(eq(companyPersonaRole.personaId, id));
  await db.delete(companyPersonaRoleBuyerRole).where(sql`${companyPersonaRoleBuyerRole.companyPersonaRoleId} IN (${roleIds})`);
  await db.delete(companyPersonaRole).where(eq(companyPersonaRole.personaId, id));
  await db.update(searchCandidate).set({ matchedPersonaId: null }).where(eq(searchCandidate.matchedPersonaId, id));
  await db.delete(recentlyViewed).where(and(eq(recentlyViewed.recordType, 'persona'), eq(recentlyViewed.recordId, id)));
  const deleted = await db.delete(persona).where(eq(persona.id, id)).returning({ id: persona.id });
  return deleted.length > 0;
}

export type InsertPersonaResult = { readonly kind: 'created'; readonly id: number } | { readonly kind: 'email_conflict' };

// Manual create. Every provided field is marked 'manual'; a duplicate email
// surfaces as a result instead of a thrown 23505 (persona_email_unique).
export async function insertPersona(values: PersonaEditValues): Promise<InsertPersonaResult> {
  const sources = Object.fromEntries(
    (Object.keys(values) as (keyof PersonaEditValues)[])
      .filter((field) => field !== 'name' && values[field] !== null)
      .map((field) => [field, 'manual' as const]),
  );
  try {
    const [inserted] = await db.insert(persona).values({ ...values, fieldSources: sources }).returning({ id: persona.id });
    return { kind: 'created', id: inserted.id };
  } catch (error) {
    if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505') {
      return { kind: 'email_conflict' };
    }
    throw error;
  }
}
