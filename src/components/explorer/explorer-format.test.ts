import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FirmographicField } from './explorer-format';

describe('FirmographicField provenance', () => {
  it('renders Apollo provenance when a field was enriched', () => {
    // Given / When
    const html = renderToStaticMarkup(
      createElement(FirmographicField, { label: 'Industry', value: 'Consulting', source: 'apollo' })
    );

    // Then
    expect(html).toContain('>Apollo<');
  });

  it('renders Prospeo provenance for persona enrichment', () => {
    // Given / When
    const html = renderToStaticMarkup(
      createElement(FirmographicField, { label: 'Title', value: 'CFO', source: 'prospeo' })
    );

    // Then
    expect(html).toContain('>Prospeo<');
  });

  it('renders Manual provenance when no marker exists', () => {
    // Given / When
    const html = renderToStaticMarkup(
      createElement(FirmographicField, { label: 'Industry', value: 'Consulting' })
    );

    // Then
    expect(html).toContain('>Manual<');
  });
});
