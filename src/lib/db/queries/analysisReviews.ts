import { sql } from 'drizzle-orm';

import {
  decideRunInputSchema,
  reconcileReviewInputSchema,
  reviewItemSchema,
  type DecideRunInput,
  type ReconcileReviewInput,
  type ReconcileReviewResult,
  type ReviewDecisionOutcome,
  type ReviewItem,
  type WholeRunDecision,
} from '@/lib/analysis/reviewContracts';

import { db } from '../index';

// D-34-02: the completed->pending_review bridge is a server-owned automatic
// boundary, never a staff action. Every reconcile/bridge event is attributed
// to this deterministic system actor so the ledger is auditable end to end.
export const REVIEW_RECONCILE_ACTOR_ID = 'analysis-review-reconciler';

const NON_REVIEWABLE_STATUSES: readonly string[] = ['queued', 'running', 'failed', 'cancelled'];

// D-34-02/D-34-04: a packet is reviewable only while it is visible. Company
// packets are always visible; persona packets must carry an unexpired retained
// artifact (the exact retention predicate reproduced from getAnalysisPacket,
// referenced as `result` — every call site aliases analysis_run_result that way).
function packetVisibilitySql(nowIso: string) {
  return sql`
    (result.target_type <> 'persona'
     OR EXISTS (
       SELECT 1 FROM analysis_result_retention AS retention
       WHERE retention.result_id = result.id
         AND retention.status = 'retained'
         AND retention.expires_at > ${nowIso}
     ))
  `;
}

type ReconcileOutcomeRow = {
  readonly status: string;
  readonly resultId: number | null;
  readonly packetHash: string | null;
  readonly hasReview: boolean;
  readonly hasPacket: boolean;
  readonly updated: boolean;
};

// D-34-02: reconcile a single completed run into the review boundary. The
// promote is atomic (UPDATE ... WHERE status = 'completed' AND packet visible)
// and idempotent — a concurrent or repeated call either wins the promotion
// (replayed: false) or replays the existing item (replayed: true), and only
// the winner appends the completed->pending_review lifecycle event.
export async function reconcileCompletedRunForReview(
  input: ReconcileReviewInput,
  options: { readonly now?: Date } = {},
): Promise<ReconcileReviewResult> {
  const parsed = reconcileReviewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const runId = parsed.data.runId;
  const nowIso = (options.now ?? new Date()).toISOString();

  const result = await db.execute<ReconcileOutcomeRow>(sql`
    WITH current_run AS (
      SELECT id, status, subject_type, subject_id, template_id, created_at
      FROM analysis_run
      WHERE id = ${runId}
    ),
    packet AS (
      SELECT result.id, result.packet_hash
      FROM analysis_run_result AS result
      WHERE result.analysis_run_id = ${runId}
        AND ${packetVisibilitySql(nowIso)}
    ),
    existing_review AS (
      SELECT result_id, packet_hash
      FROM analysis_run_review
      WHERE analysis_run_id = ${runId}
    ),
    updated AS (
      UPDATE analysis_run
      SET status = 'pending_review', updated_at = ${nowIso}
      FROM current_run
      WHERE analysis_run.id = current_run.id AND current_run.status = 'completed'
        AND EXISTS (SELECT 1 FROM packet)
        AND NOT EXISTS (
          SELECT 1
          FROM analysis_run AS active_run
          WHERE active_run.subject_type = current_run.subject_type
            AND active_run.subject_id = current_run.subject_id
            AND active_run.template_id = current_run.template_id
            AND active_run.status IN ('queued', 'running', 'pending_review')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM analysis_run AS newer_completed
          WHERE newer_completed.subject_type = current_run.subject_type
            AND newer_completed.subject_id = current_run.subject_id
            AND newer_completed.template_id = current_run.template_id
            AND newer_completed.status = 'completed'
            AND (
              newer_completed.created_at > current_run.created_at
              OR (
                newer_completed.created_at = current_run.created_at
                AND newer_completed.id > current_run.id
              )
            )
        )
        RETURNING analysis_run.id
    ),
    inserted_event AS (
      INSERT INTO analysis_run_event (
        analysis_run_id, event_key, from_status, to_status, actor_kind,
        actor_id, safe_reason, attempt, created_at
      )
      SELECT updated.id,
        concat(updated.id, ':completed->pending_review:0'),
        'completed', 'pending_review', 'system', ${REVIEW_RECONCILE_ACTOR_ID},
        NULL, 0, ${nowIso}
      FROM updated
      RETURNING id
    )
    SELECT
      current_run.status AS status,
      COALESCE(existing_review.result_id, packet.id) AS "resultId",
      COALESCE(existing_review.packet_hash, packet.packet_hash) AS "packetHash",
      EXISTS (SELECT 1 FROM existing_review) AS "hasReview",
      EXISTS (SELECT 1 FROM packet) AS "hasPacket",
      EXISTS (SELECT 1 FROM updated) AS updated
    FROM current_run
    LEFT JOIN packet ON TRUE
    LEFT JOIN existing_review ON TRUE
  `);

  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.updated) {
    return {
      ok: true,
      runId,
      resultId: Number(row.resultId),
      packetHash: row.packetHash as string,
      replayed: false,
    };
  }
  if (NON_REVIEWABLE_STATUSES.includes(row.status)) {
    return { ok: false, reason: 'not_completed' };
  }
  if (row.hasReview) {
    // D-34-02: replay of a decided run returns the persisted review identity —
    // retention expiry must never erase the immutable decision record.
    return {
      ok: true,
      runId,
      resultId: Number(row.resultId),
      packetHash: row.packetHash as string,
      replayed: true,
    };
  }
  if (!row.hasPacket) {
    return { ok: false, reason: 'missing_packet' };
  }
  // completed/pending_review that already exists in the review flow.
  return {
    ok: true,
    runId,
    resultId: Number(row.resultId),
    packetHash: row.packetHash as string,
    replayed: true,
  };
}

type DecideOutcomeRow = {
  readonly runId: number | null;
  readonly resultId: number | null;
  readonly decision: 'confirmed' | 'dismissed' | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | Date | null;
  readonly packetHash: string | null;
  readonly decided: boolean;
  readonly replayed: boolean;
  readonly status: string | null;
  readonly hasPacket: boolean | null;
};

// D-34-02: decide a pending_review run. The UPDATE is the single atomic gate —
// only the run that is still pending_review with a visible packet wins the
// decision, inserts the immutable analysis_run_review row and one staff
// lifecycle event. A retried/conflicting decision replays the ORIGINAL
// persisted winner (replayed: true); a loser of a concurrent race with no
// visible winner classifies as race_loser.
export async function decideAnalysisRun(
  input: DecideRunInput,
  actorId: string,
  options: { readonly decidedAt?: Date } = {},
): Promise<ReviewDecisionOutcome> {
  const parsed = decideRunInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  if (typeof actorId !== 'string' || actorId.trim().length === 0) {
    return { ok: false, reason: 'invalid_input' };
  }
  const { runId, decision } = parsed.data;
  const decidedAt = options.decidedAt ?? new Date();
  const nowIso = decidedAt.toISOString();

  const result = await db.execute<DecideOutcomeRow>(sql`
    WITH current_run AS (
      SELECT id, status, attempt FROM analysis_run WHERE id = ${runId}
    ),
    packet AS (
      SELECT result.id, result.packet_hash
      FROM analysis_run_result AS result
      WHERE result.analysis_run_id = ${runId}
        AND ${packetVisibilitySql(nowIso)}
    ),
    updated AS (
      UPDATE analysis_run
      SET status = ${decision},
          terminal_at = COALESCE(terminal_at, ${nowIso}),
          updated_at = ${nowIso}
      WHERE id = ${runId} AND status = 'pending_review'
        AND EXISTS (SELECT 1 FROM packet)
      RETURNING id
    ),
    inserted_review AS (
      INSERT INTO analysis_run_review (
        analysis_run_id, result_id, decision, decided_by, decided_at, packet_hash
      )
      SELECT updated.id, packet.id, ${decision}, ${actorId}, ${nowIso}, packet.packet_hash
      FROM updated CROSS JOIN packet
      ON CONFLICT (analysis_run_id) DO NOTHING
      RETURNING
        analysis_run_id AS "runId",
        result_id AS "resultId",
        decision,
        decided_by AS "decidedBy",
        decided_at AS "decidedAt",
        packet_hash AS "packetHash"
    ),
    inserted_event AS (
      INSERT INTO analysis_run_event (
        analysis_run_id, event_key, from_status, to_status, actor_kind,
        actor_id, safe_reason, attempt, created_at
      )
      SELECT updated.id,
        concat(updated.id, ':pending_review->', ${decision}::text, ':', current_run.attempt),
        'pending_review', ${decision}, 'staff', ${actorId}, NULL,
        current_run.attempt, ${nowIso}
      FROM updated CROSS JOIN current_run
      RETURNING id
    )
    SELECT
      inserted_review."runId", inserted_review."resultId", inserted_review.decision,
      inserted_review."decidedBy", inserted_review."decidedAt",
      inserted_review."packetHash",
      TRUE AS decided, FALSE AS replayed,
      NULL::text AS status, NULL::boolean AS "hasPacket"
    FROM inserted_review
    UNION ALL
    SELECT
      review.analysis_run_id AS "runId", review.result_id AS "resultId",
      review.decision, review.decided_by AS "decidedBy",
      review.decided_at AS "decidedAt", review.packet_hash AS "packetHash",
      TRUE AS decided, TRUE AS replayed,
      NULL::text AS status, NULL::boolean AS "hasPacket"
    FROM analysis_run_review AS review
    WHERE review.analysis_run_id = ${runId}
      AND NOT EXISTS (SELECT 1 FROM inserted_review)
    UNION ALL
    SELECT
      NULL::integer AS "runId", NULL::integer AS "resultId",
      NULL::analysis_review_decision AS decision, NULL::text AS "decidedBy",
      NULL::timestamptz AS "decidedAt", NULL::text AS "packetHash",
      FALSE AS decided, FALSE AS replayed,
      current_run.status::text AS status,
      EXISTS (SELECT 1 FROM packet) AS "hasPacket"
    FROM current_run
    WHERE NOT EXISTS (SELECT 1 FROM inserted_review)
      AND NOT EXISTS (SELECT 1 FROM analysis_run_review WHERE analysis_run_id = ${runId})
  `);

  const outcome = result.rows[0];
  if (!outcome) return { ok: false, reason: 'not_found' };
  if (outcome.decided) {
    return {
      ok: true,
      runId: Number(outcome.runId),
      resultId: Number(outcome.resultId),
      decision: outcome.decision as WholeRunDecision,
      decidedBy: outcome.decidedBy as string,
      decidedAt: new Date(outcome.decidedAt as string | Date).toISOString(),
      packetHash: outcome.packetHash as string,
      replayed: outcome.replayed,
    };
  }
  if (!outcome.hasPacket) return { ok: false, reason: 'missing_packet' };
  if (outcome.status !== 'pending_review') {
    return { ok: false, reason: 'not_pending_review' };
  }
  return { ok: false, reason: 'race_loser' };
}

type ReviewItemRow = {
  readonly runId: number;
  readonly status: string;
  readonly targetType: string;
  readonly subjectId: number;
  readonly subjectDisplayName: string;
  readonly templateName: string;
  readonly practiceAreaName: string;
  readonly resultId: number;
  readonly packetHash: string;
  readonly findingCount: number;
  readonly sourceCount: number;
  readonly linkCount: number;
  readonly completedAt: string | Date | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | Date | null;
  readonly decision: string | null;
};

// D-34-01/REV-01: the review listing. The boundary reconciles every completed
// run with a visible packet exactly once before reading (idempotent, system-
// attributed), then returns one normalized ReviewItem per reviewable run —
// pending_review, confirmed, and dismissed all live in the review history.
export async function listRunReviewItems(
  options: { readonly now?: Date } = {},
): Promise<ReviewItem[]> {
  const nowIso = (options.now ?? new Date()).toISOString();

  await db.execute(sql`
    WITH updated AS (
      UPDATE analysis_run AS run
      SET status = 'pending_review', updated_at = ${nowIso}
      WHERE run.status = 'completed'
        AND EXISTS (
          SELECT 1 FROM analysis_run_result AS result
          WHERE result.analysis_run_id = run.id
            AND ${packetVisibilitySql(nowIso)}
        )
        AND NOT EXISTS (
          SELECT 1
          FROM analysis_run AS active_run
          WHERE active_run.subject_type = run.subject_type
            AND active_run.subject_id = run.subject_id
            AND active_run.template_id = run.template_id
            AND active_run.status IN ('queued', 'running', 'pending_review')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM analysis_run AS newer_completed
          WHERE newer_completed.subject_type = run.subject_type
            AND newer_completed.subject_id = run.subject_id
            AND newer_completed.template_id = run.template_id
            AND newer_completed.status = 'completed'
            AND (
              newer_completed.created_at > run.created_at
              OR (
                newer_completed.created_at = run.created_at
                AND newer_completed.id > run.id
              )
            )
        )
      RETURNING id
    ),
    inserted_events AS (
      INSERT INTO analysis_run_event (
        analysis_run_id, event_key, from_status, to_status, actor_kind,
        actor_id, safe_reason, attempt, created_at
      )
      SELECT updated.id,
        concat(updated.id, ':completed->pending_review:0'),
        'completed', 'pending_review', 'system', ${REVIEW_RECONCILE_ACTOR_ID},
        NULL, 0, ${nowIso}
      FROM updated
      RETURNING id
    )
    SELECT count(*)::text AS promoted FROM updated
  `);

  const items = await db.execute<ReviewItemRow>(sql`
    SELECT
      run.id AS "runId",
      run.status AS status,
      run.subject_type AS "targetType",
      run.subject_id AS "subjectId",
      run.subject_snapshot->>'displayName' AS "subjectDisplayName",
      run.template_snapshot->>'templateName' AS "templateName",
      run.checklist_snapshot->>'practiceAreaName' AS "practiceAreaName",
      result.id AS "resultId",
      result.packet_hash AS "packetHash",
      result.finding_count AS "findingCount",
      result.source_count AS "sourceCount",
      result.link_count AS "linkCount",
      to_char(run.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "completedAt",
      review.decided_by AS "decidedBy",
      to_char(review.decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "decidedAt",
      review.decision AS decision
    FROM analysis_run AS run
    JOIN analysis_run_result AS result ON result.analysis_run_id = run.id
    LEFT JOIN analysis_run_review AS review ON review.analysis_run_id = run.id
    WHERE run.status IN ('pending_review', 'confirmed', 'dismissed')
      AND ${packetVisibilitySql(nowIso)}
    ORDER BY run.id
  `);

  return items.rows.map((row) =>
    reviewItemSchema.parse({
      runId: Number(row.runId),
      status: row.status,
      targetType: row.targetType,
      subjectId: Number(row.subjectId),
      subjectDisplayName: row.subjectDisplayName,
      templateName: row.templateName,
      practiceAreaName: row.practiceAreaName,
      resultId: Number(row.resultId),
      packetHash: row.packetHash,
      findingCount: Number(row.findingCount),
      sourceCount: Number(row.sourceCount),
      linkCount: Number(row.linkCount),
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      decidedBy: row.decidedBy ?? null,
      decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
      decision: row.decision ?? null,
    }),
  );
}
