import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompanyDetailKnowledge } from './company-detail-knowledge';

describe('CompanyDetailKnowledge', () => {
  it('renders an explicit empty state when the tab has no matching articles', () => {
    const markup = renderToStaticMarkup(<CompanyDetailKnowledge articles={[]} />);

    expect(markup).toContain('Related Knowledge');
    expect(markup).toContain('No related knowledge found.');
  });
});
