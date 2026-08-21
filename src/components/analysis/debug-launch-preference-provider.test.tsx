import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  DebugLaunchPreferenceController,
  StorageLike,
} from '@/lib/analysis/debugLaunchPreference';
import { createDebugLaunchPreferenceController } from '@/lib/analysis/debugLaunchPreference';
import {
  createConfirmedOffController,
  DebugLaunchPreferenceProvider,
  useDebugLaunchPreference,
} from './debug-launch-preference-provider';

const STORAGE_KEY = 'arclumen:debug-launch:v1';
const providerSource = readFileSync(
  resolve(process.cwd(), 'src/components/analysis/debug-launch-preference-provider.tsx'),
  'utf8',
);

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

async function flushPreferenceWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const observedControllers: DebugLaunchPreferenceController[] = [];

function PreferenceConsumer({ label }: { readonly label: string }) {
  const controller = useDebugLaunchPreference();
  observedControllers.push(controller);
  const snapshot = controller.getSnapshot();

  return (
    <output
      data-label={label}
      data-preference={snapshot.preference}
      data-status={snapshot.status}
    />
  );
}

afterEach(() => {
  observedControllers.length = 0;
  vi.unstubAllGlobals();
});

describe('DebugLaunchPreferenceProvider', () => {
  it('renders a stable SSR-safe Off/loading controller without identity or storage exposure', () => {
    // Given
    let sessionStorageReads = 0;
    vi.stubGlobal('window', {
      get sessionStorage() {
        sessionStorageReads += 1;
        throw new Error('sessionStorage must not be read during SSR');
      },
    });

    // When
    const html = renderToStaticMarkup(
      <DebugLaunchPreferenceProvider canUseDebugLaunches={false}>
        <PreferenceConsumer label="ssr" />
      </DebugLaunchPreferenceProvider>,
    );

    // Then
    expect(html).toContain('data-preference="off"');
    expect(html).toContain('data-status="loading"');
    expect(html).not.toMatch(/user_/);
    expect(sessionStorageReads).toBe(0);
  });

  it('shares one safe controller across all descendants before the browser controller mounts', () => {
    // Given / When
    renderToStaticMarkup(
      <DebugLaunchPreferenceProvider canUseDebugLaunches={false}>
        <PreferenceConsumer label="settings" />
        <PreferenceConsumer label="launcher" />
      </DebugLaunchPreferenceProvider>,
    );

    // Then
    expect(observedControllers).toHaveLength(2);
    expect(observedControllers[0]).toBe(observedControllers[1]);
    expect(observedControllers[0]?.getSnapshot()).toMatchObject({
      preference: 'off',
      status: 'loading',
    });
    expect(JSON.stringify(observedControllers[0]?.getSnapshot())).not.toMatch(/user_/);
  });

  it('resets stale On before a new capability-boundary controller can read storage', async () => {
    // Given
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, 'on');
    const adminController = createDebugLaunchPreferenceController(storage);
    await flushPreferenceWork();

    // When
    adminController.reset();
    adminController.dispose();
    const staffController = createDebugLaunchPreferenceController(storage);

    // Then
    expect(adminController.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
    expect(staffController.getSnapshot()).toMatchObject({
      preference: 'off',
      status: 'loading',
    });
    await flushPreferenceWork();
    expect(staffController.getSnapshot()).toMatchObject({ preference: 'off', status: 'confirmed' });
  });

  it('disposal stops the previous controller from notifying after identity replacement', async () => {
    // Given
    const storage = new MemoryStorage();
    const controller = createDebugLaunchPreferenceController(storage);
    await flushPreferenceWork();
    const listener = vi.fn();
    controller.subscribe(listener);

    // When
    controller.dispose();
    controller.reset();

    // Then
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
  });

  it('uses only a capability boolean to force Off and clean storage when disabled', () => {
    // Given / When
    const capabilityContract = providerSource;

    // Then
    expect(capabilityContract).toContain('readonly canUseDebugLaunches: boolean');
    expect(capabilityContract).toContain('if (!canUseDebugLaunches)');
    expect(capabilityContract).toMatch(/if \(!canUseDebugLaunches\)[\s\S]*removeItem\(STORAGE_KEY\)/u);
    expect(capabilityContract).not.toContain('userId');
    expect(capabilityContract).not.toMatch(/user_[A-Za-z0-9_-]+/u);
  });

  it('exposes mounted ineligible state as confirmed Off without enabling debug or storage access', async () => {
    // Given
    const controller = createConfirmedOffController();

    // When
    await controller.setPreference('on');

    // Then
    expect(controller.getSnapshot()).toEqual({
      preference: 'off',
      status: 'confirmed',
      errorMessage: null,
    });
  });

  it('throws a developer-facing error when the hook is used outside the provider', () => {
    // Given / When / Then
    expect(() => renderToStaticMarkup(<PreferenceConsumer label="orphan" />)).toThrow(
      'useDebugLaunchPreference must be used within a debug launch preference provider.',
    );
  });
});
