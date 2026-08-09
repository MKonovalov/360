import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));
vi.mock('@/app/actions/analysisTemplates', () => ({
  createCustomAgentAction: async () => ({ ok: true, kind: 'created' }),
  saveCustomAgentAction: async () => ({ ok: true, kind: 'version_appended' }),
  setCustomAgentStatusAction: async () => ({ ok: true, kind: 'lifecycle_updated' }),
}));
vi.mock('@/components/ui/sheet', () => {
  const passthrough = ({ children }: { readonly children?: ReactNode }) => children;
  return {
    Sheet: passthrough,
    SheetContent: passthrough,
    SheetDescription: passthrough,
    SheetFooter: passthrough,
    SheetHeader: passthrough,
    SheetTitle: passthrough,
    SheetTrigger: passthrough,
  };
});

import { CustomAgentEditor, buildCustomAgentCreatePayload } from './custom-agent-editor';
import type { PracticeAreaOption, SafeCapabilityPreset } from './custom-agent-editor';
import { schemaToDraft } from './structured-output-editor';

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

const baseProps = {
  practiceAreas,
  capabilities,
  open: true,
  onOpenChange: () => undefined,
};

describe('CustomAgentEditor', () => {
  it('renders the constructor sections in the locked order and bounded controls', () => {
    const html = renderToStaticMarkup(<CustomAgentEditor {...baseProps} mode="create" />);
    const sections = ['Identity', 'Target / Practice Area', 'Query / Behavior', 'Output Schema', 'Capabilities', 'Review / Save'];
    const positions = sections.map((section) => html.indexOf(section));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.match(/name="practiceAreaId"/g)).toHaveLength(1);
    expect(html).toContain('Server-approved Practice Area');
    expect(html).toContain('Add output field');
    expect(html).toContain('Grounding, citations, evidence, and review channels stay server-owned');
    expect(html).toContain('No optional research capability');
    expect(html).toContain('Public web research');
    expect(html).toContain('Version 1 — Retired');
    expect(html).not.toContain('Launch');
    expect(html).not.toContain('Preview');
    expect(html).not.toContain('JSON Schema');
    expect(html).not.toContain('Credentials');
    expect(html).not.toContain('Provider');
  });

  it('passes exactly one create-time Practice Area ID and never a client-authored lifecycle', () => {
    const payload = buildCustomAgentCreatePayload({
      name: 'Transformation Watcher',
      description: 'Find transformation signals.',
      targetType: 'company',
      practiceAreaId: 4,
      researchQuery: 'Find transformation signals.',
      behaviorInstruction: 'Use grounded sources.',
      defaultEffort: 'standard',
      outputSchema: null,
      capabilityPresetIds: ['web-research'],
    });

    expect(payload.practiceAreaId).toBe(4);
    expect(Object.keys(payload).filter((key) => key === 'practiceAreaId')).toHaveLength(1);
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('customAgentId');
  });

  it('shows persisted Practice Area read-only while retired edits remain retired', () => {
    const html = renderToStaticMarkup(
      <CustomAgentEditor
        {...baseProps}
        mode="edit"
        agent={{
          customAgentId: 'custom-opaque-8',
          targetType: 'company',
          practiceAreaId: 4,
          practiceAreaName: 'GBS — Design, Build & Run',
          practiceAreaShortCode: 'GBS-DBR',
          status: 'retired',
          latest: {
            version: 3,
            name: 'Transformation Watcher',
            description: 'Find transformation signals.',
            researchQuery: 'Find transformation signals.',
            behaviorInstruction: 'Use grounded sources.',
            outputSchema: null,
            capabilityPresetIds: ['web-research'],
            defaultEffort: 'standard',
          },
          history: [{ version: 2, createdBy: 'user_1', createdAt: '2026-08-07T00:00:00.000Z' }],
        }}
      />,
    );

    expect(html).toContain('Practice Area is fixed after creation');
    expect(html).toContain('GBS-DBR');
    expect(html).toContain('Version 3');
    expect(html).toContain('Retired');
    expect(html).toContain('Activate custom agent');
    expect(html).toContain('Version 2');
    expect(html).toContain('user_1');
    expect(html).toContain('Read-only');
    expect(html).not.toContain('name="practiceAreaId"');
    expect(html).not.toContain('Change Practice Area');
    expect(html).not.toContain('Create clone');
    expect(html).not.toContain('Delete agent');
  });

  it('renders server field issues inline without exposing raw failures', () => {
    const html = renderToStaticMarkup(
      <CustomAgentEditor
        {...baseProps}
        mode="create"
        issues={[{ path: 'behaviorInstruction', code: 'too_big', message: 'Behavior instruction is too long' }]}
      />,
    );

    expect(html).toContain('Behavior instruction is too long');
    expect(html).toContain('aria-invalid="true"');
    expect(html).not.toContain('DATABASE_URL');
    expect(html).not.toContain('stack trace');
  });

  it('preserves string enum constraints when an existing schema enters edit state', () => {
    const fields = schemaToDraft({
      type: 'object',
      properties: {
        priority: {
          type: 'string',
          description: 'Evidence priority',
          enum: ['high', 'medium', 'low'],
        },
      },
      required: ['priority'],
    });

    expect(fields).toEqual([
      {
        name: 'priority',
        type: 'string',
        description: 'Evidence priority',
        required: true,
        nullable: false,
        enum: ['high', 'medium', 'low'],
      },
    ]);
  });

  it('retains field issues returned by a failed save for inline rendering', async () => {
    const editorModule = await import('./custom-agent-editor');
    const validationIssuesFromResult = Reflect.get(editorModule, 'validationIssuesFromResult');
    const issues = [{ path: 'researchQuery', code: 'too_big', message: 'Research query is too long' }];

    expect(validationIssuesFromResult).toBeTypeOf('function');
    if (typeof validationIssuesFromResult !== 'function') return;

    expect(validationIssuesFromResult({ ok: false, reason: 'invalid_input', issues })).toEqual(issues);
    expect(validationIssuesFromResult({ ok: false, reason: 'action_failed' })).toEqual([]);
    expect(validationIssuesFromResult({ ok: false, reason: 'conflict' })).toEqual([]);
  });
});
