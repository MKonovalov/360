'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  BOUNDED_OUTPUT_FIELD_TYPES,
  CUSTOM_AGENT_POLICY,
  type BoundedOutputSchema,
  type CustomAgentValidationIssue,
} from '@/lib/analysis/customAgentContracts';

export type OutputFieldDraft = {
  readonly name: string;
  readonly type: (typeof BOUNDED_OUTPUT_FIELD_TYPES)[number];
  readonly description: string;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly enum?: readonly string[];
  readonly itemType?: 'string' | 'number' | 'boolean';
  readonly maxItems?: number;
};

export function schemaToDraft(schema: BoundedOutputSchema | null): OutputFieldDraft[] {
  if (schema === null) return [];
  return Object.entries(schema.properties).map(([name, field]) => ({
    name,
    type: field.type,
    description: field.description ?? '',
    required: schema.required.includes(name),
    nullable: field.nullable ?? false,
    ...(field.enum === undefined ? {} : { enum: field.enum }),
    ...(field.items ? { itemType: field.items.type } : {}),
    ...(field.maxItems === undefined ? {} : { maxItems: field.maxItems }),
  }));
}

export function StructuredOutputEditor({
  fields,
  onChange,
  issues = [],
}: {
  readonly fields: readonly OutputFieldDraft[];
  readonly onChange: (fields: readonly OutputFieldDraft[]) => void;
  readonly issues?: readonly CustomAgentValidationIssue[];
}) {
  function updateField(index: number, patch: Partial<OutputFieldDraft>): void {
    onChange(fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  }

  function issueForField(index: number): CustomAgentValidationIssue | undefined {
    const prefix = `outputSchema.fields.${index}`;
    return issues.find((issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`));
  }

  return (
    <div className="flex flex-col gap-3" data-schema-editor="bounded">
      <p className="text-xs leading-5 text-slate-500">
        Optional additive fields only. Up to {CUSTOM_AGENT_POLICY.maxFields} shallow fields; arrays are bounded and nested objects are not available.
      </p>
      {fields.map((field, index) => {
        const fieldIssue = issueForField(index);
        return (
        <div key={`${field.name}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3" data-output-field-error={fieldIssue ? index : undefined}>
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <Input aria-label={`Output field ${index + 1} name`} value={field.name} onChange={(event) => updateField(index, { name: event.target.value })} placeholder="Field name" />
            <select aria-label={`Output field ${index + 1} type`} value={field.type} onChange={(event) => updateField(index, { type: event.target.value as OutputFieldDraft['type'] })} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
              {BOUNDED_OUTPUT_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <Textarea className="mt-3" aria-label={`Output field ${index + 1} description`} value={field.description} onChange={(event) => updateField(index, { description: event.target.value })} placeholder="What this field means" rows={2} />
          {field.type === 'string' ? (
            <Input
              className="mt-3"
              aria-label={`Output field ${index + 1} enum values`}
              value={field.enum?.join(', ') ?? ''}
              onChange={(event) => updateField(index, {
                enum: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
              })}
              placeholder="Optional enum values, comma-separated"
            />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <label><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} /> <span className="ml-1">Required</span></label>
            <label><input type="checkbox" checked={field.nullable} onChange={(event) => updateField(index, { nullable: event.target.checked })} /> <span className="ml-1">Nullable</span></label>
          </div>
          {field.type === 'array' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select aria-label={`Output field ${index + 1} item type`} value={field.itemType ?? 'string'} onChange={(event) => updateField(index, { itemType: event.target.value as OutputFieldDraft['itemType'] })} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
                {['string', 'number', 'boolean'].map((type) => <option key={type} value={type}>{type} items</option>)}
              </select>
              <Input type="number" min={CUSTOM_AGENT_POLICY.minArrayItems} max={CUSTOM_AGENT_POLICY.maxArrayItems} aria-label={`Output field ${index + 1} maximum items`} value={field.maxItems ?? 5} onChange={(event) => updateField(index, { maxItems: Number(event.target.value) })} />
            </div>
          ) : null}
          {fieldIssue ? <p role="alert" className="mt-2 text-xs text-red-600">{fieldIssue.message}</p> : null}
        </div>
        );
      })}
      {fields.length < CUSTOM_AGENT_POLICY.maxFields ? (
        <Button type="button" variant="outline" onClick={() => onChange([...fields, { name: '', type: 'string', description: '', required: false, nullable: false }])}>
          Add output field
        </Button>
      ) : null}
      <p className="text-xs text-slate-500">Grounding, citations, evidence, and review channels stay server-owned.</p>
    </div>
  );
}
