import { beforeEach, describe, expect, it, vi } from 'vitest';

// 09-02-02 anchor: proposal queue queries — insert, pending list with
// evidence inline, pending count, and the guarded idempotent Accept
// (D-09/D-10/T-09-07). Pure unit on the query functions with a stubbed
// drizzle client — no live DB (D-16). The accept path uses NO db.transaction
// (neon-http has none): status-guarded conditional update + unique-index
// backstop is the exactly-once contract.
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  insertProposals,
  listPendingProposals,
  countPendingProposals,
  acceptProposal,
} from './proposals';
import { agentRun, signal, signalProposal } from '../schema';

const costProposal = {
  signalType: 'cost_pressure',
  strength: 'medium',
  detectedAt: '2026-07-31',
  evidenceUrl: 'https://example.com/cost',
  reliability: 'R2',
  confidence: 'C2',
  evidenceSnippet: 'Acme faces cost pressure',
  reasoning: 'News coverage indicates cost pressure',
};
const gbsProposal = {
  signalType: 'immature_gbs_org',
  strength: 'low',
  detectedAt: '2026-07-31',
  evidenceUrl: 'https://example.com/gbs',
  reliability: 'R3',
  confidence: 'C3',
  evidenceSnippet: 'Acme has no mature GBS org',
  reasoning: 'No mature GBS organization found',
};

// Stubbed select chain for the accept path: select().from().where()
function selectChain(resolved: unknown) {
  const where = vi.fn().mockResolvedValue(resolved);
  return { from: vi.fn().mockReturnValue({ where }) };
}

describe('proposals query module (09-02-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bulk-inserts proposals tied to a run with pending status', async () => {
    const inserted = [
      { id: 1, status: 'pending' },
      { id: 2, status: 'pending' },
    ];
    const returning = vi.fn().mockResolvedValue(inserted);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertProposals(5, 1, [costProposal, gbsProposal]);

    expect(mocks.db.insert).toHaveBeenCalledWith(signalProposal);
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ runId: 5, companyId: 1, signalType: 'cost_pressure', evidenceUrl: costProposal.evidenceUrl }),
      expect.objectContaining({ runId: 5, companyId: 1, signalType: 'immature_gbs_org', reasoning: gbsProposal.reasoning }),
    ]);
    expect(result).toEqual(inserted);
  });

  it('accepts a pending proposal: writes ONE signal row and marks the proposal accepted', async () => {
    const proposalRow = {
      id: 3,
      companyId: 1,
      signalType: 'cost_pressure',
      strength: 'medium',
      detectedAt: '2026-07-31',
      evidenceUrl: 'https://example.com/cost',
      reliability: 'R2',
      confidence: 'C2',
      evidenceSnippet: 's',
      reasoning: 'r',
    };
    const updateReturning = vi.fn().mockResolvedValue([{ id: 3 }]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mocks.db.update.mockReturnValue({ set: updateSet });
    mocks.db.select.mockReturnValue(selectChain([proposalRow]));
    const signalReturning = vi.fn().mockResolvedValue([{ id: 99 }]);
    const signalValues = vi.fn().mockReturnValue({ returning: signalReturning });
    mocks.db.insert.mockReturnValue({ values: signalValues });

    const result = await acceptProposal(3);

    expect(result).toEqual({ ok: true });
    expect(mocks.db.update).toHaveBeenCalledWith(signalProposal);
    expect(updateSet).toHaveBeenCalledWith({ status: 'accepted', resolvedAt: expect.any(Date) });
    // ONE Accept = ONE Signal (ANLZ-02/D-09): exactly one signal insert,
    // typed from the proposal row, source = evidence URL (D-10).
    expect(mocks.db.insert).toHaveBeenCalledWith(signal);
    expect(signalValues).toHaveBeenCalledTimes(1);
    expect(signalValues.mock.calls[0][0]).toMatchObject({
      companyId: 1,
      signalType: 'cost_pressure',
      strength: 'medium',
      source: 'https://example.com/cost',
      detectedAt: '2026-07-31',
      note: 'r',
    });
  });

  it('is idempotent: a second accept on the same proposal is a no-op', async () => {
    const updateReturning = vi
      .fn()
      .mockResolvedValueOnce([{ id: 3 }]) // first accept wins the guard
      .mockResolvedValueOnce([]); // second accept: status no longer pending
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mocks.db.update.mockReturnValue({ set: updateSet });
    mocks.db.select.mockReturnValue(
      selectChain([{ id: 3, companyId: 1, signalType: 'cost_pressure', strength: 'medium', detectedAt: '2026-07-31', evidenceUrl: 'https://example.com/cost', reasoning: 'r' }]),
    );
    const signalValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 99 }]) });
    mocks.db.insert.mockReturnValue({ values: signalValues });

    const first = await acceptProposal(3);
    const second = await acceptProposal(3);

    expect(first).toEqual({ ok: true });
    // Idempotent no-op, NOT an error (T-09-07).
    expect(second).toEqual({ ok: false, reason: 'already_resolved' });
    expect(signalValues).toHaveBeenCalledTimes(1);
  });

  it('maps a unique-index race on the signal insert to duplicate_signal', async () => {
    const updateReturning = vi.fn().mockResolvedValue([{ id: 3 }]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mocks.db.update.mockReturnValue({ set: updateSet });
    mocks.db.select.mockReturnValue(
      selectChain([{ id: 3, companyId: 1, signalType: 'cost_pressure', strength: 'medium', detectedAt: '2026-07-31', evidenceUrl: 'https://example.com/cost', reasoning: 'r' }]),
    );
    // Concurrent duplicate accept: the unique index signal(company_id,
    // signal_type) rejects the insert with Postgres code 23505.
    const signalValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockRejectedValue({ code: '23505', message: 'duplicate key value violates unique constraint' }),
    });
    mocks.db.insert.mockReturnValue({ values: signalValues });

    const result = await acceptProposal(3);

    expect(result).toEqual({ ok: false, reason: 'duplicate_signal' });
  });

  it('lists only pending proposals with evidence inline, company name and run trace linkage', async () => {
    const rows = [
      {
        id: 3,
        companyId: 1,
        runId: 9,
        companyName: 'Acme Corp',
        signalType: 'cost_pressure',
        strength: 'medium',
        detectedAt: '2026-07-31',
        evidenceUrl: 'https://example.com/cost',
        reliability: 'R2',
        confidence: 'C2',
        evidenceSnippet: 'Acme faces cost pressure',
        reasoning: 'News coverage indicates cost pressure',
        status: 'pending',
        resolvedAt: null,
        createdAt: new Date('2026-07-31T10:00:00Z'),
        traceId: 'trace_123',
        traceUrl: 'https://cloud.langfuse.com/trace/123',
      },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const leftJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ leftJoin });
    mocks.db.select.mockReturnValue({ from });

    const result = await listPendingProposals();

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(signalProposal);
    // join agent_run so the review UI gets the Langfuse "View trace" link
    expect(leftJoin).toHaveBeenCalledWith(agentRun, expect.anything());
    // pending-only filter (ANLZ-03)
    expect(where).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
  });

  it('counts pending proposals for the ANLZ-04 badge', async () => {
    const where = vi.fn().mockResolvedValue([{ count: 3 }]);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await countPendingProposals();

    expect(result).toBe(3);
    expect(from).toHaveBeenCalledWith(signalProposal);
  });
});
