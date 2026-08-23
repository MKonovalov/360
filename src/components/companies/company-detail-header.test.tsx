import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/enrichment/enrichment-review-dialog', () => ({
  EnrichMenu: ({
    entityType,
    recordId,
  }: {
    readonly entityType: string;
    readonly recordId: number;
  }) => (
    <div data-agent-menu="true" data-entity-type={entityType} data-record-id={recordId}>
      <span>Enrich</span>
      <span>Analyze</span>
    </div>
  ),
}));

import { CompanyDetailHeader, CompanyDetailBackLink } from './company-detail-header';

describe('CompanyDetailHeader', () => {
  it('keeps company identity and both Agent actions in one stable header', () => {
    const markup = renderToStaticMarkup(
      <CompanyDetailHeader
        companyName="Acme Corporation"
        industry="Technology"
        recordId={42}
        canEnrich
        disabledReason="Add a domain first"
      />,
    );

    expect(markup).toContain('Acme Corporation');
    expect(markup).toContain('Technology');
    expect(markup).toContain('data-agent-menu="true"');
    expect(markup).toContain('data-entity-type="company"');
    expect(markup).toContain('data-record-id="42"');
    expect(markup).toContain('Enrich');
    expect(markup).toContain('Analyze');
  });
});

describe('CompanyDetailBackLink', () => {
  it('renders a keyboard-accessible link back to the companies list', () => {
    const markup = renderToStaticMarkup(<CompanyDetailBackLink />);

    expect(markup).toContain('href="/companies"');
    expect(markup).toContain('aria-label="Back to companies"');
  });
});
