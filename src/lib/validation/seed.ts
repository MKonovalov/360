import { z } from 'zod';
import {
  signalTypeEnum,
  signalStrengthEnum,
  revenueBandEnum,
  ownershipTypeEnum,
  seniorityEnum,
} from '../db/schema';

// CSV-injection / formula-injection guard: a leading =, +, -, @, tab, or
// carriage return can be interpreted as a formula by spreadsheet software
// that later opens exported/re-imported CSV data (T-1-05 in 01-03-PLAN.md's
// threat model). Reject at validation time so no unsafe string ever reaches
// the database, regardless of how it's re-exported downstream.
const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

function startsWithDangerousPrefix(value: string): boolean {
  return DANGEROUS_PREFIXES.some((prefix) => value.startsWith(prefix));
}

const FORMULA_INJECTION_MESSAGE =
  'Value starts with a formula-injection character (=, +, -, @, tab, or carriage return)';

export const safeCsvString = z
  .string()
  .refine((value) => !startsWithDangerousPrefix(value), {
    message: FORMULA_INJECTION_MESSAGE,
  });

// csv-parse's `columns: true` mode yields '' (not undefined) for empty
// cells — treat '' as "not provided" while still guarding any non-empty
// value against formula injection.
const optionalSafeCsvString = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .refine((value) => value === undefined || !startsWithDangerousPrefix(value), {
    message: FORMULA_INJECTION_MESSAGE,
  });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z.string().regex(DATE_RE, 'Expected YYYY-MM-DD date format');

const optionalDateString = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .refine((value) => value === undefined || DATE_RE.test(value), {
    message: 'Expected YYYY-MM-DD date format',
  });

// Blank-to-undefined-then-validate, mirroring optionalDateString's shape,
// but piping into the same Drizzle pgEnum values used at the DB level
// (revenueBandEnum/ownershipTypeEnum) so the CSV validator and the schema
// can never drift apart.
const optionalRevenueBand = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .pipe(z.enum(revenueBandEnum.enumValues).optional());

const optionalOwnershipType = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .pipe(z.enum(ownershipTypeEnum.enumValues).optional());

// D-01: same blank-to-undefined-then-pipe shape as optionalRevenueBand/
// optionalOwnershipType, piped into the seniorityEnum Drizzle values so the
// CSV validator and the schema can never drift apart.
const optionalSeniority = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .pipe(z.enum(seniorityEnum.enumValues).optional());

// Same blank-to-undefined transform + formula-injection guard as
// optionalSafeCsvString, piped into Zod v4's top-level z.email() (not the
// deprecated z.string().email() form) for basic email shape validation.
const optionalEmailString = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .refine((value) => value === undefined || !startsWithDangerousPrefix(value), {
    message: FORMULA_INJECTION_MESSAGE,
  })
  .pipe(z.email().optional());

export const companyRowSchema = z.object({
  name: safeCsvString.min(1, 'name is required'),
  industry: optionalSafeCsvString,
  employee_count_band: optionalSafeCsvString,
  hq_location: optionalSafeCsvString,
  revenue_band: optionalRevenueBand,
  ownership_type: optionalOwnershipType,
  // Raw pipe-delimited string, validated as safe text here — split into an
  // array in seed.ts, not in the schema (D-04, no per-tool metadata needed).
  tech_stack: optionalSafeCsvString,
});

export const personaRowSchema = z.object({
  name: safeCsvString.min(1, 'name is required'),
  title: optionalSafeCsvString,
  seniority: optionalSeniority,
  email: optionalEmailString,
  linkedin_url: optionalSafeCsvString,
});

// DATA-03: signal_type/strength are validated against the same Drizzle
// pgEnum values used at the DB level (schema.ts's signalTypeEnum /
// signalStrengthEnum) so the two never drift out of sync.
export const signalRowSchema = z.object({
  company_name: safeCsvString.min(1, 'company_name is required'),
  signal_type: z.enum(signalTypeEnum.enumValues),
  strength: z.enum(signalStrengthEnum.enumValues),
  source: optionalSafeCsvString,
  detected_at: dateString,
  note: optionalSafeCsvString,
});

export const companyPersonaRoleRowSchema = z.object({
  company_name: safeCsvString.min(1, 'company_name is required'),
  persona_name: safeCsvString.min(1, 'persona_name is required'),
  title: optionalSafeCsvString,
  is_current: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.enum(['true', 'false']))
    .transform((value) => value === 'true'),
  start_date: optionalDateString,
  end_date: optionalDateString,
});

export type CompanyRow = z.infer<typeof companyRowSchema>;
export type PersonaRow = z.infer<typeof personaRowSchema>;
export type SignalRow = z.infer<typeof signalRowSchema>;
export type CompanyPersonaRoleRow = z.infer<typeof companyPersonaRoleRowSchema>;
