import { describe, expect, it } from 'vitest';

import type { NormalizedSearchCandidate } from './normalizeSearchPacket';
import { matchSearchCandidate, type PersonaMatchRecord } from './searchMatching';

const emptyPersona = {
  firstName: null,
  lastName: null,
  fullName: 'Ada Lovelace',
  title: null,
  email: null,
  linkedinUrl: null,
  phone: null,
  location: null,
  department: null,
  function: null,
  seniority: null,
  companyName: null,
  companyDomain: 'example.com',
  bio: null,
  photoUrl: null,
};

function makeCandidate(overrides: Partial<NormalizedSearchCandidate['persona']> = {}): NormalizedSearchCandidate {
  return {
    candidateId: 'candidate-1',
    persona: { ...emptyPersona, ...overrides },
    normalizedKeys: {
      email: overrides.email ? String(overrides.email).toLowerCase() : null,
      linkedinUrl: overrides.linkedinUrl ? String(overrides.linkedinUrl).toLowerCase() : null,
      name: String(overrides.fullName ?? emptyPersona.fullName).toLowerCase(),
      companyDomain: String(overrides.companyDomain ?? emptyPersona.companyDomain).toLowerCase(),
    },
    buyerRoleProposals: [],
    sources: [],
    claims: [],
  };
}

function makePersona(overrides: Partial<PersonaMatchRecord> = {}): PersonaMatchRecord {
  return { id: 1, name: 'Ada Lovelace', email: null, linkedinUrl: null, companyDomain: 'example.com', ...overrides };
}

describe('matchSearchCandidate', () => {
  it('uses email before LinkedIn and name-plus-domain matches', () => {
    const result = matchSearchCandidate({
      candidate: makeCandidate({ email: 'ADA@EXAMPLE.COM', linkedinUrl: 'https://linkedin.com/in/ada' }),
      companyDomain: 'example.com',
      personas: [
        makePersona({ id: 1, email: 'ada@example.com' }),
        makePersona({ id: 2, linkedinUrl: 'https://linkedin.com/in/ada' }),
        makePersona({ id: 3 }),
      ],
    });

    expect(result).toEqual({ kind: 'existing_persona', personaId: 1, matchedBy: 'email' });
  });

  it('uses LinkedIn before name-plus-domain when email is unavailable', () => {
    const result = matchSearchCandidate({
      candidate: makeCandidate({ email: null, linkedinUrl: 'https://www.linkedin.com/in/ada/' }),
      companyDomain: 'example.com',
      personas: [makePersona({ id: 2, linkedinUrl: 'https://linkedin.com/in/ada?trk=foo' })],
    });

    expect(result).toEqual({ kind: 'existing_persona', personaId: 2, matchedBy: 'linkedin_url' });
  });

  it('uses normalized name plus the selected Company domain as the final exact key', () => {
    const result = matchSearchCandidate({
      candidate: makeCandidate({ email: null, linkedinUrl: null, fullName: '  ADA   LOVELACE ' }),
      companyDomain: 'HTTPS://WWW.EXAMPLE.COM/',
      personas: [makePersona({ id: 3, name: 'Ada Lovelace', companyDomain: 'example.com' })],
    });

    expect(result).toEqual({ kind: 'existing_persona', personaId: 3, matchedBy: 'name_company_domain' });
  });

  it('returns all exact matches as an ambiguous result at the winning precedence level', () => {
    const result = matchSearchCandidate({
      candidate: makeCandidate({ email: 'ada@example.com' }),
      companyDomain: 'example.com',
      personas: [makePersona({ id: 9, email: 'ada@example.com' }), makePersona({ id: 4, email: 'ADA@example.com' })],
    });

    expect(result).toEqual({ kind: 'ambiguous', personaIds: [4, 9], matchedBy: 'email' });
  });

  it('never performs fuzzy, name-only, title-only, partial-email, or different-domain linking', () => {
    const result = matchSearchCandidate({
      candidate: makeCandidate({
        fullName: 'Ada Lovelace',
        email: 'ada@',
        linkedinUrl: null,
        title: 'CFO',
      }),
      companyDomain: 'example.com',
      personas: [
        makePersona({ id: 1, name: 'Ada Love', email: 'ada@example.com', companyDomain: 'example.com' }),
        makePersona({ id: 2, name: 'Ada Lovelace', title: 'CFO', companyDomain: null }),
        makePersona({ id: 3, name: 'Ada Lovelace', companyDomain: 'other.com' }),
      ],
    });

    expect(result).toEqual({ kind: 'new_persona' });
  });
});
