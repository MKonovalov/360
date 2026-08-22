import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CompanyDetailLoading from './loading';

describe('/companies/[id] loading state', () => {
  it('shows a responsive stable-header skeleton and slow-tab status', () => {
    const markup = renderToStaticMarkup(<CompanyDetailLoading />);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('Loading company detail');
    expect(markup).toContain('Loading selected section');
    expect(markup).toContain('data-company-detail-loading="true"');
  });
});
