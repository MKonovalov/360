// Loads data/seed/*.csv into Neon Postgres via the typed query layer.
// Run with `npm run seed` (tsx src/scripts/seed.ts).
import { config } from 'dotenv';

// tsx does not auto-load .env.local the way Next.js's own dev/build
// pipeline does. src/lib/env.ts validates process.env at MODULE-EVALUATION
// time (envSchema.parse), and ES module imports are hoisted above this
// file's top-level code — a static `import { db } from '../lib/db'` would
// therefore run (and fail) before the config() call below ever executes.
// Load .env.local first, then dynamically import everything that
// transitively touches src/lib/env.ts inside main().
config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';

import {
  companyRowSchema,
  personaRowSchema,
  signalRowSchema,
  companyPersonaRoleRowSchema,
} from '../lib/validation/seed';

const SEED_DIR = join(process.cwd(), 'data', 'seed');

function readCsv(filename: string): Record<string, string>[] {
  const content = readFileSync(join(SEED_DIR, filename), 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

// Fail loud, fail early — every row across every file is validated before
// any insert happens. This is the deliberate new error-handling convention
// for the data-access layer (CLAUDE.md Error Handling), replacing the
// retiring Astro app's silent try/catch-and-fall-back pattern.
function validateRows<T extends z.ZodTypeAny>(
  rows: Record<string, string>[],
  schema: T,
  filename: string
): z.infer<T>[] {
  const validated: z.infer<T>[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      validated.push(result.data);
    } else {
      const reasons = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      // CSV row 1 is the header; data rows start at row 2.
      errors.push(`${filename} row ${index + 2}: ${reasons}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Seed validation failed:\n${errors.join('\n')}`);
  }

  return validated;
}

async function main() {
  const companyRows = validateRows(readCsv('companies.csv'), companyRowSchema, 'companies.csv');
  const personaRows = validateRows(readCsv('personas.csv'), personaRowSchema, 'personas.csv');
  const signalRows = validateRows(readCsv('signals.csv'), signalRowSchema, 'signals.csv');
  const roleRows = validateRows(
    readCsv('company_persona_roles.csv'),
    companyPersonaRoleRowSchema,
    'company_persona_roles.csv'
  );

  // All four files are validated above before any DB connection is opened
  // or any row is inserted — a malformed row anywhere fails the whole run
  // with a descriptive error, never a partial insert or a raw Postgres
  // exception surfacing to the caller.
  const { db } = await import('../lib/db');
  const { company, persona, signal, companyPersonaRole } = await import('../lib/db/schema');
  const { insertSignal } = await import('../lib/db/queries/signals');
  const { insertCompanyPersonaRole } = await import('../lib/db/queries/companyPersonaRoles');

  // This pipeline fully owns the seed dataset — clear prior seed-managed
  // rows (children first, respecting FK constraints) so re-running `npm run
  // seed` is idempotent and never accumulates duplicate companies/personas
  // across runs (e.g. Phase 1's original 2-row placeholder set).
  await db.delete(companyPersonaRole);
  await db.delete(signal);
  await db.delete(persona);
  await db.delete(company);

  const companyNameToId = new Map<string, number>();
  for (const row of companyRows) {
    const [inserted] = await db
      .insert(company)
      .values({
        name: row.name,
        industry: row.industry,
        employeeCountBand: row.employee_count_band,
        hqLocation: row.hq_location,
        revenueBand: row.revenue_band,
        ownershipType: row.ownership_type,
        techStack: row.tech_stack ? row.tech_stack.split('|').map((s) => s.trim()) : undefined,
      })
      .returning();
    companyNameToId.set(row.name, inserted.id);
  }

  const personaNameToId = new Map<string, number>();
  for (const row of personaRows) {
    const [inserted] = await db
      .insert(persona)
      .values({
        name: row.name,
        title: row.title,
        seniority: row.seniority,
        email: row.email,
        linkedinUrl: row.linkedin_url,
      })
      .returning();
    personaNameToId.set(row.name, inserted.id);
  }

  for (const row of signalRows) {
    const companyId = companyNameToId.get(row.company_name);
    if (!companyId) {
      throw new Error(
        `signals.csv references unknown company_name "${row.company_name}" — must match a name in companies.csv`
      );
    }
    await insertSignal({
      companyId,
      signalType: row.signal_type,
      strength: row.strength,
      source: row.source,
      detectedAt: row.detected_at,
      note: row.note,
    });
  }

  for (const row of roleRows) {
    const companyId = companyNameToId.get(row.company_name);
    const personaId = personaNameToId.get(row.persona_name);
    if (!companyId) {
      throw new Error(
        `company_persona_roles.csv references unknown company_name "${row.company_name}" — must match a name in companies.csv`
      );
    }
    if (!personaId) {
      throw new Error(
        `company_persona_roles.csv references unknown persona_name "${row.persona_name}" — must match a name in personas.csv`
      );
    }
    await insertCompanyPersonaRole({
      companyId,
      personaId,
      title: row.title,
      isCurrent: row.is_current,
      startDate: row.start_date,
      endDate: row.end_date,
    });
  }

  console.log(
    `Inserted: ${companyRows.length} companies, ${personaRows.length} personas, ${signalRows.length} signals, ${roleRows.length} company_persona_roles`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
