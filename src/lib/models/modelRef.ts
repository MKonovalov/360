import type { ModelProviderId } from './catalog';

export type ModelRef = {
  readonly provider: ModelProviderId;
  readonly modelId: string;
};
