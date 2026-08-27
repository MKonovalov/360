import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createArcAgentnetClient } from '@/lib/arc-agentnet/client';

const SEARCH_TEMPLATE_MIGRATION = readFileSync(
  new URL('../../../drizzle/0022_search_template_contract.sql', import.meta.url),
  'utf8',
);
const SEARCH_AGENT_NET_SEARCH_CONTRACT = SEARCH_TEMPLATE_MIGRATION.match(
  /\$search_contract\$([\s\S]*?)\$search_contract\$/,
)?.[1] ?? '';

const ROLE_REQUIREMENTS = [
  {
    role: 'CFO',
    titleVariants: ['Chief Financial Officer', 'Regional CFO', 'Executive Vice President of Finance'],
    mandateIndicators: ['owns cost reduction or margin improvement', 'sponsors finance transformation'],
  },
  {
    role: 'COO',
    titleVariants: ['Chief Operating Officer', 'Regional COO', 'President/COO'],
    mandateIndicators: ['owns operating model or service delivery', 'sponsors process standardization'],
  },
  {
    role: 'Head of GBS',
    titleVariants: ['Head of Global Business Services', 'Chief Shared Services Officer', 'Head of Global Capability Centre'],
    mandateIndicators: ['owns or builds a GBS, SSC, GCC', 'defines service catalogue, SLAs, KPIs'],
  },
  {
    role: 'Transformation Sponsor',
    titleVariants: ['Chief Transformation Officer', 'Executive Sponsor', 'M&A Integration Lead or Carve-out Lead'],
    mandateIndicators: ['sponsors or owns a named transformation programme', 'owns a PMO or transformation portfolio'],
  },
  {
    role: 'CIO',
    titleVariants: ['Chief Information Officer', 'Chief Technology and Information Officer', 'EVP/VP Information Technology'],
    mandateIndicators: ['owns ERP, technology, data, digital, or IT transformation', 'controls technology investment'],
  },
] as const;

describe('Arc Agent Net Search contract', () => {
  it.each(ROLE_REQUIREMENTS)('contains the complete $role role guidance', ({ role, titleVariants, mandateIndicators }) => {
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain(role);
    for (const titleVariant of titleVariants) {
      expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain(titleVariant);
    }
    for (const mandateIndicator of mandateIndicators) {
      expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain(mandateIndicator);
    }
  });

  it('contains the strict packet, evidence, identity, and legacy-format restrictions', () => {
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('"schemaVersion": 1');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('"candidates"');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('No outer `result` wrapper');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('No `priority` field');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('Maximum `25` candidates');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('sourceIds');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('company_website');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('professional_profile');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('Absolute HTTPS URL');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('Every factual claim must reference one or more source IDs');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('checklistFindings');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).toContain('Do not return `checklistFindings`');
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT.length).toBeLessThanOrEqual(20_000);
  });

  it('persists the same contract text in the additive current-version migration', () => {
    expect(SEARCH_AGENT_NET_SEARCH_CONTRACT).not.toBe('');
    expect(SEARCH_TEMPLATE_MIGRATION).toContain('COALESCE(MAX("version"), 0) + 1');
    expect(SEARCH_TEMPLATE_MIGRATION).toContain('"name" = \'Company Buying Signal Search\'');
    expect(SEARCH_TEMPLATE_MIGRATION).toContain('"template_id"');
    expect(SEARCH_TEMPLATE_MIGRATION).toContain('"resolved_instructions"');
    expect(SEARCH_TEMPLATE_MIGRATION).not.toContain('UPDATE "search_template_version"');
  });

  it('serializes the complete resolved instructions as task and preserves Search spec_id', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ job_id: 'job-search-contract', status: 'queued', request_id: 'request-search-contract' }),
      { status: 202, headers: { 'content-type': 'application/json' } },
    ));
    const client = createArcAgentnetClient({
      baseUrl: 'https://agentnet.example.test',
      partnerKey: 'partner-secret',
      fetchImpl,
      registerJob: vi.fn().mockResolvedValue({ ok: true, mappingId: 1 }),
    });
    const context = {
      schemaVersion: 1,
      analysis: {
        resolvedInstructions: SEARCH_AGENT_NET_SEARCH_CONTRACT,
        subjectType: 'company' as const,
        company: { id: 42, name: 'Acme', domain: 'acme.example' },
      },
    };

    await client.submit({
      idempotencyKey: 'search-contract-key',
      input: context,
      specId: '6f9b69d738a24462b620a3c38968985b',
    });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const body: unknown = JSON.parse(String(init?.body));
    expect(body).toEqual({
      task: SEARCH_AGENT_NET_SEARCH_CONTRACT,
      context,
      spec_id: '6f9b69d738a24462b620a3c38968985b',
    });
  });
});
