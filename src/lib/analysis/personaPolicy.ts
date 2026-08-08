import { z } from 'zod';

import { phase33PolicySnapshotSchema, type Phase33PolicySnapshot } from './contracts';

export const PERSONA_POLICY_UNAVAILABLE = 'persona_policy_unavailable' as const;
export const PERSONA_CLASSIFICATIONS = ['public_biz', 'personal_data', 'restricted'] as const;

const personaFieldSchema = z.enum(['id', 'displayName', 'title', 'seniority', 'companyDisplayName']);

export const personaSourceRowSchema = z
  .object({
    id: z.number().int().positive(),
    displayName: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).nullable(),
    seniority: z.string().trim().max(120).nullable(),
    companyDisplayName: z.string().trim().max(200).nullable(),
    email: z.string().max(320).nullable().optional(),
    phone: z.string().max(80).nullable().optional(),
    linkedinUrl: z.string().max(2_048).nullable().optional(),
    notes: z.string().max(4_000).nullable().optional(),
  })
  .strict();

export const redactedPersonaInputSchema = z
  .object({
    id: z.number().int().positive(),
    displayName: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).nullable(),
    seniority: z.string().trim().max(120).nullable(),
    companyDisplayName: z.string().trim().max(200).nullable(),
    classification: z.enum(PERSONA_CLASSIFICATIONS),
    policyVersion: z.string().trim().min(1).max(120),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type PersonaSourceRow = z.infer<typeof personaSourceRowSchema>;
export type RedactedPersonaInput = z.infer<typeof redactedPersonaInputSchema>;
export type ApprovedPersonaPolicy = Extract<Phase33PolicySnapshot, { mode: 'phase33_grounded' }>;

export type PersonaPolicyResolution =
  | { readonly ok: true; readonly policy: ApprovedPersonaPolicy }
  | { readonly ok: false; readonly reason: typeof PERSONA_POLICY_UNAVAILABLE };

export function resolvePersonaPolicy(input: unknown): PersonaPolicyResolution {
  const parsed = phase33PolicySnapshotSchema.safeParse(input);
  if (!parsed.success || parsed.data.mode !== 'phase33_grounded' || !parsed.data.personaExecutionEnabled) {
    return { ok: false, reason: PERSONA_POLICY_UNAVAILABLE };
  }
  return { ok: true, policy: parsed.data };
}

export function redactPersonaInput(
  policy: ApprovedPersonaPolicy,
  source: unknown,
): RedactedPersonaInput {
  const parsed = personaSourceRowSchema.parse(source);
  const allowed = new Set(policy.personaPolicy?.allowlistedFields ?? []);
  const field = (name: z.infer<typeof personaFieldSchema>): string | null => {
    if (!allowed.has(name)) return null;
    const value = parsed[name];
    return typeof value === 'string' ? redactSensitiveText(value) : value === null ? null : String(value);
  };
  const classification = policy.retention?.classification ?? 'restricted';
  const expiresAt = new Date(Date.now() + (policy.retention?.durationSeconds ?? 0) * 1000).toISOString();
  return redactedPersonaInputSchema.parse({
    id: parsed.id,
    displayName: field('displayName') ?? '[REDACTED]',
    title: field('title'),
    seniority: field('seniority'),
    companyDisplayName: field('companyDisplayName'),
    classification,
    policyVersion: policy.policyVersion,
    expiresAt,
  });
}

export function classifyPersonaText(value: string): (typeof PERSONA_CLASSIFICATIONS)[number] {
  if (containsSensitiveText(value)) return 'restricted';
  return 'public_biz';
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED]')
    .replace(/(?:\+?\d[\d(). -]{7,}\d)/g, '[REDACTED]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED]')
    .replace(/(?:sk|pk|api[_-]?key|token|secret)[\s:=_-]*[A-Za-z0-9._-]{8,}/gi, '[REDACTED]');
}

function containsSensitiveText(value: string): boolean {
  return redactSensitiveText(value) !== value;
}
