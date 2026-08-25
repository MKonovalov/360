import 'server-only';

import { z } from 'zod';

import { db } from '@/lib/db/index';
import { searchApproveRequestSchema } from './contracts';
import { buildApproveSearchReviewSql } from './approveSearchReviewSql';

export interface ApproveSearchReviewInput {
  readonly reviewId: number;
  readonly expectedRevision: number;
  readonly actorUserId: string;
}

export type ApprovalResult =
  | { readonly kind: 'approved'; readonly personaId: number; readonly companyPersonaRole: { readonly companyId: number; readonly personaId: number; readonly created: boolean }; readonly buyerRoles: readonly { readonly buyerRoleId: number; readonly created: boolean }[]; readonly auditIds: readonly number[] }
  | { readonly kind: 'invalid_input' | 'not_found' | 'unauthorized' | 'stale_revision' | 'already_terminal' | 'ambiguous_match' | 'inconclusive' | 'unknown_buyer_role' | 'company_mismatch' | 'invalid_persona' | 'conflict' | 'persistence_failed' };

const inputSchema = searchApproveRequestSchema
  .extend({ reviewId: z.number().int().positive(), actorUserId: z.string().trim().min(1).max(200) })
  .strict();

const approvedRowSchema = z.object({
  kind: z.literal('approved'), personaId: z.number().int().positive(), companyId: z.number().int().positive(),
  companyPersonaRoleCreated: z.boolean(), buyerRoleResults: z.array(z.object({ buyerRoleId: z.number().int().positive(), created: z.boolean() })),
  approvalAuditId: z.number().int().positive(),
});

const resultRowSchema = z.discriminatedUnion('kind', [
  approvedRowSchema,
  ...(['not_found', 'unauthorized', 'stale_revision', 'already_terminal', 'ambiguous_match', 'inconclusive', 'unknown_buyer_role', 'company_mismatch', 'invalid_persona', 'conflict', 'persistence_failed'] as const).map((kind) => z.object({ kind: z.literal(kind) })),
]);

function normalizeResult(row: unknown): ApprovalResult {
  const parsed = resultRowSchema.safeParse(row);
  if (!parsed.success) return { kind: 'persistence_failed' };
  switch (parsed.data.kind) {
    case 'approved':
      return {
        kind: 'approved', personaId: parsed.data.personaId,
        companyPersonaRole: { companyId: parsed.data.companyId, personaId: parsed.data.personaId, created: parsed.data.companyPersonaRoleCreated },
        buyerRoles: parsed.data.buyerRoleResults, auditIds: [parsed.data.approvalAuditId],
      };
    case 'not_found':
    case 'unauthorized':
    case 'stale_revision':
    case 'already_terminal':
    case 'ambiguous_match':
    case 'inconclusive':
    case 'unknown_buyer_role':
    case 'company_mismatch':
    case 'invalid_persona':
    case 'conflict':
    case 'persistence_failed':
      return parsed.data;
    default:
      return { kind: 'persistence_failed' };
  }
}

export async function approveSearchReview(input: unknown): Promise<ApprovalResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid_input' };
  try {
    const result = await db.execute(buildApproveSearchReviewSql(parsed.data));
    return normalizeResult(result.rows[0]);
  } catch (error: unknown) {
    if (error instanceof Error) return { kind: 'persistence_failed' };
    return { kind: 'persistence_failed' };
  }
}
