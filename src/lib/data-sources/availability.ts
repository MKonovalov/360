import 'server-only';

import { env } from '@/lib/env';
import {
  DATA_SOURCE_PROVIDER_IDS,
  type DataSourceAvailability,
  type DataSourceProviderId,
} from './contracts';

const CONFIGURED_PROVIDER_ENV_KEYS = {
  firecrawl: 'FIRECRAWL_API_KEY',
  exa: null,
  apollo: 'APOLLO_API_KEY',
  prospeo: 'PROSPEO_API_KEY',
} as const satisfies Record<DataSourceProviderId, keyof typeof env | null>;

export function resolveDataSourceAvailability(): readonly DataSourceAvailability[] {
  return DATA_SOURCE_PROVIDER_IDS.map((provider) => {
    const envKey = CONFIGURED_PROVIDER_ENV_KEYS[provider];
    if (envKey === null) return { provider, status: 'unavailable' };
    return {
      provider,
      status: env[envKey] ? 'available' : 'not_configured',
    };
  });
}
