import { RAW_ATTEMPT_LIMITS } from './rawAttempt';

export type GroundedExecutionRawAttempt = Readonly<{
  readonly findings: readonly Readonly<Record<string, unknown>>[];
  readonly citations: readonly Readonly<Record<string, unknown>>[];
  readonly toolResults: readonly Readonly<Record<string, unknown>>[];
}>;

type RawStep = Readonly<{
  readonly toolResults?: readonly Readonly<{ readonly toolName?: string; readonly output?: unknown }>[];
}>;

type RawContextRun = Readonly<{
  readonly submittedGroundedReport?: unknown;
  readonly citations?: readonly Readonly<Record<string, unknown>>[];
  readonly steps: readonly RawStep[];
}>;

const RAW_FINDING_STATUSES = ['strong', 'weak', 'no_evidence', 'inconclusive'] as const;
const RAW_CONFIDENCES = ['low', 'medium', 'high'] as const;
const RAW_SUPPORT_ROLES = ['primary', 'corroborating'] as const;

type RawFindingStatus = (typeof RAW_FINDING_STATUSES)[number];
type RawConfidence = (typeof RAW_CONFIDENCES)[number];
type RawSupportRole = (typeof RAW_SUPPORT_ROLES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRawFindingStatus(value: unknown): value is RawFindingStatus {
  return RAW_FINDING_STATUSES.some((candidate) => candidate === value);
}

function isRawConfidence(value: unknown): value is RawConfidence {
  return RAW_CONFIDENCES.some((candidate) => candidate === value);
}

function isRawSupportRole(value: unknown): value is RawSupportRole {
  return RAW_SUPPORT_ROLES.some((candidate) => candidate === value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function extractRawFindings(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  if (!isRecord(value) || !Array.isArray(value.findings)) return [];
  return value.findings.flatMap((finding) => {
    if (!isRecord(finding)) return [];
    const findingId = nonEmptyString(finding.findingId);
    const claim = nonEmptyString(finding.claim);
    const status = finding.status;
    const confidence = finding.confidence;
    const reasoningSummary = finding.reasoningSummary;
    if (
      findingId === undefined
      || typeof finding.signalId !== 'number'
      || !Number.isInteger(finding.signalId)
      || finding.signalId <= 0
      || claim === undefined
      || !isRawFindingStatus(status)
      || !isRawConfidence(confidence)
      || (reasoningSummary !== null && reasoningSummary !== undefined && typeof reasoningSummary !== 'string')
    ) return [];
    return [{
      findingId,
      signalId: finding.signalId,
      status,
      confidence,
      claim,
      reasoningSummary: reasoningSummary ?? null,
    }];
  }).slice(0, RAW_ATTEMPT_LIMITS.findings);
}

function extractRawCitations(value: readonly Readonly<Record<string, unknown>>[]): readonly Readonly<Record<string, unknown>>[] {
  return value.flatMap((citation) => {
    const findingId = nonEmptyString(citation.findingId);
    const url = nonEmptyString(citation.url);
    const contentHash = nonEmptyString(citation.contentHash);
    const locator = nonEmptyString(citation.locator);
    if (findingId === undefined || url === undefined || contentHash === undefined || locator === undefined || !isRawSupportRole(citation.supportRole)) return [];
    return [{
      findingId,
      sourceId: nonEmptyString(citation.sourceId) ?? null,
      url,
      contentHash,
      locator,
      supportRole: citation.supportRole,
    }];
  }).slice(0, RAW_ATTEMPT_LIMITS.citations);
}

function extractRawToolResults(steps: readonly RawStep[]): readonly Readonly<Record<string, unknown>>[] {
  const results: Readonly<Record<string, unknown>>[] = [];
  for (const step of steps) {
    for (const toolResult of step.toolResults ?? []) {
      if (toolResult.toolName !== 'webSearch' || !Array.isArray(toolResult.output)) continue;
      for (const item of toolResult.output) {
        if (!isRecord(item)) continue;
        const url = nonEmptyString(item.url);
        const title = nonEmptyString(item.title);
        const excerpt = nonEmptyString(item.snippet);
        if (url === undefined || title === undefined || excerpt === undefined) continue;
        results.push({
          sourceId: nonEmptyString(item.sourceId) ?? null,
          url,
          contentHash: nonEmptyString(item.contentHash) ?? null,
          title,
          excerpt,
        });
        if (results.length >= RAW_ATTEMPT_LIMITS.toolResults) return results;
      }
    }
  }
  return results;
}

export function rawAttemptFromRun(run: RawContextRun): GroundedExecutionRawAttempt {
  return {
    findings: extractRawFindings(run.submittedGroundedReport),
    citations: extractRawCitations(run.citations ?? []),
    toolResults: extractRawToolResults(run.steps),
  };
}
