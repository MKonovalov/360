import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { appendSearchReviewAudit, stageSearchReviewEdit } from './searchReviewAudits';

beforeEach(() => mocks.db.execute.mockReset());

describe('Search Review audits', () => {
  it('appends one typed edit event and never updates or deletes audit history', async () => {
    mocks.db.execute.mockResolvedValue({
      rows: [{
        id: 12,
        searchCandidateId: 7,
        eventType: 'search_candidate_edited',
        actorId: 'user_owner',
        revision: 3,
        changes: [{ path: 'persona.email', before: '[REDACTED]', after: '[REDACTED]' }],
        createdAt: new Date('2026-08-25T12:00:00.000Z'),
      }],
    });

    const event = await appendSearchReviewAudit({
      searchCandidateId: 7,
      actorId: 'user_owner',
      revision: 3,
      changes: [{ path: 'persona.email', before: '[REDACTED]', after: '[REDACTED]' }],
    });

    expect(event).toEqual({
      id: 12,
      searchCandidateId: 7,
      eventType: 'search_candidate_edited',
      actorId: 'user_owner',
      revision: 3,
      changes: [{ path: 'persona.email', before: '[REDACTED]', after: '[REDACTED]' }],
      timestamp: new Date('2026-08-25T12:00:00.000Z'),
    });
    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('search_candidate_audit');
    expect(sqlText).toContain('INSERT');
    expect(sqlText).not.toContain('UPDATE');
    expect(sqlText).not.toContain('DELETE');
  });

  it('redacts direct audit values before building the insert statement', async () => {
    mocks.db.execute.mockResolvedValue({
      rows: [{
        id: 14,
        searchCandidateId: 7,
        eventType: 'search_candidate_edited',
        actorId: 'user_owner',
        revision: 3,
        changes: [],
        createdAt: new Date('2026-08-25T12:00:00.000Z'),
      }],
    });

    await appendSearchReviewAudit({
      searchCandidateId: 7,
      actorId: 'user_owner',
      revision: 3,
      changes: [{
        path: 'persona.email',
        before: 'ada@example.com',
        after: 'https://private.example/ada?token=secretvalue',
      }],
    });

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('[REDACTED]');
    expect(sqlText).not.toContain('ada@example.com');
    expect(sqlText).not.toContain('private.example');
  });

  it('rejects unknown audit paths without writing', async () => {
    const event = await appendSearchReviewAudit({
      searchCandidateId: 7,
      actorId: 'user_owner',
      revision: 3,
      changes: [{ path: 'prompt.raw', before: 'hidden', after: 'leaked' }],
    });

    expect(event).toBeUndefined();
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('rejects oversized audit changes without writing', async () => {
    const event = await appendSearchReviewAudit({
      searchCandidateId: 7,
      actorId: 'user_owner',
      revision: 3,
      changes: Array.from({ length: 21 }, (_, index) => ({
        path: `persona.title`,
        before: String(index),
        after: String(index + 1),
      })),
    });

    expect(event).toBeUndefined();
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('guards the staged candidate update and audit append in one parameterized statement', async () => {
    mocks.db.execute.mockResolvedValue({
      rows: [{ kind: 'edited', revision: 3, editCount: 1, auditId: 13, timestamp: new Date('2026-08-25T12:00:00.000Z') }],
    });

    const result = await stageSearchReviewEdit({
      reviewId: 7,
      expectedRevision: 2,
      actorUserId: 'user_owner',
      persona: {
        firstName: null,
        lastName: null,
        fullName: 'Grace Hopper',
        title: null,
        email: null,
        linkedinUrl: null,
        phone: null,
        location: null,
        department: null,
        function: null,
        seniority: null,
        companyName: null,
        companyDomain: null,
        bio: null,
        photoUrl: null,
      },
      buyerRoleIds: [17],
      changes: [{ path: 'persona.fullName', before: 'Ada Lovelace', after: 'Grace Hopper' }],
    });

    expect(result).toMatchObject({ kind: 'edited', revision: 3, auditId: 13 });
    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('candidate.revision');
    expect(sqlText).toContain('candidate.status');
    expect(sqlText).toContain('search_candidate_audit');
    expect(sqlText).toContain('buyer_role');
    expect(sqlText).not.toContain('UPDATE persona');
    expect(sqlText).not.toContain('UPDATE company_persona_role');
    expect(sqlText).not.toContain('UPDATE buyer_role');
  });

  it('rejects a malformed direct Persona payload without writing', async () => {
    const result = await stageSearchReviewEdit({
      reviewId: 7,
      expectedRevision: 2,
      actorUserId: 'user_owner',
      persona: {
        firstName: null,
        lastName: null,
        fullName: '',
        title: null,
        email: null,
        linkedinUrl: null,
        phone: null,
        location: null,
        department: null,
        function: null,
        seniority: null,
        companyName: null,
        companyDomain: null,
        bio: null,
        photoUrl: null,
      },
      buyerRoleIds: [],
      changes: [],
    });

    expect(result).toEqual({ kind: 'persistence_failed' });
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('returns a stale revision outcome without inventing an updated projection', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [{ kind: 'stale_revision', revision: null, editCount: null, auditId: null, timestamp: null }] });

    await expect(stageSearchReviewEdit({
      reviewId: 7,
      expectedRevision: 1,
      actorUserId: 'user_owner',
      persona: {
        firstName: null,
        lastName: null,
        fullName: 'Grace Hopper',
        title: null,
        email: null,
        linkedinUrl: null,
        phone: null,
        location: null,
        department: null,
        function: null,
        seniority: null,
        companyName: null,
        companyDomain: null,
        bio: null,
        photoUrl: null,
      },
      buyerRoleIds: [],
      changes: [],
    })).resolves.toEqual({ kind: 'stale_revision' });
  });
});
