import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, compositeAlpha } from './contrast';

describe('contrastRatio', () => {
  it('returns ~12.30 for the base text on the panel (AA 4.5 pass)', () => {
    expect(contrastRatio([0x33, 0x33, 0x33], [0xfb, 0xfc, 0xfd])).toBeCloseTo(12.3, 2);
  });

  it('returns ~3.11 for the active-pill fill on the panel (AA 1.4.11 pass)', () => {
    expect(contrastRatio([0x90, 0x90, 0x90], [0xfb, 0xfc, 0xfd])).toBeCloseTo(3.11, 2);
  });
});

describe('compositeAlpha', () => {
  it('blends the 70%-alpha label over the panel first, then ratios to ~4.89 (alpha before ratio)', () => {
    expect(compositeAlpha([51, 51, 51], [251, 252, 253], 0.7)).toEqual([111, 111, 112]);
    expect(contrastRatio([111, 111, 112], [251, 252, 253])).toBeCloseTo(4.89, 2);
  });

  it('blends the 4%-alpha Exa-style fill over the panel to ~1.09, locking the deliberate divergence', () => {
    expect(
      contrastRatio(compositeAlpha([0, 0, 0], [251, 252, 253], 0.04), [251, 252, 253])
    ).toBeCloseTo(1.09, 2);
  });
});
