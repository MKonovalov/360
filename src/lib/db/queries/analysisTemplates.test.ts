import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  getAnalysisTemplateVersion,
  listActiveAnalysisTemplates,
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
    expect(flattenSql(where.mock.calls[0]?.[0])).toContain('active');
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
});
