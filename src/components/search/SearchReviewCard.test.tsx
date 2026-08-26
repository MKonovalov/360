import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { SearchReviewProjection } from '@/lib/search/contracts';

import { SearchReviewCard } from './SearchReviewCard';

function review(overrides: Partial<SearchReviewProjection> = {}): SearchReviewProjection {
  return {
    reviewId: 501,
    searchRunId: 73,
    packetCandidateId: 'candidate-501',
    company: { id: 42, name: 'Acme Systems', domain: 'acme.example' },
    persona: {
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
      title: 'Chief Financial Officer',
      email: 'jane@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
      phone: '+1 555 0100',
      location: 'New York',
      department: 'Finance',
      function: 'Finance',
      seniority: 'executive',
      companyName: 'Acme Systems',
      companyDomain: 'acme.example',
      bio: 'Leads finance transformation.',
      photoUrl: null,
    },
    buyerRoles: [{
      buyerRoleId: 7,
      buyerRoleName: 'CFO',
      matchedRuleIds: ['finance-leader'],
      confidence: 'supported',
    }],
    sources: [{
      packetSourceId: 'source-1',
      kind: 'news_article',
      url: 'https://news.example/article',
      title: 'Acme announces finance transformation',
      supports: ['claim-1'],
    }],
    claims: [{
      claimId: 'claim-1',
      field: 'persona.title',
      value: 'Chief Financial Officer',
      sourceIds: ['source-1'],
      supported: true,
      verified: true,
    }],
    match: { kind: 'new_persona' },
    eligibility: { eligible: true, deficiencies: [] },
    status: 'pending',
    revision: 3,
    editCount: 2,
    latestEditor: 'Alex Reviewer',
    audit: { editCount: 2, lastEventType: 'search_candidate_edited', lastActorId: 'user-local' },
    ...overrides,
  };
}

const callbacks = {
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onEdit: vi.fn(),
  onSelectedChange: vi.fn(),
  onReload: vi.fn(),
};

describe('SearchReviewCard', () => {
  it('renders the safe candidate, persona, company, role, evidence, and audit projection', () => {
    const html = renderToStaticMarkup(
      <SearchReviewCard review={review()} selected={false} decisionState={{ kind: 'idle' }} {...callbacks} />,
    );

    expect(html).toContain('candidate-501');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Acme Systems');
    expect(html).toContain('Chief Financial Officer');
    expect(html).toContain('CFO');
    expect(html).toContain('finance-leader');
    expect(html).toContain('Acme announces finance transformation');
    expect(html).toContain('2 edits');
    expect(html).toContain('Alex Reviewer');
    expect(html).not.toContain('partnerJobId');
    expect(html).not.toContain('privateReasoning');
  });

  it('renders only public HTTPS source URLs as links and escapes source titles', () => {
    const html = renderToStaticMarkup(
      <SearchReviewCard
        review={review({
          sources: [
            {
              packetSourceId: 'safe',
              kind: 'news_article',
              url: 'https://news.example/safe',
              title: '<Unsafe title>',
              supports: [],
            },
            {
              packetSourceId: 'private',
              kind: 'other',
              url: 'https://localhost/debug',
              title: 'Private source',
              supports: [],
            },
          ],
        })}
        selected={false}
        decisionState={{ kind: 'idle' }}
        {...callbacks}
      />,
    );

    expect(html).toContain('href="https://news.example/safe"');
    expect(html).not.toContain('href="https://localhost/debug"');
    expect(html).toContain('&lt;Unsafe title&gt;');
  });

  it('disables approval for inconclusive or ineligible candidates and explains why', () => {
    const html = renderToStaticMarkup(
      <SearchReviewCard
        review={review({
          status: 'inconclusive',
          eligibility: { eligible: false, deficiencies: ['Missing a public source'] },
        })}
        selected={false}
        decisionState={{ kind: 'idle' }}
        {...callbacks}
      />,
    );

    expect(html).toContain('Missing a public source');
    expect(html).toContain('Approval unavailable until the candidate is eligible.');
    expect(html).toContain('disabled=""');
  });

  it('shows ambiguity and stale-revision reload copy without exposing candidate IDs', () => {
    const html = renderToStaticMarkup(
      <SearchReviewCard
        review={review({ match: { kind: 'ambiguous', personaIds: [12, 13], matchedBy: 'name_company_domain' } })}
        selected={false}
        decisionState={{ kind: 'stale', message: 'This review changed in another session.' }}
        {...callbacks}
      />,
    );

    expect(html).toContain('Ambiguous match');
    expect(html).toContain('This review changed in another session.');
    expect(html).toContain('Reload latest');
    expect(html).not.toContain('12, 13');
  });
});
