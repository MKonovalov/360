import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/actions/enrichment', () => ({
  runEnrichment: vi.fn(),
  commitEnrichment: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  AnalysisLauncher,
  analysisAgentOptionKey,
  analysisAgentSelection,
  createAnalysisPreviewPayload,
  createAnalysisRunPayload,
  defaultAnalysisAgentKey,
  isAnalysisAgentPickerReady,
} from './AnalysisLauncher';
import { analysisMenuLabel } from './AnalysisMenuAction';
import { fetchAnalysisOptions, parseCreateRunResponse, type AgentOption } from './analysisLauncherClient';

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

const PRACTICE_AREAS = [
  { id: 4, name: 'GBS Design, Build & Run', shortCode: 'GBS-DBR' },
] as const;

const FIXED_AGENT = {
  kind: 'fixed',
  templateVersionId: 11,
  key: 'company-buying-signal-analysis',
  name: 'Company Buying Signal Analysis',
  targetType: 'company',
  version: 1,
} satisfies AgentOption;

const CUSTOM_AGENT_A = {
  kind: 'custom',
  customAgentId: 'custom-a',
  templateVersionId: 71,
  name: 'Transformation Watcher',
  description: 'Finds transformation signals.',
  targetType: 'company',
  version: 1,
} satisfies AgentOption;

const CUSTOM_AGENT_B = {
  kind: 'custom',
  customAgentId: 'custom-b',
  templateVersionId: 81,
  name: 'Cost Pressure Scout',
  description: 'Finds cost pressure signals.',
  targetType: 'company',
  version: 2,
} satisfies AgentOption;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnalysisLauncher', () => {
  it('renders a controlled dialog shell without exposing a template picker', () => {
    const html = renderToStaticMarkup(
      <AnalysisLauncher
        open
        subjectType="company"
        subjectId={42}
        onOpenChange={vi.fn()}
      />,
    );

    expect(html).not.toContain('Select a template');
    expect(html).not.toContain('Template');
    expect(html).toBe('');
  });

  it('builds the fixed launch payload from only opaque server selection and subject inputs', () => {
    expect(createAnalysisRunPayload({
      subjectType: 'persona',
      subjectId: 9,
      practiceAreaId: 4,
      selection: { kind: 'fixed', templateVersionId: 12 },
    })).toEqual({
      templateVersionId: 12,
      subject: { type: 'persona', id: 9 },
      practiceAreaId: 4,
    });
  });

  it('builds a custom launch payload with only opaque identity and version', () => {
    expect(createAnalysisRunPayload({
      subjectType: 'company',
      subjectId: 42,
      practiceAreaId: 4,
      selection: analysisAgentSelection(CUSTOM_AGENT_B),
    })).toEqual({
      subject: { type: 'company', id: 42 },
      practiceAreaId: 4,
      selection: { kind: 'custom', customAgentId: 'custom-b', templateVersionId: 81 },
    });
  });

  it('keeps fixed preview compatibility and carries only custom opaque selection', () => {
    expect(createAnalysisPreviewPayload({
      subjectType: 'company',
      subjectId: 42,
      practiceAreaId: 4,
      selection: analysisAgentSelection(FIXED_AGENT),
    })).toEqual({
      subject: { type: 'company', id: 42 },
      practiceAreaId: 4,
    });
    expect(createAnalysisPreviewPayload({
      subjectType: 'company',
      subjectId: 42,
      practiceAreaId: 4,
      selection: analysisAgentSelection(CUSTOM_AGENT_A),
    })).toEqual({
      subject: { type: 'company', id: 42 },
      practiceAreaId: 4,
      selection: { kind: 'custom', customAgentId: 'custom-a', templateVersionId: 71 },
    });
  });

  it('loads Practice Areas first, then requests fixed and custom agents for the selected Practice Area', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ practiceAreas: PRACTICE_AREAS }))
      .mockResolvedValueOnce(jsonResponse({
        practiceAreas: PRACTICE_AREAS,
        agents: [FIXED_AGENT, CUSTOM_AGENT_A, CUSTOM_AGENT_B],
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAnalysisOptions('company', undefined, new AbortController().signal)).resolves.toEqual({
      ok: true,
      practiceAreas: PRACTICE_AREAS,
      agents: [],
    });
    await expect(fetchAnalysisOptions('company', 4, new AbortController().signal)).resolves.toEqual({
      ok: true,
      practiceAreas: PRACTICE_AREAS,
      agents: [FIXED_AGENT, CUSTOM_AGENT_A, CUSTOM_AGENT_B],
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/analysis-options?subjectType=company',
      '/api/analysis-options?subjectType=company&practiceAreaId=4',
    ]);
  });

  it('does not expose the agent picker before follow-up agents arrive', () => {
    expect(isAnalysisAgentPickerReady('loading', null)).toBe(false);
    expect(isAnalysisAgentPickerReady('ready', null)).toBe(false);
    expect(isAnalysisAgentPickerReady('ready', [FIXED_AGENT])).toBe(true);
  });

  it('defaults fixed first and keeps every matching custom option explicit', () => {
    const agents = [FIXED_AGENT, CUSTOM_AGENT_A, CUSTOM_AGENT_B] as const;

    expect(agents.map(analysisAgentOptionKey)).toEqual([
      'fixed:11',
      'custom:custom-a:71',
      'custom:custom-b:81',
    ]);
    expect(defaultAnalysisAgentKey(agents)).toBe('fixed:11');
    expect(defaultAnalysisAgentKey([CUSTOM_AGENT_A, CUSTOM_AGENT_B])).toBe('');
    expect(analysisAgentSelection(CUSTOM_AGENT_A)).toEqual({
      kind: 'custom',
      customAgentId: 'custom-a',
      templateVersionId: 71,
    });
  });

  it('keeps the polling handoff scalar at applicationRunId', () => {
    expect(parseCreateRunResponse({ applicationRunId: 73 })).toBe(73);
    expect(parseCreateRunResponse({ applicationRunId: { id: 73 } })).toBeNull();
  });
});

describe('Analyze Menu action', () => {
  it.each([
    ['company', 'Company'],
    ['persona', 'Persona'],
  ] as const)('exposes the enabled Analyze action for a %s record', (entityType, _label) => {
    expect(entityType).toMatch(/company|persona/);
    expect(analysisMenuLabel(true, 'Not configured')).toBe('Analyze');
  });
});
