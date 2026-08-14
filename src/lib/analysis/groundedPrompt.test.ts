import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/agents/runAgent', () => ({ runAgent: vi.fn() }));
vi.mock('@/lib/agents/modelFactory', () => ({ instantiateChain: vi.fn() }));
vi.mock('@/lib/telemetry/langfuse', () => ({ getTraceUrl: vi.fn(), runWithPhase33Trace: vi.fn() }));
vi.mock('@/lib/env', () => ({ env: { FIRECRAWL_API_KEY: 'test-key' } }));
vi.mock('firecrawl', () => ({ Firecrawl: vi.fn(function Firecrawl() { return { search: vi.fn() }; }) }));

import { buildGroundedPrompt } from './execution';
import { PHASE33_STANDARD_APPROVED_POLICY } from './contracts';
import type { GroundedExecutionInput } from './groundedContracts';

const groundedInput = {
  runId: 42,
  targetType: 'company',
  subjectId: 7,
  subjectDisplayName: 'Acme Corp',
  checklist: [{
    signalId: 1,
    name: 'New CFO',
    category: 'executive_change',
    description: 'Company announced a new CFO.',
  }],
  selectedCategory: null,
  policy: PHASE33_STANDARD_APPROVED_POLICY,
} satisfies GroundedExecutionInput;

const categoryScopedInput = {
  ...groundedInput,
  checklist: [{
    signalId: 3,
    name: 'No GBS/SSC exists',
    category: 'GBS-state',
    description: 'No shared services org exists yet.',
  }],
  selectedCategory: 'GBS-state',
} satisfies GroundedExecutionInput;

describe('buildGroundedPrompt', () => {
  it('embeds the generated strict schema used by the grounded execution path', () => {
    const prompt = buildGroundedPrompt(groundedInput);
    const schemaMarker = 'Output JSON Schema:\n';
    const schemaStart = prompt.indexOf(schemaMarker);
    expect(schemaStart).toBeGreaterThanOrEqual(0);
    const outputJsonSchema = z
      .object({
        properties: z.record(z.string(), z.unknown()),
        required: z.array(z.string()),
      })
      .passthrough()
      .parse(JSON.parse(prompt.slice(schemaStart + schemaMarker.length)));

    expect(outputJsonSchema.required).toEqual(['narrative', 'findings']);
    expect(outputJsonSchema.properties).toHaveProperty('narrative');
    expect(outputJsonSchema.properties).toHaveProperty('findings');
    const findingSchema = z
      .object({ items: z.object({ properties: z.record(z.string(), z.unknown()) }).passthrough() })
      .passthrough()
      .parse(outputJsonSchema.properties.findings);
    expect(findingSchema.items.properties).toHaveProperty('findingId');
    expect(findingSchema.items.properties).toHaveProperty('signalId');
    expect(prompt).toContain(
      'You MUST respond with a single JSON object conforming EXACTLY to this JSON Schema. Do not output the schema itself.',
    );
    expect(prompt).toContain(
      'Do not output top-level schema-document keys: type, properties, required, additionalProperties, or $schema.',
    );
  });

  it('omits any selected-category line for a v1 (unfiltered) checklist input', () => {
    const prompt = buildGroundedPrompt(groundedInput);
    expect(prompt).not.toContain('Selected buying-signal category');
  });

  it('explicitly states the selected category and only the category-scoped checklist for a v2 input', () => {
    const prompt = buildGroundedPrompt(categoryScopedInput);
    expect(prompt).toContain('Selected buying-signal category: GBS-state.');
    expect(prompt).toContain('- 3: No GBS/SSC exists (GBS-state) — No shared services org exists yet.');
    expect(prompt).not.toContain('New CFO');
    expect(prompt).not.toContain('executive_change');
  });
});
