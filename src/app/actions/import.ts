'use server';

import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { db } from '@/lib/db';
import { company, persona } from '@/lib/db/schema';
import {
  createImportBatch,
  getImportBatchById,
  updateImportBatch,
  insertImportLog,
} from '@/lib/db/queries/importBatches';
import { upsertCompanyByDomain } from '@/lib/db/queries/companies';
import { upsertPersonaByEmail } from '@/lib/db/queries/personas';
import {
  suggestColumnMapping,
  suggestValueMapping,
  COMPANY_FIELD_ALIASES,
  PERSONA_FIELD_ALIASES,
  REVENUE_BAND_ALIASES,
  OWNERSHIP_TYPE_ALIASES,
  SENIORITY_ALIASES,
} from '@/lib/import/columnMapping';
import { generateCompanyTemplate, generatePersonaTemplate } from '@/lib/import/csvTemplate';
import { partitionRows } from '@/lib/validation/csvImport';
import { companyRowSchema, personaRowSchema } from '@/lib/validation/seed';
import { normalizeDomain, normalizeEmail } from '@/lib/import/dedupKeys';
import { mapCompanyRowToUpsertInput, mapPersonaRowToUpsertInput } from '@/lib/import/rowMapper';

// Enum field names that require value mapping (CSV raw values → DB enum values).
// Used to decide which columns get suggestValueMapping treatment in uploadImportFile
// and which columns need UNMAPPED_ENUM_SENTINEL substitution in validateImportBatch.
const ENUM_FIELD_NAMES = new Set(['revenue_band', 'ownership_type', 'seniority']);

// Sentinel placed into a mapped row when an enum field's raw CSV value has no
// mapping entry (neither auto-suggested nor manually overridden). Zod's enum
// validator will reject this value, surfacing the row in the error report with
// a clear "invalid enum value" message rather than silently passing a bad value.
const UNMAPPED_ENUM_SENTINEL = '__unmapped_enum_value__';

// csv-parse options shared across all parse calls in this file.
// bom: true — real-world staff-exported CSVs (Excel/Google Sheets) commonly
// carry a UTF-8 BOM; without this option the BOM becomes part of the first
// header name, silently breaking auto-mapping (Pitfall 2 in 07-RESEARCH.md).
const CSV_PARSE_OPTIONS = {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true,
} as const;

// Step 1 of the import wizard: upload a CSV file, parse it, auto-suggest
// column and value mappings, persist the raw CSV in a new import_batch row,
// and return the data the mapping UI needs.
// requireStaffAccess() is called first — userId is derived from the server-
// verified Clerk session, never accepted as a caller-supplied parameter.
export async function uploadImportFile(
  entityType: 'company' | 'persona',
  formData: FormData
) {
  const { userId } = await requireStaffAccess();

  const file = formData.get('file') as File | null;
  if (!file) {
    return { error: 'No file provided' };
  }

  const text = await file.text();

  // Wrap csv-parse in its own try/catch — a malformed CSV (e.g. mismatched
  // quotes, binary content) should return a user-friendly error, not a 500.
  let rows: Record<string, string>[];
  try {
    rows = parse(text, CSV_PARSE_OPTIONS) as Record<string, string>[];
  } catch {
    return { error: "Couldn't read this CSV file" };
  }

  // Pitfall 3: row-count cap as a feature-scoped guard independent of the
  // global bodySizeLimit config change (which affects all Server Actions).
  if (rows.length > 5000) {
    return { error: 'File has too many rows (max 5000)' };
  }

  const headers = Object.keys(rows[0] ?? {});

  // Auto-suggest column mapping using the entity-appropriate alias dictionary.
  const aliasDict = entityType === 'company' ? COMPANY_FIELD_ALIASES : PERSONA_FIELD_ALIASES;
  const suggestedMapping = suggestColumnMapping(headers, aliasDict);

  // Compute unique values for EVERY header from the FULL rows array (not just
  // sampleRows) — the mapping UI needs the complete value set for enum pickers.
  const columnValues: Record<string, string[]> = {};
  for (const header of headers) {
    columnValues[header] = Array.from(
      new Set(
        rows
          .map((r) => r[header])
          .filter((v): v is string => v !== undefined && v !== '')
      )
    );
  }

  // Auto-suggest enum value mappings for columns that map to enum fields.
  // Only columns where suggestedMapping resolves to an enum field name get
  // value-mapping suggestions — other columns are left out of suggestedValueMapping.
  const suggestedValueMapping: Record<string, Record<string, string | null>> = {};
  for (const header of headers) {
    const fieldName = suggestedMapping[header];
    if (fieldName && ENUM_FIELD_NAMES.has(fieldName)) {
      const enumAliases =
        fieldName === 'revenue_band'
          ? REVENUE_BAND_ALIASES
          : fieldName === 'ownership_type'
            ? OWNERSHIP_TYPE_ALIASES
            : SENIORITY_ALIASES;
      suggestedValueMapping[header] = suggestValueMapping(columnValues[header], enumAliases);
    }
  }

  // Persist the raw CSV text so subsequent wizard steps can re-read it from
  // the DB rather than round-tripping the full dataset through the body limit
  // on every step call (Pattern 2 in 07-RESEARCH.md).
  const batch = await createImportBatch({ entityType, rawCsv: text, createdBy: userId });

  return {
    batchId: batch.id,
    headers,
    suggestedMapping,
    sampleRows: rows.slice(0, 5),
    columnValues,
    suggestedValueMapping,
  };
}

// Utility action: return a pre-built CSV template for the given entity type.
// No DB write — purely generates the template string from schema enum values.
export async function downloadImportTemplate(entityType: 'company' | 'persona') {
  await requireStaffAccess();
  return {
    filename: entityType === 'company' ? 'companies-template.csv' : 'personas-template.csv',
    csv: entityType === 'company' ? generateCompanyTemplate() : generatePersonaTemplate(),
  };
}

// Step 2 of the import wizard: apply the staff-confirmed column and value
// mappings to the raw CSV, validate every row with Zod, predict created vs.
// updated counts, and persist the results back to the import_batch row.
export async function validateImportBatch(
  batchId: number,
  mapping: Record<string, string | null>,
  valueMapping: Record<string, Record<string, string | null>>
) {
  await requireStaffAccess();

  const batch = await getImportBatchById(batchId);
  if (!batch) {
    return { error: 'Import batch not found' };
  }

  // Re-parse the raw CSV from the DB row — same options as uploadImportFile
  // so the header/row structure is identical.
  const rawRows = parse(batch.rawCsv, CSV_PARSE_OPTIONS) as Record<string, string>[];

  // Apply the staff-confirmed column mapping to each raw row, substituting
  // enum values via valueMapping and placing UNMAPPED_ENUM_SENTINEL for any
  // enum field whose raw value has no mapping entry.
  const mappedRows: Record<string, string>[] = rawRows.map((rawRow) => {
    const mappedRow: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      // null/undefined field means "ignore this column" — skip it entirely
      if (field == null) continue;

      const rawValue = rawRow[header];

      if (ENUM_FIELD_NAMES.has(field) && rawValue !== undefined && rawValue !== '') {
        // Enum field: look up the mapped canonical value.
        // null = "no mapping found" (suggestValueMapping returns null for unrecognized values);
        // undefined = header not in valueMapping at all. Both → sentinel so Zod rejects the row.
        const mappedValue = valueMapping[header]?.[rawValue];
        mappedRow[field] =
          mappedValue != null ? mappedValue : UNMAPPED_ENUM_SENTINEL;
      } else {
        // Non-enum field: pass through as-is (blank cells stay blank, Zod
        // transforms them to undefined via optionalSafeCsvString)
        if (rawValue !== undefined) {
          mappedRow[field] = rawValue;
        }
      }
    }
    return mappedRow;
  });

  // Partition rows into valid/invalid using the entity-appropriate Zod schema.
  const schema = batch.entityType === 'company' ? companyRowSchema : personaRowSchema;
  const { validRows, invalidRows } = partitionRows(mappedRows, schema);

  // Predict created vs. updated by checking whether the dedup key already
  // exists in the DB for each valid row. This is a best-effort estimate —
  // Pitfall 5 in 07-RESEARCH.md explains why the actual commit counts may
  // differ if another import runs concurrently between validate and commit.
  let predictedCreated = 0;
  let predictedUpdated = 0;

  if (batch.entityType === 'company') {
    for (const { data } of validRows) {
      const companyData = data as { domain?: string };
      if (!companyData.domain) {
        // D-03: blank domain always inserts
        predictedCreated++;
      } else {
        const normalized = normalizeDomain(companyData.domain);
        const existing = (
          await db.select().from(company).where(eq(company.domain, normalized))
        )[0];
        if (existing) {
          predictedUpdated++;
        } else {
          predictedCreated++;
        }
      }
    }
  } else {
    for (const { data } of validRows) {
      const personaData = data as { email?: string };
      if (!personaData.email) {
        // D-04: blank email always inserts
        predictedCreated++;
      } else {
        const normalized = normalizeEmail(personaData.email);
        const existing = (
          await db.select().from(persona).where(eq(persona.email, normalized))
        )[0];
        if (existing) {
          predictedUpdated++;
        } else {
          predictedCreated++;
        }
      }
    }
  }

  await updateImportBatch(batchId, {
    mapping,
    valueMapping,
    validatedRows: validRows,
    errorReport: invalidRows,
    rowsTotal: mappedRows.length,
    predictedCreated,
    predictedUpdated,
    predictedErrored: invalidRows.length,
    status: 'validated',
  });

  return {
    counts: {
      created: predictedCreated,
      updated: predictedUpdated,
      errored: invalidRows.length,
    },
    errorReport: invalidRows,
  };
}

// Step 3 of the import wizard: commit the validated rows to the DB.
// Reads validatedRows from the import_batch row (never re-parses the CSV),
// calls the appropriate upsert function per row, inserts an import_log row
// per record, and tallies actual created/updated counts from upsert results.
export async function commitImportBatch(batchId: number) {
  await requireStaffAccess();

  const batch = await getImportBatchById(batchId);
  if (!batch || batch.status !== 'validated') {
    return { error: 'Import batch not found' };
  }

  const validatedRows = (batch.validatedRows ?? []) as Array<{ row: number; data: unknown }>;

  let actualCreated = 0;
  let actualUpdated = 0;

  for (const { data } of validatedRows) {
    if (batch.entityType === 'company') {
      // Map BEFORE upsert — never after
      const input = mapCompanyRowToUpsertInput(data as Parameters<typeof mapCompanyRowToUpsertInput>[0]);
      const result = await upsertCompanyByDomain(input);
      await insertImportLog({
        batchId,
        entityType: 'company',
        recordId: result.record.id,
        action: result.action,
      });
      if (result.action === 'created') {
        actualCreated++;
      } else {
        actualUpdated++;
      }
    } else {
      // Map BEFORE upsert — never after
      const input = mapPersonaRowToUpsertInput(data as Parameters<typeof mapPersonaRowToUpsertInput>[0]);
      const result = await upsertPersonaByEmail(input);
      await insertImportLog({
        batchId,
        entityType: 'persona',
        recordId: result.record.id,
        action: result.action,
      });
      if (result.action === 'created') {
        actualCreated++;
      } else {
        actualUpdated++;
      }
    }
  }

  // errored = rows that failed validation (already in errorReport, not committed)
  const errored = (batch.errorReport as unknown[] | null)?.length ?? 0;

  await updateImportBatch(batchId, {
    status: 'committed',
    committedAt: new Date(),
    actualCreated,
    actualUpdated,
    actualErrored: errored,
  });

  return { created: actualCreated, updated: actualUpdated, errored };
}
