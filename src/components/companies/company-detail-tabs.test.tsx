import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompanyDetailTabs } from './company-detail-tabs';

describe('CompanyDetailTabs', () => {
  it('uses the existing line Tabs primitive for URL-driven keyboard tab links', () => {
    const markup = renderToStaticMarkup(<CompanyDetailTabs id={42} activeTab="analysis" />);

    expect(markup).toContain('General');
    expect(markup).toContain('Linked Personas');
    expect(markup).toContain('Related Knowledge');
    expect(markup).toContain('Analysis');
    expect(markup).toContain('href="/companies/42"');
    expect(markup).toContain('href="/companies/42?tab=personas"');
    expect(markup).toContain('href="/companies/42?tab=knowledge"');
    expect(markup).toContain('href="/companies/42?tab=analysis"');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-current="page"');
  });

  it('marks exactly the URL-selected tab and keeps every tab focusable as a link', () => {
    const markup = renderToStaticMarkup(<CompanyDetailTabs id={42} activeTab="personas" />);
    const tabLinks = [...markup.matchAll(/<a\b[^>]*role="tab"[^>]*>/g)].map(([tag]) => tag);
    const selectedLinks = tabLinks.filter((tag) => tag.includes('aria-selected="true"'));

    expect(tabLinks).toHaveLength(4);
    expect(selectedLinks).toHaveLength(1);
    expect(selectedLinks[0]).toContain('href="/companies/42?tab=personas"');
    expect(tabLinks.every((tag) => tag.includes('href="/companies/42'))).toBe(true);
  });
});
