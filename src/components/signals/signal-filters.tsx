'use client';

import { useQueryState, parseAsString, parseAsStringEnum, debounce } from 'nuqs';
import { catalogStatusEnum } from '@/lib/db/schema';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Categories and Practice Area names are already human-readable strings, so
// they bypass the default enum humanizer. Practice Area ids are numeric in the
// DB but serialized to the URL as strings; we pass a lookup map so the Select
// never renders a raw id to the user.
function humanizeEnum(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// SIG-03: options always come from the schema's own enumValues arrays (status)
// or from server-fetched arrays (categories, practice areas) — this is the
// single source of truth that keeps a tampered/invalid query-param value from
// ever reaching the Drizzle WHERE clause. All four params use `shallow: false`
// so changing a filter re-fetches the server-rendered Signals table.
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

export function SignalFilters({
  practiceAreas,
  categories,
}: {
  practiceAreas: Array<{ id: number; name: string }>;
  categories: string[];
}) {
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('').withOptions({ shallow: false })
  );

  const practiceAreaOptions = practiceAreas.map((pa) => String(pa.id));
  const practiceAreaLabels = Object.fromEntries(
    practiceAreas.map((pa) => [String(pa.id), pa.name])
  );

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Search signals..."
        defaultValue={search}
        onChange={(e) =>
          setSearch(e.target.value || null, {
            limitUrlUpdates: e.target.value === '' ? undefined : debounce(300),
          })
        }
      />
      <EnumFilterSelect
        paramKey="practiceArea"
        placeholder="Practice area"
        options={practiceAreaOptions}
        humanize={false}
        labelMap={practiceAreaLabels}
      />
      <EnumFilterSelect
        paramKey="category"
        placeholder="Category"
        options={categories}
        humanize={false}
      />
      <EnumFilterSelect
        paramKey="status"
        placeholder="Status"
        options={catalogStatusEnum.enumValues}
      />
    </div>
  );
}
