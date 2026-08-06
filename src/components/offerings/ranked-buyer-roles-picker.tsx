'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface RankedBuyerRoleEntry {
  buyerRoleId: number;
  rank: number;
}

export interface RankedBuyerRolesPickerProps {
  buyerRoles: Array<{ id: number; name: string }>;
  // The ordered array IS the rank — entry.rank must stay a compact 1..n
  // sequence so a freshly checked role can append at length + 1.
  selectedRanked: RankedBuyerRoleEntry[];
  onChange: (next: RankedBuyerRoleEntry[]) => void;
}

// PURE CONTROLLED component (D-04): props in, onChange callbacks out, zero
// Server Action calls inside. Both consumers own the persist decision — the
// Offering form submits the ranked array with the form payload (30-05), the
// Matrix tab's inline Popover editor persists immediately via
// updateOfferingBuyerRolesAction (30-09). This file imports nothing from the
// app-actions directory — never add a Server Action call here.
export function RankedBuyerRolesPicker({
  buyerRoles,
  selectedRanked,
  onChange,
}: RankedBuyerRolesPickerProps) {
  if (buyerRoles.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No buyer roles yet — use Manage Buyer Roles to create one.
      </p>
    );
  }

  // Swap the rank values of the entry at `index` and the entry at
  // `index + delta` (delta = -1 move up, +1 move down). Mapping over the
  // original array preserves every other entry untouched.
  function moveRank(buyerRoleId: number, delta: -1 | 1) {
    const sorted = [...selectedRanked].sort((a, b) => a.rank - b.rank);
    const index = sorted.findIndex((r) => r.buyerRoleId === buyerRoleId);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= sorted.length) return;
    const current = sorted[index];
    const other = sorted[target];
    onChange(
      selectedRanked.map((r) => {
        if (r.buyerRoleId === current.buyerRoleId) return { ...r, rank: other.rank };
        if (r.buyerRoleId === other.buyerRoleId) return { ...r, rank: current.rank };
        return r;
      })
    );
  }

  // Removing from selectedRanked both drops the rank row AND unchecks the
  // source checkbox (the checkbox reads from the same array). Ranks are
  // re-compacted to 1..n so the next checkbox append at length + 1 can never
  // collide with a stale high rank.
  function removeRole(buyerRoleId: number) {
    onChange(
      selectedRanked
        .filter((r) => r.buyerRoleId !== buyerRoleId)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    );
  }

  const roleName = (buyerRoleId: number) =>
    buyerRoles.find((r) => r.id === buyerRoleId)?.name ?? `Role #${buyerRoleId}`;

  const sortedRanked = [...selectedRanked].sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-2">
      {selectedRanked.length === 0 && (
        <p className="text-sm text-slate-500">
          No buyer roles assigned yet — select from the list below.
        </p>
      )}

      <ScrollArea className="h-40">
        <div className="space-y-3 pr-3">
          <div className="space-y-2">
            {buyerRoles.map((role) => {
              const checked = selectedRanked.some((r) => r.buyerRoleId === role.id);
              return (
                <label
                  key={role.id}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      onChange(
                        next
                          ? [...selectedRanked, { buyerRoleId: role.id, rank: selectedRanked.length + 1 }]
                          : selectedRanked.filter((r) => r.buyerRoleId !== role.id)
                      )
                    }
                  />
                  <span>{role.name}</span>
                </label>
              );
            })}
          </div>

          {sortedRanked.length > 0 && (
            <div className="space-y-1 border-t border-slate-200 pt-2">
              {sortedRanked.map((entry, index) => (
                <div
                  key={entry.buyerRoleId}
                  className="flex items-center justify-between gap-2 text-sm text-foreground"
                >
                  <span className="truncate">
                    {entry.rank}. {roleName(entry.buyerRoleId)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => moveRank(entry.buyerRoleId, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move down"
                      disabled={index === sortedRanked.length - 1}
                      onClick={() => moveRank(entry.buyerRoleId, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${roleName(entry.buyerRoleId)}`}
                      onClick={() => removeRole(entry.buyerRoleId)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
