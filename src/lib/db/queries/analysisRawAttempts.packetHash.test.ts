import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { redactFailedRawAttempt } from '@/lib/analysis/rawAttempt';
import {
  captureAndFailAnalysisRawAttempt,
  type CaptureFailedRawAttemptInput,
} from './analysisRawAttempts';

const sanitized = redactFailedRawAttempt({
  outcome: 'failed',
  targetType: 'company',
  attempt: 1,
  failureStage: 'persistence',
  failureReason: 'persistence_failed',
  modelProvider: 'anthropic',
  modelId: 'claude-test',
  findings: [],
  citations: [],
  toolResults: [],
});
if (!sanitized.ok) throw new TypeError('packet-hash fixture must sanitize');

const expectedPacketHash = 'a'.repeat(64);
const input: CaptureFailedRawAttemptInput = {
  runId: 7,
  artifact: sanitized.artifact,
  safeReason: 'execution_failed',
  actorId: 'workflow-executor',
  occurredAt: new Date('2026-08-15T12:00:00.000Z'),
  expiresAt: new Date('2026-08-29T12:00:00.000Z'),
  expectedPacketHash,
};

function normalizedObservation(packetHash: string) {
  return {
    rawAttemptId: null,
    payloadHash: null,
    runStatus: 'running',
    resultId: 31,
    packetHash,
    eventId: null,
    inserted: false,
  };
}

describe('normalized packet-hash reconciliation', () => {
  beforeEach(() => mocks.db.execute.mockReset());

  it('classifies a stored normalized result as matching only when its packet hash equals the expected hash', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({ rows: [normalizedObservation(expectedPacketHash)] });

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toEqual({
      ok: false,
      outcome: 'normalized_result_exists',
      resultId: 31,
      packetHash: expectedPacketHash,
    });
  });

  it('returns a typed conflict when the stored normalized packet hash differs from the expected hash', async () => {
    // Given
    const actualPacketHash = 'b'.repeat(64);
    mocks.db.execute.mockResolvedValueOnce({ rows: [normalizedObservation(actualPacketHash)] });

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toEqual({
      ok: false,
      outcome: 'normalized_result_conflict',
      resultId: 31,
      expectedPacketHash,
      actualPacketHash,
    });
  });
});
