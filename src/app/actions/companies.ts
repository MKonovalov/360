'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  deleteCompanyById,
  getCompanyById,
  insertCompany,
  updateCompanyFields,
  type CompanyEditValues,
} from '@/lib/db/queries/companies';
import { normalizeDomain } from '@/lib/import/dedupKeys';
import { ownershipTypeEnum, revenueBandEnum } from '@/lib/db/schema';

// Company edit/delete controller. Every action calls requireStaffAccess()
// first (a direct Server Action call bypasses the page gate), validates
// unknown input with zod before any write, and returns a discriminated
// result instead of throwing to the client.

export type CompanyActionResult = { ok: true } | { ok: false; reason: string };

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => (value === '' ? null : value));

const fieldsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  // company.domain is the CSV-import dedup key; stored without scheme/www.
  domain: optionalText(253)
    .transform((value) => (value === null ? null : normalizeDomain(value)))
    .refine((value) => value === null || /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(value), 'Enter a valid domain, e.g. acme.com'),
  industry: optionalText(200),
  employeeCountBand: optionalText(50),
  hqLocation: optionalText(200),
  revenueBand: z.enum(revenueBandEnum.enumValues).nullable(),
  ownershipType: z.enum(ownershipTypeEnum.enumValues).nullable(),
});

const editSchema = fieldsSchema.extend({
  id: z.number().int().positive(),
  baseVersion: z.number().int().min(0),
});

export type CreateCompanyResult = { ok: true; id: number } | { ok: false; reason: string };

export async function createCompany(input: unknown): Promise<CreateCompanyResult> {
  await requireStaffAccess();

  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? 'Invalid input' };

  let result: Awaited<ReturnType<typeof insertCompany>>;
  try {
    result = await insertCompany(parsed.data);
  } catch {
    return { ok: false, reason: 'Could not create the company. Try again.' };
  }
  if (result.kind === 'domain_conflict') return { ok: false, reason: 'Another company already uses this domain.' };

  revalidatePath('/companies');
  return { ok: true, id: result.id };
}

export async function updateCompany(input: unknown): Promise<CompanyActionResult> {
  await requireStaffAccess();

  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { id, baseVersion, ...values } = parsed.data satisfies CompanyEditValues & { id: number; baseVersion: number };

  try {
    const current = await getCompanyById(id);
    if (!current) return { ok: false, reason: 'Company not found' };
    const changedFields = (Object.keys(values) as (keyof CompanyEditValues)[]).filter(
      (field) => values[field] !== (current[field] ?? null),
    );
    if (changedFields.length === 0) return { ok: true };

    const result = await updateCompanyFields(id, baseVersion, values, changedFields);
    if (result === 'stale') return { ok: false, reason: 'This company changed since you opened it. Reload and try again.' };
    if (result === 'domain_conflict') return { ok: false, reason: 'Another company already uses this domain.' };
  } catch {
    return { ok: false, reason: 'Could not save the company. Try again.' };
  }

  revalidatePath(`/companies/${id}`);
  revalidatePath('/companies');
  return { ok: true };
}

export async function deleteCompany(input: unknown): Promise<CompanyActionResult> {
  await requireStaffAccess();

  const parsed = z.object({ id: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'Invalid input' };

  try {
    const deleted = await deleteCompanyById(parsed.data.id);
    if (!deleted) return { ok: false, reason: 'Company not found' };
  } catch {
    return { ok: false, reason: 'Could not delete the company. Try again.' };
  }

  revalidatePath('/companies');
  revalidatePath('/personas', 'layout');
  return { ok: true };
}
