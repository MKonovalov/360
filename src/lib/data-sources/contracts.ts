import { z } from 'zod';

export const DATA_SOURCE_PROVIDER_IDS = ['firecrawl', 'exa', 'apollo', 'prospeo'] as const;
export type DataSourceProviderId = (typeof DATA_SOURCE_PROVIDER_IDS)[number];

export const WEB_RESEARCH_PROVIDER_IDS = ['firecrawl', 'exa'] as const;
export type WebResearchProviderId = (typeof WEB_RESEARCH_PROVIDER_IDS)[number];

export const COMPANY_ENRICHMENT_PROVIDER_IDS = ['apollo', 'prospeo'] as const;
export type CompanyEnrichmentProviderId = (typeof COMPANY_ENRICHMENT_PROVIDER_IDS)[number];

export const PERSONA_ENRICHMENT_PROVIDER_IDS = ['apollo', 'prospeo'] as const;
export type PersonaEnrichmentProviderId = (typeof PERSONA_ENRICHMENT_PROVIDER_IDS)[number];

export const DEFAULT_DATA_SOURCE_SELECTION = {
  webResearchProvider: 'firecrawl',
  companyEnrichmentProvider: 'apollo',
  personaEnrichmentProvider: 'prospeo',
} as const satisfies DataSourceSelection;

export type DataSourceSelection = {
  readonly webResearchProvider: WebResearchProviderId;
  readonly companyEnrichmentProvider: CompanyEnrichmentProviderId;
  readonly personaEnrichmentProvider: PersonaEnrichmentProviderId;
};

export const dataSourceSelectionSchema = z
  .object({
    webResearchProvider: z.enum(WEB_RESEARCH_PROVIDER_IDS),
    companyEnrichmentProvider: z.enum(COMPANY_ENRICHMENT_PROVIDER_IDS),
    personaEnrichmentProvider: z.enum(PERSONA_ENRICHMENT_PROVIDER_IDS),
  })
  .strict();

export const dataSourceProviderMetadata = {
  firecrawl: {
    label: 'Firecrawl',
    description: 'Web search and page retrieval for grounded research.',
    capability: 'Web research',
  },
  exa: {
    label: 'Exa',
    description: 'Selectable for future web research support.',
    capability: 'Web research',
  },
  apollo: {
    label: 'Apollo',
    description: 'Enrichment from a company domain or work email.',
    capability: 'Company and persona enrichment',
  },
  prospeo: {
    label: 'Prospeo',
    description: 'Enrichment from a company domain or work email.',
    capability: 'Company and persona enrichment',
  },
} as const satisfies Record<
  DataSourceProviderId,
  { readonly label: string; readonly description: string; readonly capability: string }
>;

export type DataSourceAvailabilityStatus = 'available' | 'not_configured' | 'unavailable';

export type DataSourceAvailability = {
  readonly provider: DataSourceProviderId;
  readonly status: DataSourceAvailabilityStatus;
};

export type DataSourceSettingsView = DataSourceSelection & {
  readonly availability: readonly DataSourceAvailability[];
};

export function parseDataSourceSelection(input: unknown): DataSourceSelection {
  return dataSourceSelectionSchema.parse(input);
}
