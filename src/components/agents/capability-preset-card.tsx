'use client';

import { Badge } from '@/components/ui/badge';
import type { SafeCapabilityPreset } from './custom-agent-editor';

export function CapabilityPresetCard({
  preset,
  selected,
  onSelect,
}: {
  readonly preset: SafeCapabilityPreset;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={`flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors ${selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
      <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{preset.label}</span>{selected ? <Badge variant="secondary">Selected</Badge> : null}</span>
      <span className="text-xs leading-5 text-slate-600">{preset.purpose}</span>
      <span className="text-[11px] text-slate-500">Up to {preset.limits.maxSources} sources · {preset.limits.maxRequests} requests · {preset.provenance}</span>
    </button>
  );
}
