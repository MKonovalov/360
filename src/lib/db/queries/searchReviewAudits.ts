import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../index';
import type { SearchCandidateAuditChange } from '../schema';
import { searchEditRequestSchema } from '@/lib/search/contracts';
import type { SearchPersonaDraft } from '@/lib/search/contracts';
import type { StageSearchReviewEditInput, StageSearchReviewEditResult } from '@/lib/search/editSearchReview';

export const SEARCH_REVIEW_EDIT_EVENT = 'search_candidate_edited' as const;

export interface SearchReviewAuditEvent {
  readonly id: number;
  readonly searchCandidateId: number;
  readonly eventType: typeof SEARCH_REVIEW_EDIT_EVENT;
  readonly actorId: string;
  readonly revision: number;
  readonly changes: readonly SearchCandidateAuditChange[];
  readonly timestamp: Date;
}

export interface SearchReviewAuditAppendInput {
  readonly searchCandidateId: number;
  readonly actorId: string;
  readonly revision: number;
  readonly changes: readonly SearchCandidateAuditChange[];
}

const AUDIT_VALUE_MAX_LENGTH = 1_000;
const AUDIT_CHANGE_PATH_MAX_LENGTH = 80;
const MAX_AUDIT_CHANGES = 20;

const PERSONA_EDIT_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'title',
  'email',
  'linkedinUrl',
  'phone',
  'location',
  'department',
  'function',
  'seniority',
  'companyName',
  'companyDomain',
  'bio',
  'photoUrl',
] as const satisfies readonly (keyof SearchPersonaDraft)[];

const AUDIT_CHANGE_PATHS = new Set([
  ...PERSONA_EDIT_FIELDS.map((field) => `persona.${field}`),
  'buyerRoleIds',
  'edit.reason',
]);

const searchReviewAuditChangeSchema = z
  .object({
    path: z.string().trim().min(1).max(AUDIT_CHANGE_PATH_MAX_LENGTH).refine((path) => AUDIT_CHANGE_PATHS.has(path)),
    before: z.string().max(AUDIT_VALUE_MAX_LENGTH).nullable(),
    after: z.string().max(AUDIT_VALUE_MAX_LENGTH).nullable(),
  })
  .strict();

const searchReviewAuditAppendSchema = z
  .object({
    searchCandidateId: z.number().int().positive(),
    actorId: z.string().trim().min(1).max(200),
    revision: z.number().int().positive(),
    changes: z.array(searchReviewAuditChangeSchema).max(MAX_AUDIT_CHANGES),
  })
  .strict();

const stageSearchReviewEditSchema = searchEditRequestSchema
  .pick({ expectedRevision: true, persona: true, buyerRoleIds: true })
  .extend({
    reviewId: z.number().int().positive(),
    actorUserId: z.string().trim().min(1).max(200),
    changes: z.array(searchReviewAuditChangeSchema).max(MAX_AUDIT_CHANGES),
  })
  .strict();

function redactText(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED]')
    .replace(/(?:\+?\d[\d(). -]{7,}\d)/g, '[REDACTED]')
    .replace(/https?:\/\/[^\s"']+/gi, '[REDACTED]')
    .replace(/(?:sk|pk|api[_-]?key|token|secret)[\s:=_-]*[A-Za-z0-9._-]{8,}/gi, '[REDACTED]');
}

export function redactSearchReviewAuditValue(path: string, value: unknown): string | null {
  if (value === null) return null;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (serialized === undefined) return '[REDACTED]';
  const isSensitiveField = /(?:email|phone|linkedinUrl|photoUrl)$/.test(path);
  const redacted = isSensitiveField ? '[REDACTED]' : redactText(serialized);
  return redacted.length <= AUDIT_VALUE_MAX_LENGTH
    ? redacted
    : `${redacted.slice(0, AUDIT_VALUE_MAX_LENGTH - 3)}...`;
}

export function buildSearchReviewAuditChanges(
  beforePersona: SearchPersonaDraft,
  afterPersona: SearchPersonaDraft,
  beforeBuyerRoleIds: readonly number[],
  afterBuyerRoleIds: readonly number[],
): readonly SearchCandidateAuditChange[] {
  const changes: SearchCandidateAuditChange[] = [];
  for (const field of PERSONA_EDIT_FIELDS) {
    if (beforePersona[field] === afterPersona[field]) continue;
    changes.push({
      path: `persona.${field}`,
      before: redactSearchReviewAuditValue(`persona.${field}`, beforePersona[field]),
      after: redactSearchReviewAuditValue(`persona.${field}`, afterPersona[field]),
    });
  }

  const beforeRoles = [...new Set(beforeBuyerRoleIds)].sort((left, right) => left - right);
  const afterRoles = [...new Set(afterBuyerRoleIds)].sort((left, right) => left - right);
  if (JSON.stringify(beforeRoles) !== JSON.stringify(afterRoles)) {
    changes.push({
      path: 'buyerRoleIds',
      before: redactSearchReviewAuditValue('buyerRoleIds', beforeRoles),
      after: redactSearchReviewAuditValue('buyerRoleIds', afterRoles),
    });
  }
  return changes;
}

interface SearchReviewAuditRow extends Record<string, unknown> {
  readonly id: number;
  readonly searchCandidateId: number;
  readonly eventType: typeof SEARCH_REVIEW_EDIT_EVENT;
  readonly actorId: string;
  readonly revision: number;
  readonly changes: readonly SearchCandidateAuditChange[];
  readonly createdAt: Date;
}

export async function appendSearchReviewAudit(input: unknown): Promise<SearchReviewAuditEvent | undefined> {
  const parsed = searchReviewAuditAppendSchema.safeParse(input);
  if (!parsed.success) return undefined;
  const changes = parsed.data.changes.map((change) => ({
    path: change.path,
    before: redactSearchReviewAuditValue(change.path, change.before),
    after: redactSearchReviewAuditValue(change.path, change.after),
  }));

  const result = await db.execute<SearchReviewAuditRow>(sql`
    INSERT INTO search_candidate_audit (
      search_candidate_id,
      event_type,
      actor_id,
      revision,
      changes,
      created_at
    ) VALUES (
      ${parsed.data.searchCandidateId},
      ${SEARCH_REVIEW_EDIT_EVENT},
      ${parsed.data.actorId},
      ${parsed.data.revision},
      ${JSON.stringify(changes)}::jsonb,
      now()
    )
    RETURNING
      id,
      search_candidate_id AS "searchCandidateId",
      event_type AS "eventType",
      actor_id AS "actorId",
      revision,
      changes,
      created_at AS "createdAt"
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    searchCandidateId: row.searchCandidateId,
    eventType: row.eventType,
    actorId: row.actorId,
    revision: row.revision,
    changes: row.changes,
    timestamp: row.createdAt,
  };
}

interface StageSearchReviewEditRow extends Record<string, unknown> {
  readonly kind: StageSearchReviewEditResult['kind'];
  readonly revision: number | null;
  readonly editCount: number | null;
  readonly auditId: number | null;
  readonly timestamp: Date | null;
}

export async function stageSearchReviewEdit(input: StageSearchReviewEditInput): Promise<StageSearchReviewEditResult> {
  const parsed = stageSearchReviewEditSchema.safeParse(input);
  if (!parsed.success) return { kind: 'persistence_failed' };
  const roleIds = [...new Set(parsed.data.buyerRoleIds)].sort((left, right) => left - right);
  const changes = parsed.data.changes.map((change) => ({
    path: change.path,
    before: redactSearchReviewAuditValue(change.path, change.before),
    after: redactSearchReviewAuditValue(change.path, change.after),
  }));
  const roleIdList = roleIds.length === 0
    ? sql`SELECT NULL::integer AS id, NULL::text AS name WHERE false`
    : sql`SELECT id, name FROM buyer_role WHERE id IN (${sql.join(roleIds.map((id) => sql`${id}`), sql`, `)})`;
  const result = await db.execute<StageSearchReviewEditRow>(sql`
    WITH requested_roles AS (${roleIdList}),
    role_validation AS (
      SELECT count(*)::int AS found_count,
        COALESCE(jsonb_agg(jsonb_build_object(
          'buyerRoleId', id,
          'buyerRoleName', name,
          'matchedRuleIds', jsonb_build_array('manual_edit'),
          'confidence', 'uncertain'
        ) ORDER BY id), '[]'::jsonb) AS snapshot
      FROM requested_roles
    ),
    candidate_state AS MATERIALIZED (
      SELECT candidate.id, candidate.revision, candidate.status, run.initiating_user_id AS owner_user_id
      FROM search_candidate candidate
      INNER JOIN search_run run ON run.id = candidate.search_run_id
      WHERE candidate.id = ${parsed.data.reviewId}
    ),
    updated AS (
      UPDATE search_candidate candidate
      SET persona_snapshot = ${JSON.stringify(parsed.data.persona)}::jsonb,
          buyer_role_snapshot = (SELECT snapshot FROM role_validation),
          revision = candidate.revision + 1,
          edit_count = candidate.edit_count + 1,
          last_edited_by = ${parsed.data.actorUserId},
          updated_at = now()
      FROM candidate_state state, role_validation roles
      WHERE candidate.id = state.id
        AND candidate.revision = ${parsed.data.expectedRevision}
        AND candidate.status IN ('pending', 'inconclusive', 'ambiguous_match')
        AND state.owner_user_id = ${parsed.data.actorUserId}
        AND state.revision = ${parsed.data.expectedRevision}
        AND state.status IN ('pending', 'inconclusive', 'ambiguous_match')
        AND roles.found_count = ${roleIds.length}
      RETURNING candidate.id, candidate.revision, candidate.edit_count
    ),
    audit_event AS (
      INSERT INTO search_candidate_audit (search_candidate_id, event_type, actor_id, revision, changes, created_at)
      SELECT id, 'search_candidate_edited', ${parsed.data.actorUserId}, revision, ${JSON.stringify(changes)}::jsonb, now()
      FROM updated
      RETURNING id, search_candidate_id, revision, created_at
    )
    SELECT CASE
      WHEN NOT EXISTS (SELECT 1 FROM candidate_state) THEN 'not_found'
      WHEN NOT EXISTS (SELECT 1 FROM candidate_state WHERE owner_user_id = ${parsed.data.actorUserId}) THEN 'unauthorized'
      WHEN NOT EXISTS (SELECT 1 FROM candidate_state WHERE owner_user_id = ${parsed.data.actorUserId} AND revision = ${parsed.data.expectedRevision}) THEN 'stale_revision'
      WHEN NOT EXISTS (SELECT 1 FROM candidate_state WHERE owner_user_id = ${parsed.data.actorUserId} AND revision = ${parsed.data.expectedRevision} AND status IN ('pending', 'inconclusive', 'ambiguous_match')) THEN 'ineligible'
      WHEN (SELECT found_count FROM role_validation) <> ${roleIds.length} THEN 'unknown_role'
      WHEN NOT EXISTS (SELECT 1 FROM updated) THEN 'persistence_failed'
      ELSE 'edited'
    END AS kind,
    (SELECT revision FROM updated) AS revision,
    (SELECT edit_count FROM updated) AS "editCount",
    (SELECT id FROM audit_event) AS "auditId",
    (SELECT created_at FROM audit_event) AS timestamp
  `);
  const row = result.rows[0];
  if (!row) return { kind: 'persistence_failed' };
  switch (row.kind) {
    case 'edited':
      return row.revision === null || row.editCount === null || row.auditId === null || row.timestamp === null
        ? { kind: 'persistence_failed' }
        : { kind: 'edited', revision: row.revision, editCount: row.editCount, auditId: row.auditId, timestamp: row.timestamp };
    case 'not_found':
      return { kind: 'not_found' };
    case 'unauthorized':
      return { kind: 'unauthorized' };
    case 'stale_revision':
      return { kind: 'stale_revision' };
    case 'ineligible':
      return { kind: 'ineligible' };
    case 'unknown_role':
      return { kind: 'unknown_role' };
    case 'persistence_failed':
      return { kind: 'persistence_failed' };
    default:
      return { kind: 'persistence_failed' };
  }
}
