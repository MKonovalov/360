import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn(), execute: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  getAnalysisTemplateVersion,
  createCustomAgent,
  listManagedAnalysisTemplates,
  listManagedCustomAgents,
  listActiveAnalysisTemplates,
  saveCustomAgentVersion,
  saveAnalysisTemplateVersion,
  setCustomAgentStatus,
  setAnalysisTemplateStatus,
} from './analysisTemplates';
import { analysisTemplate, analysisTemplateVersion } from '../schema';

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

describe('analysisTemplates query module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only versions belonging to active reusable templates', async () => {
    const rows = [
      {
        templateId: 1,
        templateVersionId: 11,
        key: 'company-buying-signal-analysis',
        name: 'Company Buying Signal Analysis',
        targetType: 'company',
        version: 1,
        supportedEfforts: ['standard'],
        defaultEffort: 'standard',
      },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mocks.db.select.mockReturnValue({ from });

    const result = await listActiveAnalysisTemplates();

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(analysisTemplate);
    expect(innerJoin).toHaveBeenCalledWith(analysisTemplateVersion, expect.anything());
    const whereSql = flattenSql(where.mock.calls[0]?.[0]);
    expect(whereSql).toContain('active');
    expect(orderBy).toHaveBeenCalled();
  });

  it.each(['company', 'persona'] as const)(
    'filters active catalog pairs to the requested %s target',
    async (targetType) => {
      const orderBy = vi.fn().mockResolvedValue([]);
      const where = vi.fn().mockReturnValue({ orderBy });
      const innerJoin = vi.fn().mockReturnValue({ where });
      const from = vi.fn().mockReturnValue({ innerJoin });
      mocks.db.select.mockReturnValue({ from });

      await listActiveAnalysisTemplates(targetType);

      const whereSql = flattenSql(where.mock.calls[0]?.[0]);
      expect(whereSql).toContain('active');
      expect(whereSql).toContain(targetType);
    },
  );

  it('limits the active launcher catalog to fixed managed template keys', () => {
    const source = readFileSync(new URL('./analysisTemplates.ts', import.meta.url), 'utf8');

    expect(source).toContain('const fixedTemplateKeys = FIXED_ANALYSIS_TEMPLATES.map(({ key }) => key);');
    expect(source).toContain('inArray(analysisTemplate.key, fixedTemplateKeys)');
    expect(source).not.toContain('listManagedCustomAgents()');
  });

  it('loads immutable version metadata with its template lifecycle for validation', async () => {
    const row = {
      templateId: 1,
      templateVersionId: 11,
      key: 'company-buying-signal-analysis',
      name: 'Company Buying Signal Analysis',
      targetType: 'company',
      status: 'active',
      version: 1,
      instruction: 'Analyze the company.',
      supportedEfforts: ['standard'],
      defaultEffort: 'standard',
      futureBudget: {
        maxAttempts: 2,
        maxToolCalls: 12,
        maxExecutionSeconds: 300,
        maxSpendUsd: 2.5,
      },
      isCurrent: true,
    };
    const where = vi.fn().mockResolvedValue([row]);
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mocks.db.select.mockReturnValue({ from });

    const result = await getAnalysisTemplateVersion(11);

    expect(result).toEqual(row);
    expect(from).toHaveBeenCalledWith(analysisTemplateVersion);
    expect(innerJoin).toHaveBeenCalledWith(analysisTemplate, expect.anything());
    expect(flattenSql(where.mock.calls[0]?.[0])).toContain('11');
  });

  it('returns undefined when the immutable version does not exist', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mocks.db.select.mockReturnValue({ from });

    await expect(getAnalysisTemplateVersion(999)).resolves.toBeUndefined();
  });

  it('keeps fixed runtime resolution closed to custom template versions', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mocks.db.select.mockReturnValue({ from });

    await getAnalysisTemplateVersion(71);

    const whereSql = flattenSql(where.mock.calls[0]?.[0]);
    expect(whereSql).toContain('71');
    expect(whereSql).toContain('fixed');
  });

  it('D-36-01/D-36-04: projects one latest row and ordered read-only history per fixed template', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          templateId: 1,
          templateVersionId: 12,
          key: 'company-buying-signal-analysis',
          name: 'Company Buying Signal Analysis',
          targetType: 'company',
          status: 'active',
          version: 2,
          instruction: 'new company instruction',
          supportedEfforts: ['standard'],
          defaultEffort: 'standard',
          futureBudget: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
          createdBy: 'staff-2',
          createdAt: '2026-08-08T00:00:02.000Z',
        },
        {
          templateId: 1,
          templateVersionId: 11,
          key: 'company-buying-signal-analysis',
          name: 'Company Buying Signal Analysis',
          targetType: 'company',
          status: 'active',
          version: 1,
          instruction: 'old company instruction',
          supportedEfforts: ['standard'],
          defaultEffort: 'standard',
          futureBudget: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
          createdBy: 'seed-script',
          createdAt: '2026-08-08T00:00:01.000Z',
        },
        {
          templateId: 2,
          templateVersionId: 21,
          key: 'persona-buying-signal-analysis',
          name: 'Persona Buying Signal Analysis',
          targetType: 'persona',
          status: 'retired',
          version: 1,
          instruction: 'persona instruction',
          supportedEfforts: ['standard'],
          defaultEffort: 'standard',
          futureBudget: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
          createdBy: 'seed-script',
          createdAt: '2026-08-08T00:00:01.000Z',
        },
      ],
    });
    mocks.db.execute = execute;

    const result = await listManagedAnalysisTemplates();

    expect(result).toHaveLength(2);
    expect(result[0]?.latest.version).toBe(2);
    expect(result[0]?.history.map((version) => version.version)).toEqual([2, 1]);
    expect(result[1]?.status).toBe('retired');
    expect(execute).toHaveBeenCalledOnce();
    const query = flattenSql(execute.mock.calls[0]?.[0]);
    expect(query).toContain('analysis_template_version');
    expect(query.match(/fixed/g) ?? []).toHaveLength(2);
  });

  it('D-36-03/D-36-05: appends content atomically with an expected version', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ templateVersionId: 13 }] })
      .mockResolvedValueOnce({ rows: [managedTemplateRow(13, 2, 'updated instruction')] });
    mocks.db.execute = execute;

    const result = await saveAnalysisTemplateVersion(
      {
        operation: 'content',
        templateKey: 'company-buying-signal-analysis',
        expectedVersion: 1,
        instruction: 'updated instruction',
        defaultEffort: 'standard',
      },
      'staff-2',
    );

    expect(result.ok).toBe(true);
    const query = flattenSql(execute.mock.calls[0]?.[0]);
    expect(query).toContain('INSERT INTO analysis_template_version');
    expect(query).toContain('MAX');
    expect(query.match(/fixed/g) ?? []).toHaveLength(2);
  });

  it('D-36-06: changes lifecycle on the template row without inserting a version', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ templateId: 2 }] })
      .mockResolvedValueOnce({ rows: [managedTemplateRow(21, 1, 'persona instruction', 'retired')] });
    mocks.db.execute = execute;

    const result = await setAnalysisTemplateStatus(
        { operation: 'lifecycle', templateKey: 'company-buying-signal-analysis', status: 'retired' },
        'staff-2',
      );

    expect(result.ok).toBe(true);
    const query = flattenSql(execute.mock.calls[0]?.[0]);
    expect(query).toContain('UPDATE analysis_template');
    expect(query).toContain('fixed');
    expect(query).not.toContain('analysis_template_version');
  });

  it('returns a reloadable conflict when a concurrent append wins with different content', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [managedTemplateRow(13, 2, 'another instruction')] });
    mocks.db.execute = execute;

    const result = await saveAnalysisTemplateVersion(
      {
        operation: 'content',
        templateKey: 'company-buying-signal-analysis',
        expectedVersion: 1,
        instruction: 'concurrent instruction',
        defaultEffort: 'standard',
      },
      'staff-2',
    );

    expect(result).toEqual({ ok: false, reason: 'conflict' });
    expect(flattenSql(execute.mock.calls[0]?.[0])).toContain('ON CONFLICT');
    expect(flattenSql(execute.mock.calls[0]?.[0])).not.toMatch(/UPDATE|DELETE/);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('keeps template management writes isolated from run, evidence, review, and live catalog tables', async () => {
    const source = readFileSync(new URL('./analysisTemplates.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(
      /\b(?:analysis_run|analysis_run_event|analysis_result|analysis_finding|analysis_source|analysis_run_review|signal|offering|signal_offering_link)\b/,
    );
  });

  it('creates an opaque custom identity and retired version one in one write', async () => {
    mocks.db.execute
      .mockResolvedValueOnce({ rows: [{ templateId: 7, templateVersionId: 71, customAgentId: 'custom-server-key' }] })
      .mockResolvedValueOnce({ rows: [customAgentRow(7, 71, 1, 'Draft agent', 'retired')] });

    const result = await createCustomAgent(customAgentInput(), 'staff-creator');

    expect(result).toMatchObject({ ok: true, kind: 'created' });
    const query = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(query).toContain('WITH');
    expect(query).toContain('gen_random_uuid');
    expect(query).toContain("'retired'");
    expect(query).toContain('analysis_template_version');
    expect(query).toContain('staff-creator');
  });

  it('lists custom agents with newest immutable version first and complete authored fields', async () => {
    mocks.db.execute.mockResolvedValueOnce({
      rows: [
        customAgentRow(7, 72, 2, 'Renamed agent', 'retired'),
        customAgentRow(7, 71, 1, 'Draft agent', 'retired'),
      ],
    });

    const result = await listManagedCustomAgents();

    expect(result).toHaveLength(1);
    expect(result[0]?.latest.name).toBe('Renamed agent');
    expect(result[0]?.history.map((version) => version.version)).toEqual([2, 1]);
    expect(result[0]?.latest.researchQuery).toBe('Find buying pressure');
    expect(result[0]?.latest.behaviorInstruction).toBe('Use evidence.');
    expect(result[0]?.latest.capabilityPresetIds).toEqual(['web-research']);
  });

  it('appends a custom version without changing target identity or retired lifecycle', async () => {
    mocks.db.execute
      .mockResolvedValueOnce({ rows: [{ templateVersionId: 72 }] })
      .mockResolvedValueOnce({ rows: [customAgentRow(7, 72, 2, 'Renamed agent', 'retired')] });

    const result = await saveCustomAgentVersion(
      'custom-server-key',
      { ...customAgentInput({ name: 'Renamed agent' }), outputSchema: null },
      'staff-editor',
    );

    expect(result).toMatchObject({ ok: true, kind: 'version_appended', agent: { status: 'retired' } });
    const query = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(query).toContain('MAX');
    expect(query).toContain('ON CONFLICT');
    expect(query).not.toMatch(/UPDATE|DELETE/);
    expect(query).toContain('practice_area_id');
  });

  it('changes custom lifecycle without inserting a content version', async () => {
    mocks.db.execute
      .mockResolvedValueOnce({ rows: [{ templateId: 7 }] })
      .mockResolvedValueOnce({ rows: [customAgentRow(7, 72, 2, 'Renamed agent', 'active')] });

    const result = await setCustomAgentStatus('custom-server-key', 'active', 'staff-activator');

    expect(result).toMatchObject({ ok: true, kind: 'lifecycle_updated', agent: { status: 'active' } });
    const query = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(query).toContain('UPDATE analysis_template');
    expect(query).not.toContain('analysis_template_version');
  });

  it('rejects a same-state custom lifecycle request without changing history', async () => {
    mocks.db.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [customAgentRow(7, 72, 2, 'Renamed agent', 'retired')] });

    const result = await setCustomAgentStatus('custom-server-key', 'retired', 'staff-activator');

    expect(result).toEqual({ ok: false, reason: 'invalid_transition' });
    expect(flattenSql(mocks.db.execute.mock.calls[0]?.[0])).not.toContain('analysis_template_version');
  });
});

function managedTemplateRow(
  templateVersionId: number,
  version: number,
  instruction: string,
  status: 'active' | 'retired' = 'active',
) {
  return {
    templateId: 1,
    templateVersionId,
    key: 'company-buying-signal-analysis',
    name: 'Company Buying Signal Analysis',
    targetType: 'company',
    status,
    version,
    instruction,
    supportedEfforts: ['standard'],
    defaultEffort: 'standard',
    futureBudget: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
    createdBy: 'staff-2',
    createdAt: '2026-08-08T00:00:02.000Z',
  };
}

function customAgentInput(overrides: Partial<Parameters<typeof createCustomAgent>[0]> = {}) {
  return {
    name: 'Draft agent',
    description: 'A custom research agent',
    targetType: 'company' as const,
    practiceAreaId: 42,
    researchQuery: 'Find buying pressure',
    behaviorInstruction: 'Use evidence.',
    defaultEffort: 'standard' as const,
    outputSchema: null,
    capabilityPresetIds: ['web-research'],
    ...overrides,
  };
}

function customAgentRow(
  templateId: number,
  templateVersionId: number,
  version: number,
  name: string,
  status: 'active' | 'retired',
) {
  return {
    templateId,
    customAgentId: 'custom-server-key',
    targetType: 'company',
    practiceAreaId: 42,
    status,
    templateVersionId,
    version,
    name,
    description: 'A custom research agent',
    researchQuery: 'Find buying pressure',
    behaviorInstruction: 'Use evidence.',
    outputSchema: null,
    capabilityPresetIds: ['web-research'],
    supportedEfforts: ['standard'],
    defaultEffort: 'standard',
    createdBy: 'staff-editor',
    createdAt: '2026-08-09T00:00:00.000Z',
  };
}
