import 'server-only';

import { desc, inArray } from 'drizzle-orm';

import { db } from '../index';
import { analysisRun, analysisRunEvent, searchRun } from '../schema';

// Read-only, team-wide job log across Analyze (internal and Arc Agent Net) and
// Search runs. Deliberately excludes partner job/request ids, idempotency keys,
// raw payloads and user ids: it exposes local lifecycle facts only.

export type JobLogKind = 'analyze' | 'search';
export type JobLogOutcome = 'active' | 'success' | 'failed';

export type JobLogEvent = { readonly at: string; readonly label: string };

export type JobLogRow = {
  readonly key: string;
  readonly kind: JobLogKind;
  readonly runId: number;
  readonly executor: 'internal' | 'arc-agentnet' | 'search';
  readonly subjectType: 'company' | 'persona';
  readonly subjectId: number;
  readonly subjectName: string;
  readonly template: string;
  readonly status: string;
  readonly outcome: JobLogOutcome;
  readonly reason: string | null;
  readonly summary: string | null;
  readonly owner: 'you' | 'teammate';
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly durationSeconds: number | null;
  readonly events: readonly JobLogEvent[];
};

export const JOB_LOG_LIMIT = 200;

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['queued', 'running']);
const FAILED_STATUSES: ReadonlySet<string> = new Set(['failed', 'cancelled']);

export function outcomeForStatus(status: string): JobLogOutcome {
  if (ACTIVE_STATUSES.has(status)) return 'active';
  if (FAILED_STATUSES.has(status)) return 'failed';
  return 'success';
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function durationSeconds(start: Date | null | undefined, end: Date | null | undefined): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

function timeline(entries: readonly (readonly [Date | null | undefined, string])[]): JobLogEvent[] {
  return entries
    .flatMap(([at, label]) => (at ? [{ at: at.toISOString(), label }] : []))
    .sort((left, right) => left.at.localeCompare(right.at));
}

export async function listJobLogs(viewerUserId: string, limit: number = JOB_LOG_LIMIT): Promise<JobLogRow[]> {
  const [analysisRows, searchRows] = await Promise.all([
    db.select().from(analysisRun).orderBy(desc(analysisRun.createdAt), desc(analysisRun.id)).limit(limit),
    db.select().from(searchRun).orderBy(desc(searchRun.createdAt), desc(searchRun.id)).limit(limit),
  ]);

  const events = analysisRows.length === 0
    ? []
    : await db
        .select()
        .from(analysisRunEvent)
        .where(inArray(analysisRunEvent.analysisRunId, analysisRows.map((run) => run.id)))
        .orderBy(analysisRunEvent.createdAt, analysisRunEvent.id);
  const eventsByRun = new Map<number, JobLogEvent[]>();
  for (const event of events) {
    const label = `${event.fromStatus ?? 'created'} → ${event.toStatus}${event.safeReason ? ` (${event.safeReason})` : ''}`;
    const list = eventsByRun.get(event.analysisRunId) ?? [];
    list.push({ at: event.createdAt.toISOString(), label });
    eventsByRun.set(event.analysisRunId, list);
  }

  const analyze = analysisRows.map((run): JobLogRow => {
    const partner = run.executionTarget === 'arc-agentnet';
    const status = partner ? run.arcAgentnetLocalStatus ?? 'queued' : run.status;
    const startedAt = partner ? run.arcAgentnetStartedAt ?? run.startedAt : run.startedAt;
    const finishedAt = partner
      ? run.arcAgentnetTerminalAt ?? run.arcAgentnetCompletedAt ?? run.terminalAt
      : run.terminalAt ?? run.completedAt;
    const ownerId = partner ? run.initiatingUserId : run.createdBy;
    return {
      key: `analyze-${run.id}`,
      kind: 'analyze',
      runId: run.id,
      executor: partner ? 'arc-agentnet' : 'internal',
      subjectType: run.subjectType,
      subjectId: run.subjectId,
      subjectName: run.subjectSnapshot.displayName,
      template: run.templateSnapshot.templateName,
      status,
      outcome: outcomeForStatus(status),
      reason: (partner ? run.arcAgentnetSafeReason : run.safeReason) ?? null,
      summary: null,
      owner: ownerId === viewerUserId ? 'you' : 'teammate',
      createdAt: run.createdAt.toISOString(),
      startedAt: iso(startedAt),
      finishedAt: iso(finishedAt),
      durationSeconds: durationSeconds(startedAt ?? run.createdAt, finishedAt),
      // Internal runs carry a real transition log; partner runs only have
      // timestamps, so they get a synthesized timeline like Search runs.
      events: eventsByRun.get(run.id) ?? timeline([
        [run.createdAt, 'created'],
        [startedAt, 'started'],
        [finishedAt, status],
      ]),
    };
  });

  const search = searchRows.map((run): JobLogRow => {
    const summary = run.terminalResultSummary;
    return {
      key: `search-${run.id}`,
      kind: 'search',
      runId: run.id,
      executor: 'search',
      subjectType: 'company',
      subjectId: run.companyId,
      subjectName: run.companySnapshot.name,
      template: run.templateSnapshot.name,
      status: run.status,
      outcome: outcomeForStatus(run.status),
      reason: null,
      summary: summary ? `${summary.normalizedCandidateCount} candidates · ${summary.sourceCount} sources` : null,
      owner: run.initiatingUserId === viewerUserId ? 'you' : 'teammate',
      createdAt: run.createdAt.toISOString(),
      startedAt: iso(run.startedAt),
      finishedAt: iso(run.terminalAt ?? run.completedAt),
      durationSeconds: durationSeconds(run.startedAt ?? run.createdAt, run.terminalAt ?? run.completedAt),
      events: timeline([
        [run.createdAt, 'created'],
        [run.startedAt, 'started'],
        [run.terminalAt ?? run.completedAt, run.status],
      ]),
    };
  });

  return [...analyze, ...search]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.runId - left.runId)
    .slice(0, limit);
}
