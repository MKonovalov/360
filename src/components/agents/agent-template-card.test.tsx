import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { AgentManagement } from './agent-management';
import type { ManagedAnalysisTemplateRead } from '@/lib/analysis/templateContracts';

const makeTemplate = (
  key: ManagedAnalysisTemplateRead['key'],
  name: ManagedAnalysisTemplateRead['name'],
  targetType: ManagedAnalysisTemplateRead['targetType'],
): ManagedAnalysisTemplateRead => ({
  templateId: key === 'company-buying-signal-analysis' ? 1 : 2,
  key,
  name,
  targetType,
  status: 'active',
  latest: {
    templateVersionId: key === 'company-buying-signal-analysis' ? 11 : 21,
    version: 1,
    instruction: 'Safe instruction',
    supportedEfforts: ['standard'],
    defaultEffort: 'standard',
    futureBudget: {
      maxAttempts: 2,
      maxToolCalls: 12,
      maxExecutionSeconds: 300,
      maxSpendUsd: 2.5,
    },
    createdBy: 'seed-script',
    createdAt: '2026-08-08T00:00:00.000Z',
  },
  history: [],
});

const TEMPLATES = [
  makeTemplate('company-buying-signal-analysis', 'Company Buying Signal Analysis', 'company'),
  makeTemplate('persona-buying-signal-analysis', 'Persona Buying Signal Analysis', 'persona'),
];

describe('AgentManagement', () => {
  it('renders exactly the fixed Company and Persona management entries', () => {
    const html = renderToStaticMarkup(<AgentManagement templates={TEMPLATES} />);

    expect([...html.matchAll(/data-template-key="([^"]+)"/g)].map((match) => match[1])).toEqual([
      'company-buying-signal-analysis',
      'persona-buying-signal-analysis',
    ]);
    expect(html).toContain('Company Buying Signal Analysis');
    expect(html).toContain('Persona Buying Signal Analysis');
    expect(html).not.toContain('Create template');
    expect(html).not.toContain('Provider');
  });
});
