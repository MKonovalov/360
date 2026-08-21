export type DebugPreference = 'on' | 'off';

export type DebugPreferenceStatus =
  | 'loading'
  | 'confirmed'
  | 'updating'
  | 'unavailable';

export type DebugPreferenceSnapshot = Readonly<{
  preference: DebugPreference;
  status: DebugPreferenceStatus;
  errorMessage: string | null;
}>;

export interface StorageLike {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void;
}

export interface DebugLaunchPreferenceController {
  getSnapshot(): DebugPreferenceSnapshot;
  subscribe(listener: () => void): () => void;
  setPreference(next: DebugPreference): Promise<void>;
  reset(): void;
  dispose(): void;
}

const STORAGE_KEY = 'arclumen:debug-launch:v1';
const UNAVAILABLE_MESSAGE = 'Debug launch setting is unavailable. Debug launches are Off.';

class DebugPreferenceUnavailableError extends Error {
  readonly name = 'DebugPreferenceUnavailableError';

  constructor() {
    super(UNAVAILABLE_MESSAGE);
  }
}

class DebugPreferenceUpdateInProgressError extends Error {
  readonly name = 'DebugPreferenceUpdateInProgressError';

  constructor() {
    super('A debug launch preference update is already in progress.');
  }
}

class DebugPreferenceControllerDisposedError extends Error {
  readonly name = 'DebugPreferenceControllerDisposedError';

  constructor() {
    super('The debug launch preference controller has been disposed.');
  }
}

export function createDebugLaunchPreferenceController(
  storage: StorageLike | null | undefined,
): DebugLaunchPreferenceController {
  function snapshotFor(
    preference: DebugPreference,
    status: DebugPreferenceStatus,
    errorMessage: string | null,
  ): DebugPreferenceSnapshot {
    return Object.freeze({ preference, status, errorMessage });
  }

  let snapshot = snapshotFor('off', 'loading', null);
  let operationGeneration = 0;
  let isDisposed = false;
  const listeners = new Set<() => void>();
  const initialReadGeneration = operationGeneration;

  function publish(next: DebugPreferenceSnapshot): void {
    if (isDisposed) return;
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function publishUnavailable(): void {
    publish(snapshotFor('off', 'unavailable', UNAVAILABLE_MESSAGE));
  }

  async function readInitialPreference(generation: number): Promise<void> {
    if (storage === null || storage === undefined) {
      if (generation === operationGeneration) publishUnavailable();
      return;
    }

    try {
      const storedValue = await storage.getItem(STORAGE_KEY);
      if (isDisposed || generation !== operationGeneration) return;
      if (storedValue === null || storedValue === 'off') {
        publish(snapshotFor('off', 'confirmed', null));
        return;
      }
      if (storedValue === 'on') {
        publish(snapshotFor('on', 'confirmed', null));
        return;
      }
      publishUnavailable();
    } catch (_error: unknown) {
      if (!isDisposed && generation === operationGeneration) publishUnavailable();
    }
  }

  queueMicrotask(() => {
    void readInitialPreference(initialReadGeneration);
  });

  return {
    getSnapshot(): DebugPreferenceSnapshot {
      return snapshot;
    },

    subscribe(listener: () => void): () => void {
      if (isDisposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async setPreference(next: DebugPreference): Promise<void> {
      if (isDisposed) throw new DebugPreferenceControllerDisposedError();
      if (snapshot.status === 'updating') throw new DebugPreferenceUpdateInProgressError();
      if (snapshot.status !== 'confirmed' || storage === null || storage === undefined) {
        throw new DebugPreferenceUnavailableError();
      }

      const confirmedPreference = snapshot.preference;
      const generation = ++operationGeneration;
      publish(snapshotFor(confirmedPreference, 'updating', null));

      try {
        await storage.setItem(STORAGE_KEY, next);
        if (isDisposed) return;
        if (generation !== operationGeneration) {
          storage.removeItem(STORAGE_KEY);
          return;
        }
        publish(snapshotFor(next, 'confirmed', null));
      } catch (error: unknown) {
        try {
          storage.removeItem(STORAGE_KEY);
        } catch (cleanupError: unknown) {
          void cleanupError;
        }
        if (!isDisposed && generation === operationGeneration) publishUnavailable();
        throw error;
      }
    },

    reset(): void {
      if (isDisposed) return;
      operationGeneration += 1;
      try {
        storage?.removeItem(STORAGE_KEY);
        publish(snapshotFor('off', 'confirmed', null));
      } catch (_error: unknown) {
        publishUnavailable();
      }
    },

    dispose(): void {
      if (isDisposed) return;
      operationGeneration += 1;
      isDisposed = true;
      snapshot = snapshotFor('off', 'unavailable', UNAVAILABLE_MESSAGE);
      listeners.clear();
    },
  };
}
