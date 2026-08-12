export type ModelProviderId = 'anthropic' | 'openrouter' | 'nousresearch' | 'opencode';

export type ProviderGate = { allowlist?: readonly string[]; npm?: readonly string[] };

export const OPENCODE_NPM_GATE: readonly string[] = [
  '@ai-sdk/openai-compatible',
  '@ai-sdk/anthropic',
];

export const PROVIDER_GATES: Record<ModelProviderId, ProviderGate> = {
  anthropic: {},
  openrouter: {},
  nousresearch: {},
  opencode: { npm: OPENCODE_NPM_GATE },
};

export const SERVABLE_PROVIDERS: readonly ModelProviderId[] = [
  'anthropic',
  'openrouter',
  'nousresearch',
  'opencode',
];

export const SNAPSHOT_PROVIDER_IDS: Record<ModelProviderId, readonly string[]> = {
  anthropic: ['anthropic'],
  openrouter: ['openrouter'],
  nousresearch: ['nousresearch'],
  opencode: ['opencode', 'opencode-go'],
};

export const PROVIDER_PRECEDENCE: readonly ModelProviderId[] = [
  'anthropic',
  'nousresearch',
  'openrouter',
  'opencode',
];
