import { describe, expect, it } from 'vitest';

import { ANALYSIS_RUN_STATUSES } from './contracts';
import {
  analysisPreviewInputSchema,
  analysisPreviewResponseSchema,
  analysisRunHistoryRowSchema,
  confirmedCandidateDisplayRowSchema,
} from './experienceContracts';

const packetHash = 'a'.repeat(64);

const checklist = {
  schemaVersion: 1,
  targetType: 'company' as const,
  practiceAreaId: 3,
  practiceAreaName: 'GBS',
  items: [
    {
      signalId: 9,
      status: 'active' as const,
      name: 'Cost pressure',
      category: 'Financial',
      description: 'The company is under cost pressure.',
    },
  ],
};

const candidate = {
  targetType: 'company' as const,
  subjectId: 42,
  offeringId: 77,
  offeringName: 'GBS transformation',
  analysisRunId: 3,
  resultId: 9,
  packetHash,
  findingRowId: 5,
  findingKey: 'finding-1',
  signalType: 'company' as const,
  signalId: 5001,
  signalName: 'Cost pressure',
  evidenceStatus: 'strong' as const,
  supportRole: 'primary' as const,
  sourceRowId: 12,
  sourceKey: 'source-1',
  canonicalUrl: 'https://example.com/report',
  sourceTitle: 'Annual report',
  retrievedAt: '2026-08-08T00:00:00.000Z',
  excerpt: 'Bounded evidence excerpt.',
  displayStatus: 'active' as const,
  linkIdentity: {
    signalType: 'company' as const,
    signalId: 5001,
    offeringId: 77,
    status: 'active' as const,
  },
};

describe('Phase 35 experience contracts', () => {
  it('accepts only a subject and practice-area identifier as preview input', () => {
    expect(
      analysisPreviewInputSchema.parse({
        subject: { type: 'company', id: 42 },
        practiceAreaId: 3,
      }),
    ).toEqual({ subject: { type: 'company', id: 42 }, practiceAreaId: 3 });

    for (const input of [
      { subject: { type: 'company', id: 0 }, practiceAreaId: 3 },
      { subject: { type: 'company', id: -1 }, practiceAreaId: 3 },
      { subject: { type: 'company', id: 42 }, practiceAreaId: 0 },
      { subject: { type: 'account', id: 42 }, practiceAreaId: 3 },
      { subject: { type: 'company', id: 42 }, practiceAreaId: 3, instruction: 'forged' },
      { subject: { type: 'company', id: 42 }, practiceAreaId: 3, checklist: [] },
      { subject: { type: 'company', id: 42 }, practiceAreaId: 3, actorId: 'forged' },
      { subject: { type: 'company', id: 42 }, practiceAreaId: 3, model: 'forged' },
      { subject: { type: 'company', id: 42 }, practiceAreaId: 3, decision: 'confirmed' },
    ]) {
      expect(() => analysisPreviewInputSchema.parse(input)).toThrow();
    }
  });

  it('requires a complete server-resolved preview for each target type', () => {
    const companyPreview = {
      subject: { type: 'company' as const, id: 42, displayName: 'Acme' },
      template: {
        templateId: 1,
        templateVersionId: 11,
        key: 'company-buying-signal-analysis',
        name: 'Company Buying Signal Analysis',
        targetType: 'company' as const,
        version: 1,
      },
      instruction: 'Assess buying signals.',
      practiceArea: { id: 3, name: 'GBS', shortCode: 'GBS' },
      checklist,
      effort: 'standard' as const,
    };

    expect(analysisPreviewResponseSchema.parse(companyPreview)).toEqual(companyPreview);
    expect(
      analysisPreviewResponseSchema.parse({
        ...companyPreview,
        subject: { type: 'persona', id: 42, displayName: 'Alex' },
        template: { ...companyPreview.template, targetType: 'persona' },
        checklist: { ...checklist, targetType: 'persona' },
      }),
    ).toMatchObject({ subject: { type: 'persona', id: 42 } });
    expect(() =>
      analysisPreviewResponseSchema.parse({
        ...companyPreview,
        template: { ...companyPreview.template, targetType: 'persona' },
      }),
    ).toThrow();
  });

  it('accepts every lifecycle status without making terminal status assumptions', () => {
    const base = {
      runId: 7,
      targetType: 'company' as const,
      subjectId: 42,
      subjectDisplayName: 'Acme',
      templateVersionId: 11,
      templateName: 'Company Buying Signal Analysis',
      practiceAreaId: 3,
      practiceAreaName: 'GBS',
      safeReason: null,
      createdAt: '2026-08-08T00:00:00.000Z',
      startedAt: null,
      completedAt: null,
      terminalAt: null,
      updatedAt: '2026-08-08T00:00:00.000Z',
      review: null,
      packetProjection: null,
    };

    for (const status of ANALYSIS_RUN_STATUSES) {
      expect(
        analysisRunHistoryRowSchema.parse({ ...base, status }),
      ).toMatchObject({ status, targetType: 'company', subjectId: 42 });
    }
  });

  it('keeps equal Company and Persona IDs distinct in history and candidates', () => {
    const baseHistory = {
      runId: 7,
      status: 'confirmed' as const,
      subjectId: 42,
      subjectDisplayName: 'Same numeric ID',
      templateVersionId: 11,
      templateName: 'Buying Signal Analysis',
      practiceAreaId: 3,
      practiceAreaName: 'GBS',
      safeReason: null,
      createdAt: '2026-08-08T00:00:00.000Z',
      startedAt: null,
      completedAt: '2026-08-08T00:00:00.000Z',
      terminalAt: '2026-08-08T00:00:00.000Z',
      updatedAt: '2026-08-08T00:00:00.000Z',
      review: { decision: 'confirmed' as const, decidedBy: 'user_1', decidedAt: '2026-08-08T00:00:00.000Z' },
      packetProjection: { resultId: 9, packetHash },
    };

    const companyHistory = analysisRunHistoryRowSchema.parse({ ...baseHistory, targetType: 'company' });
    const personaHistory = analysisRunHistoryRowSchema.parse({ ...baseHistory, targetType: 'persona' });
    expect(companyHistory.targetType).not.toBe(personaHistory.targetType);
    expect(companyHistory.subjectId).toBe(personaHistory.subjectId);

    const companyCandidate = confirmedCandidateDisplayRowSchema.parse(candidate);
    const personaCandidate = confirmedCandidateDisplayRowSchema.parse({
      ...candidate,
      targetType: 'persona',
      signalType: 'persona',
      linkIdentity: { ...candidate.linkIdentity, signalType: 'persona' },
    });
    expect(companyCandidate.targetType).not.toBe(personaCandidate.targetType);
    expect(companyCandidate.subjectId).toBe(personaCandidate.subjectId);
  });

  it('restricts candidate display evidence to strong and weak source-backed rows', () => {
    expect(confirmedCandidateDisplayRowSchema.parse(candidate).offeringName).toBe('GBS transformation');
    expect(() => confirmedCandidateDisplayRowSchema.parse({ ...candidate, evidenceStatus: 'no_evidence' })).toThrow();
    expect(() => confirmedCandidateDisplayRowSchema.parse({ ...candidate, evidenceStatus: 'inconclusive' })).toThrow();
    expect(() => confirmedCandidateDisplayRowSchema.parse({ ...candidate, offeringName: undefined })).toThrow();
    expect(() =>
      confirmedCandidateDisplayRowSchema.parse({
        ...candidate,
        linkIdentity: { ...candidate.linkIdentity, signalId: 9999 },
      }),
    ).toThrow();
  });
});
