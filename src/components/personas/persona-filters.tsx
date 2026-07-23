'use client';

import { useQueryState, parseAsStringEnum } from 'nuqs';
import { seniorityEnum } from '@/lib/db/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// seniority is a fixed-but-extensible pgEnum storing slug values
// (e.g. "c_level") — humanize for display, matching company-filters.tsx's
// convention for the same enum families.
function humanizeEnum(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// T-3-05: options always come directly from the schema's own enumValues
// array (or, for currentCompany, the actual DISTINCT current-role company
// names) — this is the single source of truth that keeps a tampered/invalid
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

export function PersonaFilters({ currentCompanies }: { currentCompanies: string[] }) {
  // D-07: hasSignals isn't a schema enum — it's a derived true/false filter
  // over the two-hop EXISTS in listPersonas — so it gets its own Select with
  // explicit Yes/No labels rather than reusing EnumFilterSelect's
  // slug-capitalization humanizeEnum.
  const [hasSignals, setHasSignals] = useQueryState(
    'hasSignals',
    parseAsStringEnum(['true', 'false']).withOptions({ shallow: false })
  );

  return (
    <div className="flex flex-wrap gap-3">
      <EnumFilterSelect
        paramKey="seniority"
        placeholder="Seniority"
        options={seniorityEnum.enumValues}
      />
      <EnumFilterSelect
        paramKey="currentCompany"
        placeholder="Current company"
        options={currentCompanies}
        humanize={false}
      />
      <Select
        value={hasSignals ?? undefined}
        onValueChange={(next: 'true' | 'false') =>
          setHasSignals(next === hasSignals ? null : next)
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Has signals" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
