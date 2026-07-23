'use client';

import { useQueryState, parseAsStringEnum } from 'nuqs';
import { signalTypeEnum, revenueBandEnum, ownershipTypeEnum } from '@/lib/db/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// revenue_band/ownership_type/signal_type are fixed-but-extensible pgEnums
// storing slug values (e.g. "under_50m") — humanize for display, matching
// company-list.tsx's convention for the same enum families.
function humanizeEnum(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// T-2-01/T-2-08: options always come directly from the schema's own
// enumValues arrays (or, for industry, the actual DISTINCT values present in
// the DB) — this is the single source of truth that keeps a tampered/invalid
// query-param value from ever reaching the Drizzle WHERE clause.
function EnumFilterSelect({
  paramKey,
  placeholder,
  options,
  humanize = true,
}: {
  paramKey: string;
  placeholder: string;
  options: readonly string[];
  humanize?: boolean;
}) {
  const [value, setValue] = useQueryState(
    paramKey,
    parseAsStringEnum<string>([...options]).withOptions({ shallow: false })
  );

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(next) => setValue(next === value ? null : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {humanize ? humanizeEnum(opt) : opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CompanyFilters({ industries }: { industries: string[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      <EnumFilterSelect
        paramKey="industry"
        placeholder="Industry"
        options={industries}
        humanize={false}
      />
      <EnumFilterSelect
        paramKey="signal"
        placeholder="Signal type"
        options={signalTypeEnum.enumValues}
      />
      <EnumFilterSelect
        paramKey="revenueBand"
        placeholder="Revenue band"
        options={revenueBandEnum.enumValues}
      />
      <EnumFilterSelect
        paramKey="ownershipType"
        placeholder="Ownership type"
        options={ownershipTypeEnum.enumValues}
      />
    </div>
  );
}
