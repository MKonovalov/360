import { beforeEach, describe, expect, it, vi } from 'vitest';

// 09-02-01 anchor: createRun persists Langfuse trace linkage + run artifacts
// (OBSV-01). Pure unit on the query functions with a stubbed drizzle client —
// no live DB (D-16).
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { createRun, getRunById } from './runs';
import { agentRun } from '../schema';

describe('runs query module (09-02-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists traceId + traceUrl + usageTokens + evidenceAppendix + hypotheses for a companyId', async () => {
    const row = { id: 9, companyId: 1, createdAt: new Date('2026-07-31T00:00:00Z') };
    const returning = vi.fn().mockResolvedValue([row]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const input = {
      companyId: 1,
      traceId: 'trace_123',
      traceUrl: 'https://cloud.langfuse.com/trace/123',
      verdict: 'emerging',
      usageTokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      evidenceAppendix: [{ url: 'https://example.com/a', title: 'A', snippet: 's' }],
      hypotheses: [{ question: 'Is GBS mature?', status: 'unsupported' }],
    };

    const result = await createRun(input);

    expect(mocks.db.insert).toHaveBeenCalledWith(agentRun);
    expect(values).toHaveBeenCalledWith(input);
    expect(returning).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it('getRunById returns the run row for correction trace-linking lookups', async () => {
    const row = { id: 9, companyId: 1, traceId: 'trace_123', traceUrl: 'https://cloud.langfuse.com/trace/123' };
    const where = vi.fn().mockResolvedValue([row]);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await getRunById(9);

    expect(mocks.db.select).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith(agentRun);
    expect(result).toEqual(row);
  });

  it('returns undefined when the run does not exist', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    expect(await getRunById(999)).toBeUndefined();
  });
});
