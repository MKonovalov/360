import { describe, expect, it } from 'vitest';
import {
  COMPANY_ENRICHMENT_PROVIDER_IDS,
  DEFAULT_DATA_SOURCE_SELECTION,
  dataSourceSelectionSchema,
  PERSONA_ENRICHMENT_PROVIDER_IDS,
  parseDataSourceSelection,
} from './contracts';

describe('data source contracts', () => {
  it('accepts the complete shared selection tuple', () => {
    const value = parseDataSourceSelection({
      webResearchProvider: 'exa',
      companyEnrichmentProvider: 'apollo',
      personaEnrichmentProvider: 'prospeo',
    });

    expect(value.webResearchProvider).toBe('exa');
  });

  it('accepts either configured enrichment provider for either enrichment role', () => {
    const value = parseDataSourceSelection({
      ...DEFAULT_DATA_SOURCE_SELECTION,
      companyEnrichmentProvider: 'prospeo',
      personaEnrichmentProvider: 'apollo',
    });

    expect(value.companyEnrichmentProvider).toBe('prospeo');
    expect(value.personaEnrichmentProvider).toBe('apollo');
  });

  it('keeps both enrichment roles aligned to the two preconfigured tools', () => {
    expect(COMPANY_ENRICHMENT_PROVIDER_IDS).toEqual(['apollo', 'prospeo']);
    expect(PERSONA_ENRICHMENT_PROVIDER_IDS).toEqual(['apollo', 'prospeo']);
  });

  it('rejects partial or unknown provider tuples', () => {
    expect(() => dataSourceSelectionSchema.parse({ webResearchProvider: 'firecrawl' })).toThrow();
    expect(() =>
      dataSourceSelectionSchema.parse({
        ...DEFAULT_DATA_SOURCE_SELECTION,
        webResearchProvider: 'unknown',
      }),
    ).toThrow();
  });
});
