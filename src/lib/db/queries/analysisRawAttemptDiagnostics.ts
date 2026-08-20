import 'server-only';

import { and, eq, gt } from 'drizzle-orm';

import type { AnalysisRunStatus } from '@/lib/analysis/contracts';
import type { RawAttemptArtifact } from '@/lib/analysis/rawAttempt';
import { db } from '../index';
import { analysisRawAttempt, analysisRun, analysisRunResult } from '../schema';

export type AnalysisRawAttemptDiagnosticRow = Readonly<{
  rawAttemptId: number;
  analysisRunId: number;
  attempt: number;
  failureStage: string;
  status: string;
  safeReason: string;
  artifact: RawAttemptArtifact;
  capturedAt: Date;
  expiresAt: Date;
  runStatus: AnalysisRunStatus;
  runCreatedAt: Date;
  runStartedAt: Date | null;
  runCompletedAt: Date | null;
  runTerminalAt: Date | null;
  normalized: Readonly<{
    resultId: number;
    targetType: 'company' | 'persona';
    packetHash: string;
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    findingCount: number;
    sourceCount: number;
    linkCount: number;
    expiresAt: Date | null;
  }> | null;
}>;

export async function getAnalysisRawAttemptDiagnostic(
  analysisRunId: number,
  now: Date = new Date(),
): Promise<AnalysisRawAttemptDiagnosticRow | undefined> {
  const rows = await db
    .select({
      rawAttemptId: analysisRawAttempt.id,
      analysisRunId: analysisRawAttempt.analysisRunId,
      attempt: analysisRawAttempt.attempt,
      failureStage: analysisRawAttempt.failureStage,
      status: analysisRawAttempt.status,
      safeReason: analysisRawAttempt.safeReason,
      artifact: analysisRawAttempt.artifact,
      capturedAt: analysisRawAttempt.capturedAt,
      expiresAt: analysisRawAttempt.expiresAt,
      runStatus: analysisRun.status,
      runCreatedAt: analysisRun.createdAt,
      runStartedAt: analysisRun.startedAt,
      runCompletedAt: analysisRun.completedAt,
      runTerminalAt: analysisRun.terminalAt,
      normalized: {
        resultId: analysisRunResult.id,
        targetType: analysisRunResult.targetType,
        packetHash: analysisRunResult.packetHash,
        startedAt: analysisRunResult.startedAt,
        completedAt: analysisRunResult.completedAt,
        durationMs: analysisRunResult.durationMs,
        findingCount: analysisRunResult.findingCount,
        sourceCount: analysisRunResult.sourceCount,
        linkCount: analysisRunResult.linkCount,
        expiresAt: analysisRunResult.expiresAt,
      },
    })
    .from(analysisRawAttempt)
    .innerJoin(analysisRun, eq(analysisRun.id, analysisRawAttempt.analysisRunId))
    .leftJoin(analysisRunResult, eq(analysisRunResult.analysisRunId, analysisRun.id))
    .where(and(
      eq(analysisRawAttempt.analysisRunId, analysisRunId),
      gt(analysisRawAttempt.expiresAt, now),
    ))
    .limit(1);

  return rows[0];
}
