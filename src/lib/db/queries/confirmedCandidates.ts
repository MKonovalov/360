import { sql } from 'drizzle-orm';

import type { ConfirmedCandidateEvidence } from '@/lib/analysis/reviewContracts';

import { db } from '../index';

// D-34-04: a packet is a candidate source only while it is visible. Company
// packets are always visible; persona packets must carry an unexpired retained
// artifact (the exact retention predicate reproduced from getAnalysisPacket,
// referenced as `result` — every call site aliases analysis_run_result that way).
function packetVisibilitySql(nowIso: string) {
  return sql`
    (result.target_type <> 'persona'
     OR EXISTS (
       SELECT 1 FROM analysis_result_retention AS retention
       WHERE retention.result_id = result.id
         AND retention.status = 'retained'
         AND retention.expires_at > ${nowIso}
     ))
  `;
}

type CandidateEvidenceRow = {
  readonly targetType: string;
  readonly subjectId: number;
  readonly offeringId: number;
  readonly analysisRunId: number;
  readonly resultId: number;
  readonly packetHash: string;
  readonly findingRowId: number;
  readonly findingKey: string;
  readonly signalType: string;
  readonly signalId: number;
  readonly signalName: string;
  readonly evidenceStatus: string;
  readonly supportRole: string;
  readonly sourceRowId: number;
  readonly sourceKey: string;
  readonly canonicalUrl: string;
  readonly sourceTitle: string;
  readonly retrievedAt: string;
  readonly excerpt: string;
  readonly displayStatus: string;
  readonly linkSignalType: string;
  readonly linkSignalId: number;
  readonly linkOfferingId: number;
  readonly linkStatus: string;
};

// D-34-03/D-34-04/REV-05: confirmed-only candidate projection. Only runs whose
// whole-run review decision was confirmed (analysis_run.status = 'confirmed'
// AND its immutable analysis_run_review row carries decision = 'confirmed')
// reach the projection. Evidence is restricted to strong/weak findings with at
// least one persisted finding-source link, joined to the offering catalogue
// through the existing polymorphic signal_offering_link on BOTH the signal
// discriminator and the finding's snapshotted signal id — never resolved by
// current signal name/category, never joined on numeric signal id alone. The
// link identity is the historical provenance fact; offering.status is the
// active-by-default display status. Read-only SELECT: candidate reads never
// write a row. Duplicate provenance (multiple sources per finding) survives as
// separate deterministic evidence rows; consumers may normalize or collapse.
export async function listConfirmedCandidateOfferings(
  options: { readonly now?: Date } = {},
): Promise<ConfirmedCandidateEvidence[]> {
  const nowIso = (options.now ?? new Date()).toISOString();

  const result = await db.execute<CandidateEvidenceRow>(sql`
    SELECT
      run.subject_type AS "targetType",
      run.subject_id AS "subjectId",
      offering.id AS "offeringId",
      run.id AS "analysisRunId",
      result.id AS "resultId",
      result.packet_hash AS "packetHash",
      finding.id AS "findingRowId",
      finding.finding_id AS "findingKey",
      link.signal_type::text AS "signalType",
      finding.signal_id AS "signalId",
      finding.signal_name AS "signalName",
      finding.status AS "evidenceStatus",
      finding_source.support_role AS "supportRole",
      source.id AS "sourceRowId",
      source.source_id AS "sourceKey",
      source.canonical_url AS "canonicalUrl",
      source.title AS "sourceTitle",
      to_char(source.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "retrievedAt",
      source.excerpt AS "excerpt",
      offering.status AS "displayStatus",
      link.signal_type::text AS "linkSignalType",
      link.signal_id AS "linkSignalId",
      link.offering_id AS "linkOfferingId",
      offering.status AS "linkStatus"
    FROM analysis_run AS run
    JOIN analysis_run_review AS review
      ON review.analysis_run_id = run.id
     AND review.decision = 'confirmed'
    JOIN analysis_run_result AS result ON result.analysis_run_id = run.id
    JOIN analysis_finding AS finding ON finding.result_id = result.id
    JOIN analysis_finding_source AS finding_source
      ON finding_source.finding_id = finding.id
    JOIN analysis_source AS source ON source.id = finding_source.source_id
    -- D-34-04: polymorphic discriminator + snapshotted signal id. signal_type
    -- is record_type and subject_type is analysis_target_type — two different
    -- PG enum types, so both sides cast to text before comparison.
    JOIN signal_offering_link AS link
      ON link.signal_type::text = run.subject_type::text
     AND link.signal_id = finding.signal_id
    JOIN offering ON offering.id = link.offering_id
    WHERE run.status = 'confirmed'
      AND finding.status IN ('strong', 'weak')
      AND ${packetVisibilitySql(nowIso)}
    ORDER BY run.id, finding.id, source.id
  `);

  return result.rows.map((row) => ({
    targetType: row.targetType as ConfirmedCandidateEvidence['targetType'],
    subjectId: Number(row.subjectId),
    offeringId: Number(row.offeringId),
    analysisRunId: Number(row.analysisRunId),
    resultId: Number(row.resultId),
    packetHash: row.packetHash,
    findingRowId: Number(row.findingRowId),
    findingKey: row.findingKey,
    signalType: row.signalType as ConfirmedCandidateEvidence['signalType'],
    signalId: Number(row.signalId),
    signalName: row.signalName,
    evidenceStatus: row.evidenceStatus as ConfirmedCandidateEvidence['evidenceStatus'],
    supportRole: row.supportRole as ConfirmedCandidateEvidence['supportRole'],
    sourceRowId: Number(row.sourceRowId),
    sourceKey: row.sourceKey,
    canonicalUrl: row.canonicalUrl,
    sourceTitle: row.sourceTitle,
    retrievedAt: new Date(row.retrievedAt).toISOString(),
    excerpt: row.excerpt,
    displayStatus: row.displayStatus as ConfirmedCandidateEvidence['displayStatus'],
    linkIdentity: {
      signalType: row.linkSignalType as ConfirmedCandidateEvidence['linkIdentity']['signalType'],
      signalId: Number(row.linkSignalId),
      offeringId: Number(row.linkOfferingId),
      status: row.linkStatus as ConfirmedCandidateEvidence['linkIdentity']['status'],
    },
  }));
}
