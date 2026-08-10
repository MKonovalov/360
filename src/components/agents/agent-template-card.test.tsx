import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));
vi.mock('@/app/actions/analysisTemplates', () => ({
  saveAnalysisTemplateAction: async () => ({ ok: true, kind: 'no_op', template: undefined }),
  setAnalysisTemplateStatusAction: async () => ({ ok: true, kind: 'lifecycle_updated', template: undefined }),
}));

import { AgentManagement } from './agent-management';
import { AgentTemplateCard, actionMessage } from './agent-template-card';
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
  {
    ...makeTemplate('company-buying-signal-analysis', 'Company Buying Signal Analysis', 'company'),
    latest: {
      ...makeTemplate('company-buying-signal-analysis', 'Company Buying Signal Analysis', 'company').latest,
      version: 2,
      instruction: 'Current company instruction',
    },
    history: [
      {
        ...makeTemplate('company-buying-signal-analysis', 'Company Buying Signal Analysis', 'company').latest,
        version: 2,
        instruction: 'Current company instruction',
      },
      {
        ...makeTemplate('company-buying-signal-analysis', 'Company Buying Signal Analysis', 'company').latest,
        templateVersionId: 10,
        version: 1,
        instruction: 'Prior company instruction',
      },
    ],
  },
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

  it('exposes only current editable content and labels prior history read-only', () => {
    const html = renderToStaticMarkup(<AgentManagement templates={TEMPLATES} />);

    expect(html).toContain('Current version');
    expect(html).toContain('Version 1');
    expect(html).toContain('Read-only history');
    expect(html).toContain('Current company instruction');
    expect(html).toContain('Prior company instruction');
    expect(html).toContain('Default effort');
    expect(html).toContain('Retire template');
    expect(html).not.toContain('Delete version');
  });

  it('shows reactivation for a retired template without changing its current version label', () => {
    const retired = { ...TEMPLATES[1], status: 'retired' as const, latest: { ...TEMPLATES[1].latest, version: 4 } };
    const html = renderToStaticMarkup(<AgentTemplateCard template={retired} />);

    expect(html).toContain('Retired');
    expect(html).toContain('Reactivate template');
    expect(html).toContain('Current version 4');
    expect(html).not.toContain('New version 5');
  });

  it('maps safe action failures to reloadable feedback without exposing raw errors', () => {
    expect(actionMessage('conflict')).toContain('Refresh');
    expect(actionMessage('action_failed')).not.toContain('database');
    expect(actionMessage('unexpected-internal-error')).not.toContain('unexpected-internal-error');
  });
});
