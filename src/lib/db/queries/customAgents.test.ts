import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.hoisted(() => vi.fn());
vi.mock('../index', () => ({ db: { execute } }));

import {
  getActiveCustomAgentLaunchVersion,
  listActiveCustomAgentOptions,
} from './customAgents';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  if ('queryChunks' in record && Array.isArray(record.queryChunks)) return record.queryChunks.map(flattenSql).join('');
  if ('brand' in record || 'value' in record) return String(record.value);
  return '';
}

const row = {
  templateId: 7,
  customAgentId: 'custom-7',
  targetType: 'company' as const,
  practiceAreaId: 3,
  status: 'active' as const,
  templateVersionId: 71,
  version: 2,
  name: 'Cost Pressure Scout',
  description: 'Find cost pressure.',
  researchQuery: 'cost pressure',
  behaviorInstruction: 'Assess cost pressure.',
  outputSchema: null,
  capabilityPresetIds: ['none'],
  supportedEfforts: ['standard'],
  defaultEffort: 'standard',
  createdBy: 'staff',
  createdAt: '2026-08-11T00:00:00.000Z',
};

describe('custom launch query boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fences option rows to active custom identity, target, Practice Area, and current version', async () => {
    execute.mockResolvedValue({ rows: [row] });

    const options = await listActiveCustomAgentOptions('company', 3);

    expect(options).toEqual([expect.objectContaining({ customAgentId: 'custom-7', latest: expect.objectContaining({ templateVersionId: 71 }) })]);
    const query = flattenSql(execute.mock.calls[0]?.[0]);
    expect(query).toContain("t.kind = 'custom'");
    expect(query).toContain("t.status = 'active'");
    expect(query).toContain('t.target_type');
    expect(query).toContain('t.practice_area_id');
    expect(query).toContain('MAX(current_version.version)');
  });

  it('loads only the selected current immutable custom version', async () => {
    execute.mockResolvedValue({ rows: [row] });

    await getActiveCustomAgentLaunchVersion('custom-7', 71);

    const query = flattenSql(execute.mock.calls[0]?.[0]);
    expect(query).toContain("t.key =");
    expect(query).toContain('v.id =');
    expect(query).toContain("v.kind = 'custom'");
    expect(query).toContain("t.status = 'active'");
  });
});
