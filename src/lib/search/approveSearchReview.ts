import 'server-only';

import { z } from 'zod';

import { db } from '@/lib/db/index';
import { searchApproveRequestSchema } from './contracts';
import { buildApproveSearchReviewSql } from './approveSearchReviewSql';
import { recordSearchMetric } from './searchTelemetry';

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

function hasPostgresCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (Reflect.get(current, 'code') === code) return true;
    current = current.cause;
  }
  return false;
}

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

// Folds "approval conflict/duplicate prevention" and "audit completeness"
// into one event per approveSearchReview() call, sourced entirely from the
// ApprovalResult this function already returns — no field here is computed
// solely for telemetry. duplicatePreventedCount counts the Company Persona
// Role and Buyer Role links this decision reused instead of creating.
function emitApprovalMetric(reviewId: number, result: ApprovalResult): void {
  const duplicatePreventedCount = result.kind === 'approved'
    ? (result.companyPersonaRole.created ? 0 : 1) + result.buyerRoles.filter((role) => !role.created).length
    : 0;
  recordSearchMetric({
    kind: 'approval',
    reviewId,
    conflictCount: result.kind === 'conflict' ? 1 : 0,
    duplicatePreventedCount,
    auditRecorded: result.kind === 'approved' && result.auditIds.length > 0,
  });
}

export async function approveSearchReview(input: unknown): Promise<ApprovalResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid_input' };
  try {
    const result = await db.execute(buildApproveSearchReviewSql(parsed.data));
    const normalized = normalizeResult(result.rows[0]);
    emitApprovalMetric(parsed.data.reviewId, normalized);
    return normalized;
  } catch (error: unknown) {
    const result: ApprovalResult = hasPostgresCode(error, '23505') ? { kind: 'conflict' } : { kind: 'persistence_failed' };
    emitApprovalMetric(parsed.data.reviewId, result);
    return result;
  }
}
