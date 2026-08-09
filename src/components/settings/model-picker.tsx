'use client';

import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// Client-safe (T-17-09): value imports are limited to the pure logic module
// and UI primitives — the committed model snapshot never crosses into this
// client component. ServableModel is a type-only import (erased at compile);
// the trigger-badge provider union is derived from it by indexed access
// (ServableModel['providerID']) rather than a second type import — the
// canonical union source does not re-export the type through the logic
// module, and a raw path import here would trip the client-safety canary.
import {
  groupByProvider,
  isHighCost,
  pinnedSelection,
  providerName,
  rowCaption,
  searchValue,
  triggerLabel,
} from './model-picker-logic';
import type { ServableModel } from './model-picker-logic';

export function ModelPicker({
  id,
  ariaLabel,
  value,
  valueName,
  options,
  onChange,
  placeholder,
  badge,
  grouped = false,
  staleLabel = null,
}: {
  id: string;
  ariaLabel: string;
  value: string;
  // Display name for the closed trigger, resolved by the caller (form) from a
  // name-resolvable source OTHER than the deduped options list (CR-01) — the
  // primary slot's own id is excluded from its options by design, so an
  // options lookup can never resolve it. Omit for unknown/stale values so the
  // raw-id fallback and the staleLabel path keep working.
  valueName?: string | null;
  options: ServableModel[];
  onChange: (id: string) => void;
  placeholder: string;
  badge?: ServableModel['providerID']; // trigger badge (D-21-10) — required for the primary picker + closed state
  grouped?: boolean; // true → provider sections for union option lists; false → one provider-scoped section
  staleLabel?: string | null; // non-null → append a disabled CommandItem with this label (D-10/D-11 stale-row rendering)
}) {
  const [open, setOpen] = useState(false);
  // Provider sections (D-21-08): grouped mode buckets union options by
  // provider; provider-scoped slots render one section header.
  const byProvider = grouped ? groupByProvider(options) : null;
  const groups: { provider: ServableModel['providerID']; models: ServableModel[] }[] = byProvider
    ? (Object.keys(byProvider) as ServableModel['providerID'][]).map((provider) => ({
        provider,
        models: byProvider[provider],
      }))
    : [{ provider: options[0]?.providerID ?? 'anthropic', models: options }];
  // WR-02/current-selection pin: a known value excluded from its own options
  // (the primary slot's deduped list) renders as a disabled, checked row
  // before the groups — the value is never lost from the open list, and a
  // legitimately empty list (anthropic single-model) gets its explanation
  // instead of "No models found." (see pinnedSelection in model-picker-logic).
  const pin = pinnedSelection(value, options, valueName);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          id={id}
          aria-label={ariaLabel}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {badge ? (
              <Badge variant="secondary" className="mr-1.5">
                {providerName(badge)}
              </Badge>
            ) : null}
            {/* triggerLabel (model-picker-logic) resolves the closed-trigger
                name: valueName when supplied (the CR-01 primary case — the
                deduped options can never resolve the primary id), then the
                options lookup, then the raw-value fallback that keeps a stale
                saved id visible (UI-SPEC §Row Anatomy); '' (an in-progress
                fallback row) shows the placeholder instead. */}
            {triggerLabel(value, options, valueName) ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput aria-label={`Search ${ariaLabel}`} placeholder="Search models…" autoFocus />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            {/* Pinned current-selection row (WR-02/GAP-2): renders when a known
                value is excluded from its own options (primary slot dedupe) —
                it keeps the current model visible + checked (data-checked
                drives the vendored CheckIcon) and explains a legitimately
                empty list (single-model anthropic case) instead of leaving
                "No models found." unexplained. Disabled so it can never be
                re-selected into the draft. */}
            {pin ? (
              <CommandItem
                key={value}
                value={searchValue({ id: value, name: pin.name, family: '' })}
                disabled
                data-checked
              >
                <span className="truncate">
                  {pin.name}
                  {pin.onlyModel ? (
                    <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                      {' '}— only available {providerName(badge ?? 'anthropic')} model
                    </span>
                  ) : null}
                </span>
              </CommandItem>
            ) : null}
            {groups.map((g) => (
              <CommandGroup key={g.provider} heading={providerName(g.provider)}>
                {g.models.map((m) => {
                  // cmdk 1.1.1 sets only data-selected / aria-selected /
                  // data-disabled, never data-checked — the vendored v4
                  // CommandItem auto-renders its Check icon gated on
                  // group-data-[checked=true]; without this attribute the
                  // selected row shows no check (RESEARCH Pitfall 1). This is
                  // the single most likely silent-failure point in the phase.
                  return (
                    <CommandItem
                      key={m.id}
                      value={searchValue(m)}
                      data-checked={value === m.id}
                      onSelect={(v) => {
                        // The CommandItem value is the COMPOSITE search string
                        // (id + name + family), so onSelect delivers the
                        // composite — reverse-lookup to the id before onChange,
                        // or the draft stores the composite and Save fails
                        // invalid_model (Pitfall 3). The `?? ''` mirrors the
                        // existing empty-fallback-row convention ('' =
                        // in-progress row).
                        onChange(options.find((o) => searchValue(o) === v)?.id ?? '');
                        setOpen(false);
                      }}
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span>
                          {grouped ? (
                            <Badge variant="secondary" className="mr-1.5">
                              {providerName(m.providerID)}
                            </Badge>
                          ) : null}
                          {m.name}
                          {rowCaption(m) ? (
                            <span className="text-[12px] font-normal leading-[1.4] text-slate-500"> · {rowCaption(m)}</span>
                          ) : null}
                          {/* D-26-05 (corrected): cost caption stays unconditional — no
                              suppression by providerID. Both native NousResearch rows
                              and their OpenRouter mirror carry real, non-zero cost in
                              the live snapshot; do not "fix" this into a suppression
                              rule for either provider. */}
                          <span
                            className={cn(
                              'text-[12px] font-normal leading-[1.4]',
                              isHighCost(m.costInput) ? 'text-amber-700' : 'text-slate-500',
                            )}
                          >
                            {' '}· ${m.costInput} / ${m.costOutput} per MTok
                          </span>
                        </span>
                        {/* Family renders as a second line under the name
                            (D-21-11, UI-SPEC §Row Anatomy) — as a direct flex
                            child of the vendored CommandItem a block span
                            would sit inline after the cost caption instead. */}
                        {m.family ? (
                          <span className="block text-[12px] font-normal leading-[1.4] text-slate-500">
                            {m.family}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            {staleLabel != null ? (
              <CommandItem
                key={value}
                value={searchValue({ id: value, name: staleLabel, family: '' })}
                disabled
              >
                <div className="flex min-w-0 flex-1 items-center">
                  {badge ? (
                    <Badge variant="secondary" className="mr-1.5">
                      {providerName(badge)}
                    </Badge>
                  ) : null}
                  <span className="truncate">{staleLabel}</span>
                </div>
              </CommandItem>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
