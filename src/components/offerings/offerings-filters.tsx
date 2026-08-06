'use client';

import { useQueryState, parseAsStringEnum } from 'nuqs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Practice Area names are human-readable strings already, so they bypass the
// default enum humanizer. Practice Area ids are numeric in the DB but
// serialized to the URL as strings; we pass a lookup map so the Select never
// renders a raw id to the user.
function humanizeEnum(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// OFR-05: options always come from the server-fetched practice-area array —
// the single source of truth that keeps a tampered/invalid query-param value
// from ever reaching the Drizzle WHERE clause. `shallow: false` re-fetches the
// server-rendered Matrix table when the filter changes (shared link preserves
// the filter via the URL).
function EnumFilterSelect({
  paramKey,
  placeholder,
  options,
  humanize = true,
  labelMap,
}: {
  paramKey: string;
  placeholder: string;
  options: readonly string[];
  humanize?: boolean;
  labelMap?: Record<string, string>;
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
            {labelMap?.[opt] ?? (humanize ? humanizeEnum(opt) : opt)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// The Matrix tab's filter bar has exactly ONE dimension — Practice Area
// (UI-SPEC line 172). No search field, no category/status filters.
export function OfferingsFilters({
  practiceAreas,
}: {
  practiceAreas: Array<{ id: number; name: string }>;
}) {
  const practiceAreaOptions = practiceAreas.map((pa) => String(pa.id));
  const practiceAreaLabels = Object.fromEntries(
    practiceAreas.map((pa) => [String(pa.id), pa.name])
  );

  return (
    <div className="flex flex-wrap gap-3">
      <EnumFilterSelect
        paramKey="practiceArea"
        placeholder="Practice area"
        options={practiceAreaOptions}
        humanize={false}
        labelMap={practiceAreaLabels}
      />
    </div>
  );
}
