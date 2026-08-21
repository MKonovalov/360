import { describe, expect, it, vi } from 'vitest';

import {
  createDebugLaunchPreferenceController,
  type DebugLaunchPreferenceController,
  type StorageLike,
} from './debugLaunchPreference';

const STORAGE_KEY = 'arclumen:debug-launch:v1';

class StorageBlockedError extends Error {
  readonly name = 'StorageBlockedError';
}

class MemoryStorage implements StorageLike {
  readonly values: Map<string, string>;
  readonly writes: Array<readonly [string, string]> = [];
  readonly removals: string[] = [];

  getItem: StorageLike['getItem'] = (key) => this.values.get(key) ?? null;
  setItem: StorageLike['setItem'] = (key, value) => {
    this.writes.push([key, value]);
    this.values.set(key, value);
  };
  removeItem: StorageLike['removeItem'] = (key) => {
    this.removals.push(key);
    this.values.delete(key);
  };

  constructor(initial: Readonly<Record<string, string>> = {}) {
    this.values = new Map(Object.entries(initial));
  }
}

async function flushPreferenceWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function readyController(
  storage: StorageLike,
): Promise<DebugLaunchPreferenceController> {
  const controller = createDebugLaunchPreferenceController(storage);
  await flushPreferenceWork();
  return controller;
}

function controlledPromise(): Readonly<{ promise: Promise<void>; resolve: () => void }> {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('debug launch preference controller', () => {
  it('starts Off while storage is read, then confirms an exact On value', async () => {
    // Given
    const storage = new MemoryStorage({ [STORAGE_KEY]: 'on' });

    // When
    const controller = createDebugLaunchPreferenceController(storage);

    // Then
    expect(controller.getSnapshot()).toEqual({
      preference: 'off',
      status: 'loading',
      errorMessage: null,
    });
    await flushPreferenceWork();
    expect(controller.getSnapshot()).toMatchObject({ preference: 'on', status: 'confirmed' });
  });

  it('confirms Off when the versioned session value is missing', async () => {
    // Given
    const storage = new MemoryStorage();

    // When
    const controller = await readyController(storage);

    // Then
    expect(controller.getSnapshot()).toMatchObject({
      preference: 'off',
      status: 'confirmed',
      errorMessage: null,
    });
  });

  it.each(['', 'ON', 'true', 'user_admin', '{"preference":"on"}'])(
    'treats malformed stored value %j as unavailable Off',
    async (value) => {
      // Given
      const storage = new MemoryStorage({ [STORAGE_KEY]: value });

      // When
      const controller = await readyController(storage);

      // Then
      expect(controller.getSnapshot()).toMatchObject({
        preference: 'off',
        status: 'unavailable',
        errorMessage: 'Debug launch setting is unavailable. Debug launches are Off.',
      });
    },
  );

  it('treats missing or throwing storage as unavailable Off', async () => {
    // Given
    const missingController = createDebugLaunchPreferenceController(null);
    const throwingStorage = new MemoryStorage();
    throwingStorage.getItem = () => {
      throw new StorageBlockedError('read blocked');
    };

    // When
    const throwingController = createDebugLaunchPreferenceController(throwingStorage);
    await flushPreferenceWork();

    // Then
    expect(missingController.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
    expect(throwingController.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
  });

  it('keeps the confirmed value while updating and changes it only after the write resolves', async () => {
    // Given
    const storage = new MemoryStorage();
    const controller = await readyController(storage);
    const pending = controlledPromise();
    storage.setItem = vi.fn(() => pending.promise);

    // When
    const update = controller.setPreference('on');

    // Then
    expect(controller.getSnapshot()).toMatchObject({ preference: 'off', status: 'updating' });
    await expect(controller.setPreference('off')).rejects.toThrow();
    pending.resolve();
    await update;
    expect(controller.getSnapshot()).toMatchObject({ preference: 'on', status: 'confirmed' });
  });

  it('ends unavailable Off and rejects when a write fails', async () => {
    // Given
    const storage = new MemoryStorage();
    const controller = await readyController(storage);
    const failure = new StorageBlockedError('write blocked');
    storage.setItem = vi.fn(() => Promise.reject(failure));

    // When
    const update = controller.setPreference('on');

    // Then
    await expect(update).rejects.toBe(failure);
    expect(controller.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
  });

  it('removes stale On when an Off write fails before a later controller reads storage', async () => {
    // Given
    const storage = new MemoryStorage({ [STORAGE_KEY]: 'on' });
    const adminController = await readyController(storage);
    const failure = new StorageBlockedError('write blocked');
    storage.setItem = vi.fn(() => Promise.reject(failure));

    // When
    const update = adminController.setPreference('off');

    // Then
    await expect(update).rejects.toBe(failure);
    expect(adminController.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
    expect(storage.removals).toEqual([STORAGE_KEY]);
    const staffController = await readyController(storage);
    expect(staffController.getSnapshot()).toMatchObject({ preference: 'off', status: 'confirmed' });
  });

  it('resets to Off and prevents stale On reuse after a provider remount', async () => {
    // Given
    const storage = new MemoryStorage({ [STORAGE_KEY]: 'on' });
    const adminController = await readyController(storage);

    // When
    adminController.reset();
    const staffController = createDebugLaunchPreferenceController(storage);

    // Then
    expect(adminController.getSnapshot()).toMatchObject({ preference: 'off', status: 'confirmed' });
    expect(storage.removals).toEqual([STORAGE_KEY]);
    expect(staffController.getSnapshot()).toMatchObject({
      preference: 'off',
      status: 'loading',
    });
    await flushPreferenceWork();
    expect(staffController.getSnapshot()).toMatchObject({ preference: 'off', status: 'confirmed' });
  });

  it('ends unavailable Off when reset cannot remove the value', async () => {
    // Given
    const storage = new MemoryStorage({ [STORAGE_KEY]: 'on' });
    const controller = await readyController(storage);
    storage.removeItem = () => {
      throw new StorageBlockedError('remove blocked');
    };

    // When
    controller.reset();
    expect(controller.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
  });

  it('notifies active subscribers and stops pending notifications after disposal', async () => {
    // Given
    const storage = new MemoryStorage();
    const controller = await readyController(storage);
    const pending = controlledPromise();
    storage.setItem = () => pending.promise;
    const listener = vi.fn();
    controller.subscribe(listener);

    // When
    const update = controller.setPreference('on');
    controller.dispose();
    pending.resolve();
    await update;
    controller.reset();

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
  });

  it('unsubscribe prevents later notifications', async () => {
    // Given
    const storage = new MemoryStorage();
    const controller = await readyController(storage);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    unsubscribe();

    // When
    await controller.setPreference('on');

    // Then
    expect(listener).not.toHaveBeenCalled();
  });

  it('stores only the versioned key and closed preference value', async () => {
    // Given
    const storage = new MemoryStorage();
    const controller = await readyController(storage);

    // When
    await controller.setPreference('on');

    // Then
    expect(storage.writes).toEqual([[STORAGE_KEY, 'on']]);
    const storedValues = storage.writes.map(([, value]) => value);
    expect(JSON.stringify(controller.getSnapshot())).not.toContain('user_');
    expect(JSON.stringify(storedValues)).not.toContain('user_');
    expect(JSON.stringify(storedValues)).not.toContain('launch');
  });
});
