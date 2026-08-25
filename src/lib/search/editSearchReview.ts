import 'server-only';

import { z } from 'zod';

import {
  getSearchReviewEditState,
  type SearchReviewEditState,
} from '@/lib/db/queries/searchReviews';
import {
  buildSearchReviewAuditChanges,
  redactSearchReviewAuditValue,
  stageSearchReviewEdit,
} from '@/lib/db/queries/searchReviewAudits';
import type { SearchCandidateAuditChange } from '@/lib/db/schema';
import { searchEditRequestSchema, type SearchPersonaDraft } from './contracts';

export type SearchPersonaEdit = SearchPersonaDraft;
export type { SearchReviewEditState };
export { buildSearchReviewAuditChanges };

export interface StageSearchReviewEditInput {
  readonly reviewId: number;
  readonly expectedRevision: number;
  readonly actorUserId: string;
  readonly persona: SearchPersonaEdit;
  readonly buyerRoleIds: readonly number[];
  readonly changes: readonly SearchCandidateAuditChange[];
}

export type StageSearchReviewEditResult =
  | { readonly kind: 'edited'; readonly revision: number; readonly editCount: number; readonly auditId: number; readonly timestamp: Date }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'stale_revision' }
  | { readonly kind: 'ineligible' }
  | { readonly kind: 'unknown_role' }
  | { readonly kind: 'persistence_failed' };

export interface SearchReviewEditRepository {
  readonly getEditState: (reviewId: number) => Promise<SearchReviewEditState | undefined>;
  readonly stageEdit: (input: StageSearchReviewEditInput) => Promise<StageSearchReviewEditResult>;
}

const editSearchReviewInputSchema = searchEditRequestSchema
  .extend({
    reviewId: z.number().int().positive(),
    actorUserId: z.string().trim().min(1).max(200),
  })
  .strict();

export type EditSearchReviewResult =
  | StageSearchReviewEditResult
  | { readonly kind: 'invalid_input' };

const defaultRepository: SearchReviewEditRepository = {
  getEditState: getSearchReviewEditState,
  stageEdit: stageSearchReviewEdit,
};

function canonicalRoleIds(roleIds: readonly number[]): readonly number[] {
  return [...new Set(roleIds)].sort((left, right) => left - right);
}

export async function editSearchReview(
  input: unknown,
  repository: SearchReviewEditRepository = defaultRepository,
): Promise<EditSearchReviewResult> {
  const parsed = editSearchReviewInputSchema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid_input' };

  let state: SearchReviewEditState | undefined;
  try {
    state = await repository.getEditState(parsed.data.reviewId);
  } catch (error: unknown) {
    if (error instanceof Error) return { kind: 'persistence_failed' };
    throw error;
  }
  if (!state) return { kind: 'not_found' };
  if (state.ownerUserId !== parsed.data.actorUserId) return { kind: 'unauthorized' };
  if (state.revision !== parsed.data.expectedRevision) return { kind: 'stale_revision' };
  if (state.status === 'approved' || state.status === 'rejected') return { kind: 'ineligible' };

  const buyerRoleIds = canonicalRoleIds(parsed.data.buyerRoleIds);
  const changes = [
    ...buildSearchReviewAuditChanges(state.persona, parsed.data.persona, state.buyerRoleIds, buyerRoleIds),
    ...(parsed.data.reason === undefined
      ? []
      : [{ path: 'edit.reason', before: null, after: redactSearchReviewAuditValue('edit.reason', parsed.data.reason) }]),
  ];

  try {
    return await repository.stageEdit({
      reviewId: parsed.data.reviewId,
      expectedRevision: parsed.data.expectedRevision,
      actorUserId: parsed.data.actorUserId,
      persona: parsed.data.persona,
      buyerRoleIds,
      changes,
    });
  } catch (error: unknown) {
    if (error instanceof Error) return { kind: 'persistence_failed' };
    throw error;
  }
}
