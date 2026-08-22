import { z } from 'zod';

import {
  analysisDebugRunDiagnosticSchema,
  type DebugAnalysisRunDiagnostic,
} from '@/lib/analysis/debugDiagnostics';
import { rawAttemptArtifactSchema, type RawAttemptArtifact } from '@/lib/analysis/rawAttempt';
import { requireDebugAdminAccess } from '@/lib/auth/requireDebugAdminAccess';
import { getAnalysisRawAttemptDiagnostic } from '@/lib/db/queries/analysisRawAttemptDiagnostics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const applicationRunIdSchema = z.coerce.number().int().positive();

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

function noStoreJson(payload: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'private, no-store');
  return Response.json(payload, { ...init, headers });
}

function redactedValue(value: {
  readonly value: string | null;
  readonly sha256: string;
  readonly originalLength: number;
  readonly redaction: 'none' | 'sensitive' | 'unsafe_url' | 'persona' | 'metadata_only';
  readonly truncated: boolean;
}) {
  return {
    value: value.value,
    sha256: value.sha256,
    originalLength: value.originalLength,
    redaction: value.redaction,
    truncated: value.truncated,
  };
}

function projectFailure(
  failure: NonNullable<RawAttemptArtifact['failure']>,
): NonNullable<DebugAnalysisRunDiagnostic['failure']> {
  return {
    stage: failure.failureStage,
    errorName: failure.errorName,
    errorMessage: failure.errorMessage,
    stackExcerpt: failure.stackExcerpt === null ? null : redactedValue(failure.stackExcerpt),
    providerPayload: failure.providerPayload === null ? null : redactedValue(failure.providerPayload),
    correlation: {
      runId: failure.correlation.runId,
      traceId: failure.correlation.traceId,
      observationId: failure.correlation.observationId,
      parentObservationId: failure.correlation.parentObservationId,
    },
  };
}

function projectCitationCoverage(artifact: RawAttemptArtifact): DebugAnalysisRunDiagnostic['raw']['citationCoverage'] {
  const findingIds = new Set(artifact.findings.map((finding) => finding.findingId));
  const citedFindingIds = new Set(
    artifact.citations
      .filter((citation) => findingIds.has(citation.findingId))
      .map((citation) => citation.findingId),
  );
  const orphanedCitationFindingIds = [...new Set(
    artifact.citations
      .filter((citation) => !findingIds.has(citation.findingId))
      .map((citation) => citation.findingId),
  )];
  const mismatches = [
    ...artifact.findings
      .filter((finding) => !citedFindingIds.has(finding.findingId))
      .map((finding) => ({ kind: 'finding_without_citation' as const, findingId: finding.findingId })),
    ...orphanedCitationFindingIds.map((findingId) => ({
      kind: 'citation_without_finding' as const,
      findingId,
    })),
  ];

  return {
    findingCount: artifact.findings.length,
    citedFindingCount: citedFindingIds.size,
    citationCount: artifact.citations.length,
    mismatches,
  };
}

function projectDiagnostic(
  row: NonNullable<Awaited<ReturnType<typeof getAnalysisRawAttemptDiagnostic>>>,
): DebugAnalysisRunDiagnostic | null {
  const parsedArtifact = rawAttemptArtifactSchema.safeParse(row.artifact);
  if (!parsedArtifact.success) return null;
  const artifact = parsedArtifact.data;
  const projected = {
    applicationRunId: row.analysisRunId,
    rawAttemptId: row.rawAttemptId,
    status: row.runStatus,
    safeReason: row.safeReason,
    reason: artifact.failureReason,
    failure: artifact.failure === null ? null : projectFailure(artifact.failure),
    timestamps: {
      capturedAt: row.capturedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.runCreatedAt.toISOString(),
      startedAt: row.runStartedAt?.toISOString() ?? null,
      completedAt: row.runCompletedAt?.toISOString() ?? null,
      terminalAt: row.runTerminalAt?.toISOString() ?? null,
    },
    raw: {
      targetType: artifact.targetType,
      attempt: artifact.attempt,
      failureStage: artifact.failureStage,
      schemaVersion: artifact.schemaVersion,
      redactionVersion: artifact.redactionVersion,
      truncated: artifact.truncated,
      counts: artifact.counts,
      bytes: artifact.bytes,
      citationCoverage: projectCitationCoverage(artifact),
      findings: artifact.findings.map((finding) => ({
        findingId: finding.findingId,
        signalId: finding.signalId,
        status: finding.status,
        confidence: finding.confidence,
        claim: redactedValue(finding.claim),
      })),
      citations: artifact.citations.map((citation) => ({
        findingId: citation.findingId,
        sourceId: citation.sourceId,
        supportRole: citation.supportRole,
        url: redactedValue(citation.url),
      })),
      toolResults: artifact.toolResults.map((result) => ({
        sourceId: result.sourceId,
        url: redactedValue(result.url),
      })),
    },
    normalized: row.normalized === null ? null : {
      resultId: row.normalized.resultId,
      targetType: row.normalized.targetType,
      packetHash: row.normalized.packetHash,
      startedAt: row.normalized.startedAt.toISOString(),
      completedAt: row.normalized.completedAt.toISOString(),
      durationMs: row.normalized.durationMs,
      findingCount: row.normalized.findingCount,
      sourceCount: row.normalized.sourceCount,
      linkCount: row.normalized.linkCount,
      expiresAt: row.normalized.expiresAt?.toISOString() ?? null,
    },
  } satisfies DebugAnalysisRunDiagnostic;

  const parsedProjection = analysisDebugRunDiagnosticSchema.safeParse(projected);
  return parsedProjection.success ? parsedProjection.data : null;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  await requireDebugAdminAccess();

  const params = await context.params;
  const parsedId = applicationRunIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return noStoreJson({ error: 'invalid_input' }, { status: 400 });
  }

  const diagnostic = await getAnalysisRawAttemptDiagnostic(parsedId.data);
  if (!diagnostic) {
    return noStoreJson({ error: 'analysis_debug_not_found' }, { status: 404 });
  }

  const projected = projectDiagnostic(diagnostic);
  if (projected === null) {
    return noStoreJson({ error: 'analysis_debug_not_found' }, { status: 404 });
  }

  return noStoreJson(projected);
}
