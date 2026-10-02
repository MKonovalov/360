import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PersonaDetailTabs } from './persona-detail-tabs';

describe('PersonaDetailTabs', () => {
  it('renders URL-driven tab links with the canonical paths', () => {
    const markup = renderToStaticMarkup(<PersonaDetailTabs id={23} activeTab="analysis" />);

    expect(markup).toContain('href="/personas/23"');
    expect(markup).toContain('href="/personas/23?tab=knowledge"');
    expect(markup).toContain('href="/personas/23?tab=analysis"');
    expect(markup).toContain('Related Knowledge');
  });

  it('marks exactly the URL-selected tab', () => {
    const markup = renderToStaticMarkup(<PersonaDetailTabs id={23} activeTab="knowledge" />);
    const tabLinks = [...markup.matchAll(/<a\b[^>]*role="tab"[^>]*>/g)].map(([tag]) => tag);
    const selected = tabLinks.filter((tag) => tag.includes('aria-selected="true"'));

    expect(tabLinks).toHaveLength(3);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContain('href="/personas/23?tab=knowledge"');
  });
});
