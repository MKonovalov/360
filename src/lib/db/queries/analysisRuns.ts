import { eq, sql } from 'drizzle-orm';

import {
  ANALYSIS_RUN_STATUSES,
  ANALYSIS_RUN_TRANSITIONS,
  NONTERMINAL_ANALYSIS_RUN_STATUSES,
  canTransitionAnalysisRun,
  type AnalysisRunStatus,
  type AnalysisTargetType,
  type ReadonlyAnalysisSnapshot,
  type SafeOutcomeReason,
} from '@/lib/analysis/contracts';
import { db } from '../index';
import { analysisRun, analysisRunEvent } from '../schema';

// The exact status set the partial unique index
// analysis_run_active_subject_template_idx blocks duplicates with. Kept in one
// shared export so the schema index, duplicate-guard tests, and result mapping
// can never drift apart (Pitfall 2 in 32-RESEARCH.md).
export const ACTIVE_RUN_STATUSES = NONTERMINAL_ANALYSIS_RUN_STATUSES;

// Mirrors the analysis_actor_kind database enum; actors are always explicit
// server-provided values, never read from Clerk or Workflow inside this module.
export const ANALYSIS_ACTOR_KINDS = ['staff', 'workflow', 'system'] as const;
export type AnalysisActorKind = (typeof ANALYSIS_ACTOR_KINDS)[number];

export type AnalysisRunRow = typeof analysisRun.$inferSelect;
export type AnalysisRunEventRow = typeof analysisRunEvent.$inferSelect;

// Terminal statuses (no outgoing transition in the shared graph) are exactly
// the statuses whose transition list is empty. Derived, never duplicated.
const TERMINAL_ANALYSIS_RUN_STATUSES = ANALYSIS_RUN_STATUSES.filter(
  (status) => ANALYSIS_RUN_TRANSITIONS[status].length === 0,
);

export interface CreateAnalysisRunInput {
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly subjectType: AnalysisTargetType;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly createdBy: string;
  readonly templateSnapshot: ReadonlyAnalysisSnapshot['template'];
  readonly subjectSnapshot: ReadonlyAnalysisSnapshot['subject'];
  readonly checklistSnapshot: ReadonlyAnalysisSnapshot['checklist'];
  readonly executionSnapshot: ReadonlyAnalysisSnapshot['execution'];
  readonly policySnapshot: ReadonlyAnalysisSnapshot['policy'];
}

export type CreateAnalysisRunResult =
  | { readonly ok: true; readonly run: AnalysisRunRow }
  | { readonly ok: false; readonly reason: 'active_run_exists' };

export interface TransitionAnalysisRunInput {
  readonly runId: number;
  readonly expectedStatus: AnalysisRunStatus;
  readonly toStatus: AnalysisRunStatus;
  readonly actorKind: AnalysisActorKind;
  readonly actorId: string;
  readonly safeReason?: SafeOutcomeReason;
  readonly attempt: number;
  readonly occurredAt?: Date;
}

export type TransitionAnalysisRunResult =
  | {
      readonly ok: true;
      readonly reason: 'transitioned';
      readonly run: AnalysisRunRow;
      readonly event: AnalysisRunEventRow;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid_transition' | 'replayed' | 'not_found';
      readonly run: AnalysisRunRow | undefined;
    };

type CreateOutcomeRow = {
  readonly runId: number;
  readonly eventId: number;
};

type TransitionEventRow = {
  readonly id: number;
  readonly analysisRunId: number;
  readonly eventKey: string;
  readonly fromStatus: AnalysisRunStatus;
  readonly toStatus: AnalysisRunStatus;
  readonly actorKind: AnalysisActorKind;
  readonly actorId: string;
  readonly safeReason: string | null;
  readonly attempt: number;
  readonly createdAt: Date;
};

export async function getAnalysisRun(runId: number): Promise<AnalysisRunRow | undefined> {
  const rows = await db
    .select()
    .from(analysisRun)
    .where(eq(analysisRun.id, runId));
  return rows[0];
}

export async function listAnalysisRunEvents(runId: number): Promise<AnalysisRunEventRow[]> {
  return db
    .select()
    .from(analysisRunEvent)
    .where(eq(analysisRunEvent.analysisRunId, runId))
    .orderBy(analysisRunEvent.createdAt, analysisRunEvent.id);
}

// The installed neon-http driver rejects interactive db.transaction (see
// 32-TRANSACTION-PROBE.md), so every guarded write pairs the conditional run
// mutation and the append-only event insert inside ONE data-modifying CTE.
// A winning statement updates exactly one row and inserts exactly one event;
// a losing statement updates zero rows and therefore inserts nothing.
export async function createAnalysisRun(
  input: CreateAnalysisRunInput,
): Promise<CreateAnalysisRunResult> {
  let outcome: CreateOutcomeRow | undefined;
  try {
    const result = await db.execute<CreateOutcomeRow>(sql`
      WITH inserted_run AS (
        INSERT INTO analysis_run (
          template_id,
          template_version_id,
          subject_type,
          subject_id,
          practice_area_id,
          status,
          created_by,
          template_snapshot,
          subject_snapshot,
          checklist_snapshot,
          execution_snapshot,
          policy_snapshot
        )
        VALUES (
          ${input.templateId},
          ${input.templateVersionId},
          ${input.subjectType},
          ${input.subjectId},
          ${input.practiceAreaId},
          'queued',
          ${input.createdBy},
          ${JSON.stringify(input.templateSnapshot)}::jsonb,
          ${JSON.stringify(input.subjectSnapshot)}::jsonb,
          ${JSON.stringify(input.checklistSnapshot)}::jsonb,
          ${JSON.stringify(input.executionSnapshot)}::jsonb,
          ${JSON.stringify(input.policySnapshot)}::jsonb
        )
        RETURNING id
      ),
      inserted_event AS (
        INSERT INTO analysis_run_event (
          analysis_run_id,
          event_key,
          from_status,
          to_status,
          actor_kind,
          actor_id,
          safe_reason,
          attempt
        )
        SELECT
          inserted_run.id,
          concat(inserted_run.id, ':queued:0'),
          NULL,
          'queued',
          'staff',
          ${input.createdBy},
          NULL,
          0
        FROM inserted_run
        RETURNING id, analysis_run_id
      )
      SELECT inserted_run.id AS "runId", inserted_event.id AS "eventId"
      FROM inserted_run
      JOIN inserted_event ON inserted_event.analysis_run_id = inserted_run.id
    `);
    outcome = result.rows[0];
  } catch (error: unknown) {
    // Only a PostgreSQL unique violation (SQLSTATE 23505) at the create
    // boundary maps to active_run_exists; arbitrary DB errors propagate.
    if (hasPostgresCode(error, '23505')) return { ok: false, reason: 'active_run_exists' };
    throw error;
  }

  if (!outcome) throw new Error('analysis run insert returned no row');
  const run = await getAnalysisRun(outcome.runId);
  if (!run) throw new Error('analysis run not found after insert');
  return { ok: true, run };
}

export async function transitionAnalysisRun(
  input: TransitionAnalysisRunInput,
): Promise<TransitionAnalysisRunResult> {
  // The expected-status predicate alone cannot stop a legal from-status being
  // paired with an illegal next status, so the shared transition graph guards
  // every call before any SQL runs. Terminal statuses have no outgoing
  // transitions here, which is what makes terminal rows impossible to reset.
  if (!canTransitionAnalysisRun(input.expectedStatus, input.toStatus)) {
    const run = await getAnalysisRun(input.runId);
    return { ok: false, reason: 'invalid_transition', run };
  }

  const occurredAt = input.occurredAt ?? new Date();
  const eventKey = `${input.runId}:${input.expectedStatus}->${input.toStatus}:${input.attempt}`;
  const startedAt = input.toStatus === 'running' ? occurredAt : null;
  const completedAt = input.toStatus === 'completed' || input.toStatus === 'failed' || input.toStatus === 'cancelled'
    ? occurredAt
    : null;
  const terminalAt = TERMINAL_ANALYSIS_RUN_STATUSES.includes(input.toStatus)
    ? occurredAt
    : null;

  const result = await db.execute<TransitionEventRow>(sql`
    WITH updated AS (
      UPDATE analysis_run
      SET status = ${input.toStatus},
          safe_reason = ${input.safeReason ?? null},
          attempt = ${input.attempt},
          started_at = COALESCE(started_at, ${startedAt}),
          completed_at = COALESCE(completed_at, ${completedAt}),
          terminal_at = COALESCE(terminal_at, ${terminalAt}),
          updated_at = ${occurredAt}
      WHERE id = ${input.runId} AND status = ${input.expectedStatus}
      RETURNING id
    ),
    inserted AS (
      INSERT INTO analysis_run_event (
        analysis_run_id,
        event_key,
        from_status,
        to_status,
        actor_kind,
        actor_id,
        safe_reason,
        attempt,
        created_at
      )
      SELECT
        updated.id,
        ${eventKey},
        ${input.expectedStatus},
        ${input.toStatus},
        ${input.actorKind},
        ${input.actorId},
        ${input.safeReason ?? null},
        ${input.attempt},
        ${occurredAt}
      FROM updated
      RETURNING
        id,
        analysis_run_id AS "analysisRunId",
        event_key AS "eventKey",
        from_status AS "fromStatus",
        to_status AS "toStatus",
        actor_kind AS "actorKind",
        actor_id AS "actorId",
        safe_reason AS "safeReason",
        attempt,
        created_at AS "createdAt"
    )
    SELECT * FROM inserted
  `);

  const event = result.rows[0];
  if (!event) {
    // No row matched the expected status: the transition is a replay. Return
    // the authoritative current row unchanged and append nothing.
    const run = await getAnalysisRun(input.runId);
    return { ok: false, reason: run ? 'replayed' : 'not_found', run };
  }

  const run = await getAnalysisRun(input.runId);
  if (!run) return { ok: false, reason: 'not_found', run: undefined };
  return { ok: true, reason: 'transitioned', run, event };
}

// SQLSTATE 23505 can arrive directly on the error or wrapped in a cause chain.
// Only exact-code matches are classified; everything else is left to the caller.
function hasPostgresCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  let depth = 0;
  while (current instanceof Error && depth < 4) {
    if (Reflect.get(current, 'code') === code) return true;
    current = current.cause;
    depth += 1;
  }
  return false;
}
