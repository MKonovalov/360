import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  AnalysisPacketConflictError,
  persistAnalysisPacket,
  prepareAnalysisPacket,
} from './analysisResults';

const source = {
  sourceId: 'source-a',
  canonicalUrl: 'https://example.com/news/',
  title: 'Example announcement',
  retrievedAt: '2026-08-07T12:00:00.000Z',
  excerpt: 'The company announced a transformation program.',
  contentHash: 'a'.repeat(64),
  classification: 'public_biz' as const,
};

const packet = {
  schemaVersion: 1 as const,
  targetType: 'company' as const,
  narrative: 'The company has announced a transformation program.',
  findings: [
    {
      findingId: 'finding-1',
      identity: {
        signalId: 11,
        signalName: 'Transformation announcement',
        signalCategory: 'buying_signal',
        buyerRoleId: null,
      },
      status: 'strong' as const,
      confidence: 'high' as const,
      claim: 'A transformation program was announced.',
      reasoningSummary: 'The announcement is explicit.',
    },
  ],
  sources: [source],
  links: [
    {
      findingId: 'finding-1',
      sourceId: 'source-a',
      locator: 'announcement paragraph',
      supportRole: 'primary' as const,
    },
  ],
  audit: {
    attempt: 1,
    modelId: 'model-a',
    toolCallCount: 1,
    sourceCount: 1,
    findingCount: 1,
    durationMs: 1200,
    traceId: 'trace-a',
    failureReason: null,
  },
};

const approvedPersonaPolicy = {
  schemaVersion: 1,
  mode: 'phase33_grounded' as const,
  executionEnabled: true as const,
  personaExecutionEnabled: true,
  policyVersion: 'persona-policy-1',
  limits: {
    maxAttempts: 1,
    maxToolCalls: 1,
    maxExecutionSeconds: 60,
    maxSources: 10,
    maxSourceBytes: 100_000,
    maxExcerptBytes: 2_000,
    maxSpendUsd: 0,
  },
  personaPolicy: {
    version: 'persona-policy-1',
    allowlistedFields: ['id', 'displayName'],
    redactionRules: ['remove direct identifiers'],
    classifications: ['public_biz'] as const,
  },
  retention: { durationSeconds: 3_600, classification: 'public_biz' as const },
  evidenceStorage: 'bounded_excerpt_and_content_hash' as const,
  auditVisibility: 'allowlisted_safe_metadata_only' as const,
  failureReason: null,
  networkAccess: true as const,
  writesAllowed: false as const,
  effectiveMaxAttempts: 1,
  effectiveMaxToolCalls: 1,
  effectiveMaxExecutionSeconds: 60,
  effectiveMaxSpendUsd: 0,
};

describe('analysis result persistence boundary', () => {
  it('collapses canonical duplicate sources before persistence', () => {
    const prepared = prepareAnalysisPacket({
      packet: {
        ...packet,
        sources: [source, { ...source, sourceId: 'source-b', canonicalUrl: 'https://EXAMPLE.com/news' }],
      },
      checklistSignalIds: [11],
    });

    expect(prepared.packet.sources).toHaveLength(1);
    expect(prepared.packet.sources[0]?.sourceId).toBe('source-a');
  });

  it('rejects a duplicate finding-source pair before any database call', () => {
    expect(() =>
      prepareAnalysisPacket({
        packet: {
          ...packet,
          links: [packet.links[0], packet.links[0]],
        },
        checklistSignalIds: [11],
      })
    ).toThrow('duplicate_source_link');
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('persists through one statement and returns the authoritative result row', async () => {
    mocks.db.execute.mockResolvedValueOnce({
      rows: [{ resultId: 31, packetHash: 'b'.repeat(64), inserted: true }],
    });

    const result = await persistAnalysisPacket({ runId: 7, packet, checklistSignalIds: [11] });

    expect(result).toEqual({ ok: true, resultId: 31, packetHash: 'b'.repeat(64), replayed: false });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
    const queryText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(queryText).not.toContain('transaction');
  });

  it('rejects a conflicting replay hash without exposing an update path', async () => {
    mocks.db.execute.mockResolvedValueOnce({
      rows: [{ resultId: 31, packetHash: 'c'.repeat(64), inserted: false }],
    });

    await expect(
      persistAnalysisPacket({ runId: 7, packet, checklistSignalIds: [11] })
    ).rejects.toBeInstanceOf(AnalysisPacketConflictError);
  });

  it('fails closed for Persona persistence without an approved retention policy', async () => {
    const personaPacket = { ...packet, targetType: 'persona' as const };

    await expect(
      persistAnalysisPacket({ runId: 8, packet: personaPacket, checklistSignalIds: [11] })
    ).rejects.toThrow('persona_policy_unavailable');
    expect(mocks.db.execute).toHaveBeenCalledTimes(0);
  });

  it('derives approved Persona expiry metadata without retaining raw Persona fields', async () => {
    mocks.db.execute.mockResolvedValueOnce({
      rows: [{ resultId: 32, packetHash: 'd'.repeat(64), inserted: true }],
    });

    const personaPacket = { ...packet, targetType: 'persona' as const };
    await persistAnalysisPacket({
      runId: 9,
      packet: personaPacket,
      checklistSignalIds: [11],
      policy: approvedPersonaPolicy,
      now: new Date('2026-08-07T12:00:00.000Z'),
    });

    const queryText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(queryText).toContain('persona-policy-1');
    expect(queryText).toContain('2026-08-07T13:00:00.000Z');
    expect(queryText).not.toContain('email');
  });
});
