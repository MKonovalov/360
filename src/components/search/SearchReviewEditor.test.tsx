import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { SearchReviewProjection } from '@/lib/search/contracts';

import {
  SearchReviewEditor,
  buildSearchReviewEditPayload,
  createPersonaDraftFromReview,
  type SearchReviewRoleOption,
} from './SearchReviewEditor';

const REVIEW: SearchReviewProjection = {
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
  buyerRoles: [{ buyerRoleId: 7, buyerRoleName: 'CFO', matchedRuleIds: ['rule-1'], confidence: 'supported' }],
  sources: [],
  claims: [],
  match: { kind: 'new_persona' },
  eligibility: { eligible: true, deficiencies: [] },
  status: 'pending',
  revision: 3,
  editCount: 0,
  latestEditor: null,
  audit: { editCount: 0, lastEventType: null, lastActorId: null },
};

const ROLE_OPTIONS: readonly SearchReviewRoleOption[] = [
  { id: 7, name: 'CFO' },
  { id: 9, name: 'Transformation Lead' },
];

describe('SearchReviewEditor', () => {
  it('renders every Persona-compatible staged field and available role assignments', () => {
    const html = renderToStaticMarkup(
      <SearchReviewEditor
        review={REVIEW}
        roleOptions={ROLE_OPTIONS}
        isSaving={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain('First name');
    expect(html).toContain('Last name');
    expect(html).toContain('Full name');
    expect(html).toContain('LinkedIn URL');
    expect(html).toContain('Biography');
    expect(html).toContain('CFO');
    expect(html).toContain('Transformation Lead');
    expect(html).toContain('Save staged edits');
    expect(html).not.toContain('partnerJobId');
    expect(html).not.toContain('rawInstructions');
  });

  it('copies a projection into a complete draft without dropping nullable fields', () => {
    const draft = createPersonaDraftFromReview(REVIEW);

    expect(draft.fullName).toBe('Jane Doe');
    expect(draft.email).toBe('jane@example.com');
    expect(draft.photoUrl).toBeNull();
    expect(Object.keys(draft)).toHaveLength(15);
  });

  it('builds a revision-independent edit payload with deduplicated sorted role IDs', () => {
    const payload = buildSearchReviewEditPayload({
      persona: REVIEW.persona,
      buyerRoleIds: [9, 7, 9],
      reason: 'Confirmed from the latest source.',
    });

    expect(payload).toEqual({
      persona: REVIEW.persona,
      buyerRoleIds: [7, 9],
      reason: 'Confirmed from the latest source.',
    });
    expect(payload).not.toHaveProperty('expectedRevision');
  });
});
