import { registerTelemetry } from 'ai';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { LangfuseClient } from '@langfuse/client';
import { startActiveObservation } from '@langfuse/tracing';
import { propagateAttributes } from '@langfuse/tracing';
import { z } from 'zod';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { SERVABLE_PROVIDERS } from '@/lib/models/catalog';
import { modelRefSchema } from '@/lib/analysis/contracts';
import {
  formatDebugFailureStatusMessage,
  type DebugFailureRecord,
  type DebugFailureSpan,
} from '@/lib/analysis/failureDiagnostics';
import { env } from '../env';
import {
  buildSafeObservationInput,
  buildSafeObservationOutput,
  sanitizeAiObservationAttributes,
  telemetryIdentifierSchema,
} from './langfuseSafe';

// Phase 9 observability bootstrap (D-13, D-15, D-16). No `instrumentation.ts`
// (D-13): initLangfuse() is the single explicit entry point, called by the
// Analyze route or the live execution seam. All keys optional (D-15): unset
// keys degrade to a no-op here, and the Analyze action surfaces "not configured" instead.
// Tests never register telemetry (D-16) — the NODE_ENV guard must stay first.

let langfuseClient: LangfuseClient | undefined;
let initialized = false;
let langfuseSpanProcessor: LangfuseSpanProcessor | undefined;

const phase33MetadataSchema = z
  .object({
    runId: z.number().int().positive(),
    targetType: z.enum(['company', 'persona']),
    modelId: telemetryIdentifierSchema,
    modelProvider: z.enum(SERVABLE_PROVIDERS).nullable().default(null),
    modelChain: z.array(z.union([modelRefSchema, telemetryIdentifierSchema])).max(8).default([]),
    usedFallback: z.boolean(),
    durationMs: z.number().int().nonnegative().max(86_400_000),
    toolCallCount: z.number().int().nonnegative().max(100),
    findingCount: z.number().int().nonnegative().max(100),
    sourceCount: z.number().int().nonnegative().max(100),
    packetSchemaVersion: z.literal(1),
    policyVersion: z.string().trim().min(1).max(120).nullable(),
    traceId: telemetryIdentifierSchema.nullable(),
    traceUrl: z
      .url()
      .max(2_048)
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === 'https:' && url.username === '' && url.password === '' && url.search === '' && url.hash === '';
      })
      .nullable(),
  })
  .strip();

export type Phase33TelemetryMetadata = z.infer<typeof phase33MetadataSchema>;

export type DebugFailureMetadata = Readonly<{
  readonly schemaVersion: 1;
  readonly debugFailure: Readonly<{ readonly enabled: true } & DebugFailureRecord>;
}>;

class PrivacySafeLangfuseSpanProcessor extends LangfuseSpanProcessor {
  override onEnd(span: ReadableSpan): void {
    const isAiSpan = span.instrumentationScope.name === 'ai'
      || Object.keys(span.attributes).some((key) => key.startsWith('gen_ai.'));
    if (isAiSpan) sanitizeAiObservationAttributes(span.attributes);
    super.onEnd(span);
  }
}

export function buildPhase33TelemetryMetadata(input: unknown): Phase33TelemetryMetadata {
  return phase33MetadataSchema.parse(input);
}

export function buildDebugFailureMetadata(record: DebugFailureRecord): DebugFailureMetadata {
  const debugFailure: DebugFailureMetadata['debugFailure'] = Object.freeze({
    enabled: true,
    ...record,
  });
  return {
    schemaVersion: 1,
    debugFailure,
  };
}

function ignoreLangfuseError(error: unknown): void {
  if (error instanceof Error) return;
  return;
}

export function annotateDebugFailure(span: DebugFailureSpan, record: DebugFailureRecord): void {
  try {
    span.update({
      metadata: buildDebugFailureMetadata(record),
      level: 'ERROR',
      statusMessage: formatDebugFailureStatusMessage(record),
    });
  } catch (error: unknown) {
    ignoreLangfuseError(error);
  }
}

export type DebugFailureCorrelation = Readonly<{
  readonly traceId: string | null;
}>;

type DebugFailureFactory = (
  error: unknown,
  correlation: DebugFailureCorrelation,
) => DebugFailureRecord | undefined;

// Lazy client accessor shared by initLangfuse, getTraceUrl and the reject
// mirror. Server Action invocations (rejectProposalAction) reach this module on
// cold starts without it, so the mirror must self-bootstrap the client or silently drop
// the annotation. Same D-15/D-16 semantics as before: unset keys or tests
// return undefined (no-op), never a crash.
function getLangfuseClient(): LangfuseClient | undefined {
  if (process.env.NODE_ENV === 'test') return undefined; // D-16 — never in tests
  if (langfuseClient) return langfuseClient;
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) return undefined; // D-15
  langfuseClient = new LangfuseClient({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: env.LANGFUSE_TRACE_BASE_URL ?? 'https://cloud.langfuse.com',
  });
  return langfuseClient;
}

export function initLangfuse(): void {
  if (process.env.NODE_ENV === 'test') return; // D-16 — never register in tests
  if (initialized) return; // module-singleton guard (idempotent)
  initialized = true;

  // D-15 — unset keys degrade to a no-op, never a crash at import.
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) return;

  const baseUrl = env.LANGFUSE_TRACE_BASE_URL ?? 'https://cloud.langfuse.com';

  // AI SDK v7 exports telemetry spans through the OpenTelemetry tracer
  // provider; LangfuseSpanProcessor pipes those spans to Langfuse. Research
  // Assumption A1 resolved at install time: v5.9.1 of the vercel-ai-sdk
  // integration requires this OTel path (it exports no registerTelemetry of
  // its own — that lives on `ai`).
  const sdk = new NodeSDK({
    spanProcessors: [
      (langfuseSpanProcessor = new PrivacySafeLangfuseSpanProcessor({
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
        baseUrl,
        exportMode: 'immediate',
      })),
    ],
  });
  sdk.start();

  registerTelemetry(new LangfuseVercelAiSdkIntegration());

  getLangfuseClient();
}

export async function runWithPhase33Trace<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    readonly input?: unknown;
    readonly metadata?: unknown;
    readonly output?: (result: T) => unknown;
    readonly sessionId?: string;
    readonly debugFailure?: DebugFailureRecord;
    readonly debugFailureFactory?: DebugFailureFactory;
  },
): Promise<{ readonly result: T; readonly traceId: string | null }> {
  // D-16 — test runs execute the callback directly and never register or call
  // Langfuse. D-15 — missing keys retain the same zero-observability behavior.
  if (process.env.NODE_ENV === 'test') return { result: await fn(), traceId: null };
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
    return { result: await fn(), traceId: null };
  }

  let callbackResult: { readonly result: T; readonly traceId: string | null } | undefined;
  let callbackStarted = false;
  const observe = () =>
    startActiveObservation(
      name,
      async (span) => {
        callbackStarted = true;
        span.update({
          input: buildSafeObservationInput(name, options?.input),
          metadata: buildSafeObservationInput(name, options?.metadata),
        });
        try {
          const result = await fn();
          span.update({
            output: buildSafeObservationOutput(options?.output?.(result)),
          });
          const completed = { result, traceId: span.traceId };
          callbackResult = completed;
          return completed;
        } catch (error: unknown) {
          try {
            const debugFailure = options?.debugFailureFactory?.(error, { traceId: span.traceId ?? null })
              ?? options?.debugFailure;
            if (debugFailure !== undefined) annotateDebugFailure(span, debugFailure);
          } catch (telemetryError: unknown) {
            ignoreLangfuseError(telemetryError);
          }
          try {
            span.update({ output: { schemaVersion: 1, status: 'failed' } });
          } catch (telemetryError: unknown) {
            ignoreLangfuseError(telemetryError);
          }
          throw error;
        }
      },
      { asType: 'span' },
    );

  try {
    initLangfuse();
    const observed = await (options?.sessionId
      ? propagateAttributes({ sessionId: options.sessionId }, observe)
      : observe());
    return { result: observed.result, traceId: observed.traceId ?? null };
  } catch (error: unknown) {
    if (callbackResult) return callbackResult;
    if (!callbackStarted) return { result: await fn(), traceId: null };
    throw error;
  } finally {
    await flushLangfuse();
  }
}

async function flushLangfuse(): Promise<void> {
  try {
    await langfuseSpanProcessor?.forceFlush();
  } catch (error: unknown) {
    if (error instanceof Error) return;
    return;
  }
}

export async function getTraceUrl(traceId: string): Promise<string | undefined> {
  // No-op when keys unset or in tests — the Analyze route stores the URL
  // only when Langfuse is actually configured (D-15).
  const client = getLangfuseClient();
  if (!client) return undefined;
  try {
    return await client.getTraceUrl(traceId);
  } catch (error: unknown) {
    if (error instanceof Error) return undefined;
    return undefined;
  }
}

export async function recordPhase33Telemetry(input: unknown): Promise<void> {
  const metadata = buildPhase33TelemetryMetadata(input);
  if (!metadata.traceId) return;
  const client = getLangfuseClient();
  if (!client) return;

  try {
    client.score.create({
      traceId: metadata.traceId,
      name: 'phase33_run',
      value: 1,
      comment: JSON.stringify(metadata),
    });
    await client.flush();
  } catch (error: unknown) {
    if (error instanceof Error) return;
    return;
  }
}

export async function mirrorCorrectionAnnotation(
  traceId: string,
  correction: { reason: string; note?: string },
): Promise<void> {
  // D-14: the DB is the source of truth; this is the observability mirror
  // only. Self-bootstraps the client (the reject Server Action is a separate
  // invocation from the Analyze route that calls initLangfuse — cold starts
  // would otherwise drop the annotation silently) and flushes before
  // returning so the queued score is delivered before the serverless process
  // yields (score.create only enqueues; delivery needs flush()).
  const client = getLangfuseClient();
  if (!client) return;
  client.score.create({
    traceId,
    name: 'correction',
    value: 0,
    comment: JSON.stringify(correction),
  });
  await client.flush();
}
