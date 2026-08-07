import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  confirmedCandidateEvidenceSchema,
  isEligibleCandidateEvidence,
  normalizeCandidateEvidence,
} from '@/lib/analysis/reviewContracts';
import { listConfirmedCandidateOfferings } from './confirmedCandidates';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  if ('queryChunks' in record && Array.isArray(record.queryChunks)) {
    return record.queryChunks.map(flattenSql).join('');
  }
  if ('brand' in record || 'value' in record) return String(record.value);
  return '';
}

function executeRows(...rows: readonly unknown[]) {
  mocks.db.execute.mockResolvedValue({ rows });
  return mocks.db.execute;
}

const PACKET_HASH = 'a'.repeat(64);

const CANDIDATE_ROW = {
  targetType: 'company',
  subjectId: 42,
  offeringId: 77,
  analysisRunId: 3,
  resultId: 9,
  packetHash: PACKET_HASH,
  findingRowId: 5,
  findingKey: 'f-strong-1',
  signalType: 'company',
  signalId: 5001,
  signalName: 'Cost Pressure',
  evidenceStatus: 'strong',
  supportRole: 'primary',
  sourceRowId: 12,
  sourceKey: 's-annual-1',
  canonicalUrl: 'https://example.com/annual-report',
  sourceTitle: 'Annual Report 2025',
  retrievedAt: '2026-07-01T00:00:00.000Z',
  excerpt: 'The company reported higher costs in fiscal 2025.',
  displayStatus: 'active',
  linkSignalType: 'company',
  linkSignalId: 5001,
  linkOfferingId: 77,
  linkStatus: 'active',
} as const;

beforeEach(() => {
  mocks.db.execute.mockReset();
});

describe('listConfirmedCandidateOfferings', () => {
  it('emits a confirmed-only read-only projection with the D-34-04 join direction', async () => {
    executeRows();

    await listConfirmedCandidateOfferings();

    const sqlText = flattenSql(mocks.db.execute.mock.calls[0][0]);
    expect(sqlText).toContain('FROM analysis_run');
    expect(sqlText).toContain("status = 'confirmed'");
    expect(sqlText).toContain('analysis_run_review');
    expect(sqlText).toContain("decision = 'confirmed'");
    expect(sqlText).toContain('analysis_run_result');
    expect(sqlText).toContain('analysis_finding');
    expect(sqlText).toContain('analysis_finding_source');
    expect(sqlText).toContain('analysis_source');
    expect(sqlText).toContain('signal_offering_link');
    expect(sqlText).toContain('signal_type');
    expect(sqlText).toContain('signal_id');
    expect(sqlText).toContain('offering');
    // Evidence filter: only strong/weak findings with persisted links.
    expect(sqlText).toContain("'strong'");
    expect(sqlText).toContain("'weak'");
    // Persona retention boundary reuses the retention-aware packet rule.
    expect(sqlText).toContain('analysis_result_retention');
    expect(sqlText).toContain('retained');
    // Read-only: no insert/update/delete in the candidate query.
    expect(sqlText).not.toContain('INSERT');
    expect(sqlText).not.toContain('UPDATE');
    expect(sqlText).not.toContain('DELETE');
  });

  it('maps one source-backed candidate row into the closed contract', async () => {
    executeRows({ ...CANDIDATE_ROW });

    const candidates = await listConfirmedCandidateOfferings();

    expect(candidates).toHaveLength(1);
    expect(confirmedCandidateEvidenceSchema.parse(candidates[0])).toEqual(candidates[0]);
    expect(candidates[0]).toEqual({
      targetType: 'company',
      subjectId: 42,
      offeringId: 77,
      analysisRunId: 3,
      resultId: 9,
      packetHash: PACKET_HASH,
      findingRowId: 5,
      findingKey: 'f-strong-1',
      signalType: 'company',
      signalId: 5001,
      signalName: 'Cost Pressure',
      evidenceStatus: 'strong',
      supportRole: 'primary',
      sourceRowId: 12,
      sourceKey: 's-annual-1',
      canonicalUrl: 'https://example.com/annual-report',
      sourceTitle: 'Annual Report 2025',
      retrievedAt: '2026-07-01T00:00:00.000Z',
      excerpt: 'The company reported higher costs in fiscal 2025.',
      displayStatus: 'active',
      linkIdentity: {
        signalType: 'company',
        signalId: 5001,
        offeringId: 77,
        status: 'active',
      },
    });
  });

  it('rejects non-eligible evidence statuses through the contract', async () => {
    executeRows({ ...CANDIDATE_ROW, evidenceStatus: 'no_evidence' });

    const candidates = await listConfirmedCandidateOfferings();

    expect(candidates).toHaveLength(1);
    expect(() => confirmedCandidateEvidenceSchema.parse(candidates[0])).toThrow();
    expect(isEligibleCandidateEvidence('no_evidence')).toBe(false);
    expect(isEligibleCandidateEvidence('strong')).toBe(true);
  });

  it('keeps duplicate provenance as deterministic normalized rows', async () => {
    // Two sources backing the same finding — both must survive as separate
    // evidence rows, never grouped away.
    const secondSourceRow = {
      ...CANDIDATE_ROW,
      sourceRowId: 13,
      sourceKey: 's-press-1',
      canonicalUrl: 'https://example.com/press-release',
      sourceTitle: 'Press Release',
      retrievedAt: '2026-07-02T00:00:00.000Z',
      excerpt: 'A new chief financial officer was announced.',
    };
    executeRows(secondSourceRow, { ...CANDIDATE_ROW });

    const candidates = await listConfirmedCandidateOfferings();

    expect(candidates).toHaveLength(2);
    expect(new Set(candidates.map((candidate) => candidate.sourceRowId))).toEqual(
      new Set([12, 13]),
    );
    // normalizeCandidateEvidence: deterministic order by run:finding:source.
    const normalized = normalizeCandidateEvidence(candidates);
    expect(normalized.map((candidate) => candidate.sourceRowId)).toEqual([12, 13]);
  });

  it('retains the historical link identity alongside the display status', async () => {
    executeRows({
      ...CANDIDATE_ROW,
      displayStatus: 'retired',
      linkStatus: 'retired',
    });

    const candidates = await listConfirmedCandidateOfferings();

    expect(candidates[0].displayStatus).toBe('retired');
    expect(candidates[0].linkIdentity).toEqual({
      signalType: 'company',
      signalId: 5001,
      offeringId: 77,
      status: 'retired',
    });
    expect(confirmedCandidateEvidenceSchema.parse(candidates[0])).toEqual(candidates[0]);
  });
});
