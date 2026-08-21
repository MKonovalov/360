import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type {
  DebugLaunchPreferenceController,
  DebugPreference,
  DebugPreferenceSnapshot,
  DebugPreferenceStatus,
} from '@/lib/analysis/debugLaunchPreference';
import { DebugLaunchPreferenceContext } from '@/components/analysis/debug-launch-preference-provider';
import { DebugSettingsPanel } from './debug-settings-panel';

function controllerFor(snapshot: DebugPreferenceSnapshot): DebugLaunchPreferenceController {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    setPreference: async () => undefined,
    reset: () => undefined,
    dispose: () => undefined,
  };
}

function preferenceSnapshot(
  status: DebugPreferenceStatus,
  preference: DebugPreference = 'off',
  errorMessage: string | null = null,
): DebugPreferenceSnapshot {
  return {
    preference,
    status,
    errorMessage,
  };
}

function renderPanel(snapshot: DebugPreferenceSnapshot): string {
  return renderToStaticMarkup(
    <DebugLaunchPreferenceContext.Provider value={controllerFor(snapshot)}>
      <DebugSettingsPanel panelId="debug-settings-panel" />
    </DebugLaunchPreferenceContext.Provider>,
  );
}

describe('DebugSettingsPanel provider seam', () => {
  it('consumes the controller from the shared provider context and preserves the Off accessibility contract', () => {
    // Given / When
    const html = renderPanel(preferenceSnapshot('confirmed'));

    // Then
    expect(html).toContain('Analysis debug launches');
    expect(html).toContain('Debug Off');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="Enable debug launches for this browser session"');
  });

  it('keeps the confirmed On state and disables the switch while updating', () => {
    // Given / When
    const html = renderPanel(preferenceSnapshot('updating', 'on'));

    // Then
    expect(html).toContain('Debug On');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Updating debug launch setting');
    expect(html).toContain('disabled=""');
  });

  it('fails safely when rendered without the shared provider', () => {
    // Given / When / Then
    expect(() => renderToStaticMarkup(<DebugSettingsPanel panelId="debug-settings-panel" />)).toThrow(
      'useDebugLaunchPreference must be used within a debug launch preference provider.',
    );
  });
});
