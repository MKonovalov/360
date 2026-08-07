import { describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??= 'pk_test_placeholder';
process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';

import { buildPhase33TelemetryMetadata } from './langfuse';

describe('Phase 33 Langfuse metadata', () => {
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
});
