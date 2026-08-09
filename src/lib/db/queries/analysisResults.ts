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

type PreparationInput = {
  readonly packet: unknown;
  readonly checklistSignalIds: readonly number[];
};

type PersistenceInput = PreparationInput & {
  readonly runId: number;
  readonly policy?: unknown;
  readonly now?: Date;
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

type PersistedResultRow = {
  readonly resultId: number;
  readonly packetHash: string;
  readonly inserted: boolean;
};

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
  const packetHash = createHash('sha256').update(JSON.stringify(checked)).digest('hex');
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
  const packet = prepared.packet;
  const audit = packet.audit;
  const modelChain = audit.modelChain;

  const result = await db.execute<PersistedResultRow>(sql`
    WITH inserted_result AS (
      INSERT INTO analysis_run_result (
        analysis_run_id, schema_version, target_type, narrative, raw_audit,
        model_id, model_provider, model_chain, trace_id, started_at, completed_at, duration_ms,
        finding_count, source_count, link_count, packet_hash, policy_version,
        classification, expires_at
      )
      VALUES (
        ${input.runId}, ${packet.schemaVersion}, ${packet.targetType}, ${packet.narrative},
        ${JSON.stringify(audit)}::jsonb, ${audit.modelId}, ${audit.modelProvider}, ${JSON.stringify(modelChain)}::jsonb,
        ${audit.traceId}, ${new Date(input.now ?? new Date()).toISOString()},
        ${new Date((input.now ?? new Date()).getTime() + audit.durationMs).toISOString()},
        ${audit.durationMs}, ${packet.findings.length}, ${packet.sources.length}, ${packet.links.length},
        ${prepared.packetHash}, ${retention?.policy.policyVersion ?? null},
        ${retention?.classification ?? null}, ${retention?.expiresAt.toISOString() ?? null}
      )
      ON CONFLICT (analysis_run_id) DO NOTHING
      RETURNING id, packet_hash
    ),
    inserted_findings AS (
      INSERT INTO analysis_finding (
        result_id, analysis_run_id, finding_id, signal_id, signal_name, signal_category,
        buyer_role_id, status, confidence, claim, reasoning_summary, policy_version,
        classification, expires_at
      )
      SELECT
        inserted_result.id, ${input.runId}, item->>'findingId',
        (item->'identity'->>'signalId')::integer,
        (
          SELECT checklist_item->>'name'
          FROM analysis_run AS source_run
          CROSS JOIN LATERAL jsonb_array_elements(source_run.checklist_snapshot->'items') AS checklist_item
          WHERE source_run.id = ${input.runId}
            AND (checklist_item->>'signalId')::integer = (item->'identity'->>'signalId')::integer
          LIMIT 1
        ),
        (
          SELECT checklist_item->>'category'
          FROM analysis_run AS source_run
          CROSS JOIN LATERAL jsonb_array_elements(source_run.checklist_snapshot->'items') AS checklist_item
          WHERE source_run.id = ${input.runId}
            AND (checklist_item->>'signalId')::integer = (item->'identity'->>'signalId')::integer
          LIMIT 1
        ),
        NULLIF(item->'identity'->>'buyerRoleId', '')::integer,
        (item->>'status')::analysis_evidence_status,
        (item->>'confidence')::analysis_confidence,
        item->>'claim', item->>'reasoningSummary',
        ${retention?.policy.policyVersion ?? null},
        ${retention?.classification ?? null}::analysis_source_classification,
        ${retention?.expiresAt.toISOString() ?? null}
      FROM inserted_result
      CROSS JOIN LATERAL jsonb_array_elements(${JSON.stringify(packet.findings)}::jsonb) AS item
      RETURNING id, finding_id AS "findingId"
    ),
    inserted_sources AS (
      INSERT INTO analysis_source (
        result_id, source_id, canonical_url, title, retrieved_at, excerpt, content_hash,
        classification, policy_version, expires_at
      )
      SELECT
        inserted_result.id, item->>'sourceId', item->>'canonicalUrl', item->>'title',
        (item->>'retrievedAt')::timestamptz, item->>'excerpt', item->>'contentHash',
        (item->>'classification')::analysis_source_classification,
        ${retention?.policy.policyVersion ?? null},
        ${retention?.expiresAt.toISOString() ?? null}
      FROM inserted_result
      CROSS JOIN LATERAL jsonb_array_elements(${JSON.stringify(packet.sources)}::jsonb) AS item
      RETURNING id, source_id AS "sourceId"
    ),
    inserted_links AS (
      INSERT INTO analysis_finding_source (result_id, finding_id, source_id, locator, support_role)
      SELECT inserted_result.id, finding.id, source.id, item->>'locator',
        (item->>'supportRole')::analysis_support_role
      FROM inserted_result
      CROSS JOIN LATERAL jsonb_array_elements(${JSON.stringify(packet.links)}::jsonb) AS item
      JOIN inserted_findings AS finding ON finding."findingId" = item->>'findingId'
      JOIN inserted_sources AS source ON source."sourceId" = item->>'sourceId'
      RETURNING id
    ),
    inserted_retention AS (
      INSERT INTO analysis_result_retention (
        result_id, policy_version, classification, expires_at, status
      )
      SELECT inserted_result.id, ${retention?.policy.policyVersion ?? null},
        ${retention?.classification ?? null}, ${retention?.expiresAt.toISOString() ?? null}, 'retained'
      FROM inserted_result
      WHERE ${packet.targetType} = 'persona'
      RETURNING id
    )
    SELECT inserted_result.id AS "resultId", inserted_result.packet_hash AS "packetHash",
      TRUE AS inserted
    FROM inserted_result
    UNION ALL
    SELECT result.id AS "resultId", result.packet_hash AS "packetHash",
      FALSE AS inserted
    FROM analysis_run_result AS result
    WHERE result.analysis_run_id = ${input.runId}
      AND NOT EXISTS (SELECT 1 FROM inserted_result)
  `);

  const row = result.rows[0];
  if (!row) throw new Error('analysis packet persistence returned no result');
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
