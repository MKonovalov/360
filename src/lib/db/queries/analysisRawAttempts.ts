import 'server-only';

import { createHash } from 'node:crypto';

import type { RawAttemptArtifact } from '@/lib/analysis/rawAttempt';
import type { AnalysisRunStatus, SafeOutcomeReason } from '@/lib/analysis/contracts';
import {
  executeCaptureStatement,
  readCaptureObservation,
  type CaptureObservation,
} from './analysisRawAttemptPersistence';

export { deleteExpiredAnalysisRawAttemptsBatch } from './analysisRawAttemptPersistence';

export type CaptureFailedRawAttemptInput = {
  readonly runId: number;
  readonly artifact: RawAttemptArtifact;
  readonly safeReason: SafeOutcomeReason;
  readonly actorId: string;
  readonly occurredAt: Date;
  readonly expiresAt: Date;
  readonly expectedPacketHash?: string;
};

export type CaptureFailedRawAttemptResult =
  | {
      readonly ok: true;
      readonly outcome: 'captured' | 'replayed';
      readonly rawAttemptId: number;
      readonly eventId: number;
      readonly payloadHash: string;
      readonly reconciled: boolean;
    }
  | {
      readonly ok: false;
      readonly outcome: 'normalized_result_exists';
      readonly resultId: number;
      readonly packetHash: string;
    }
  | {
      readonly ok: false;
      readonly outcome: 'normalized_result_conflict';
      readonly resultId: number;
      readonly expectedPacketHash: string;
      readonly actualPacketHash: string;
    }
  | {
      readonly ok: false;
      readonly outcome: 'status_conflict';
      readonly runStatus: AnalysisRunStatus | null;
    }
  | {
      readonly ok: false;
      readonly outcome: 'database_unavailable';
      readonly error: AnalysisRawAttemptCaptureUnavailableError;
    };

export class AnalysisRawAttemptPayloadConflictError extends Error {
  readonly name = 'AnalysisRawAttemptPayloadConflictError';

  constructor(
    readonly runId: number,
    readonly expectedPayloadHash: string,
    readonly actualPayloadHash: string,
  ) {
    super(`raw analysis attempt payload hash conflict for run ${runId}`);
  }
}

export class AnalysisRawAttemptCaptureUnavailableError extends Error {
  readonly name = 'AnalysisRawAttemptCaptureUnavailableError';

  constructor(
    readonly runId: number,
    readonly captureCause: unknown,
    readonly reconciliationCause?: unknown,
  ) {
    super(`raw analysis attempt capture unavailable for run ${runId}`, {
      cause: reconciliationCause ?? captureCause,
    });
  }
}

export async function captureAndFailAnalysisRawAttempt(
  input: CaptureFailedRawAttemptInput,
): Promise<CaptureFailedRawAttemptResult> {
  const payloadHash = createHash('sha256').update(JSON.stringify(input.artifact)).digest('hex');
  let observation: CaptureObservation;
  try {
    observation = await executeCaptureStatement(input, payloadHash);
  } catch (captureCause: unknown) {
    return reconcileAfterCaptureError(input, payloadHash, captureCause);
  }

  if (
    observation.rawAttemptId === null
    && observation.resultId === null
    && observation.runStatus === 'running'
  ) {
    try {
      const reconciled = await readCaptureObservation(input);
      return classifyObservation(input, payloadHash, reconciled, true);
    } catch (reconciliationCause: unknown) {
      return {
        ok: false,
        outcome: 'database_unavailable',
        error: new AnalysisRawAttemptCaptureUnavailableError(input.runId, reconciliationCause),
      };
    }
  }
  return classifyObservation(input, payloadHash, observation, false);
}

async function reconcileAfterCaptureError(
  input: CaptureFailedRawAttemptInput,
  payloadHash: string,
  captureCause: unknown,
): Promise<CaptureFailedRawAttemptResult> {
  let observation: CaptureObservation;
  try {
    observation = await readCaptureObservation(input);
  } catch (reconciliationCause: unknown) {
    return {
      ok: false,
      outcome: 'database_unavailable',
      error: new AnalysisRawAttemptCaptureUnavailableError(
        input.runId,
        captureCause,
        reconciliationCause,
      ),
    };
  }
  if (
    observation.rawAttemptId === null
    && observation.resultId === null
    && observation.runStatus === 'running'
  ) {
    return {
      ok: false,
      outcome: 'database_unavailable',
      error: new AnalysisRawAttemptCaptureUnavailableError(input.runId, captureCause),
    };
  }
  return classifyObservation(input, payloadHash, observation, true);
}

function classifyObservation(
  input: CaptureFailedRawAttemptInput,
  expectedPayloadHash: string,
  observation: CaptureObservation,
  reconciled: boolean,
): CaptureFailedRawAttemptResult {
  if (observation.resultId !== null && observation.packetHash !== null) {
    if (
      input.expectedPacketHash !== undefined
      && observation.packetHash !== input.expectedPacketHash
    ) {
      return {
        ok: false,
        outcome: 'normalized_result_conflict',
        resultId: observation.resultId,
        expectedPacketHash: input.expectedPacketHash,
        actualPacketHash: observation.packetHash,
      };
    }
    return {
      ok: false,
      outcome: 'normalized_result_exists',
      resultId: observation.resultId,
      packetHash: observation.packetHash,
    };
  }
  if (observation.rawAttemptId === null || observation.payloadHash === null) {
    return { ok: false, outcome: 'status_conflict', runStatus: observation.runStatus };
  }
  if (observation.payloadHash !== expectedPayloadHash) {
    throw new AnalysisRawAttemptPayloadConflictError(
      input.runId,
      expectedPayloadHash,
      observation.payloadHash,
    );
  }
  if (observation.runStatus !== 'failed' || observation.eventId === null) {
    return { ok: false, outcome: 'status_conflict', runStatus: observation.runStatus };
  }
  return {
    ok: true,
    outcome: observation.inserted ? 'captured' : 'replayed',
    rawAttemptId: observation.rawAttemptId,
    eventId: observation.eventId,
    payloadHash: observation.payloadHash,
    reconciled,
  };
}
