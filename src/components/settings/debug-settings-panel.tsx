'use client';

import { useSyncExternalStore } from 'react';

import { useDebugLaunchPreference } from '@/components/analysis/debug-launch-preference-provider';
import type { DebugPreferenceStatus } from '@/lib/analysis/debugLaunchPreference';

export { DebugLaunchPreferenceContext } from '@/components/analysis/debug-launch-preference-provider';

const STATUS_COPY = {
  loading: 'Loading debug launch setting',
  confirmed: null,
  updating: 'Updating debug launch setting',
  unavailable: 'Debug launch setting is unavailable. Debug launches are Off.',
} satisfies Record<DebugPreferenceStatus, string | null>;

export function DebugSettingsPanel({ panelId }: { readonly panelId: string }) {
  const controller = useDebugLaunchPreference();
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const isChecked = snapshot.preference === 'on';
  const isSwitchDisabled = snapshot.status !== 'confirmed';
  const stateLabel = isChecked ? 'Debug On' : 'Debug Off';
  const statusMessage = snapshot.status === 'unavailable'
    ? snapshot.errorMessage ?? STATUS_COPY.unavailable
    : STATUS_COPY[snapshot.status];
  const switchLabel = isChecked
    ? 'Disable debug launches for this browser session'
    : 'Enable debug launches for this browser session';
  const switchId = `${panelId}-switch`;
  const headingId = `${panelId}-heading`;
  const descriptionId = `${panelId}-description`;

  function togglePreference(): void {
    if (isSwitchDisabled) return;

    void controller.setPreference(isChecked ? 'off' : 'on').catch((error: unknown) => {
      if (error instanceof Error) return;
      throw error;
    });
  }

  return (
    <section
      id={panelId}
      aria-labelledby={headingId}
      className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 wrap-anywhere max-sm:p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Analysis debug launches
        </h2>
        <p className="text-sm text-slate-500">
          This preference affects later launches in this browser session only.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={switchId} className="text-sm font-medium text-slate-900">
            Debug launches
          </label>
          <p id={descriptionId} className="text-sm text-slate-500">
            {stateLabel}
          </p>
        </div>
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-label={switchLabel}
          aria-checked={isChecked}
          aria-describedby={descriptionId}
          data-state={isChecked ? 'checked' : 'unchecked'}
          disabled={isSwitchDisabled}
          onClick={togglePreference}
          className="inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-slate-300 bg-slate-100 p-0.5 transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:border-slate-900 data-[state=checked]:bg-slate-900"
        >
          <span
            aria-hidden="true"
            className={`size-4 rounded-full bg-white shadow-sm transition-transform ${isChecked ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-500">
          Debug launches retain failed-attempt diagnostics only, within the existing bounds.
        </p>
        <p className="text-sm text-slate-500">
          This setting does not enable successful-attempt capture or change other users&apos; settings.
        </p>
        {statusMessage !== null ? (
          <p role="status" aria-live="polite" className="text-sm text-slate-600">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
