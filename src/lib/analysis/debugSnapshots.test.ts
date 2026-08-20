import { describe, expect, it } from 'vitest';

import { PHASE33_STANDARD_APPROVED_POLICY } from './contracts';
import { buildPhase33AnalysisSnapshots } from './snapshots';

const launchInput = {
  template: {
    schemaVersion: 1 as const,
    templateId: 1,
    templateVersionId: 11,
    templateKey: 'company-buying-signal-analysis',
    templateName: 'Company Buying Signal Analysis',
    targetType: 'company' as const,
    version: 1,
    resolvedInstruction: 'Assess the selected company.',
    effort: 'standard' as const,
  },
  subject: { type: 'company' as const, id: 42, displayName: 'Acme Corp' },
  checklist: {
    schemaVersion: 1 as const,
    targetType: 'company' as const,
    practiceAreaId: 9,
    practiceAreaName: 'GBS',
    items: [],
  },
  resolvedModelChain: ['phase33-test'],
};

describe('analysis debug snapshots', () => {
  it('defaults capture off and freezes an explicit server debug snapshot', () => {
    const ordinary = buildPhase33AnalysisSnapshots(launchInput, PHASE33_STANDARD_APPROVED_POLICY);
    const debug = buildPhase33AnalysisSnapshots(
      { ...launchInput, debugCaptureEnabled: true },
      PHASE33_STANDARD_APPROVED_POLICY,
    );

    expect(ordinary.executionSnapshot.debugCaptureEnabled).toBe(false);
    expect(debug.executionSnapshot.debugCaptureEnabled).toBe(true);
    expect(Object.isFrozen(debug.executionSnapshot)).toBe(true);
    expect(Reflect.set(debug.executionSnapshot, 'debugCaptureEnabled', false)).toBe(false);
  });
});
