import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CompanyDetailNotFound from './not-found';

describe('/companies/[id] not-found state', () => {
  it('renders a safe empty state with a real list link', () => {
    const markup = renderToStaticMarkup(<CompanyDetailNotFound />);

    expect(markup).toContain('Company not found');
    expect(markup).toContain('href="/companies"');
    expect(markup).toContain('Back to companies');
  });
});
