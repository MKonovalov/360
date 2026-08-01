import { and, eq, ilike, exists, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, signal, revenueBandEnum, ownershipTypeEnum, signalTypeEnum } from '../schema';
import { normalizeDomain, buildUpdatePatch } from '@/lib/import/dedupKeys';
import type { CompanyAcceptedValues } from '@/lib/enrichment/reviewProposal';

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

// D-01/D-02/D-03/D-09/D-10 (Phase 7): upsert by normalized domain.
// Blank domain → always insert (D-03: no dedup fallback to name matching).
// Non-blank domain → normalize, select existing; if none → insert; if found →
// build patch from non-blank fields only (D-10) and update by id.
// No try/catch — mirrors the never-throw-internally convention of the functions
// above; the caller (Server Action) owns error handling.
export interface UpsertCompanyInput {
  name: string;
  domain?: string;
  industry?: string;
  employeeCountBand?: string;
  hqLocation?: string;
  revenueBand?: (typeof revenueBandEnum.enumValues)[number];
  ownershipType?: (typeof ownershipTypeEnum.enumValues)[number];
  techStack?: string[];
}

const COMPANY_PROVENANCE_FIELDS = [
  'industry',
  'employeeCountBand',
  'hqLocation',
  'revenueBand',
  'ownershipType',
  'techStack',
] as const;

function manualSources(input: UpsertCompanyInput): Record<string, 'manual'> {
  return Object.fromEntries(
    COMPANY_PROVENANCE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [
      field,
      'manual' as const,
    ])
  );
}

export async function upsertCompanyByDomain(
  row: UpsertCompanyInput
): Promise<{ record: typeof company.$inferSelect; action: 'created' | 'updated' }> {
  if (!row.domain) {
    // D-03: blank domain cell ALWAYS inserts a new company — no dedup fallback
    const [inserted] = await db
      .insert(company)
      .values({ ...row, domain: undefined, fieldSources: manualSources(row) })
      .returning();
    return { record: inserted, action: 'created' };
  }
  const normalized = normalizeDomain(row.domain);
  const existing = (await db.select().from(company).where(eq(company.domain, normalized)))[0];
  if (!existing) {
    const [inserted] = await db
      .insert(company)
      .values({ ...row, domain: normalized, fieldSources: manualSources(row) })
      .returning();
    return { record: inserted, action: 'created' };
  }
  // D-09/D-10: full overwrite EXCEPT fields where the incoming value is
  // blank/undefined — buildUpdatePatch strips those out so existing data
  // is never overwritten with an empty value from a blank CSV cell.
  const patch = buildUpdatePatch({ ...row, domain: normalized });
  const sources = manualSources(row);
  const [updated] = await db
    .update(company)
    .set({
      ...patch,
      fieldSources: sql`coalesce(${company.fieldSources}, '{}'::jsonb) || ${JSON.stringify(sources)}::jsonb`,
      version: sql`${company.version} + 1`,
    })
    .where(eq(company.id, existing.id))
    .returning();
  return { record: updated, action: 'updated' };
}

// Phase 8 (ENRC-02/ENRC-03): committed enrichment write. A lighter cousin of
// upsertCompanyByDomain — no insert path (the record always already exists;
// enrichment only ever touches records staff already track). Writes ONLY the
// caller-accepted field values, merges per-field 'apollo' provenance onto the
// existing fieldSources map (untouched fields keep their marker), and stamps
// lastEnrichedAt. No try/catch — caller (Server Action) owns error handling.
export async function applyCompanyEnrichment(
  id: number,
  baseVersion: number,
  accepted: CompanyAcceptedValues
): Promise<boolean> {
  const sources = Object.fromEntries(Object.keys(accepted).map((field) => [field, 'apollo']));
  const [updated] = await db
    .update(company)
    .set({
      ...accepted,
      fieldSources: sql`coalesce(${company.fieldSources}, '{}'::jsonb) || ${JSON.stringify(sources)}::jsonb`,
      lastEnrichedAt: new Date(),
      version: sql`${company.version} + 1`,
    })
    .where(and(eq(company.id, id), eq(company.version, baseVersion)))
    .returning({ id: company.id });
  return updated !== undefined;
}
