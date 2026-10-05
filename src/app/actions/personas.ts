'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  deletePersonaById,
  getPersonaById,
  updatePersonaFields,
  type PersonaEditValues,
} from '@/lib/db/queries/personas';
import { seniorityEnum } from '@/lib/db/schema';

// Persona edit/delete controller. Every action calls requireStaffAccess()
// first (a direct Server Action call bypasses the page gate), validates
// unknown input with zod before any write, and returns a discriminated
// result instead of throwing to the client.

export type PersonaActionResult = { ok: true } | { ok: false; reason: string };

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => (value === '' ? null : value));

const editSchema = z.object({
  id: z.number().int().positive(),
  baseVersion: z.number().int().min(0),
  name: z.string().trim().min(1, 'Name is required').max(200),
  title: optionalText(300),
  seniority: z.enum(seniorityEnum.enumValues).nullable(),
  email: optionalText(320).refine((value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email'),
  // Only http(s) links are stored: this value is later rendered as an anchor href.
  linkedinUrl: optionalText(500).refine((value) => value === null || /^https?:\/\//i.test(value), 'LinkedIn URL must start with http(s)://'),
});

export async function updatePersona(input: unknown): Promise<PersonaActionResult> {
  await requireStaffAccess();

  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { id, baseVersion, ...rawValues } = parsed.data;
  const values: PersonaEditValues = {
    ...rawValues,
    // persona.email is the CSV-import dedup key, which is stored lowercase.
    email: rawValues.email === null ? null : rawValues.email.toLowerCase(),
  };

  try {
    const current = await getPersonaById(id);
    if (!current) return { ok: false, reason: 'Persona not found' };
    const changedFields = (Object.keys(values) as (keyof PersonaEditValues)[]).filter(
      (field) => values[field] !== (current[field] ?? null),
    );
    if (changedFields.length === 0) return { ok: true };

    const result = await updatePersonaFields(id, baseVersion, values, changedFields);
    if (result === 'stale') return { ok: false, reason: 'This persona changed since you opened it. Reload and try again.' };
    if (result === 'email_conflict') return { ok: false, reason: 'Another persona already uses this email.' };
  } catch {
    return { ok: false, reason: 'Could not save the persona. Try again.' };
  }

  revalidatePath(`/personas/${id}`);
  revalidatePath('/personas');
  return { ok: true };
}

export async function deletePersona(input: unknown): Promise<PersonaActionResult> {
  await requireStaffAccess();

  const parsed = z.object({ id: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'Invalid input' };

  try {
    const deleted = await deletePersonaById(parsed.data.id);
    if (!deleted) return { ok: false, reason: 'Persona not found' };
  } catch {
    return { ok: false, reason: 'Could not delete the persona. Try again.' };
  }

  revalidatePath('/personas');
  revalidatePath('/companies', 'layout');
  return { ok: true };
}
