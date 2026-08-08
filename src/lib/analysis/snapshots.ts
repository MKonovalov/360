import { z } from 'zod';

import {
  checklistSnapshotSchema,
  parseAnalysisSnapshot,
  phase33PolicySnapshotSchema,
  PHASE33_DEFERRED_POLICY,
  PHASE32_NOOP_POLICY,
  STANDARD_EXECUTION_BUDGET,
  subjectSnapshotSchema,
  templateSnapshotSchema,
  type AnalysisTargetType,
  type ReadonlyAnalysisSnapshot,
} from './contracts';

const buildAnalysisSnapshotsInputSchema = z
  .object({
    template: templateSnapshotSchema,
    subject: subjectSnapshotSchema,
    checklist: checklistSnapshotSchema,
    resolvedModelChain: z.unknown(),
  })
  .strict();

export type BuiltAnalysisSnapshots = Readonly<{
  templateId: number;
  templateVersionId: number;
  subjectType: AnalysisTargetType;
  subjectId: number;
  practiceAreaId: number;
  templateSnapshot: ReadonlyAnalysisSnapshot['template'];
  subjectSnapshot: ReadonlyAnalysisSnapshot['subject'];
  checklistSnapshot: ReadonlyAnalysisSnapshot['checklist'];
  executionSnapshot: ReadonlyAnalysisSnapshot['execution'];
  policySnapshot: ReadonlyAnalysisSnapshot['policy'];
}>;

export function buildAnalysisSnapshots(input: unknown): BuiltAnalysisSnapshots {
  const validatedInput = buildAnalysisSnapshotsInputSchema.parse(input);
  const snapshot = parseAnalysisSnapshot({
    schemaVersion: 1,
    template: validatedInput.template,
    subject: validatedInput.subject,
    checklist: validatedInput.checklist,
    execution: {
      schemaVersion: 1,
      effort: validatedInput.template.effort,
      resolvedModelChain: validatedInput.resolvedModelChain,
      futureBudget: STANDARD_EXECUTION_BUDGET,
      policy: PHASE32_NOOP_POLICY,
    },
    policy: PHASE32_NOOP_POLICY,
    templateVersionId: validatedInput.template.templateVersionId,
    subjectType: validatedInput.subject.type,
    subjectId: validatedInput.subject.id,
    practiceAreaId: validatedInput.checklist.practiceAreaId,
  });

  return Object.freeze({
    templateId: snapshot.template.templateId,
    templateVersionId: snapshot.templateVersionId,
    subjectType: snapshot.subjectType,
    subjectId: snapshot.subjectId,
    practiceAreaId: snapshot.practiceAreaId,
    templateSnapshot: snapshot.template,
    subjectSnapshot: snapshot.subject,
    checklistSnapshot: snapshot.checklist,
    executionSnapshot: snapshot.execution,
    policySnapshot: snapshot.policy,
  });
}

export function buildPhase33AnalysisSnapshots(
  input: unknown,
  policyDecision: unknown = PHASE33_DEFERRED_POLICY,
): BuiltAnalysisSnapshots {
  const validatedInput = buildAnalysisSnapshotsInputSchema.parse(input);
  const policy = phase33PolicySnapshotSchema.parse(policyDecision);
  const snapshot = parseAnalysisSnapshot({
    schemaVersion: 1,
    template: validatedInput.template,
    subject: validatedInput.subject,
    checklist: validatedInput.checklist,
    execution: {
      schemaVersion: 1,
      effort: validatedInput.template.effort,
      resolvedModelChain: validatedInput.resolvedModelChain,
      futureBudget: STANDARD_EXECUTION_BUDGET,
      policy,
    },
    policy,
    templateVersionId: validatedInput.template.templateVersionId,
    subjectType: validatedInput.subject.type,
    subjectId: validatedInput.subject.id,
    practiceAreaId: validatedInput.checklist.practiceAreaId,
  });

  return Object.freeze({
    templateId: snapshot.template.templateId,
    templateVersionId: snapshot.templateVersionId,
    subjectType: snapshot.subjectType,
    subjectId: snapshot.subjectId,
    practiceAreaId: snapshot.practiceAreaId,
    templateSnapshot: snapshot.template,
    subjectSnapshot: snapshot.subject,
    checklistSnapshot: snapshot.checklist,
    executionSnapshot: snapshot.execution,
    policySnapshot: snapshot.policy,
  });
}
