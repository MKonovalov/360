import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  analysisRunEndpoint,
  createArcAgentnetRunPayload,
  createAnalysisRunPayload,
  fetchAnalysisOptions,
  fetchAnalysisPreview,
  getErrorCopy,
  parseCreateRunResponse,
  pollArcAgentnetRun,
  readJson,
  type AgentSelection,
} from './analysisLauncherClient';

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe('analysisLauncherClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchAnalysisOptions', () => {
    it('requests only subjectType on the initial step and parses { practiceAreas }', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }] }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const result = await fetchAnalysisOptions('company', undefined, new AbortController().signal);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/analysis-options?subjectType=company');
      expect(result).toEqual({
        ok: true,
        practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }],
        agents: [],
        signalCategories: [],
      });
    });

    it('sends subjectType and practiceAreaId on the follow-up step and parses { agents, practiceAreas, signalCategories }', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          agents: [{ kind: 'fixed', templateVersionId: 11, key: 'company-buying-signal-analysis', name: 'Fixed', targetType: 'company', version: 1, executor: 'internal' }],
          practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }],
          signalCategories: ['GBS-state', 'financial'],
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/analysis-options?subjectType=company&practiceAreaId=3');
      expect(result).toEqual({
        ok: true,
        practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }],
        agents: [{ kind: 'fixed', templateVersionId: 11, key: 'company-buying-signal-analysis', name: 'Fixed', targetType: 'company', version: 1, executor: 'internal' }],
        signalCategories: ['GBS-state', 'financial'],
      });
    });

    it('defaults signalCategories to an empty list when the follow-up response omits it', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({ agents: [], practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }] }),
      ));

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      expect(result).toEqual({
        ok: true,
        practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }],
        agents: [],
        signalCategories: [],
      });
    });

    it('accepts a Company follow-up response with executionTargets: [] (Arc-agentnet disabled)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({ agents: [], practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }], executionTargets: [] }),
      ));

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      expect(result).toEqual({
        ok: true,
        practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }],
        agents: [],
        signalCategories: [],
        executionTargets: [],
      });
    });

    it('accepts a Company follow-up response with both execution targets when Arc-agentnet is enabled', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({ agents: [], practiceAreas: [], executionTargets: ['internal', 'arc-agentnet'] }),
      ));

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      expect(result.ok).toBe(true);
    });

    it('accepts a Persona follow-up response that omits executionTargets entirely', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({ agents: [], practiceAreas: [] }),
      ));

      const result = await fetchAnalysisOptions('persona', 3, new AbortController().signal);

      expect(result.ok).toBe(true);
    });

    it('returns Company execution availability without making it launch authority', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({
          agents: [{ kind: 'fixed', templateVersionId: 11, key: 'company-buying-signal-analysis', name: 'Fixed', targetType: 'company', version: 1, executor: 'arc-agentnet' }],
          practiceAreas: [],
          executionTargets: [],
        }),
      ));

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      expect(result).toMatchObject({ ok: true, executionTargets: [] });
      expect(analysisRunEndpoint('off')).toBe('/api/analysis-runs');
    });

    it('rejects a follow-up response with an invalid executionTargets value', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({ agents: [], practiceAreas: [], executionTargets: ['bogus'] }),
      ));

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      expect(result).toEqual({ ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' });
    });

    it('preserves fixed-first ordering and returns every matching active custom option as a separate explicit choice', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({
          agents: [
            { kind: 'fixed', templateVersionId: 11, key: 'company-buying-signal-analysis', name: 'Fixed', targetType: 'company', version: 1, executor: 'internal' },
            { kind: 'custom', customAgentId: 'custom-a', templateVersionId: 71, name: 'A', description: 'A desc', targetType: 'company', version: 1, executor: 'internal' },
            { kind: 'custom', customAgentId: 'custom-b', templateVersionId: 81, name: 'B', description: 'B desc', targetType: 'company', version: 2, executor: 'arc-agentnet' },
          ],
          practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }],
        }),
      ));

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok result');
      expect(result.agents.map((agent) => agent.kind)).toEqual(['fixed', 'custom', 'custom']);
      expect(result.agents.map((agent) => (agent.kind === 'custom' ? agent.customAgentId : null))).toEqual([null, 'custom-a', 'custom-b']);
    });

    it('parses a valid custom identity/version option strictly, stripping unmodeled display fields', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({
          agents: [{
            kind: 'custom',
            customAgentId: 'custom-7',
            templateVersionId: 71,
            name: 'Scout',
            description: 'Finds transformation signals.',
            targetType: 'company',
            version: 2,
            executor: 'internal',
            supportedEfforts: ['standard'],
            defaultEffort: 'standard',
          }],
          practiceAreas: [],
        }),
      ));

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      expect(result).toEqual({
        ok: true,
        practiceAreas: [],
        agents: [{
          kind: 'custom',
          customAgentId: 'custom-7',
          templateVersionId: 71,
          name: 'Scout',
          description: 'Finds transformation signals.',
          targetType: 'company',
          version: 2,
          executor: 'internal',
        }],
        signalCategories: [],
      });
    });

    it('returns a safe fallback message for a network-level response failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_input' }, 400)));

      const result = await fetchAnalysisOptions('company', undefined, new AbortController().signal);

      expect(result).toEqual({ ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' });
    });

    it.each([
      ['missing practiceAreas on the initial response', {}],
      ['a non-array practiceAreas value', { practiceAreas: 'nope' }],
      ['an unmodeled top-level field on the initial response', { practiceAreas: [], templates: [] }],
    ])('rejects a malformed initial options response: %s', async (_label, body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));

      const result = await fetchAnalysisOptions('company', undefined, new AbortController().signal);

      expect(result).toEqual({ ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' });
    });

    it.each([
      ['missing agents on the follow-up response', { practiceAreas: [] }],
      ['a fixed option missing templateVersionId', { agents: [{ kind: 'fixed', key: 'x', name: 'X', targetType: 'company', version: 1 }], practiceAreas: [] }],
      ['a custom option missing customAgentId', { agents: [{ kind: 'custom', templateVersionId: 71, name: 'X', description: 'd', targetType: 'company', version: 1 }], practiceAreas: [] }],
      ['an unknown agent kind', { agents: [{ kind: 'legacy', templateVersionId: 11 }], practiceAreas: [] }],
      ['a malformed executor', { agents: [{ kind: 'fixed', templateVersionId: 11, key: 'x', name: 'X', targetType: 'company', version: 1, executor: 'claude' }], practiceAreas: [] }],
      ['an unknown response key', { agents: [], practiceAreas: [], executor: 'arc-agentnet' }],
    ])('rejects a malformed follow-up options response: %s', async (_label, body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));

      const result = await fetchAnalysisOptions('company', 3, new AbortController().signal);

      expect(result).toEqual({ ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' });
    });
  });

  describe('fetchAnalysisPreview', () => {
    it('sends the required signalCategory alongside subject and practiceAreaId', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_input' }, 400));
      vi.stubGlobal('fetch', fetchMock);

      await fetchAnalysisPreview({
        subjectType: 'company',
        subjectId: 42,
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: { kind: 'fixed', templateVersionId: 11 },
        signal: new AbortController().signal,
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        subject: { type: 'company', id: 42 },
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: { kind: 'fixed', templateVersionId: 11 },
      });
    });
  });

  describe('analysisRunEndpoint', () => {
    it.each([
      ['off', '/api/analysis-runs'],
      ['on', '/api/debug/analysis-runs'],
    ] as const)('maps Debug %s to exactly one launch endpoint', (preference, expected) => {
      expect(analysisRunEndpoint(preference)).toBe(expected);
    });

    it('uses the ordinary endpoint for an unavailable preference (unavailable is represented as Off)', () => {
      expect(analysisRunEndpoint('off')).toBe('/api/analysis-runs');
    });
  });

  describe('createAnalysisRunPayload', () => {
    it('carries the persisted executor only as an optional consistency hint', () => {
      const payload = createAnalysisRunPayload({
        subjectType: 'company',
        subjectId: 42,
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: { kind: 'fixed', templateVersionId: 11 },
        executor: 'internal',
      });

      expect(payload).toMatchObject({ executor: 'internal' });
      expect(Object.keys(payload)).not.toContain('partnerJobId');
      expect(Object.keys(payload)).not.toContain('credentials');
    });

    it('never adds a client debug authorization field to the existing payload', () => {
      const payload = createAnalysisRunPayload({
        subjectType: 'company',
        subjectId: 42,
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: { kind: 'fixed', templateVersionId: 11 },
      });

      expect(payload).not.toHaveProperty('debugCaptureEnabled');
      expect(payload).not.toHaveProperty('debugAdminUserIds');
      expect(payload).not.toHaveProperty('userId');
    });

    it('preserves the fixed request shape with signalCategory while omitting a selection wrapper', () => {
      const payload = createAnalysisRunPayload({
        subjectType: 'company',
        subjectId: 42,
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: { kind: 'fixed', templateVersionId: 11 },
      });

      expect(payload).toEqual({
        templateVersionId: 11,
        subject: { type: 'company', id: 42 },
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
      });
      expect(payload).not.toHaveProperty('selection');
    });

    it('builds an opaque custom selection payload carrying only identity, version, subject, and Practice Area', () => {
      const payload = createAnalysisRunPayload({
        subjectType: 'persona',
        subjectId: 9,
        practiceAreaId: 5,
        signalCategory: 'Financial',
        selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 },
      });

      expect(payload).toEqual({
        subject: { type: 'persona', id: 9 },
        practiceAreaId: 5,
        signalCategory: 'Financial',
        selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 },
      });
      expect(Object.keys(payload)).toEqual(['subject', 'practiceAreaId', 'signalCategory', 'selection']);
      if (!('selection' in payload)) throw new Error('expected a custom selection payload');
      expect(Object.keys(payload.selection!)).toEqual(['kind', 'customAgentId', 'templateVersionId']);
    });

    it.each([
      ['instruction', 'behaviorInstruction'],
      ['researchQuery', 'find transformation programs'],
      ['outputSchema', { fieldCount: 3 }],
      ['capabilityPresetIds', ['none']],
      ['actorId', 'staff-1'],
      ['effort', 'deep'],
      ['effortOverride', 'deep'],
      ['modelChain', [{ modelId: 'claude', provider: 'anthropic' }]],
      ['budget', { maxSpendUsd: 100 }],
      ['policy', { mode: 'unrestricted' }],
      ['provider', 'anthropic'],
      ['tool', 'web_search'],
      ['credential', 'sk-secret'],
      ['dataSource', 'internal-crm'],
      ['executor', 'arc-agentnet'],
    ])('strips a forbidden %s field carried on the selection before building the fixed payload', (field, value) => {
      const taintedSelection = { kind: 'fixed', templateVersionId: 11, [field]: value } as unknown as AgentSelection;

      const payload = createAnalysisRunPayload({
        subjectType: 'company',
        subjectId: 42,
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: taintedSelection,
      });

      expect(payload).toEqual({
        templateVersionId: 11,
        subject: { type: 'company', id: 42 },
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
      });
      expect(payload).not.toHaveProperty(field);
    });

    it.each([
      ['instruction', 'behaviorInstruction'],
      ['researchQuery', 'find transformation programs'],
      ['outputSchema', { fieldCount: 3 }],
      ['capabilityPresetIds', ['none']],
      ['actorId', 'staff-1'],
      ['effort', 'deep'],
      ['effortOverride', 'deep'],
      ['modelChain', [{ modelId: 'claude', provider: 'anthropic' }]],
      ['budget', { maxSpendUsd: 100 }],
      ['policy', { mode: 'unrestricted' }],
      ['provider', 'anthropic'],
      ['tool', 'web_search'],
      ['credential', 'sk-secret'],
      ['dataSource', 'internal-crm'],
    ])('strips a forbidden %s field carried on the selection before building the custom payload', (field, value) => {
      const taintedSelection = {
        kind: 'custom',
        customAgentId: 'custom-7',
        templateVersionId: 71,
        [field]: value,
      } as unknown as AgentSelection;

      const payload = createAnalysisRunPayload({
        subjectType: 'company',
        subjectId: 42,
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: taintedSelection,
      });

      expect(payload).toEqual({
        subject: { type: 'company', id: 42 },
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 },
      });
      expect(payload.selection).not.toHaveProperty(field);
    });
  });

  describe('Company Arc-agentnet launch payload and polling', () => {
    it('submits only opaque identities and a generated idempotency key', () => {
      expect(createArcAgentnetRunPayload({
        subjectType: 'company',
        subjectId: 42,
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: { kind: 'fixed', templateVersionId: 11 },
        idempotencyKey: 'run-key',
      })).toEqual({
        subject: { type: 'company', id: 42 },
        practiceAreaId: 3,
        signalCategory: 'GBS-state',
        selection: { kind: 'fixed', templateVersionId: 11 },
        idempotencyKey: 'run-key',
      });
    });

    it('polls the local application run ID and stops on a terminal Arc-agentnet state', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
        applicationRunId: 73,
        status: 'completed',
        safeReason: 'completed',
      }));

      await expect(pollArcAgentnetRun({
        applicationRunId: 73,
        signal: new AbortController().signal,
        intervalMs: 0,
        fetchImpl: fetchMock,
      })).resolves.toEqual({ kind: 'terminal', status: 'completed' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/analysis-runs/arc-agentnet/73');
    });

    it('aborts local-ID polling without another request', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(pollArcAgentnetRun({
        applicationRunId: 73,
        signal: controller.signal,
        fetchImpl: vi.fn(),
      })).resolves.toEqual({ kind: 'aborted' });
    });
  });

  describe('getErrorCopy', () => {
    it('maps a known error code to its safe copy', () => {
      expect(getErrorCopy({ error: 'active_run_exists' })).toBe('An active analysis run already exists for this record.');
    });

    it('falls back to a generic message for an unrecognized payload', () => {
      expect(getErrorCopy(null)).toBe('The analysis request could not be completed. Try again.');
      expect(getErrorCopy({ error: 'unknown_reason' })).toBe('The analysis request could not be completed. Try again.');
    });
  });

  describe('parseCreateRunResponse', () => {
    it('parses a positive applicationRunId', () => {
      expect(parseCreateRunResponse({ applicationRunId: 41 })).toBe(41);
    });

    it.each([
      { applicationRunId: 0 },
      { applicationRunId: -1 },
      { applicationRunId: 'forty-one' },
      {},
      null,
    ])('rejects a malformed run response: %j', (body) => {
      expect(parseCreateRunResponse(body)).toBeNull();
    });
  });

  describe('readJson', () => {
    it('returns null for a non-JSON body instead of throwing', async () => {
      const response = new Response('not json', { status: 200 });
      await expect(readJson(response)).resolves.toBeNull();
    });

    it('parses a valid JSON body', async () => {
      const response = jsonResponse({ ok: true });
      await expect(readJson(response)).resolves.toEqual({ ok: true });
    });
  });
});
