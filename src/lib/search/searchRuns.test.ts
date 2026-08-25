import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@/lib/db/index', () => ({ db: mocks.db }));
vi.mock('@/lib/db/schema', () => ({
  searchRun: {
    id: 'search_run.id',
    initiatingUserId: 'search_run.initiating_user_id',
    idempotencyKey: 'search_run.idempotency_key',
    inputFingerprint: 'search_run.input_fingerprint',
    companyId: 'search_run.company_id',
    templateVersionId: 'search_run.template_version_id',
    partnerJobMappingId: 'search_run.partner_job_mapping_id',
  },
  partnerJobMapping: {
    id: 'partner_job_mapping.id',
    partnerJobId: 'partner_job_mapping.partner_job_id',
    requestId: 'partner_job_mapping.request_id',
  },
}));
vi.mock('server-only', () => ({}));

import {
  createSearchRun,
  associateSearchRunPartnerMapping,
  getSearchRunById,
  getSearchStatusProjection,
  recordSearchRunStatus,
  recordSearchTerminalResult,
  type CreateSearchRunInput,
} from './searchRuns';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  if ('queryChunks' in record && Array.isArray(record.queryChunks)) return record.queryChunks.map(flattenSql).join('');
  if ('name' in record) return String(record.name);
  if ('value' in record) return String(record.value);
  return '';
}

function selectRows(...rows: readonly unknown[]) {
  let index = 0;
  const where = vi.fn().mockImplementation(async () => {
    const row = rows[index] ?? rows[0];
    index += 1;
    return row === undefined ? [] : [row];
  });
  const from = vi.fn().mockReturnValue({ where });
  mocks.db.select.mockReturnValue({ from });
  return where;
}

const createInput: CreateSearchRunInput = {
  initiatingUserId: 'user_360',
  idempotencyKey: 'search-key',
  inputFingerprint: 'a'.repeat(64),
  companyId: 42,
  templateVersionId: 8,
  companySnapshot: { id: 42, name: 'Acme', domain: 'acme.example' },
  templateSnapshot: {
    schemaVersion: 1,
    templateId: 7,
    templateVersionId: 8,
    version: 1,
    name: 'Company Search',
    resolvedInstructions: 'Find current finance leaders.',
    buyerRoleRules: [],
    evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
    status: 'active',
  },
  buyerRoleSnapshot: [{ id: 1, name: 'CFO' }],
  evidencePolicySnapshot: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
};

const run = {
  id: 101,
  initiatingUserId: createInput.initiatingUserId,
  idempotencyKey: createInput.idempotencyKey,
  inputFingerprint: createInput.inputFingerprint,
  companyId: createInput.companyId,
  templateVersionId: createInput.templateVersionId,
  partnerJobMappingId: null,
  status: 'queued',
};

describe('Search run persistence', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a durable queued Search run before any partner submission succeeds', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [{ outcome: 'created', runId: run.id }] });
    selectRows(run);

    await expect(createSearchRun(createInput)).resolves.toEqual({ kind: 'created', run });

    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('search_run');
    expect(sqlText).toContain('queued');
    expect(sqlText).toContain('input_fingerprint');
  });

  it('replays the same scoped idempotency fingerprint and rejects a changed fingerprint', async () => {
    mocks.db.execute.mockResolvedValueOnce({ rows: [{ outcome: 'replayed', runId: run.id }] });
    selectRows(run);
    await expect(createSearchRun(createInput)).resolves.toEqual({ kind: 'replayed', run });

    mocks.db.execute.mockResolvedValueOnce({ rows: [{ outcome: 'idempotency_conflict', runId: null }] });
    await expect(createSearchRun({ ...createInput, inputFingerprint: 'b'.repeat(64) })).resolves.toEqual({
      kind: 'idempotency_conflict',
    });
  });

  it('maps the active Company/template uniqueness guard to active_run_exists', async () => {
    mocks.db.execute.mockRejectedValue(Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint: 'search_run_active_company_template_idx',
    }));

    await expect(createSearchRun(createInput)).resolves.toEqual({ kind: 'active_run_exists' });
  });

  it('does not regress a terminal run when a late nonterminal partner status is observed', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [] });
    const terminalRun = { ...run, status: 'succeeded' as const };
    selectRows(terminalRun);

    await expect(recordSearchRunStatus({
      runId: run.id,
      initiatingUserId: createInput.initiatingUserId,
      partnerJobId: 'job-1',
      requestId: 'request-1',
      partnerStatus: 'running',
      source: 'poll',
    })).resolves.toEqual({ kind: 'replayed', run: terminalRun });

    expect(flattenSql(mocks.db.execute.mock.calls[0]?.[0])).toContain("status IN ('queued', 'running')");
    expect(flattenSql(mocks.db.execute.mock.calls[0]?.[0])).toContain('FOR UPDATE');
  });

  it('guards terminal packet replay by hash and distinguishes changed packets', async () => {
    const terminalRun = { ...run, status: 'succeeded' as const, packetHash: 'c'.repeat(64) };
    mocks.db.execute.mockResolvedValueOnce({ rows: [{ outcome: 'replayed' }] });
    selectRows(terminalRun);
    await expect(recordSearchTerminalResult({
      runId: run.id,
      initiatingUserId: createInput.initiatingUserId,
      partnerJobId: 'job-1',
      requestId: 'request-1',
      status: 'succeeded',
      packetHash: 'c'.repeat(64),
      packetSchemaVersion: 1,
      terminalResultSummary: { schemaVersion: 1, candidateCount: 0, sourceCount: 0, inconclusiveCount: 0, normalizedCandidateCount: 0 },
    })).resolves.toEqual({ kind: 'replayed', run: terminalRun });

    mocks.db.execute.mockResolvedValueOnce({ rows: [{ outcome: 'conflict' }] });
    selectRows(terminalRun);
    await expect(recordSearchTerminalResult({
      runId: run.id,
      initiatingUserId: createInput.initiatingUserId,
      partnerJobId: 'job-1',
      requestId: 'request-1',
      status: 'succeeded',
      packetHash: 'd'.repeat(64),
      packetSchemaVersion: 1,
      terminalResultSummary: { schemaVersion: 1, candidateCount: 1, sourceCount: 0, inconclusiveCount: 0, normalizedCandidateCount: 1 },
    })).resolves.toEqual({ kind: 'conflict', run: terminalRun });
  });

  it('allows terminal metadata to be attached after status observation before replay protection begins', async () => {
    const terminalRun = { ...run, status: 'succeeded' as const, packetHash: null, terminalResultSummary: null };
    mocks.db.execute.mockResolvedValue({ rows: [{ outcome: 'applied' }] });
    selectRows(terminalRun);

    await expect(recordSearchTerminalResult({
      runId: run.id,
      initiatingUserId: createInput.initiatingUserId,
      partnerJobId: 'job-1',
      requestId: 'request-1',
      status: 'succeeded',
      packetHash: 'c'.repeat(64),
      packetSchemaVersion: 1,
      terminalResultSummary: { schemaVersion: 1, candidateCount: 0, sourceCount: 0, inconclusiveCount: 0, normalizedCandidateCount: 0 },
    })).resolves.toEqual({ kind: 'applied', run: terminalRun });

    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('terminal_result_summary IS NULL');
  });

  it('associates the registered partner mapping with the owned Search run', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [{ runId: run.id }] });
    selectRows({ ...run, partnerJobMappingId: 202 });

    await expect(associateSearchRunPartnerMapping({
      runId: run.id,
      initiatingUserId: createInput.initiatingUserId,
      partnerJobId: 'job-1',
      requestId: 'request-1',
    })).resolves.toMatchObject({ partnerJobMappingId: 202 });

    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('partner_job_mapping_id');
    expect(sqlText).toContain('partner_job_id');
  });

  it('returns a safe status projection with zero candidates and no Reviews URL', async () => {
    mocks.db.execute.mockResolvedValue({
      rows: [{
        searchRunId: 101,
        status: 'succeeded',
        companyId: 42,
        companyName: 'Acme',
        companyDomain: 'acme.example',
        templateId: 7,
        templateVersionId: 8,
        templateName: 'Company Search',
        templateVersion: 1,
        total: 0,
        pending: 0,
        inconclusive: 0,
        ambiguous: 0,
        approved: 0,
        rejected: 0,
      }],
    });

    await expect(getSearchStatusProjection(101, createInput.initiatingUserId)).resolves.toEqual({
      searchRunId: 101,
      status: 'succeeded',
      company: { id: 42, name: 'Acme', domain: 'acme.example' },
      template: { id: 7, versionId: 8, name: 'Company Search', version: 1 },
      candidateCounts: { total: 0, pending: 0, inconclusive: 0, ambiguous: 0, approved: 0, rejected: 0 },
      reviewsUrl: null,
    });
  });

  it('scopes run lookup to the authenticated initiating user', async () => {
    const where = selectRows(run);
    await expect(getSearchRunById(run.id, createInput.initiatingUserId)).resolves.toEqual(run);
    expect(flattenSql(where.mock.calls[0]?.[0])).toContain('initiating_user_id');
  });
});
