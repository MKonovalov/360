import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataSourceSettingsForm, statusAfterDataSourceEdit } from './data-source-settings-form';

vi.mock('@/app/actions/settings', () => ({ saveDataSourceSettingsAction: vi.fn() }));

describe('DataSourceSettingsForm', () => {
  it('renders selections and availability labels without any API key values', () => {
    const html = renderToStaticMarkup(
      <DataSourceSettingsForm
        selection={{
          webResearchProvider: 'firecrawl',
          companyEnrichmentProvider: 'apollo',
          personaEnrichmentProvider: 'prospeo',
        }}
        availability={[
          { provider: 'firecrawl', status: 'available' },
          { provider: 'exa', status: 'unavailable' },
          { provider: 'apollo', status: 'not_configured' },
          { provider: 'prospeo', status: 'available' },
        ]}
      />,
    );

    expect(html).toContain('Data Sources');
    expect(html).toContain('Firecrawl');
    expect(html).toContain('Apollo');
    expect(html).toContain('Prospeo');
    expect(html).not.toContain('API_KEY');
  });

  it('clears stale terminal status on edits while preserving an in-flight save', () => {
    expect(statusAfterDataSourceEdit('saved')).toBe('idle');
    expect(statusAfterDataSourceEdit('error')).toBe('idle');
    expect(statusAfterDataSourceEdit('saving')).toBe('saving');
  });
});
