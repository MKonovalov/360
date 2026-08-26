import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SearchStatusProjection } from '@/lib/search/contracts';

import {
  SearchLauncherPanel,
  canStartSearch,
  initialSearchTemplateVersionId,
  type SearchTemplateProjection,
} from './SearchLauncher';

const TEMPLATE: SearchTemplateProjection = {
  id: 5,
  versionId: 11,
  name: 'GBS Scout',
  version: 2,
  buyerRoles: [{ id: 7, name: 'CFO' }],
  buyerRoleEvidence: [{
    buyerRoleId: 7,
    buyerRoleName: 'CFO',
    matchedRules: [{
      ruleId: 'finance-leader',
      label: 'Finance leadership',
      required: true,
      match: 'any_selector',
      matchedSelectors: [{ kind: 'role_name', value: 'CFO' }],
    }],
  }],
  evidencePolicy: {
    minimumPublicSources: 1,
    allowedSourceKinds: ['company_site', 'filing'],
    requireHttps: true,
    allowPrivateSources: false,
  },
};

const COMPANY = { id: 42, name: 'Acme', domain: 'acme.example' } as const;

function activeRun(status: SearchStatusProjection['status']): SearchStatusProjection {
  return {
    searchRunId: 73,
    status,
    company: COMPANY,
    template: { id: 5, versionId: 11, name: 'GBS Scout', version: 2 },
    candidateCounts: {
      total: 0,
      pending: 0,
      inconclusive: 0,
      ambiguous: 0,
      approved: 0,
      rejected: 0,
    },
    reviewsUrl: null,
  };
}

describe('SearchLauncher', () => {
  it('defaults to the first active template version without exposing instructions', () => {
    expect(initialSearchTemplateVersionId([TEMPLATE])).toBe('11');

    const html = renderToStaticMarkup(
      <SearchLauncherPanel
        company={COMPANY}
        template={TEMPLATE}
        isStartDisabled={false}
        onStartAction={vi.fn()}
      />,
    );

    expect(html).toContain('Acme');
    expect(html).toContain('acme.example');
    expect(html).toContain('GBS Scout');
    expect(html).toContain('CFO');
    expect(html).toContain('Finance leadership');
    expect(html).not.toContain('resolvedInstructions');
    expect(html).not.toContain('partnerJobId');
  });

  it('does not allow Start without an active template or while a run is active', () => {
    expect(canStartSearch({ templates: [], selectedTemplateVersionId: '', activeRun: null })).toBe(false);
    expect(canStartSearch({ templates: [TEMPLATE], selectedTemplateVersionId: '11', activeRun: activeRun('running') })).toBe(false);
    expect(canStartSearch({ templates: [TEMPLATE], selectedTemplateVersionId: '11', activeRun: null })).toBe(true);
  });

  it('renders the existing active Search state and disables Start', () => {
    const html = renderToStaticMarkup(
      <SearchLauncherPanel
        company={COMPANY}
        template={TEMPLATE}
        activeRun={activeRun('running')}
        isStartDisabled
        onStartAction={vi.fn()}
      />,
    );

    expect(html).toContain('Search is running');
    expect(html).toContain('disabled');
  });
});
