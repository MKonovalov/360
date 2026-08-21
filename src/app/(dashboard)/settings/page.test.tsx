import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

type DebugAdminConfigFixture = {
  captureEnabled: boolean;
  adminUserIds: readonly string[];
};

type SettingsTabsProps = {
  readonly canUseDebugLaunches?: boolean;
  readonly debugSettings?: React.ReactNode;
  readonly modelSettings: React.ReactNode;
  readonly dataSources: React.ReactNode;
};

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  getModelSettingsForUser: vi.fn(),
  getDataSourceSettingsView: vi.fn(),
  debugAdminConfig: {
    captureEnabled: Boolean(false),
    adminUserIds: [] as readonly string[],
  } satisfies DebugAdminConfigFixture,
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/auth/debugAdminConfig', () => ({
  get debugAdminConfig() {
    return mocks.debugAdminConfig;
  },
}));
vi.mock('@/lib/db/queries/userModelSettings', () => ({
  getModelSettingsForUser: mocks.getModelSettingsForUser,
}));
vi.mock('@/lib/data-sources/settings', () => ({
  getDataSourceSettingsView: mocks.getDataSourceSettingsView,
}));
vi.mock('@/lib/models/catalog', () => ({
  SERVABLE_PROVIDERS: [],
  dedupeProviderRows: vi.fn(() => []),
  getModelDisplayName: vi.fn(() => ''),
  getProviderForModelId: vi.fn(() => null),
  getServableIdsForProvider: vi.fn(() => []),
  getUnionServableIds: vi.fn(() => []),
}));
vi.mock('@/lib/models/catalog.json', () => ({ default: { generatedAt: '2026-08-20' } }));
vi.mock('@/lib/agents/modelFactory', () => ({ PROVIDER_DEFAULT_MODELS: {} }));
vi.mock('@/components/settings/model-settings-form', () => ({
  ModelSettingsForm: () => <div>model settings</div>,
}));
vi.mock('@/components/settings/data-source-settings-form', () => ({
  DataSourceSettingsForm: () => <div>data source settings</div>,
}));
vi.mock('@/components/settings/debug-settings-panel', () => ({
  DebugSettingsPanel: ({ panelId }: { readonly panelId: string }) => (
    <div data-panel-id={panelId}>debug settings</div>
  ),
}));
vi.mock('@/components/settings/settings-tabs', () => ({
  SettingsTabs: ({
    canUseDebugLaunches = false,
    debugSettings = null,
  }: SettingsTabsProps) => (
    <div data-can-use-debug-launches={String(canUseDebugLaunches)}>
      {canUseDebugLaunches ? debugSettings : null}
    </div>
  ),
}));

import SettingsPage from './page';

function configurePage({
  userId,
  config,
}: {
  readonly userId: string;
  readonly config: DebugAdminConfigFixture;
}): void {
  mocks.requireStaffAccess.mockResolvedValue({ userId });
  mocks.getModelSettingsForUser.mockResolvedValue(undefined);
  mocks.getDataSourceSettingsView.mockResolvedValue(undefined);
  mocks.debugAdminConfig.captureEnabled = config.captureEnabled;
  mocks.debugAdminConfig.adminUserIds = config.adminUserIds;
}

async function renderSettingsPage(): Promise<string> {
  return renderToStaticMarkup(await SettingsPage());
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('SettingsPage debug capability boundary', () => {
  it('hides Debug when capture is disabled even for an allowlisted-looking user', async () => {
    // Given
    configurePage({
      userId: 'user_admin',
      config: { captureEnabled: false, adminUserIds: ['user_admin'] },
    });
    vi.stubGlobal('window', {
      sessionStorage: { getItem: () => 'on' },
    });

    // When
    const html = await renderSettingsPage();

    // Then
    expect(html).toContain('data-can-use-debug-launches="false"');
    expect(html).not.toContain('debug settings');
    expect(html).not.toContain('user_admin');
  });

  it('passes only true capability for an allowlisted admin when the gate is enabled', async () => {
    // Given
    configurePage({
      userId: 'user_admin',
      config: { captureEnabled: true, adminUserIds: ['user_admin'] },
    });

    // When
    const html = await renderSettingsPage();

    // Then
    expect(html).toContain('data-can-use-debug-launches="true"');
    expect(html).toContain('data-panel-id="debug-settings-panel"');
    expect(html).not.toContain('user_admin');
    expect(html).not.toContain('adminUserIds');
    expect(html).not.toContain('ANALYSIS_DEBUG');
  });

  it('hides Debug for ordinary staff even when the server gate is enabled', async () => {
    // Given
    configurePage({
      userId: 'user_staff',
      config: { captureEnabled: true, adminUserIds: ['user_admin'] },
    });

    // When
    const html = await renderSettingsPage();

    // Then
    expect(html).toContain('data-can-use-debug-launches="false"');
    expect(html).not.toContain('debug settings');
    expect(html).not.toContain('user_staff');
  });

  it('fails closed for invalid configuration and stale On session storage', async () => {
    // Given
    configurePage({
      userId: 'user_admin',
      config: { captureEnabled: false, adminUserIds: [] },
    });
    vi.stubGlobal('window', {
      sessionStorage: { getItem: () => 'on' },
    });

    // When
    const html = await renderSettingsPage();

    // Then
    expect(html).toContain('data-can-use-debug-launches="false"');
    expect(html).not.toContain('Debug');
  });
});
