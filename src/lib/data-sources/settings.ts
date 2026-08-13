import 'server-only';

import { getOrganizationDataSourceSettings } from '@/lib/db/queries/organizationDataSourceSettings';
import { resolveDataSourceAvailability } from './availability';
import type { DataSourceSettingsView } from './contracts';

export async function getDataSourceSettingsView(): Promise<DataSourceSettingsView> {
  const [selection, availability] = await Promise.all([
    getOrganizationDataSourceSettings(),
    Promise.resolve(resolveDataSourceAvailability()),
  ]);

  return { ...selection, availability };
}
