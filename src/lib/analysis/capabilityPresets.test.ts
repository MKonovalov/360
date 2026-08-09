import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_PRESETS,
  listCapabilityPresetCards,
  validateCapabilitySelection,
} from './capabilityPresets';

describe('custom agent capability presets', () => {
  it('D-37-12/D-37-15: exposes exactly safe opaque preset cards', () => {
    expect(Object.keys(CAPABILITY_PRESETS)).toEqual(['none', 'web-research']);

    const cards = listCapabilityPresetCards();
    expect(cards).toHaveLength(2);
    expect(cards[1]).toEqual(expect.objectContaining({ id: 'web-research', provenance: 'internal-policy' }));
    expect(JSON.stringify(cards)).not.toMatch(/credential|provider|invocation|https?:\/\//i);
  });

  it('D-37-13: selection expresses availability without a forced invocation flag', () => {
    const result = validateCapabilitySelection({
      targetType: 'company',
      practiceAreaId: 4,
      capabilityPresetIds: ['web-research'],
    });

    expect(result).toEqual({ ok: true, capabilityPresetIds: ['web-research'] });
    expect(result.ok && 'mustCall' in result).toBe(false);
  });

  it.each([
    ['unknown', 'capabilityPresetIds[0]'],
    ['web-research,web-research', 'capabilityPresetIds[1]'],
  ])('D-37-14: rejects %s capability selection at %s', (selection, path) => {
    const result = validateCapabilitySelection({
      targetType: 'persona',
      practiceAreaId: 4,
      capabilityPresetIds: selection.split(','),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual(expect.objectContaining({ path }));
  });

  it('D-37-14: rejects client-authored provider, credential, and tool identifiers', () => {
    const result = validateCapabilitySelection({
      targetType: 'company',
      practiceAreaId: 4,
      capabilityPresetIds: ['provider:exa'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.path).toBe('capabilityPresetIds[0]');
  });
});
