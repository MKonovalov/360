import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

vi.mock('@/app/actions/analysisTemplates', () => ({
  createCustomAgentAction: async () => ({ ok: true, kind: 'created' }),
  saveCustomAgentAction: async () => ({ ok: true, kind: 'version_appended' }),
  setCustomAgentStatusAction: async () => ({ ok: true, kind: 'lifecycle_updated' }),
  saveAnalysisTemplateAction: async () => ({ ok: true, kind: 'no_op' }),
  setAnalysisTemplateStatusAction: async () => ({ ok: true, kind: 'lifecycle_updated' }),
}));

import { AgentManagement } from './agent-management';
import type { CustomAgentRead } from '@/lib/db/queries/customAgents';
import type { ManagedAnalysisTemplateRead } from '@/lib/analysis/templateContracts';
import type { PracticeAreaOption, SafeCapabilityPreset } from './custom-agent-editor';

const fixedTemplate = (key: ManagedAnalysisTemplateRead['key'], targetType: ManagedAnalysisTemplateRead['targetType']): ManagedAnalysisTemplateRead => ({
  templateId: targetType === 'company' ? 1 : 2,
  key,
  name: targetType === 'company' ? 'Company Buying Signal Analysis' : 'Persona Buying Signal Analysis',
  targetType,
  status: 'active',
  latest: {
    templateVersionId: targetType === 'company' ? 11 : 21,
    version: 1,
    instruction: 'Fixed instruction',
    supportedEfforts: ['standard'],
    defaultEffort: 'standard',
    futureBudget: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
    createdBy: 'seed-script',
    createdAt: '2026-08-08T00:00:00.000Z',
  },
  history: [],
});

const customAgent: CustomAgentRead = {
  templateId: 8,
  customAgentId: 'custom-opaque-8',
  targetType: 'company',
  practiceAreaId: 4,
  status: 'retired',
  latest: {
    templateVersionId: 81,
    version: 1,
    name: 'Transformation Watcher',
    description: 'Find transformation signals.',
    researchQuery: 'Find transformation signals for this company.',
    behaviorInstruction: 'Use grounded sources.',
    outputSchema: null,
    capabilityPresetIds: ['web-research'],
    supportedEfforts: ['standard'],
    defaultEffort: 'standard',
    createdBy: 'user_123',
    createdAt: '2026-08-08T00:00:00.000Z',
  },
  history: [],
};

const practiceAreas: readonly PracticeAreaOption[] = [
  { id: 4, name: 'GBS — Design, Build & Run', shortCode: 'GBS-DBR' },
  { id: 5, name: 'Finance Transformation', shortCode: 'FIN-X' },
];

const capabilities: readonly SafeCapabilityPreset[] = [
  {
    id: 'none',
    label: 'No optional research capability',
    purpose: 'Use the standard analysis path.',
    supportedTargetTypes: ['company', 'persona'],
    supportedPracticeAreas: 'all',
    limits: { maxSources: 0, maxRequests: 0 },
    provenance: 'internal-policy',
    compatibilityTags: ['baseline'],
  },
  {
    id: 'web-research',
    label: 'Public web research',
    purpose: 'Make bounded research available.',
    supportedTargetTypes: ['company', 'persona'],
    supportedPracticeAreas: 'all',
    limits: { maxSources: 8, maxRequests: 4 },
    provenance: 'internal-policy',
    compatibilityTags: ['bounded'],
  },
];

describe('AgentManagement custom composition', () => {
  it('keeps fixed Company and Persona cards first, then separates Custom Agents', () => {
    const html = renderToStaticMarkup(
      <AgentManagement
        templates={[
          fixedTemplate('company-buying-signal-analysis', 'company'),
          fixedTemplate('persona-buying-signal-analysis', 'persona'),
        ]}
        customAgents={[customAgent]}
        practiceAreas={practiceAreas}
        capabilities={capabilities}
      />,
    );

    expect(html.indexOf('Company Buying Signal Analysis')).toBeLessThan(html.indexOf('Custom Agents'));
    expect(html.indexOf('Persona Buying Signal Analysis')).toBeLessThan(html.indexOf('Custom Agents'));
    expect(html).toContain('Create custom agent');
    expect(html).toContain('Custom');
    expect(html).toContain('GBS-DBR');
    expect(html).toContain('Current version 1');
    expect(html).toContain('Retired');
    expect(html).not.toContain('Clone');
    expect(html).not.toContain('Delete');
    expect(html).not.toContain('Launch');
    expect(html).not.toContain('Provider');
  });
});
