import { sql, type SQL } from 'drizzle-orm';

export type AnalysisRunOutcomeGuardInput = {
  readonly runId: number;
  readonly attempt: number;
};

export function lockRunningAnalysisRun(input: AnalysisRunOutcomeGuardInput): SQL {
  return sql`
    SELECT candidate.id
    FROM analysis_run AS candidate
    WHERE candidate.id = ${input.runId}
      AND candidate.status = 'running'
      AND candidate.attempt = ${input.attempt}
    FOR UPDATE
  `;
}
