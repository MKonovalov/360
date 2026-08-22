import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn() },
  inArray: vi.fn(),
}));

vi.mock('../index', () => ({ db: mocks.db }));
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  inArray: mocks.inArray,
}));

import { signal } from '../schema';
import { listSignalSummariesForCompanies } from './signals';

describe('signal summary queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inArray.mockReturnValue('bounded company ids');
  });

  it('projects one grouped summary query bounded to the visible company ids', async () => {
    const rows = [
      { companyId: 11, signalType: 'cost_pressure' },
      { companyId: 11, signalType: 'new_cfo_or_gbs_head' },
      { companyId: 22, signalType: 'transformation_announcement' },
    ];
    const groupBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ groupBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listSignalSummariesForCompanies([11, 22]);

    expect(mocks.db.select).toHaveBeenCalledTimes(1);
    expect(mocks.db.select).toHaveBeenCalledWith({
      companyId: signal.companyId,
      signalType: signal.signalType,
    });
    expect(from).toHaveBeenCalledWith(signal);
    expect(mocks.inArray).toHaveBeenCalledWith(signal.companyId, [11, 22]);
    expect(where).toHaveBeenCalledTimes(1);
    expect(groupBy).toHaveBeenCalledWith(signal.companyId, signal.signalType);
    expect(where).toHaveBeenCalledWith('bounded company ids');
    expect(result).toEqual(rows);
  });

  it('skips the database when there are no visible companies', async () => {
    const result = await listSignalSummariesForCompanies([]);

    expect(result).toEqual([]);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });
});
