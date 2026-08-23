import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));
vi.mock('server-only', () => ({}));

import {
  applyArcAgentnetResultProjection,
  createArcAgentnetRunWithMapping,
  findArcAgentnetActiveRun,
  findArcAgentnetIdempotency,
  getArcAgentnetRunByPartnerIdentity,
  getArcAgentnetRunById,
  recordArcAgentnetStatus,
} from './arcAgentnetRuns';
import { serializeArcAgentnetProjection } from './arcAgentnetResultValidation';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  if ('queryChunks' in record && Array.isArray(record.queryChunks)) {
    return record.queryChunks.map(flattenSql).join('');
  }
  if ('name' in record) return String(record.name);
  if ('value' in record) return String(record.value);
  return '';
}

function executeRows(...rows: readonly unknown[]) {
  mocks.db.execute.mockResolvedValue({ rows });
  return mocks.db.execute;
}

function selectRows(...rows: readonly unknown[]) {
  let fromCalls = 0;
  const where = vi.fn();
  const from = vi.fn().mockImplementation(() => {
    const row = rows[fromCalls] ?? rows[0];
    fromCalls += 1;
    where.mockResolvedValue(row === undefined ? [] : [row]);
    return { where };
  });
  mocks.db.select.mockReturnValue({ from });
  return where;
}

const createInput = {
  initiatingUserId: 'user_360',
  createdBy: 'user_360',
  companyId: 42,
  templateId: 7,
  templateVersionId: 8,
  practiceAreaId: 9,
  subjectSnapshot: { type: 'company', id: 42, displayName: 'Acme' },
  templateSnapshot: {
    schemaVersion: 1,
    templateId: 7,
    templateVersionId: 8,
    templateKey: 'company-analysis',
    templateName: 'Company Analysis',
    targetType: 'company',
    version: 1,
    resolvedInstruction: 'Assess the company.',
    effort: 'standard',
  },
  checklistSnapshot: {
    schemaVersion: 1,
    targetType: 'company',
    practiceAreaId: 9,
    practiceAreaName: 'GBS',
    items: [],
  },
  executionSnapshot: {
    executor: 'arc-agentnet',
    schemaVersion: 1,
    effort: 'standard',
    resolvedModelChain: ['partner'],
    futureBudget: { maxAttempts: 2, maxToolCalls: 6, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
    policy: { schemaVersion: 1, mode: 'phase32_noop', networkAccess: false, writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0, effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 },
  },
  policySnapshot: { schemaVersion: 1, mode: 'phase32_noop', networkAccess: false, writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0, effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 },
  inputSnapshot: { schemaVersion: 1, analysis: { subjectType: 'company', company: { id: 42, name: 'Acme', domain: 'acme.example', profile: { industry: null, headcount: null, headquarters: null, description: null } }, practiceArea: { id: 9, name: 'GBS', shortCode: 'GBS' }, buyingSignalCategory: 'Financial', template: { kind: 'fixed', templateId: 7, templateVersionId: 8, templateKey: 'company-analysis', templateName: 'Company Analysis', templateVersion: 1, targetType: 'company', customAgentId: null, customAgentName: null, customAgentVersion: null }, resolvedInstructions: 'Assess the company.', checklist: [], publicEvidenceUrls: [] } },
  partnerJobId: 'job_42',
  requestId: 'request_42',
  idempotencyKey: 'retry-key',
  payloadHash: 'a'.repeat(64),
} as const;

const run = { id: 101, executionTarget: 'arc-agentnet', initiatingUserId: 'user_360', subjectId: 42, status: 'queued', arcAgentnetLocalStatus: 'queued', arcAgentnetPayloadHash: createInput.payloadHash };
const mapping = { id: 202, partnerJobId: 'job_42', requestId: 'request_42', status: 'queued' };

function nestedProjection(depth: number): Record<string, unknown> {
  let value: unknown = 'leaf';
  for (let level = 0; level < depth; level += 1) value = { level: value };
  return value as Record<string, unknown>;
}

describe('Arc-agentnet local persistence guards', () => {
  beforeEach(() => vi.resetAllMocks());

  it('replays one scoped idempotency key to the original run and mapping', async () => {
    const execute = executeRows({ outcome: 'replayed', runId: run.id, mappingId: mapping.id });
    selectRows(run, mapping);

    const result = await createArcAgentnetRunWithMapping(createInput);

    expect(result).toEqual({ kind: 'replayed', run, mapping });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(flattenSql(execute.mock.calls[0]?.[0])).toContain('arc_agentnet_idempotency');
    expect(flattenSql(execute.mock.calls[0]?.[0])).toContain('payload_hash');
  });

  it('persists the Arc-agentnet executor in the immutable local execution snapshot', async () => {
    const execute = executeRows({ outcome: 'created', runId: run.id, mappingId: mapping.id });
    selectRows(run, mapping);

    await createArcAgentnetRunWithMapping(createInput);

    expect(flattenSql(execute.mock.calls[0]?.[0])).toContain('executor');
    expect(flattenSql(execute.mock.calls[0]?.[0])).toContain('arc-agentnet');
  });

  it('reuses the mapping registered by the partner client before local persistence', async () => {
    const execute = executeRows({ outcome: 'created', runId: run.id, mappingId: mapping.id });
    selectRows(run, mapping);

    await createArcAgentnetRunWithMapping(createInput);

    expect(flattenSql(execute.mock.calls[0]?.[0])).toContain('existing_mapping');
  });

  it('returns idempotency_conflict when the scoped key has a different payload fingerprint', async () => {
    executeRows({ outcome: 'idempotency_conflict' });

    await expect(createArcAgentnetRunWithMapping({ ...createInput, payloadHash: 'b'.repeat(64) })).resolves.toEqual({
      kind: 'idempotency_conflict',
    });
  });

  it('maps the active-run unique violation to active_run_exists', async () => {
    mocks.db.execute.mockRejectedValue(Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint: 'analysis_run_active_subject_template_idx',
    }));
    selectRows();

    await expect(createArcAgentnetRunWithMapping(createInput)).resolves.toEqual({ kind: 'active_run_exists' });
  });

  it('re-reads a concurrent scoped idempotency insert and replays the matching fingerprint', async () => {
    mocks.db.execute.mockRejectedValue(Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint: 'arc_agentnet_idempotency_scope_key_unique',
    }));
    selectRows(
      { id: 303, analysisRunId: run.id, partnerJobMappingId: mapping.id, payloadHash: createInput.payloadHash },
      run,
      mapping,
    );

    await expect(createArcAgentnetRunWithMapping(createInput)).resolves.toEqual({ kind: 'replayed', run, mapping });
  });

  it('returns idempotency_conflict after a concurrent scoped insert with a different fingerprint', async () => {
    mocks.db.execute.mockRejectedValue(Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint: 'arc_agentnet_idempotency_scope_key_unique',
    }));
    selectRows({ id: 303, analysisRunId: run.id, partnerJobMappingId: mapping.id, payloadHash: 'b'.repeat(64) });

    await expect(createArcAgentnetRunWithMapping(createInput)).resolves.toEqual({ kind: 'idempotency_conflict' });
  });

  it('does not classify partner mapping conflicts as active runs', async () => {
    const duplicate = Object.assign(new Error('duplicate partner job'), {
      code: '23505',
      constraint: 'partner_job_mapping_partner_job_id_unique',
    });
    mocks.db.execute.mockRejectedValue(duplicate);
    selectRows();

    await expect(createArcAgentnetRunWithMapping(createInput)).rejects.toBe(duplicate);
  });

  it('does not regress an Arc-agentnet run after a terminal status wins', async () => {
    const execute = executeRows();
    selectRows({ ...run, status: 'completed', arcAgentnetLocalStatus: 'completed' });

    const result = await recordArcAgentnetStatus({ runId: run.id, initiatingUserId: createInput.initiatingUserId, partnerJobId: createInput.partnerJobId, requestId: createInput.requestId, partnerStatus: 'running', occurredAt: new Date('2026-08-23T12:00:00.000Z') });

    expect(result).toEqual({ kind: 'replayed', run: { ...run, status: 'completed', arcAgentnetLocalStatus: 'completed' } });
    expect(execute).toHaveBeenCalledTimes(1);
    const sqlText = flattenSql(execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("IN ('queued', 'running')");
    expect(sqlText).toContain('FOR UPDATE');
    expect(sqlText).toContain('previous_status');
  });

  it.each([
    ['succeeded', 'completed'],
    ['failed', 'failed'],
    ['cancelled', 'cancelled'],
  ] as const)('maps partner %s to local %s', async (partnerStatus, localStatus) => {
    const execute = executeRows({ outcome: 'transitioned', runId: run.id });
    selectRows({ ...run, status: localStatus, arcAgentnetLocalStatus: localStatus });

    const result = await recordArcAgentnetStatus({ runId: run.id, initiatingUserId: createInput.initiatingUserId, partnerJobId: createInput.partnerJobId, requestId: createInput.requestId, partnerStatus });

    expect(result).toMatchObject({ kind: 'transitioned', run: { status: localStatus, arcAgentnetLocalStatus: localStatus } });
    expect(flattenSql(execute.mock.calls[0]?.[0])).toContain(localStatus);
  });

  it('persists a result hash, byte count, and safe projection once', async () => {
    const execute = executeRows({ outcome: 'applied', runId: run.id });
    selectRows({ ...run, arcAgentnetResultHash: 'c'.repeat(64), arcAgentnetResultSizeBytes: 128, arcAgentnetResultProjection: { summary: 'safe' } });

    const result = await applyArcAgentnetResultProjection({
      runId: run.id,
      initiatingUserId: createInput.initiatingUserId,
      partnerJobId: createInput.partnerJobId,
      requestId: createInput.requestId,
      resultHash: 'd'.repeat(64),
      resultSizeBytes: 1,
      projection: { summary: 'safe' },
    });

    expect(result).toMatchObject({ kind: 'applied', run: { arcAgentnetResultSizeBytes: 128 } });
    const serialized = serializeArcAgentnetProjection({ summary: 'safe' });
    expect(serialized.ok).toBe(true);
    const sqlText = flattenSql(execute.mock.calls[0]?.[0]);
    if (serialized.ok) {
      expect(sqlText).toContain(serialized.hash);
      expect(sqlText).toContain(String(serialized.sizeBytes));
    }
    expect(sqlText).not.toContain('d'.repeat(64));
    expect(sqlText).toContain('result_projection');
    expect(sqlText).toContain("arc_agentnet_local_status IN ('queued', 'running')");
  });

  it('rejects unsafe projections before issuing a database write', async () => {
    const result = await applyArcAgentnetResultProjection({
      runId: run.id,
      initiatingUserId: createInput.initiatingUserId,
      partnerJobId: createInput.partnerJobId,
      requestId: createInput.requestId,
      projection: { apiKey: 'secret' },
    });

    expect(result).toEqual({ kind: 'invalid_input' });
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('rejects a projection at the first depth beyond the contract without recursive parsing', () => {
    expect(serializeArcAgentnetProjection(nestedProjection(9))).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('accepts a projection at the contract depth boundary', () => {
    expect(serializeArcAgentnetProjection(nestedProjection(8)).ok).toBe(true);
  });

  it('rejects extreme nesting without throwing RangeError', () => {
    expect(() => serializeArcAgentnetProjection(nestedProjection(10_000))).not.toThrow();
    expect(serializeArcAgentnetProjection(nestedProjection(10_000))).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it.each([
    { label: 'oversized string', projection: { value: 'x'.repeat(20_001) } },
    { label: 'oversized array', projection: { value: Array.from({ length: 101 }, () => 'item') } },
    {
      label: 'oversized serialization',
      projection: Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`field${index}`, 'x'.repeat(20_000)])),
    },
  ])('rejects $label before producing caller-controlled metadata', ({ projection }) => {
    expect(serializeArcAgentnetProjection(projection)).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('finds idempotency only inside the authenticated user and Company/template scope', async () => {
    const where = selectRows({ id: 303, analysisRunId: run.id, payloadHash: createInput.payloadHash });

    const result = await findArcAgentnetIdempotency({
      initiatingUserId: createInput.initiatingUserId,
      companyId: createInput.companyId,
      templateId: createInput.templateId,
      templateVersionId: createInput.templateVersionId,
      idempotencyKey: createInput.idempotencyKey,
    });

    expect(result).toEqual({ id: 303, analysisRunId: run.id, payloadHash: createInput.payloadHash });
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('finds only queued, running, or pending-review Arc-agentnet runs in the local scope', async () => {
    const where = selectRows(run);

    await expect(findArcAgentnetActiveRun({ initiatingUserId: createInput.initiatingUserId, companyId: createInput.companyId, templateId: createInput.templateId })).resolves.toEqual(run);

    expect(where).toHaveBeenCalledOnce();
  });

  it('does not expose an internal run through the Arc-agentnet lookup', async () => {
    selectRows();

    await expect(getArcAgentnetRunById(404, 'user_360')).resolves.toBeUndefined();
  });

  it('requires an owner in the local-id lookup predicate', async () => {
    const where = selectRows(run);
    await getArcAgentnetRunById(run.id, createInput.initiatingUserId);
    expect(flattenSql(where.mock.calls[0]?.[0])).toContain('initiating_user_id');
  });

  it('requires the validated partner job and request identity for callback lookup', async () => {
    const where = selectRows(run);
    await getArcAgentnetRunByPartnerIdentity(createInput.partnerJobId, createInput.requestId);
    const sqlText = flattenSql(where.mock.calls[0]?.[0]);
    expect(sqlText).toContain('partner_job_id');
    expect(sqlText).toContain('partner_request_id');
    expect(sqlText).toContain('EXISTS');
  });
});
