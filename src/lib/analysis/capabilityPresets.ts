import type { AnalysisTargetType } from './contracts';

export const CAPABILITY_PRESET_IDS = ['none', 'web-research'] as const;
export type CapabilityPresetId = (typeof CAPABILITY_PRESET_IDS)[number];

type CapabilityPreset = {
  readonly id: CapabilityPresetId;
  readonly label: string;
  readonly purpose: string;
  readonly supportedTargetTypes: readonly AnalysisTargetType[];
  readonly supportedPracticeAreas: 'all';
  readonly limits: {
    readonly maxSources: number;
    readonly maxRequests: number;
  };
  readonly provenance: 'internal-policy';
  readonly compatibilityTags: readonly string[];
  readonly runtimeCapability: 'none' | 'in_house_public_web_research';
};

// D-37-12/D-37-13: runtime capability resolution is server-owned. These IDs
// are availability presets, not executable tool names or forced invocations.
export const CAPABILITY_PRESETS = {
  none: {
    id: 'none',
    label: 'No optional research capability',
    purpose: 'Use the standard analysis path without an optional data source.',
    supportedTargetTypes: ['company', 'persona'],
    supportedPracticeAreas: 'all',
    limits: { maxSources: 0, maxRequests: 0 },
    provenance: 'internal-policy',
    compatibilityTags: ['baseline'],
    runtimeCapability: 'none',
  },
  'web-research': {
    id: 'web-research',
    label: 'Public web research',
    purpose: 'Make bounded public-web research available when server policy requires it.',
    supportedTargetTypes: ['company', 'persona'],
    supportedPracticeAreas: 'all',
    limits: { maxSources: 8, maxRequests: 4 },
    provenance: 'internal-policy',
    compatibilityTags: ['public-web', 'bounded'],
    runtimeCapability: 'in_house_public_web_research',
  },
} as const satisfies Readonly<Record<CapabilityPresetId, CapabilityPreset>>;

export type CapabilityPresetCard = Omit<CapabilityPreset, 'runtimeCapability'>;

export function listCapabilityPresetCards(): readonly CapabilityPresetCard[] {
  return CAPABILITY_PRESET_IDS.map((id) => {
    const preset = CAPABILITY_PRESETS[id];
    const { runtimeCapability: _runtimeCapability, ...card } = preset;
    return card;
  });
}

export type CapabilitySelectionInput = {
  readonly targetType: AnalysisTargetType;
  readonly practiceAreaId: number;
  readonly capabilityPresetIds: readonly string[];
};

export type CapabilityValidationIssue = {
  readonly path: string;
  readonly code: 'unknown' | 'duplicate' | 'incompatible' | 'invalid';
  readonly message: string;
};

export type CapabilitySelectionResult =
  | { readonly ok: true; readonly capabilityPresetIds: readonly CapabilityPresetId[] }
  | { readonly ok: false; readonly issues: readonly CapabilityValidationIssue[] };

function isCapabilityPresetId(value: string): value is CapabilityPresetId {
  return CAPABILITY_PRESET_IDS.some((presetId) => presetId === value);
}

export function validateCapabilitySelection(input: CapabilitySelectionInput): CapabilitySelectionResult {
  const issues: CapabilityValidationIssue[] = [];
  const selected: CapabilityPresetId[] = [];

  input.capabilityPresetIds.forEach((id, index) => {
    const path = `capabilityPresetIds[${index}]`;
    if (!isCapabilityPresetId(id)) {
      issues.push({ path, code: 'unknown', message: 'Select a server-approved capability preset' });
      return;
    }
    if (selected.includes(id)) {
      issues.push({ path, code: 'duplicate', message: 'A capability preset may be selected only once' });
      return;
    }
    selected.push(id);
    const preset = CAPABILITY_PRESETS[id];
    if (!preset.supportedTargetTypes.includes(input.targetType)) {
      issues.push({ path, code: 'incompatible', message: 'This capability is not supported for the selected target or Practice Area' });
    }
  });

  if (selected.includes('none') && selected.length > 1) {
    issues.push({ path: 'capabilityPresetIds', code: 'invalid', message: 'The baseline preset cannot be combined with another capability' });
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, capabilityPresetIds: selected };
}
