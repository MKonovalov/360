import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/db/index', () => ({ db: mocks.db }));
vi.mock('server-only', () => ({}));

import { approveSearchReview } from './approveSearchReview';

const input = {
  reviewId: 7,
  expectedRevision: 2,
  actorUserId: 'user_owner',
};

function resultRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'approved',
    personaId: 31,
    companyId: 42,
    companyPersonaRoleCreated: false,
    buyerRoleResults: [
      { buyerRoleId: 11, created: false },
      { buyerRoleId: 17, created: true },
    ],
    approvalAuditId: 99,
    ...overrides,
  };
}

beforeEach(() => mocks.db.execute.mockReset());

describe('approveSearchReview', () => {
  it('approves an eligible current candidate and returns deterministic reused/created link results', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [resultRow()] });

    await expect(approveSearchReview(input)).resolves.toEqual({
      kind: 'approved',
      personaId: 31,
      companyPersonaRole: { companyId: 42, personaId: 31, created: false },
      buyerRoles: [
        { buyerRoleId: 11, created: false },
        { buyerRoleId: 17, created: true },
      ],
      auditIds: [99],
    });

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('FOR UPDATE');
    expect(sqlText).toContain('persona.email');
    expect(sqlText).toContain('linkedin_url');
    expect(sqlText).toContain('company_persona_role');
    expect(sqlText).toContain('company_persona_role_buyer_role');
    expect(sqlText).toContain('buyer_role');
    expect(sqlText).toContain('search_candidate_audit');
    expect(sqlText).not.toContain('offering_buyer_role');
  });

  it('keeps exact matching precedence and applies only explicitly staged Persona fields', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [resultRow()] });

    await approveSearchReview(input);

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText.indexOf('email')).toBeLessThan(sqlText.indexOf('linkedin_url'));
    expect(sqlText).toContain('name_company_domain');
    expect(sqlText).toContain('search_candidate_edited');
    expect(sqlText).toContain('persona_snapshot');
    expect(sqlText).toContain('CASE');
    expect(sqlText).toContain('fullName');
  });

  it('uses the canonical Search normalization rules for approval matching', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [resultRow()] });

    await approveSearchReview(input);

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('NFKC');
    expect(sqlText).toContain('utm_');
    expect(sqlText).toContain('fbclid');
    expect(sqlText).not.toContain("regexp_replace(regexp_replace(lower(");
  });

  it('sorts retained LinkedIn query parameters without lowercasing their pathname', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [resultRow()] });

    await approveSearchReview(input);

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('regexp_split_to_table');
    expect(sqlText).toContain('WITH ORDINALITY');
    expect(sqlText).toContain('string_agg');
    expect(sqlText).toContain('linkedin.com');
  });

  it('fails closed for unsupported approval Company domains', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [resultRow()] });

    await approveSearchReview(input);

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('THEN NULL');
  });

  it('loads the complete evidence snapshot and resolves concurrent exact-key inserts', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [resultRow()] });

    await approveSearchReview(input);

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('candidate.claims_snapshot');
    expect(sqlText).toContain('ON CONFLICT (email) DO UPDATE SET');
    expect(sqlText).toContain('ON CONFLICT (company_id, persona_id) WHERE is_current = true DO UPDATE SET');
    expect(sqlText).toContain('ON CONFLICT (company_persona_role_id, buyer_role_id) DO UPDATE SET');
  });

  it.each([
    ['ambiguous_match', { kind: 'ambiguous_match' }],
    ['inconclusive evidence', { kind: 'inconclusive' }],
    ['missing Buyer Role', { kind: 'unknown_buyer_role' }],
    ['already terminal', { kind: 'already_terminal' }],
    ['stale revision', { kind: 'stale_revision' }],
    ['unauthorized owner', { kind: 'unauthorized' }],
    ['company identity mismatch', { kind: 'company_mismatch' }],
    ['database conflict', { kind: 'conflict' }],
  ])('returns a safe %s outcome without a domain result', async (_label, row) => {
    mocks.db.execute.mockResolvedValue({ rows: [row] });

    await expect(approveSearchReview(input)).resolves.toEqual(row);
  });

  it('rejects malformed approval input without reaching the database', async () => {
    await expect(approveSearchReview({ ...input, expectedRevision: 0, extra: 'blocked' })).resolves.toEqual({
      kind: 'invalid_input',
    });
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('uses one atomic statement so any branch failure rolls back every write', async () => {
    mocks.db.execute.mockRejectedValueOnce(new Error('constraint failure'));

    await expect(approveSearchReview(input)).resolves.toEqual({ kind: 'persistence_failed' });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.db.execute.mock.calls[0]?.[0])).not.toContain('partner');
  });

  it('maps a database uniqueness conflict to the explicit conflict outcome', async () => {
    mocks.db.execute.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(approveSearchReview(input)).resolves.toEqual({ kind: 'conflict' });
  });

  it('does not expose partner identifiers, prompts, or private reasoning in the approved result', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [resultRow({ partnerJobId: 'secret', prompt: 'hidden' })] });

    const result = await approveSearchReview(input);

    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('hidden');
    expect(result).toEqual(expect.objectContaining({ kind: 'approved' }));
  });
});

describe('approveSearchReview — recordSearchMetric seam', () => {
  const originalSearchFlag = process.env.SEARCH_ENABLED;

  afterEach(() => {
    if (originalSearchFlag === undefined) delete process.env.SEARCH_ENABLED;
    else process.env.SEARCH_ENABLED = originalSearchFlag;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // env.ts snapshots SEARCH_ENABLED at module-load time, so exercising both
  // flag states in the same suite requires reloading approveSearchReview
  // (and its env.ts dependency) fresh per test, after setting process.env —
  // the same pattern security.test.ts/templateContracts.test.ts already use.
  async function loadApproveSearchReview() {
    vi.resetModules();
    const fresh = await import('./approveSearchReview');
    return fresh.approveSearchReview;
  }

  it('emits a bounded approval metric with duplicate-prevention and audit counts when Search is enabled', async () => {
    process.env.SEARCH_ENABLED = 'true';
    const freshApproveSearchReview = await loadApproveSearchReview();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.db.execute.mockResolvedValue({ rows: [resultRow()] });

    await freshApproveSearchReview(input);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [payload] = consoleSpy.mock.calls[0] as [string];
    expect(JSON.parse(payload)).toEqual({
      schemaVersion: 1,
      source: 'search',
      kind: 'approval',
      reviewId: 7,
      conflictCount: 0,
      // resultRow() has companyPersonaRoleCreated: false and one reused Buyer Role (created: false).
      duplicatePreventedCount: 2,
      auditRecorded: true,
    });
  });

  it('emits a conflict-only approval metric on a database uniqueness conflict when Search is enabled', async () => {
    process.env.SEARCH_ENABLED = 'true';
    const freshApproveSearchReview = await loadApproveSearchReview();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.db.execute.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await freshApproveSearchReview(input);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [payload] = consoleSpy.mock.calls[0] as [string];
    expect(JSON.parse(payload)).toEqual({
      schemaVersion: 1,
      source: 'search',
      kind: 'approval',
      reviewId: 7,
      conflictCount: 1,
      duplicatePreventedCount: 0,
      auditRecorded: false,
    });
  });

  it('emits nothing when Search is disabled, and still returns the real approval result', async () => {
    delete process.env.SEARCH_ENABLED;
    const freshApproveSearchReview = await loadApproveSearchReview();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.db.execute.mockResolvedValue({ rows: [resultRow()] });

    const result = await freshApproveSearchReview(input);

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ kind: 'approved' }));
  });
});
