// Pure mapping functions: snake_case CSV row fields → camelCase UpsertInput shapes.
// No DB access, no 'use server' — these are called from commitImportBatch after
// partitionRows validates the row, and the mapping must happen BEFORE the upsert call.
import { UpsertCompanyInput } from '@/lib/db/queries/companies';
import { UpsertPersonaInput } from '@/lib/db/queries/personas';
import { CompanyRow, PersonaRow } from '@/lib/validation/seed';

// Maps a validated CompanyRow (snake_case fields from CSV) to the camelCase
// UpsertCompanyInput shape expected by upsertCompanyByDomain.
// tech_stack is pipe-delimited in the CSV — split here, not in the schema
// (D-04 in seed.ts: raw pipe-delimited string validated as safe text, split
// at the point of DB write, matching seed.ts lines 104-105 exactly).
export function mapCompanyRowToUpsertInput(row: CompanyRow): UpsertCompanyInput {
  return {
    name: row.name,
    domain: row.domain,
    industry: row.industry,
    employeeCountBand: row.employee_count_band,
    hqLocation: row.hq_location,
    revenueBand: row.revenue_band,
    ownershipType: row.ownership_type,
    techStack: row.tech_stack
      ? row.tech_stack
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
  };
}

// Maps a validated PersonaRow (snake_case fields from CSV) to the camelCase
// UpsertPersonaInput shape expected by upsertPersonaByEmail.
export function mapPersonaRowToUpsertInput(row: PersonaRow): UpsertPersonaInput {
  return {
    name: row.name,
    title: row.title,
    seniority: row.seniority,
    email: row.email,
    linkedinUrl: row.linkedin_url,
  };
}
