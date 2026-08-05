'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface LinkedOffering {
  id: number;
  name: string;
}

export interface LinkedOfferingsPickerProps {
  offerings: LinkedOffering[];
  selectedIds: number[];
  onChange: (nextIds: number[]) => void;
}

export function LinkedOfferingsPicker({
  offerings,
  selectedIds,
  onChange,
}: LinkedOfferingsPickerProps) {
  if (offerings.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No active offerings for this Practice Area yet.
      </p>
    );
  }

  return (
    <ScrollArea className="h-40">
      <div className="space-y-2 pr-3">
        {offerings.map((offering) => {
          const checked = selectedIds.includes(offering.id);
          return (
            <label
              key={offering.id}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) =>
                  onChange(
                    next ? [...selectedIds, offering.id] : selectedIds.filter((id) => id !== offering.id)
                  )
                }
              />
              <span>{offering.name}</span>
            </label>
          );
        })}
      </div>
    </ScrollArea>
  );
}
