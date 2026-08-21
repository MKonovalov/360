import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type {
  DebugLaunchPreferenceController,
  DebugPreference,
  DebugPreferenceSnapshot,
  DebugPreferenceStatus,
} from '@/lib/analysis/debugLaunchPreference';
import { DebugLaunchPreferenceContext, DebugSettingsPanel } from './debug-settings-panel';
import { SettingsTabs } from './settings-tabs';

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

function controllerFor(snapshot: DebugPreferenceSnapshot): DebugLaunchPreferenceController {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    setPreference: async () => undefined,
    reset: () => undefined,
    dispose: () => undefined,
  };
}

function renderPanel(snapshot: DebugPreferenceSnapshot): string {
  return renderToStaticMarkup(
    <DebugLaunchPreferenceContext.Provider value={controllerFor(snapshot)}>
      <DebugSettingsPanel panelId="debug-settings-panel" />
    </DebugLaunchPreferenceContext.Provider>,
  );
}

describe('SettingsTabs', () => {
  it('renders AI Models and Data Sources as separate settings tabs', () => {
    const html = renderToStaticMarkup(
      <SettingsTabs modelSettings={<p>Model settings body</p>} dataSources={<p>Data source body</p>} />,
    );

    expect(html).toContain('AI Models');
    expect(html).toContain('Data Sources');
    expect(html).toContain('Model settings body');
    expect(html).toContain('aria-controls="radix-');
  });

  it('omits every Debug element for ordinary staff', () => {
    const html = renderToStaticMarkup(
      <SettingsTabs
        modelSettings={<p>Model settings body</p>}
        dataSources={<p>Data source body</p>}
        canUseDebugLaunches={false}
        debugSettings={<p>Debug settings body</p>}
      />,
    );

    expect(html).not.toContain('Debug');
    expect(html).not.toContain('debug launch');
  });

  it('renders Debug after existing tabs only for eligible admins', () => {
    const html = renderToStaticMarkup(
      <SettingsTabs
        modelSettings={<p>Model settings body</p>}
        dataSources={<p>Data source body</p>}
        canUseDebugLaunches
        debugSettings={<p>Debug settings body</p>}
      />,
    );

    expect(html.indexOf('Data Sources')).toBeLessThan(html.indexOf('Debug'));
    expect(html).toContain('Settings sections');
    expect(html).not.toContain('Debug settings body');
  });
});

describe('DebugSettingsPanel', () => {
  it('renders a disabled Loading status while the session preference is read', () => {
    const html = renderPanel(preferenceSnapshot('loading'));

    expect(html).toContain('Loading debug launch setting');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('disabled=""');
  });

  it('renders the confirmed Off state as an unchecked enabled switch', () => {
    const html = renderPanel(preferenceSnapshot('confirmed'));

    expect(html).toContain('Debug Off');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('disabled=""');
  });

  it('renders the confirmed On state as a checked enabled switch', () => {
    const html = renderPanel(preferenceSnapshot('confirmed', 'on'));

    expect(html).toContain('Debug On');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-label="Disable debug launches for this browser session"');
    expect(html).not.toContain('disabled=""');
  });

  it('keeps the confirmed visible value while Updating and disables the switch', () => {
    const html = renderPanel(preferenceSnapshot('updating', 'off'));

    expect(html).toContain('Updating debug launch setting');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Debug Off');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('disabled=""');
  });

  it('fails safe to a disabled Off state when the preference is Unavailable', () => {
    const html = renderPanel(
      preferenceSnapshot(
        'unavailable',
        'off',
        'Debug launch setting is unavailable. Debug launches are Off.',
      ),
    );

    expect(html).toContain('Debug launch setting is unavailable. Debug launches are Off.');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Debug Off');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('disabled=""');
  });

  it('uses a labelled native switch with a visible focus ring and Space-compatible button semantics', () => {
    const html = renderPanel(preferenceSnapshot('confirmed'));

    expect(html).toContain('type="button"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Enable debug launches for this browser session"');
    expect(html).toContain('focus-visible:ring-3');
  });

  it('explains the session scope and failed-attempt-only diagnostics without global or successful-capture claims', () => {
    const html = renderPanel(preferenceSnapshot('confirmed'));

    expect(html).toContain('this browser session only');
    expect(html).toContain('failed-attempt diagnostics only');
    expect(html).toContain('does not enable successful-attempt capture');
    expect(html).toContain('or change other users');
    expect(html).not.toContain('successful raw capture');
    expect(html).not.toContain('global configuration');
  });
});
