import { z } from 'zod';

import {
  analysisEffortSchema,
  analysisRunStatusSchema,
  analysisSubjectSchema,
  analysisTargetTypeSchema,
  checklistSnapshotSchema,
  subjectSnapshotSchema,
  type AnalysisTargetType,
} from './contracts';
import {
  confirmedCandidateEvidenceSchema,
  wholeRunDecisionSchema,
} from './reviewContracts';

const positiveIdSchema = z.number().int().positive();
const safeNameSchema = z.string().trim().min(1).max(500);
const serverTimestampSchema = z.string().datetime({ offset: true });
const safeReasonSchema = z.string().trim().min(1).max(500);
const packetHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const previewTemplateSchema = z
  .object({
    templateId: positiveIdSchema,
    templateVersionId: positiveIdSchema,
    key: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: safeNameSchema,
    targetType: analysisTargetTypeSchema,
    version: positiveIdSchema,
  })
  .strict();

const previewPracticeAreaSchema = z
  .object({
    id: positiveIdSchema,
    name: safeNameSchema,
    shortCode: z.string().trim().min(1).max(120),
  })
  .strict();

export const analysisPreviewInputSchema = z
  .object({
    subject: analysisSubjectSchema,
    practiceAreaId: positiveIdSchema,
  })
  .strict();
export type AnalysisPreviewInput = z.infer<typeof analysisPreviewInputSchema>;

export const analysisPreviewResponseSchema = z
  .object({
    subject: subjectSnapshotSchema,
    template: previewTemplateSchema,
    instruction: z.string().trim().min(1).max(20_000),
    practiceArea: previewPracticeAreaSchema,
    checklist: checklistSnapshotSchema,
    effort: analysisEffortSchema,
  })
  .strict()
  .superRefine((preview, context) => {
    if (preview.template.targetType !== preview.subject.type) {
      context.addIssue({ code: 'custom', path: ['template', 'targetType'], message: 'subject_mismatch' });
    }
    if (preview.checklist.targetType !== preview.subject.type) {
      context.addIssue({ code: 'custom', path: ['checklist', 'targetType'], message: 'subject_mismatch' });
    }
    if (preview.checklist.practiceAreaId !== preview.practiceArea.id) {
      context.addIssue({ code: 'custom', path: ['checklist', 'practiceAreaId'], message: 'practice_area_mismatch' });
    }
  });
export type AnalysisPreviewResponse = z.infer<typeof analysisPreviewResponseSchema>;

const reviewProjectionSchema = z
  .object({
    decision: wholeRunDecisionSchema,
    decidedBy: z.string().trim().min(1).max(200),
    decidedAt: serverTimestampSchema,
  })
  .strict();

const packetProjectionSchema = z
  .object({
    resultId: positiveIdSchema,
    packetHash: packetHashSchema,
  })
  .strict();

export const analysisRunHistoryRowSchema = z
  .object({
    runId: positiveIdSchema,
    status: analysisRunStatusSchema,
    targetType: analysisTargetTypeSchema,
    subjectId: positiveIdSchema,
    subjectDisplayName: safeNameSchema,
    templateVersionId: positiveIdSchema,
    templateName: safeNameSchema,
    practiceAreaId: positiveIdSchema,
    practiceAreaName: safeNameSchema,
    safeReason: safeReasonSchema.nullable(),
    createdAt: serverTimestampSchema,
    startedAt: serverTimestampSchema.nullable(),
    completedAt: serverTimestampSchema.nullable(),
    terminalAt: serverTimestampSchema.nullable(),
    updatedAt: serverTimestampSchema,
    review: reviewProjectionSchema.nullable(),
    packetProjection: packetProjectionSchema.nullable(),
  })
  .strict();
export type AnalysisRunHistoryRow = z.infer<typeof analysisRunHistoryRowSchema>;

export const confirmedCandidateDisplayRowSchema = confirmedCandidateEvidenceSchema
  .extend({ offeringName: safeNameSchema })
  .strict();
export type ConfirmedCandidateDisplayRow = z.infer<typeof confirmedCandidateDisplayRowSchema>;

export interface SubjectScope {
  readonly targetType: AnalysisTargetType;
  readonly subjectId: number;
}
