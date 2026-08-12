import { beforeAll, describe, expect, it, vi } from 'vitest';

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
let runWithPhase33Trace: typeof import('./langfuse').runWithPhase33Trace;
let safeTelemetry: typeof import('./langfuseSafe');

beforeAll(async () => {
  ({ buildPhase33TelemetryMetadata, runWithPhase33Trace } = await import('./langfuse'));
  safeTelemetry = await import('./langfuseSafe');
});

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
});
