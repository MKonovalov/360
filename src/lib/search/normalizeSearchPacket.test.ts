import { describe, expect, it } from 'vitest';

import {
  normalizeSearchDomain,
  normalizeSearchEmail,
  normalizeSearchLinkedInUrl,
  normalizeSearchName,
  normalizeSearchPacket,
} from './normalizeSearchPacket';

const persona = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: ' Ada   Lovelace ',
  title: ' CFO ',
  email: ' ADA@EXAMPLE.COM ',
  linkedinUrl: 'https://www.linkedin.com/in/ada/?trk=profile',
  phone: null,
  location: 'London',
  department: 'Finance',
  function: 'Transformation',
  seniority: 'c_level',
  companyName: 'Analytical Engines Inc',
  companyDomain: 'HTTPS://WWW.EXAMPLE.COM/',
  bio: null,
  photoUrl: null,
};

const source = {
  sourceId: 'source-1',
  kind: 'company_website' as const,
  url: 'https://example.com/about/?utm_source=search&ref=kept',
  title: 'About page',
};

const candidate = {
  candidateId: 'candidate-1',
  persona,
  buyerRoleProposals: [
    {
      buyerRoleId: 1,
      buyerRoleName: 'CFO',
      matchedRuleIds: ['rule-finance'],
      confidence: 'supported' as const,
    },
  ],
  sources: [source],
  claims: [
    {
      claimId: 'claim-1',
      field: 'persona.title',
      value: 'CFO',
      sourceIds: ['source-1'],
    },
  ],
};

describe('normalizeSearchEmail, normalizeSearchName, normalizeSearchDomain, and normalizeSearchLinkedInUrl', () => {
  it('applies Unicode normalization, whitespace folding, and lowercase matching keys', () => {
    expect(normalizeSearchEmail('  ADA@Example.COM ')).toBe('ada@example.com');
    expect(normalizeSearchName('  Ada\u00a0  Lovelace ')).toBe('ada lovelace');
    expect(normalizeSearchDomain(' HTTPS://WWW.Example.COM/ ')).toBe('example.com');
  });

  it('removes LinkedIn tracking parameters, fragments, and trailing slashes', () => {
    expect(normalizeSearchLinkedInUrl('https://www.linkedin.com/in/ada/?trk=profile#about')).toBe(
      'https://www.linkedin.com/in/ada',
    );
  });
});

describe('normalizeSearchPacket', () => {
  it('normalizes Persona fields and sources while producing a stable packet hash', () => {
    const first = normalizeSearchPacket(
      { schemaVersion: 1, candidates: [candidate] },
      { resolvedRuleIds: ['rule-finance'] },
    );
    const reordered = normalizeSearchPacket(
      {
        candidates: [
          {
            claims: candidate.claims,
            sources: candidate.sources,
            buyerRoleProposals: candidate.buyerRoleProposals,
            persona: candidate.persona,
            candidateId: candidate.candidateId,
          },
        ],
        schemaVersion: 1,
      },
      { resolvedRuleIds: ['rule-finance'] },
    );

    expect(first.ok).toBe(true);
    expect(reordered.ok).toBe(true);
    if (!first.ok || !reordered.ok) throw new Error('expected valid packets');

    expect(first.packetHash).toBe(reordered.packetHash);
    expect(first.candidates[0]?.persona).toMatchObject({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      companyDomain: 'example.com',
    });
    expect(first.candidates[0]?.normalizedKeys).toEqual({
      email: 'ada@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      name: 'ada lovelace',
      companyDomain: 'example.com',
    });
    expect(first.candidates[0]?.sources[0]?.url).toBe('https://example.com/about?ref=kept');
  });

  it('keeps valid candidates and records invalid candidates as diagnostics-only', () => {
    const result = normalizeSearchPacket({
      schemaVersion: 1,
      candidates: [
        { ...candidate, candidateId: 'invalid-1', persona: { ...persona, fullName: '' } },
        { ...candidate, candidateId: 'valid-1' },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected packet envelope to be valid');
    expect(result.candidates.map(({ candidateId }) => candidateId)).toEqual(['valid-1']);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ candidateId: 'invalid-1', code: 'invalid_candidate' }),
    ]);
  });

  it('deduplicates canonical source URLs and preserves unsupported claims as unverified diagnostics', () => {
    const result = normalizeSearchPacket({
      schemaVersion: 1,
      candidates: [
        {
          ...candidate,
          sources: [
            source,
            { ...source, sourceId: 'source-2', url: 'https://example.com/about/?ref=kept#fragment' },
          ],
          claims: [
            ...candidate.claims,
            { claimId: 'claim-2', field: 'persona.untrustedField', value: 'x', sourceIds: ['source-2'] },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected valid packet envelope');
    expect(result.candidates[0]?.sources).toHaveLength(1);
    expect(result.candidates[0]?.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claimId: 'claim-2', supported: false, sourceIds: ['source-1'] }),
      ]),
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate_source_url' }),
        expect.objectContaining({ code: 'unsupported_claim', claimId: 'claim-2' }),
      ]),
    );
  });

  it('rejects unsafe top-level packet shape and never accepts Markdown as machine input', () => {
    const result = normalizeSearchPacket({ schemaVersion: 1, candidates: [], markdown: 'debug transcript' });

    expect(result).toMatchObject({ ok: false, reason: 'invalid_packet' });
  });

  it('records missing source references and rejects unsupported source kinds without creating candidates', () => {
    const result = normalizeSearchPacket({
      schemaVersion: 1,
      candidates: [
        {
          ...candidate,
          sources: [{ ...source, kind: 'other' as const }],
          claims: [{ ...candidate.claims[0], sourceIds: ['missing-source'] }],
        },
        {
          ...candidate,
          candidateId: 'unsupported-source',
          sources: [{ ...source, kind: 'rumor' as never }],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected packet envelope to be valid');
    expect(result.candidates).toHaveLength(1);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_source_reference' }),
        expect.objectContaining({ code: 'unsupported_source_kind' }),
      ]),
    );
  });
});
