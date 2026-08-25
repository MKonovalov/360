import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type {
  SearchPersonaEdit,
  SearchReviewEditState,
  StageSearchReviewEditInput,
} from './editSearchReview';
import { buildSearchReviewAuditChanges, editSearchReview } from './editSearchReview';

const basePersona: SearchPersonaEdit = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  title: 'CFO',
  email: 'ada@example.com',
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  phone: '+1 555 0100',
  location: 'London',
  department: 'Finance',
  function: 'Transformation',
  seniority: 'c_level',
  companyName: 'Acme',
  companyDomain: 'acme.example',
  bio: null,
  photoUrl: null,
};

const baseState: SearchReviewEditState = {
  reviewId: 7,
  ownerUserId: 'user_owner',
  status: 'pending',
  revision: 2,
  persona: basePersona,
  buyerRoleIds: [11, 17],
};

function repository(state: SearchReviewEditState = baseState) {
  const getEditState = vi.fn().mockResolvedValue(state);
  const stageEdit = vi.fn().mockImplementation(
    async (input: StageSearchReviewEditInput) => ({
      kind: 'edited',
      revision: input.expectedRevision + 1,
      editCount: 1,
      auditId: 99,
      timestamp: new Date('2026-08-25T12:00:00.000Z'),
    }),
  );
  return { getEditState, stageEdit };
}

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reviewId: 7,
    expectedRevision: 2,
    persona: basePersona,
    buyerRoleIds: [11, 17],
    actorUserId: 'user_owner',
    ...overrides,
  };
}

describe('editSearchReview', () => {
  it('stages a complete nullable Persona edit and add/remove/change role assignments', async () => {
    const editRepository = repository();
    const editedPersona = { ...basePersona, firstName: null, fullName: 'Grace Hopper', title: null };

    const result = await editSearchReview(
      validInput({ persona: editedPersona, buyerRoleIds: [23, 29], reason: 'Corrected after review.' }),
      editRepository,
    );

    expect(result).toMatchObject({ kind: 'edited', revision: 3, auditId: 99 });
    expect(editRepository.stageEdit).toHaveBeenCalledWith(expect.objectContaining({
      persona: editedPersona,
      buyerRoleIds: [23, 29],
    }));
  });

  it('accepts an empty Buyer Role assignment when the edit contract permits it', async () => {
    const editRepository = repository();

    await expect(editSearchReview(validInput({ buyerRoleIds: [] }), editRepository)).resolves.toMatchObject({ kind: 'edited' });
    expect(editRepository.stageEdit).toHaveBeenCalledWith(expect.objectContaining({ buyerRoleIds: [] }));
  });

  it.each([
    ['an unknown top-level field', validInput({ unexpected: true })],
    ['an unknown Persona field', validInput({ persona: { ...basePersona, nickname: 'Ada' } })],
    ['an oversized reason', validInput({ reason: 'x'.repeat(501) })],
  ])('rejects %s without writing', async (_label, input) => {
    const editRepository = repository();

    await expect(editSearchReview(input, editRepository)).resolves.toMatchObject({ kind: 'invalid_input' });
    expect(editRepository.stageEdit).not.toHaveBeenCalled();
  });

  it('returns an unknown-role outcome when a Buyer Role is absent at mutation time', async () => {
    const editRepository = repository();
    editRepository.stageEdit = vi.fn().mockResolvedValue({ kind: 'unknown_role' });

    await expect(editSearchReview(validInput({ buyerRoleIds: [999] }), editRepository)).resolves.toEqual({ kind: 'unknown_role' });
  });

  it('enforces owner scope before accepting a revision', async () => {
    const editRepository = repository({ ...baseState, ownerUserId: 'different_owner' });

    await expect(editSearchReview(validInput(), editRepository)).resolves.toEqual({ kind: 'unauthorized' });
    expect(editRepository.stageEdit).not.toHaveBeenCalled();
  });

  it('returns stale_revision when the submitted revision is not current', async () => {
    const editRepository = repository();

    await expect(editSearchReview(validInput({ expectedRevision: 1 }), editRepository)).resolves.toEqual({ kind: 'stale_revision' });
    expect(editRepository.stageEdit).not.toHaveBeenCalled();
  });

  it('does not stage terminal candidates', async () => {
    const editRepository = repository({ ...baseState, status: 'approved' });

    await expect(editSearchReview(validInput(), editRepository)).resolves.toEqual({ kind: 'ineligible' });
    expect(editRepository.stageEdit).not.toHaveBeenCalled();
  });

  it('maps persistence failures to a safe outcome', async () => {
    const editRepository = repository();
    editRepository.stageEdit = vi.fn().mockRejectedValue(new Error('database unavailable'));

    await expect(editSearchReview(validInput(), editRepository)).resolves.toEqual({ kind: 'persistence_failed' });
  });

  it('builds field-level redacted before/after audit values without domain writes', () => {
    const after = { ...basePersona, email: 'grace@example.com', phone: '+1 555 9999', linkedinUrl: 'https://private.example/grace' };

    const changes = buildSearchReviewAuditChanges(basePersona, after, [11, 17], [23]);

    expect(changes).toEqual(expect.arrayContaining([
      { path: 'persona.email', before: '[REDACTED]', after: '[REDACTED]' },
      { path: 'persona.phone', before: '[REDACTED]', after: '[REDACTED]' },
      { path: 'persona.linkedinUrl', before: '[REDACTED]', after: '[REDACTED]' },
      { path: 'buyerRoleIds', before: '[11,17]', after: '[23]' },
    ]));
    expect(JSON.stringify(changes)).not.toContain('ada@example.com');
    expect(JSON.stringify(changes)).not.toContain('private.example');
    expect(JSON.stringify(changes)).not.toContain('555 9999');
  });

  it('passes only staged candidate data to the mutation repository', async () => {
    const editRepository = repository();

    await editSearchReview(validInput(), editRepository);

    const mutationInput = editRepository.stageEdit.mock.calls[0]?.[0];
    expect(mutationInput).toBeDefined();
    expect(mutationInput).not.toHaveProperty('personaId');
    expect(mutationInput).not.toHaveProperty('companyPersonaRole');
    expect(mutationInput).not.toHaveProperty('companyPersonaRoleBuyerRole');
    expect(mutationInput).not.toHaveProperty('buyerRole');
  });
});
