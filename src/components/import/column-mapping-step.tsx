'use client';

import { Fragment, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { validateImportBatch } from '@/app/actions/import';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { humanizeEnum } from '@/components/explorer/explorer-format';
import { revenueBandEnum, ownershipTypeEnum, seniorityEnum } from '@/lib/db/schema';
import { COMPANY_FIELD_ALIASES, PERSONA_FIELD_ALIASES } from '@/lib/import/columnMapping';
import { cn } from '@/lib/utils';

// Mirrors ENUM_FIELD_NAMES in src/app/actions/import.ts — the three pgEnum
// fields whose raw CSV values need a second, value-level mapping pass before
// the row can pass Zod validation.
const ENUM_FIELD_NAMES = new Set(['revenue_band', 'ownership_type', 'seniority']);

// Canonical enum values read straight from the Drizzle schema — never
// hardcoded a second time (enum-values-as-single-source-of-truth convention,
// 07-PATTERNS.md). Same import shape company-filters.tsx already uses.
const ENUM_VALUES: Record<string, readonly string[]> = {
  revenue_band: revenueBandEnum.enumValues,
  ownership_type: ownershipTypeEnum.enumValues,
  seniority: seniorityEnum.enumValues,
};

// Radix's Select forbids an empty-string item value, so the "skip this column"
// choice needs an explicit sentinel that is translated back to `null` before it
// reaches the Server Action.
const NO_IMPORT_VALUE = '__no_import__';

// humanizeEnum's naive slug-capitalization produces "Hq Location" /
// "Linkedin Url", so acronym-bearing field names get an explicit label. The
// wording matches the column headers already shipped on /companies and the
// field labels on the detail panes.
const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  hq_location: 'HQ Location',
  linkedin_url: 'LinkedIn URL',
  employee_count_band: 'Employee Count',
};

function fieldLabel(field: string): string {
  return FIELD_LABEL_OVERRIDES[field] ?? humanizeEnum(field);
}

export function ColumnMappingStep({
  batchId,
  headers,
  suggestedMapping,
  sampleRows,
  columnValues,
  suggestedValueMapping,
  entityType,
  onValidated,
}: {
  batchId: number;
  headers: string[];
  suggestedMapping: Record<string, string | null>;
  sampleRows: Record<string, string>[];
  columnValues: Record<string, string[]>;
  suggestedValueMapping: Record<string, Record<string, string | null>>;
  entityType: 'company' | 'persona';
  onValidated: (result: {
    counts: { created: number; updated: number; errored: number };
    errorReport: { row: number; errors: string[] }[];
  }) => void;
}) {
  const [mapping, setMapping] = useState<Record<string, string | null>>(suggestedMapping);
  const [valueMapping, setValueMapping] =
    useState<Record<string, Record<string, string | null>>>(suggestedValueMapping);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldOptions = Object.keys(
    entityType === 'company' ? COMPANY_FIELD_ALIASES : PERSONA_FIELD_ALIASES
  );

  // Derived LIVE from the CURRENT mapping state, never from suggestedMapping —
  // re-pointing a column at an enum field must immediately surface its
  // value-mapping sub-table and immediately re-gate the Continue button.
  const enumMappedHeaders = headers.filter((header) => {
    const field = mapping[header];
    return field != null && ENUM_FIELD_NAMES.has(field);
  });

  // D-08 / 07-UI-SPEC.md: an unmapped enum value is never silently defaulted
  // into the commit, so every distinct raw value of every enum-mapped column
  // needs an explicit selection before validation can run.
  const canContinue = enumMappedHeaders.every((header) =>
    (columnValues[header] ?? []).every((value) => valueMapping[header]?.[value] != null)
  );

  function handleMappingChange(header: string, nextValue: string) {
    const field = nextValue === NO_IMPORT_VALUE ? null : nextValue;
    setMapping((prev) => ({ ...prev, [header]: field }));

    setValueMapping((prev) => {
      const next = { ...prev };
      if (field != null && ENUM_FIELD_NAMES.has(field) && suggestedMapping[header] === field) {
        // Returning a column to the field the server originally suggested
        // restores that column's auto-suggested value mappings.
        next[header] = { ...(suggestedValueMapping[header] ?? {}) };
      } else {
        // Any other change invalidates the stored value mappings — a
        // `seniority` value can never be a valid `revenue_band` value.
        delete next[header];
      }
      return next;
    });
  }

  function handleValueMappingChange(header: string, rawValue: string, canonical: string) {
    setValueMapping((prev) => ({
      ...prev,
      [header]: { ...(prev[header] ?? {}), [rawValue]: canonical },
    }));
  }

  async function handleContinue() {
    setError(null);
    setIsValidating(true);
    try {
      const result = await validateImportBatch(batchId, mapping, valueMapping);
      // TypeScript normalizes this action's multi-return union so BOTH members
      // declare `error` (optional/undefined on the success side) — `'error' in
      // result` therefore does not discriminate. Compare against undefined.
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      // Step navigation is owned by the wizard shell — this component only
      // reports the validation outcome.
      onValidated(result);
    } catch {
      setError('Something went wrong validating this import. Try again.');
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {error ? (
        <div role="alert" className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-[18px] leading-[1.2] font-semibold text-amber-800">
            {"Couldn't validate this import"}
          </p>
          <p className="text-[14px] leading-[1.5] font-normal text-amber-800">{error}</p>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CSV Column</TableHead>
              <TableHead>Sample Value</TableHead>
              <TableHead>Maps To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header) => {
              const field = mapping[header] ?? null;
              const isEnumMapped = field != null && ENUM_FIELD_NAMES.has(field);
              // Always the COMPLETE distinct value set from the full CSV —
              // never derived from the 5-row sampleRows preview.
              const rawValues = isEnumMapped ? (columnValues[header] ?? []) : [];
              const enumValues = field != null ? (ENUM_VALUES[field] ?? []) : [];
              const unmappedCount = rawValues.filter(
                (value) => valueMapping[header]?.[value] == null
              ).length;
              const isExpanded = isEnumMapped && expanded[header] === true;
              const sampleValue = sampleRows[0]?.[header] ?? '';

              return (
                <Fragment key={header}>
                  <TableRow>
                    <TableCell className="text-[14px] leading-[1.5] font-normal text-slate-900">
                      {header}
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-48 truncate text-[12px] leading-[1.4] font-normal text-slate-500">
                        {sampleValue || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={field ?? NO_IMPORT_VALUE}
                            onValueChange={(next) => handleMappingChange(header, next)}
                          >
                            <SelectTrigger className="w-56" aria-label={`Map column ${header}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_IMPORT_VALUE}>{"— Don't import —"}</SelectItem>
                              {fieldOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {fieldLabel(option)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {field == null ? <Badge variant="outline">Unmapped</Badge> : null}
                        </div>

                        {isEnumMapped ? (
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpanded((prev) => ({ ...prev, [header]: !prev[header] }))
                            }
                            className="flex items-center gap-1 rounded-lg text-[12px] leading-[1.4] font-normal text-slate-500 outline-none focus-visible:ring-3 focus-visible:ring-indigo-600/50"
                          >
                            <ChevronDownIcon
                              aria-hidden="true"
                              className={cn(
                                'size-4 shrink-0 text-slate-400 transition-transform',
                                isExpanded && 'rotate-180'
                              )}
                            />
                            {unmappedCount > 0 ? (
                              <Badge variant="outline">{unmappedCount} values need mapping</Badge>
                            ) : (
                              'Review value mapping'
                            )}
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded ? (
                    <TableRow>
                      <TableCell colSpan={3} className="border-t border-slate-200 bg-slate-50 p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>CSV Value</TableHead>
                              <TableHead>Maps To</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rawValues.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={2}
                                  className="text-[14px] leading-[1.5] font-normal text-slate-500"
                                >
                                  This column is empty — nothing to map.
                                </TableCell>
                              </TableRow>
                            ) : (
                              rawValues.map((rawValue) => {
                                const canonical = valueMapping[header]?.[rawValue] ?? null;

                                return (
                                  <TableRow key={rawValue}>
                                    <TableCell className="text-[14px] leading-[1.5] font-normal text-slate-900">
                                      {rawValue}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Select
                                          value={canonical ?? undefined}
                                          onValueChange={(next) =>
                                            handleValueMappingChange(header, rawValue, next)
                                          }
                                        >
                                          <SelectTrigger
                                            className="w-48"
                                            aria-label={`Map value ${rawValue}`}
                                          >
                                            <SelectValue placeholder="Pick a value" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {enumValues.map((enumValue) => (
                                              <SelectItem key={enumValue} value={enumValue}>
                                                {humanizeEnum(enumValue)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {canonical == null ? (
                                          <Badge variant="outline">Unmapped</Badge>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-4">
        {!canContinue ? (
          <p className="text-[12px] leading-[1.4] font-normal text-slate-500">
            Map every value in the expandable columns to continue.
          </p>
        ) : null}
        <Button
          type="button"
          variant="default"
          disabled={!canContinue || isValidating}
          onClick={() => void handleContinue()}
        >
          Continue to Validation
        </Button>
      </div>
    </div>
  );
}
