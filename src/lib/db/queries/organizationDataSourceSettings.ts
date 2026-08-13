import { eq } from 'drizzle-orm';
import {
  DEFAULT_DATA_SOURCE_SELECTION,
  parseDataSourceSelection,
  type DataSourceSelection,
} from '@/lib/data-sources/contracts';
import { db } from '../index';
import { organizationDataSourceSettings } from '../schema';

const SHARED_SINGLETON_KEY = 1;

export async function getOrganizationDataSourceSettings(): Promise<DataSourceSelection> {
  const [row] = await db
    .select({
      webResearchProvider: organizationDataSourceSettings.webResearchProvider,
      companyEnrichmentProvider: organizationDataSourceSettings.companyEnrichmentProvider,
      personaEnrichmentProvider: organizationDataSourceSettings.personaEnrichmentProvider,
    })
    .from(organizationDataSourceSettings)
    .where(eq(organizationDataSourceSettings.singletonKey, SHARED_SINGLETON_KEY))
    .limit(1);

  return row ? parseDataSourceSelection(row) : DEFAULT_DATA_SOURCE_SELECTION;
}

export async function upsertOrganizationDataSourceSettings(selection: DataSourceSelection): Promise<void> {
  const now = new Date();
  await db
    .insert(organizationDataSourceSettings)
    .values({
      singletonKey: SHARED_SINGLETON_KEY,
      ...selection,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: organizationDataSourceSettings.singletonKey,
      set: {
        ...selection,
        updatedAt: now,
      },
    });
}
