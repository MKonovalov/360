'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  createDebugLaunchPreferenceController,
  type DebugLaunchPreferenceController,
  type StorageLike,
} from '@/lib/analysis/debugLaunchPreference';

const STORAGE_KEY = 'arclumen:debug-launch:v1';
const SSR_SAFE_CONTROLLER = createSafeOffController();

export const DebugLaunchPreferenceContext = createContext<DebugLaunchPreferenceController | null>(null);

export function useDebugLaunchPreference(): DebugLaunchPreferenceController {
  const controller = useContext(DebugLaunchPreferenceContext);
  if (controller === null) {
    throw new Error('useDebugLaunchPreference must be used within a debug launch preference provider.');
  }
  return controller;
}

export function useDebugLaunchPreferenceOrSafe(): DebugLaunchPreferenceController {
  return useContext(DebugLaunchPreferenceContext) ?? SSR_SAFE_CONTROLLER;
}

export function DebugLaunchPreferenceProvider({
  canUseDebugLaunches,
  children,
}: {
  readonly canUseDebugLaunches: boolean;
  readonly children: ReactNode;
}) {
  const safeController = useMemo(
    () => createSafeOffController(),
    [],
  );
  const controllerStore = useMemo(
    () => createControllerStore(safeController),
    [safeController],
  );
  const browserController = useSyncExternalStore(
    controllerStore.subscribe,
    controllerStore.getSnapshot,
    controllerStore.getSnapshot,
  );
  useEffect(() => {
    const storage = getSessionStorage();
    if (!canUseDebugLaunches) {
      storage?.removeItem(STORAGE_KEY);
      controllerStore.replace(createConfirmedOffController());
      return;
    }

    const nextController = createDebugLaunchPreferenceController(storage);
    controllerStore.replace(nextController);

    return () => {
      nextController.reset();
      nextController.dispose();
    };
  }, [canUseDebugLaunches, controllerStore, safeController]);

  return (
    <DebugLaunchPreferenceContext.Provider value={browserController}>
      {children}
    </DebugLaunchPreferenceContext.Provider>
  );
}

function createSafeOffController(): DebugLaunchPreferenceController {
  const snapshot = Object.freeze({
    preference: 'off' as const,
    status: 'loading' as const,
    errorMessage: null,
  });

  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    setPreference: async () => undefined,
    reset: () => undefined,
    dispose: () => undefined,
  };
}

export function createConfirmedOffController(): DebugLaunchPreferenceController {
  const snapshot = Object.freeze({
    preference: 'off' as const,
    status: 'confirmed' as const,
    errorMessage: null,
  });

  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    setPreference: async () => undefined,
    reset: () => undefined,
    dispose: () => undefined,
  };
}

function createControllerStore(initialController: DebugLaunchPreferenceController) {
  let currentController = initialController;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => currentController,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replace(nextController: DebugLaunchPreferenceController): void {
      currentController = nextController;
      for (const listener of listeners) listener();
    },
  };
}

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch (error: unknown) {
    if (error instanceof Error) return null;
    throw error;
  }
}
