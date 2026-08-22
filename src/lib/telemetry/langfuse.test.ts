import { beforeAll, describe, expect, it, vi } from 'vitest';

import { normalizeDebugFailure } from '@/lib/analysis/failureDiagnostics';

const mocks = vi.hoisted(() => ({
  startActiveObservation: vi.fn(),
  registerTelemetry: vi.fn(),
  nodeSdkStart: vi.fn(),
  forceFlush: vi.fn(),
}));

vi.mock('@langfuse/tracing', () => ({ startActiveObservation: mocks.startActiveObservation }));
vi.mock('ai', () => ({ registerTelemetry: mocks.registerTelemetry }));
vi.mock('@opentelemetry/sdk-node', () => ({ NodeSDK: vi.fn(function NodeSDK() { return { start: mocks.nodeSdkStart }; }) }));
vi.mock('@langfuse/otel', () => ({ LangfuseSpanProcessor: vi.fn(function LangfuseSpanProcessor() { return { forceFlush: mocks.forceFlush }; }) }));
vi.mock('@langfuse/vercel-ai-sdk', () => ({ LangfuseVercelAiSdkIntegration: vi.fn() }));
vi.mock('@langfuse/client', () => ({ LangfuseClient: vi.fn() }));

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??= 'pk_test_placeholder';
process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';

let buildPhase33TelemetryMetadata: typeof import('./langfuse').buildPhase33TelemetryMetadata;
let buildDebugFailureMetadata: typeof import('./langfuse').buildDebugFailureMetadata;
let annotateDebugFailure: typeof import('./langfuse').annotateDebugFailure;
let runWithPhase33Trace: typeof import('./langfuse').runWithPhase33Trace;
let safeTelemetry: typeof import('./langfuseSafe');

beforeAll(async () => {
  ({ buildPhase33TelemetryMetadata, buildDebugFailureMetadata, annotateDebugFailure, runWithPhase33Trace } = await import('./langfuse'));
  safeTelemetry = await import('./langfuseSafe');
});

function makeDebugFailureRecord() {
  return normalizeDebugFailure(new Error('provider unavailable'), 'provider', { runId: 42 });
}

describe('Phase 33 Langfuse metadata', () => {
  it('runs the callback without registering an observation in test mode', async () => {
    const result = await runWithPhase33Trace('analyze-company', async () => 'completed');

    expect(result).toEqual({ result: 'completed', traceId: null });
    expect(mocks.startActiveObservation).not.toHaveBeenCalled();
  });

  it('keeps only allowlisted identifiers and bounded counts', () => {
    const metadata = buildPhase33TelemetryMetadata({
      runId: 42,
      targetType: 'persona',
      modelId: 'model.primary',
      modelChain: ['model.primary', 'model.fallback'],
      usedFallback: true,
      durationMs: 1200,
      toolCallCount: 2,
      findingCount: 3,
      sourceCount: 2,
      packetSchemaVersion: 1,
      policyVersion: 'policy-1',
      traceId: 'trace-42',
      traceUrl: 'https://cloud.langfuse.com/trace/trace-42',
      prompt: 'private reasoning and email@example.com',
    });

    expect(metadata).toEqual({
      runId: 42,
      targetType: 'persona',
      modelId: 'model.primary',
      modelProvider: null,
      modelChain: ['model.primary', 'model.fallback'],
      usedFallback: true,
      durationMs: 1200,
      toolCallCount: 2,
      findingCount: 3,
      sourceCount: 2,
      packetSchemaVersion: 1,
      policyVersion: 'policy-1',
      traceId: 'trace-42',
      traceUrl: 'https://cloud.langfuse.com/trace/trace-42',
    });
    expect(JSON.stringify(metadata)).not.toContain('email@example.com');
    expect(JSON.stringify(metadata)).not.toContain('private reasoning');
  });

  it('rejects unsafe trace metadata instead of retaining it', () => {
    expect(() =>
      buildPhase33TelemetryMetadata({
        runId: 42,
        targetType: 'company',
        modelId: 'sk_live_secret',
        modelChain: ['model.primary'],
        usedFallback: false,
        durationMs: 1,
        toolCallCount: 0,
        findingCount: 0,
        sourceCount: 0,
        packetSchemaVersion: 1,
        policyVersion: null,
        traceId: null,
        traceUrl: null,
      }),
    ).toThrow();
  });

  it('builds bounded observation I/O without retaining prompt, company, or source content', () => {
    const input = safeTelemetry.buildSafeObservationInput('analyze-company', {
      runId: 42,
      targetType: 'company',
      modelChain: ['model.primary'],
      prompt: 'private prompt',
      company: { name: 'Acme Corp' },
      source: { url: 'https://private.example/source', snippet: 'finding' },
    });
    const output = safeTelemetry.buildSafeObservationOutput({
      ok: true,
      modelUsed: 'model.primary',
      proposals: [{ claim: 'private finding' }],
      output: { narrative: 'private model output' },
    });

    expect(input).toEqual({ operation: 'analyze-company', runId: 42, targetType: 'company', modelChain: ['model.primary'] });
    expect(output).toMatchObject({ status: 'completed' });
    expect(JSON.stringify({ input, output })).not.toContain('private');
  });

  it('marks a failed result without copying its error or output content', () => {
    const output = safeTelemetry.buildSafeObservationOutput({ ok: false, reason: 'private provider error', output: 'secret output' });

    expect(output).toEqual({ status: 'failed' });
  });

  it('builds the exact bounded Debug failure metadata envelope', () => {
    const record = makeDebugFailureRecord();

    const metadata = buildDebugFailureMetadata(record);

    expect(metadata).toEqual({
      schemaVersion: 1,
      debugFailure: { enabled: true, ...record },
    });
    expect(Object.isFrozen(metadata.debugFailure)).toBe(true);
  });

  it('annotates the active parent span with ERROR and a bounded status message', () => {
    const update = vi.fn();
    const record = makeDebugFailureRecord();

    annotateDebugFailure({ update }, record);

    expect(update).toHaveBeenCalledWith({
      metadata: {
        schemaVersion: 1,
        debugFailure: { enabled: true, ...record },
      },
      level: 'ERROR',
      statusMessage: 'Analysis failed during provider: provider unavailable',
    });
  });

  it('captures only the bounded grounded report envelope', () => {
    const output = safeTelemetry.buildSafeObservationOutput({
      groundedReport: {
        narrative: 'Validated narrative',
        findings: [{
          identity: { signalId: 1, signalName: 'omit me' },
          status: 'strong',
          confidence: 'high',
          claim: 'Validated claim',
          reasoningSummary: 'Bounded reasoning',
          custom: 'omit me',
        }],
        custom: { secret: 'omit me' },
      },
    });

    expect(output).toEqual({
      status: 'completed',
      groundedReport: {
        narrative: 'Validated narrative',
        findings: [{
          identity: { signalId: 1 },
          status: 'strong',
          confidence: 'high',
          claim: 'Validated claim',
          reasoningSummary: 'Bounded reasoning',
        }],
      },
    });
    expect(JSON.stringify(output)).not.toContain('omit me');
  });

  it('omits malformed grounded reports instead of throwing', () => {
    expect(() => safeTelemetry.buildSafeObservationOutput({
      groundedReport: { narrative: 'invalid', findings: [{ identity: { signalId: 'bad' } }] },
    })).not.toThrow();
    expect(safeTelemetry.buildSafeObservationOutput({
      groundedReport: { narrative: 'invalid', findings: [{ identity: { signalId: 'bad' } }] },
    })).toEqual({ status: 'completed' });
  });

  it.each([
    ['a URL', 'See https://private.example/source for details.'],
    ['an email', 'Contact analyst@example.com for details.'],
    ['a phone number', 'Call +1 (555) 123-4567 for details.'],
    ['a credential pattern', 'token=sk_live_abc123'],
    ['a control character', 'safe\u0000text'],
  ])('fails closed when grounded report text contains %s', (_label, hostileText) => {
    const output = safeTelemetry.buildSafeObservationOutput({
      groundedReport: {
        narrative: hostileText,
        findings: [],
      },
    });

    expect(output).toEqual({ status: 'completed' });
  });

  it('fails closed when multibyte grounded report serialization exceeds 64 KiB', () => {
    const output = safeTelemetry.buildSafeObservationOutput({
      groundedReport: {
        narrative: '界'.repeat(12_000),
        findings: [{
          identity: { signalId: 1 },
          status: 'strong',
          confidence: 'high',
          claim: '界'.repeat(4_000),
          reasoningSummary: null,
        }, {
          identity: { signalId: 2 },
          status: 'strong',
          confidence: 'high',
          claim: '界'.repeat(4_000),
          reasoningSummary: null,
        }, {
          identity: { signalId: 3 },
          status: 'strong',
          confidence: 'high',
          claim: '界'.repeat(4_000),
          reasoningSummary: null,
        }],
      },
    });

    expect(output).toEqual({ status: 'completed' });
  });

  it('replaces AI SDK prompt, output, tool, and reasoning attributes with bounded observation I/O', () => {
    const attributes: Record<string, string | number> = {
      'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': 'model.primary',
      'gen_ai.input.messages': 'private prompt',
      'gen_ai.output.messages': 'private model output',
      'gen_ai.tool.call.arguments': 'private tool input',
      'gen_ai.usage.input_tokens': 12,
      'gen_ai.usage.output_tokens': 8,
    };

    safeTelemetry.sanitizeAiObservationAttributes(attributes);

    expect(attributes['langfuse.observation.input']).toContain('model.primary');
    expect(attributes['langfuse.observation.output']).toContain('12');
    expect(JSON.stringify(attributes)).not.toContain('private');
    expect(attributes['gen_ai.input.messages']).toBeUndefined();
    expect(attributes['gen_ai.output.messages']).toBeUndefined();
    expect(attributes['gen_ai.tool.call.arguments']).toBeUndefined();
  });

  it('updates the root observation with safe input and output when Langfuse is configured', async () => {
    const update = vi.fn();
    const span = { traceId: 'trace-42', update };
    mocks.startActiveObservation.mockImplementationOnce(async (_name: string, callback: (observation: typeof span) => Promise<unknown>) => callback(span));
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('../env', () => ({ env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
      LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
      LANGFUSE_SECRET_KEY: 'sk-lf-test',
    } }));
    vi.resetModules();

    const configuredModule = await import('./langfuse');
    const result = await configuredModule.runWithPhase33Trace(
      'analyze-company',
      async () => ({ ok: true, narrative: 'private output' }),
      {
        input: { runId: 42, targetType: 'company', prompt: 'private prompt' },
        output: () => ({ status: 'completed', findingCount: 1 }),
      },
    );

    expect(result).toEqual({ result: { ok: true, narrative: 'private output' }, traceId: 'trace-42' });
    expect(update).toHaveBeenCalledWith({
      input: { operation: 'analyze-company', runId: 42, targetType: 'company' },
      metadata: { operation: 'analyze-company' },
    });
    expect(update).toHaveBeenCalledWith({ output: { status: 'completed', findingCount: 1 } });
    expect(JSON.stringify(update.mock.calls)).not.toContain('private');

    vi.doUnmock('../env');
    vi.unstubAllEnvs();
  });

  it('annotates a factory-produced Debug failure before rethrowing the original error', async () => {
    const update = vi.fn();
    const span = { traceId: 'trace-42', update };
    const originalFailure = new Error('provider unavailable');
    const record = normalizeDebugFailure(originalFailure, 'provider', { runId: 42, traceId: 'trace-42' });
    const debugFailureFactory = vi.fn(() => record);
    mocks.startActiveObservation.mockImplementationOnce(async (_name: string, callback: (observation: typeof span) => Promise<unknown>) => callback(span));
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('../env', () => ({ env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
      LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
      LANGFUSE_SECRET_KEY: 'sk-lf-test',
    } }));
    vi.resetModules();

    const configuredModule = await import('./langfuse');
    await expect(configuredModule.runWithPhase33Trace('analyze-company', async () => {
      throw originalFailure;
    }, { debugFailureFactory })).rejects.toBe(originalFailure);

    expect(debugFailureFactory).toHaveBeenCalledWith(originalFailure, { traceId: 'trace-42' });
    expect(update).toHaveBeenCalledWith({
      metadata: {
        schemaVersion: 1,
        debugFailure: { enabled: true, ...record },
      },
      level: 'ERROR',
      statusMessage: 'Analysis failed during provider: provider unavailable',
    });

    vi.doUnmock('../env');
    vi.unstubAllEnvs();
  });

  it('leaves the failure span unchanged when the immutable Debug gate is disabled', async () => {
    const update = vi.fn();
    const span = { traceId: 'trace-disabled', update };
    const originalFailure = new Error('analysis failed');
    mocks.startActiveObservation.mockImplementationOnce(async (_name: string, callback: (observation: typeof span) => Promise<unknown>) => callback(span));
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('../env', () => ({ env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
      LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
      LANGFUSE_SECRET_KEY: 'sk-lf-test',
    } }));
    vi.resetModules();

    const configuredModule = await import('./langfuse');
    await expect(configuredModule.runWithPhase33Trace('analyze-company', async () => {
      throw originalFailure;
    })).rejects.toBe(originalFailure);

    expect(update).toHaveBeenCalledWith({ output: { schemaVersion: 1, status: 'failed' } });
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'ERROR' }));

    vi.doUnmock('../env');
    vi.unstubAllEnvs();
  });

  it('preserves the original failure when annotation and flush delivery are unavailable', async () => {
    const originalFailure = new Error('analysis failed');
    const record = makeDebugFailureRecord();
    const update = vi.fn((input: Readonly<Record<string, unknown>>) => {
      if (input.level === 'ERROR') throw new Error('annotation unavailable');
    });
    const span = { traceId: 'trace-failure', update };
    mocks.startActiveObservation.mockImplementationOnce(async (_name: string, callback: (observation: typeof span) => Promise<unknown>) => callback(span));
    mocks.forceFlush.mockRejectedValueOnce(new Error('flush unavailable'));
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('../env', () => ({ env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
      LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
      LANGFUSE_SECRET_KEY: 'sk-lf-test',
    } }));
    vi.resetModules();

    const configuredModule = await import('./langfuse');
    await expect(configuredModule.runWithPhase33Trace('analyze-company', async () => {
      throw originalFailure;
    }, { debugFailure: record })).rejects.toBe(originalFailure);
    expect(update).toHaveBeenCalledWith({
      metadata: {
        schemaVersion: 1,
        debugFailure: { enabled: true, ...record },
      },
      level: 'ERROR',
      statusMessage: 'Analysis failed during provider: provider unavailable',
    });
    expect(mocks.forceFlush).toHaveBeenCalled();

    vi.doUnmock('../env');
    vi.unstubAllEnvs();
  });
});
