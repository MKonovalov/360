import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsTabs } from './settings-tabs';

describe('SettingsTabs', () => {
  it('renders AI Models and Data Sources as separate settings tabs', () => {
    const html = renderToStaticMarkup(
      <SettingsTabs modelSettings={<p>Model settings body</p>} dataSources={<p>Data source body</p>} />,
    );

    expect(html).toContain('AI Models');
    expect(html).toContain('Data Sources');
    expect(html).toContain('Model settings body');
    expect(html).toContain('aria-controls="radix-');
  });
});
