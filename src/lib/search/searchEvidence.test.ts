import { describe, expect, it } from 'vitest';

import type { NormalizedSearchCandidate } from './normalizeSearchPacket';
import { evaluateSearchEvidence, type SearchEvidencePolicy } from './searchEvidence';

const candidate: NormalizedSearchCandidate = {
  candidateId: 'candidate-1',
  persona: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    fullName: 'Ada Lovelace',
    title: 'CFO',
    email: 'ada@example.com',
    linkedinUrl: null,
    phone: null,
    location: null,
    department: 'Finance',
    function: 'Transformation',
    seniority: 'c_level',
    companyName: 'Example',
    companyDomain: 'example.com',
    bio: null,
    photoUrl: null,
  },
  normalizedKeys: {
    email: 'ada@example.com',
    linkedinUrl: null,
    name: 'ada lovelace',
    companyDomain: 'example.com',
  },
  buyerRoleProposals: [
    {
      buyerRoleId: 1,
      buyerRoleName: 'CFO',
      matchedRuleIds: ['rule-finance'],
      confidence: 'supported',
    },
  ],
  sources: [
    {
      sourceId: 'source-1',
      kind: 'company_website',
      url: 'https://example.com/about',
      title: 'About page',
      isPublicHttps: true,
    },
  ],
  claims: [
    {
      claimId: 'claim-1',
      field: 'persona.title',
      value: 'CFO',
      sourceIds: ['source-1'],
      supported: true,
      verified: true,
    },
  ],
};

const policy: SearchEvidencePolicy = {
  minimumPublicSources: 1,
  allowedSourceKinds: ['company_website'],
  requireHttps: true,
  allowPrivateSources: false,
};

describe('evaluateSearchEvidence', () => {
  it('marks a candidate with enough public evidence and every required rule as pending and eligible', () => {
    expect(evaluateSearchEvidence(candidate, policy, ['rule-finance'])).toEqual({
      status: 'pending',
      eligible: true,
      deficiencies: [],
    });
  });

  it('marks evidence-deficient candidates inconclusive with stable deficiencies', () => {
    const result = evaluateSearchEvidence(
      {
        ...candidate,
        sources: [],
      },
      { ...policy, minimumPublicSources: 2 },
      ['rule-finance', 'rule-gbs'],
    );

    expect(result).toEqual({
      status: 'inconclusive',
      eligible: false,
      deficiencies: ['insufficient_public_sources:2', 'missing_required_rule:rule-gbs'],
    });
  });

  it('marks ambiguous deterministic matches ineligible regardless of evidence quality', () => {
    expect(
      evaluateSearchEvidence(
        { ...candidate, match: { kind: 'ambiguous', personaIds: [2, 1], matchedBy: 'email' } },
        policy,
        ['rule-finance'],
      ),
    ).toEqual({
      status: 'ambiguous_match',
      eligible: false,
      deficiencies: ['ambiguous_match:email:1,2'],
    });
  });

  it('treats unsupported claims and disallowed source kinds as deficiencies', () => {
    const result = evaluateSearchEvidence(
      {
        ...candidate,
        sources: [{ ...candidate.sources[0], kind: 'news_article' }],
        claims: [{ ...candidate.claims[0], supported: false, verified: false }],
      },
      policy,
      ['rule-finance'],
    );

    expect(result).toEqual({
      status: 'inconclusive',
      eligible: false,
      deficiencies: ['no_allowed_public_sources', 'unsupported_claim:claim-1'],
    });
  });
});
