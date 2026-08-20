import { createHash } from 'node:crypto';

import { sql } from 'drizzle-orm';

import {
  canonicalizeSourceUrl,
  groundedPacketSchema,
  validateGroundedPacket,
  type CanonicalSource,
  type GroundedPacket,
} from '@/lib/analysis/groundedContracts';
import { resolvePersonaPolicy, type ApprovedPersonaPolicy } from '@/lib/analysis/personaPolicy';

import { db } from '../index';
import { executeAnalysisResultPersistence } from './analysisResultPersistence';

type PreparationInput = {
  readonly packet: unknown;
  readonly checklistSignalIds: readonly number[];
  readonly customOutput?: Readonly<Record<string, unknown>> | null;
};

type PersistenceInput = PreparationInput & {
  readonly runId: number;
  readonly policy?: unknown;
  readonly now?: Date;
  // Normalized custom-output transport (null for fixed runs; optional so legacy
  // callers compile); persisted only at raw_audit.customOutput, never
  // authoritative for packet data.
  readonly customOutput?: Readonly<Record<string, unknown>> | null;
};

type RetentionMetadata = {
  readonly policy: ApprovedPersonaPolicy;
  readonly classification: 'public_biz' | 'personal_data' | 'restricted';
  readonly expiresAt: Date;
};

export type PreparedAnalysisPacket = {
  readonly packet: GroundedPacket;
  readonly packetHash: string;
  readonly retention: RetentionMetadata | undefined;
};

export type PersistAnalysisPacketResult = {
  readonly ok: true;
  readonly resultId: number;
  readonly packetHash: string;
  readonly replayed: boolean;
};

export class AnalysisPacketConflictError extends Error {
  readonly code = 'analysis_packet_hash_conflict' as const;

  constructor(readonly runId: number) {
    super(`analysis packet hash conflict for run ${runId}`);
    this.name = 'AnalysisPacketConflictError';
  }
}

export class AnalysisRunOutcomeConflictError extends Error {
  readonly code = 'analysis_run_outcome_conflict' as const;

  constructor(readonly runId: number) {
    super(`analysis run outcome conflict for run ${runId}`);
    this.name = 'AnalysisRunOutcomeConflictError';
  }
}

function stripRecitedFindingIdentity(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || !('findings' in input) || !Array.isArray(input.findings)) {
    return input;
  }

  return {
    ...input,
    findings: input.findings.map((finding) => {
      if (
        typeof finding !== 'object'
        || finding === null
        || !('identity' in finding)
        || typeof finding.identity !== 'object'
        || finding.identity === null
      ) {
        return finding;
      }
      return {
        ...finding,
        identity: {
          signalId: 'signalId' in finding.identity ? finding.identity.signalId : undefined,
          buyerRoleId: 'buyerRoleId' in finding.identity ? finding.identity.buyerRoleId : null,
        },
      };
    }),
  };
}

export function prepareAnalysisPacket(input: PreparationInput): PreparedAnalysisPacket {
  const validated = validateGroundedPacket(stripRecitedFindingIdentity(input.packet), input.checklistSignalIds);
  const sourcesByCanonicalUrl = new Map<string, CanonicalSource>();
  const sourceIdMap = new Map<string, string>();

  for (const source of validated.sources) {
    const canonicalUrl = canonicalizeSourceUrl(source.canonicalUrl);
    const firstSource = sourcesByCanonicalUrl.get(canonicalUrl);
    if (firstSource) {
      sourceIdMap.set(source.sourceId, firstSource.sourceId);
      continue;
    }
    const normalized = { ...source, canonicalUrl };
    sourcesByCanonicalUrl.set(canonicalUrl, normalized);
    sourceIdMap.set(source.sourceId, source.sourceId);
  }

  const packet = groundedPacketSchema.parse({
    ...validated,
    sources: [...sourcesByCanonicalUrl.values()],
    links: validated.links.map((link) => ({
      ...link,
      sourceId: sourceIdMap.get(link.sourceId) ?? link.sourceId,
    })),
  });
  const checked = validateGroundedPacket(packet, input.checklistSignalIds);
  // Packet-hash identity covers the canonical packet plus the bounded custom
  // output, matching normalizeAnalysisPacketWithCustomOutput; absent/null
  // custom output collapses to the fixed-run hash so replay with changed
  // custom output raises the existing packet-hash conflict.
  const packetHash = createHash('sha256')
    .update(JSON.stringify({ packet: checked, customOutput: input.customOutput ?? undefined }))
    .digest('hex');
  return { packet: checked, packetHash, retention: undefined };
}

function retentionForPacket(input: PersistenceInput, packet: GroundedPacket): RetentionMetadata | undefined {
  if (packet.targetType !== 'persona') return undefined;
  const policyResult = resolvePersonaPolicy(input.policy);
  if (!policyResult.ok) throw new Error(policyResult.reason);
  const retention = policyResult.policy.retention;
  if (!retention) throw new Error('persona_policy_unavailable');
  const now = input.now ?? new Date();
  return {
    policy: policyResult.policy,
    classification: retention.classification,
    expiresAt: new Date(now.getTime() + retention.durationSeconds * 1_000),
  };
}

export async function persistAnalysisPacket(input: PersistenceInput): Promise<PersistAnalysisPacketResult> {
  const prepared = prepareAnalysisPacket(input);
  const retention = retentionForPacket(input, prepared.packet);
  const row = await executeAnalysisResultPersistence({
    runId: input.runId,
    packet: prepared.packet,
    packetHash: prepared.packetHash,
    retention: retention === undefined
      ? undefined
      : {
          policyVersion: retention.policy.policyVersion,
          classification: retention.classification,
          expiresAt: retention.expiresAt,
        },
    ...(input.customOutput === undefined ? {} : { customOutput: input.customOutput }),
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  if (!row) throw new AnalysisRunOutcomeConflictError(input.runId);
  if (!row.inserted && row.packetHash !== prepared.packetHash) {
    throw new AnalysisPacketConflictError(input.runId);
  }
  return { ok: true, resultId: row.resultId, packetHash: row.packetHash, replayed: !row.inserted };
}

export type AnalysisPacketRead = {
  readonly result: Readonly<Record<string, unknown>>;
  readonly findings: readonly Readonly<Record<string, unknown>>[];
  readonly sources: readonly Readonly<Record<string, unknown>>[];
  readonly links: readonly Readonly<Record<string, unknown>>[];
};

export async function getAnalysisPacket(runId: number, now = new Date()): Promise<AnalysisPacketRead | undefined> {
  const result = await db.execute<Readonly<Record<string, unknown>>>(sql`
    SELECT result.*
    FROM analysis_run_result AS result
    WHERE result.analysis_run_id = ${runId}
      AND (
        result.target_type <> 'persona'
        OR EXISTS (
          SELECT 1 FROM analysis_result_retention AS retention
          WHERE retention.result_id = result.id
            AND retention.status = 'retained'
            AND retention.expires_at > ${now.toISOString()}
        )
      )
  `);
  const header = result.rows[0];
  if (!header) return undefined;
  const resultId = header.id;
  const findings = await db.execute<Readonly<Record<string, unknown>>>(sql`
    SELECT * FROM analysis_finding WHERE result_id = ${resultId} ORDER BY id
  `);
  const sources = await db.execute<Readonly<Record<string, unknown>>>(sql`
    SELECT * FROM analysis_source WHERE result_id = ${resultId} ORDER BY id
  `);
  const links = await db.execute<Readonly<Record<string, unknown>>>(sql`
    SELECT * FROM analysis_finding_source WHERE result_id = ${resultId} ORDER BY id
  `);
  return { result: header, findings: findings.rows, sources: sources.rows, links: links.rows };
}

export async function enforcePersonaArtifactRetention(now = new Date()): Promise<readonly number[]> {
  const result = await db.execute<{ readonly resultId: number }>(sql`
    UPDATE analysis_result_retention AS retention
    SET status = 'tombstoned', tombstoned_at = ${now.toISOString()}, tombstone_reason = 'expired'
    FROM analysis_run_result AS result
    WHERE retention.result_id = result.id
      AND result.target_type = 'persona'
      AND retention.status = 'retained'
      AND retention.expires_at <= ${now.toISOString()}
    RETURNING retention.result_id AS "resultId"
  `);
  return result.rows.map((row) => row.resultId);
}
