import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ownershipTypeEnum, revenueBandEnum, seniorityEnum } from '@/lib/db/schema';

const PROPOSAL_VERSION = 1;
const PROPOSAL_TTL_MS = 10 * 60 * 1000;
const textValueSchema = z.string().trim().min(1).max(2_000);
const textListSchema = z.array(textValueSchema).max(100);
const classificationSchema = z.enum(['fill', 'conflict']);

function textRowSchema(field: string) {
  return z.object({
    field: z.literal(field),
    currentValue: textValueSchema.nullable(),
    incomingValue: textValueSchema,
    confidence: z.number().min(0).max(1).optional(),
    classification: classificationSchema,
    preAccepted: z.boolean(),
  });
}

function enumRowSchema<T extends readonly [string, ...string[]]>(field: string, values: T) {
  const valueSchema = z.enum(values);
  return z.object({
    field: z.literal(field),
    currentValue: valueSchema.nullable(),
    incomingValue: valueSchema,
    confidence: z.number().min(0).max(1).optional(),
    classification: classificationSchema,
    preAccepted: z.boolean(),
  });
}

const companyRowSchema = z.discriminatedUnion('field', [
  textRowSchema('industry'),
  textRowSchema('employeeCountBand'),
  textRowSchema('hqLocation'),
  enumRowSchema('revenueBand', revenueBandEnum.enumValues),
  enumRowSchema('ownershipType', ownershipTypeEnum.enumValues),
  z.object({
    field: z.literal('techStack'),
    currentValue: textListSchema.nullable(),
    incomingValue: textListSchema,
    confidence: z.number().min(0).max(1).optional(),
    classification: classificationSchema,
    preAccepted: z.boolean(),
  }),
]);

const personaRowSchema = z.discriminatedUnion('field', [
  textRowSchema('title'),
  enumRowSchema('seniority', seniorityEnum.enumValues),
  z.object({
    field: z.literal('linkedinUrl'),
    currentValue: z.url().nullable(),
    incomingValue: z.url(),
    confidence: z.number().min(0).max(1).optional(),
    classification: classificationSchema,
    preAccepted: z.boolean(),
  }),
]);

const proposalSchema = z.discriminatedUnion('entityType', [
  z.object({
    version: z.literal(PROPOSAL_VERSION),
    userId: z.string().min(1),
    entityType: z.literal('company'),
    recordId: z.number().int().positive(),
    baseVersion: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    rows: z.array(companyRowSchema).max(6),
  }),
  z.object({
    version: z.literal(PROPOSAL_VERSION),
    userId: z.string().min(1),
    entityType: z.literal('persona'),
    recordId: z.number().int().positive(),
    baseVersion: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    rows: z.array(personaRowSchema).max(3),
  }),
]);

const proposalInputSchema = z.discriminatedUnion('entityType', [
  proposalSchema.options[0].omit({ version: true, expiresAt: true }),
  proposalSchema.options[1].omit({ version: true, expiresAt: true }),
]);

const verificationInputSchema = z.object({
  token: z.string().min(1).max(32_000),
  acceptedFields: z
    .array(z.string().min(1))
    .max(6)
    .refine((fields) => new Set(fields).size === fields.length),
});

export const runEnrichmentInputSchema = z.object({
  entityType: z.enum(['company', 'persona']),
  recordId: z.number().int().positive(),
});

export const companyAcceptedValuesSchema = z
  .object({
    industry: textValueSchema.optional(),
    employeeCountBand: textValueSchema.optional(),
    hqLocation: textValueSchema.optional(),
    revenueBand: z.enum(revenueBandEnum.enumValues).optional(),
    ownershipType: z.enum(ownershipTypeEnum.enumValues).optional(),
    techStack: textListSchema.optional(),
  })
  .strict();

export const personaAcceptedValuesSchema = z
  .object({
    title: textValueSchema.optional(),
    seniority: z.enum(seniorityEnum.enumValues).optional(),
    linkedinUrl: z.url().optional(),
  })
  .strict();

export type ReviewProposalInput = z.infer<typeof proposalInputSchema>;
export type ReviewProposal = z.infer<typeof proposalSchema>;
export type AcceptedEnrichmentValues = Readonly<Record<string, string | string[]>>;
export type CompanyAcceptedValues = z.infer<typeof companyAcceptedValuesSchema>;
export type PersonaAcceptedValues = z.infer<typeof personaAcceptedValuesSchema>;

type VerificationContext = {
  readonly userId: string;
  readonly secret: string;
  readonly now?: Date;
};

export type VerifyReviewProposalResult =
  | {
      readonly ok: true;
      readonly proposal: ReviewProposal;
      readonly accepted: AcceptedEnrichmentValues;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid_request' | 'invalid_proposal' | 'expired_proposal';
    };

function signatureFor(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

export function createReviewProposal(input: unknown, secret: string, now = new Date()): string {
  z.string().min(32).parse(secret);
  const parsed = proposalInputSchema.parse(input);
  const payload = proposalSchema.parse({
    ...parsed,
    version: PROPOSAL_VERSION,
    expiresAt: now.getTime() + PROPOSAL_TTL_MS,
  });
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signatureFor(encodedPayload, secret).toString('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyReviewProposal(
  input: unknown,
  context: VerificationContext
): VerifyReviewProposalResult {
  const request = verificationInputSchema.safeParse(input);
  if (!request.success) return { ok: false, reason: 'invalid_request' };

  const segments = request.data.token.split('.');
  if (segments.length !== 2) return { ok: false, reason: 'invalid_proposal' };
  const [encodedPayload, encodedSignature] = segments;
  if (!encodedPayload || !encodedSignature) return { ok: false, reason: 'invalid_proposal' };

  try {
    z.string().min(32).parse(context.secret);
    const supplied = Buffer.from(encodedSignature, 'base64url');
    const expected = signatureFor(encodedPayload, context.secret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return { ok: false, reason: 'invalid_proposal' };
    }

    const raw: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const proposal = proposalSchema.safeParse(raw);
    if (!proposal.success || proposal.data.userId !== context.userId) {
      return { ok: false, reason: 'invalid_proposal' };
    }
    if (proposal.data.expiresAt < (context.now ?? new Date()).getTime()) {
      return { ok: false, reason: 'expired_proposal' };
    }

    const rowsByField = new Map(proposal.data.rows.map((row) => [row.field, row]));
    const accepted: Record<string, string | string[]> = {};
    for (const field of request.data.acceptedFields) {
      const row = rowsByField.get(field);
      if (!row) return { ok: false, reason: 'invalid_request' };
      accepted[field] = row.incomingValue;
    }

    return { ok: true, proposal: proposal.data, accepted };
  } catch {
    return { ok: false, reason: 'invalid_proposal' };
  }
}
