import { describe, expect, it } from 'vitest';

import { resolveRosterDrift } from './refresh-model-catalog';

describe('resolveRosterDrift', () => {
  it('retains an accepted Zen live-only id by returning its preserved row', () => {
    const previousRows = [{ id: 'ling-3.0-flash-free', name: 'Ling-3.0-flash Free' }];

    const result = resolveRosterDrift({
      label: 'Zen',
      cliIds: ['other-model'],
      liveIds: ['other-model', 'ling-3.0-flash-free'],
      knownLiveOnlyIds: new Set(['ling-3.0-flash-free']),
      cliOmissionOnly: true,
      previousProviderRows: previousRows,
      requirePreservedRow: true,
    });

    expect(result.acceptedIds).toEqual(['ling-3.0-flash-free']);
    expect(result.preservedRows).toEqual([previousRows[0]]);
  });

  it('retains a pinned Zen id even when the live roster has rotated it out entirely', () => {
    // Reproduces the observed live behavior: opencode.ai/zen/v1/models
    // dropped ling-3.0-flash-free from its response entirely during this
    // fix's own verification run — the pinned id is neither live-only nor
    // CLI-only anymore, it is simply absent everywhere upstream except the
    // committed snapshot. cliOmissionOnly:true must still preserve it,
    // proving the exception does not silently re-depend on the very live
    // feed it exists to route around.
    const previousRows = [{ id: 'ling-3.0-flash-free', name: 'Ling-3.0-flash Free' }];

    const result = resolveRosterDrift({
      label: 'Zen',
      cliIds: ['other-model'],
      liveIds: ['other-model'],
      knownLiveOnlyIds: new Set(['ling-3.0-flash-free']),
      cliOmissionOnly: true,
      previousProviderRows: previousRows,
      requirePreservedRow: true,
    });

    expect(result.acceptedIds).toEqual(['ling-3.0-flash-free']);
    expect(result.preservedRows).toEqual([previousRows[0]]);
  });

  it('rejects an unknown Zen live-only id', () => {
    expect(() =>
      resolveRosterDrift({
        label: 'Zen',
        cliIds: ['other-model'],
        liveIds: ['other-model', 'brand-new-model'],
        knownLiveOnlyIds: new Set(['ling-3.0-flash-free']),
        cliOmissionOnly: true,
        previousProviderRows: [],
        requirePreservedRow: true,
      })
    ).toThrow(/Zen roster drift — snapshot NOT regenerated[\s\S]*Live-only ids \(1\): brand-new-model/);
  });

  it('rejects a CLI-only id even when live-only drift is fully known', () => {
    expect(() =>
      resolveRosterDrift({
        label: 'Zen',
        cliIds: ['other-model', 'cli-only-model'],
        liveIds: ['other-model'],
        knownLiveOnlyIds: new Set(['ling-3.0-flash-free']),
        cliOmissionOnly: true,
        previousProviderRows: [],
        requirePreservedRow: true,
      })
    ).toThrow(/CLI-only ids \(1\): cli-only-model/);
  });

  it('rejects an accepted id whose row is missing from the previous snapshot', () => {
    expect(() =>
      resolveRosterDrift({
        label: 'Zen',
        cliIds: ['other-model'],
        liveIds: ['other-model', 'ling-3.0-flash-free'],
        knownLiveOnlyIds: new Set(['ling-3.0-flash-free']),
        cliOmissionOnly: true,
        previousProviderRows: [{ id: 'some-other-id' }],
        requirePreservedRow: true,
      })
    ).toThrow(/Known-drift id "ling-3\.0-flash-free" has no preserved row/);
  });

  it('accepts known Go drift without requiring a preserved row', () => {
    const result = resolveRosterDrift({
      label: 'Go',
      cliIds: ['other-go-model'],
      liveIds: ['other-go-model', 'minimax-m2.5'],
      knownLiveOnlyIds: new Set(['minimax-m2.5']),
      cliOmissionOnly: false,
      previousProviderRows: null,
      requirePreservedRow: false,
    });

    expect(result.acceptedIds).toEqual(['minimax-m2.5']);
    expect(result.preservedRows).toEqual([]);
  });

  it('rejects a Go id that is CLI-omitted but no longer reported live (missing-based gate)', () => {
    // Go intentionally keeps the stricter, original missing-based gate: an id
    // must still be live to count as known drift. A rotated-away Go id is
    // therefore treated as a genuinely new, unpinned discrepancy — proving
    // Go's exception behavior is unchanged by the Zen fix.
    expect(() =>
      resolveRosterDrift({
        label: 'Go',
        cliIds: ['other-go-model'],
        liveIds: ['other-go-model', 'brand-new-go-model'],
        knownLiveOnlyIds: new Set(['minimax-m2.5']),
        cliOmissionOnly: false,
        previousProviderRows: null,
        requirePreservedRow: false,
      })
    ).toThrow(/Go roster drift — snapshot NOT regenerated/);
  });
});
