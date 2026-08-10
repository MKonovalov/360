import { registerTelemetry } from 'ai';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { LangfuseClient } from '@langfuse/client';
import { startActiveObservation } from '@langfuse/tracing';
import { z } from 'zod';
import { SERVABLE_PROVIDERS } from '@/lib/models/catalog';
import { modelRefSchema } from '@/lib/analysis/contracts';
import { env } from '../env';

// Phase 9 observability bootstrap (D-13, D-15, D-16). No `instrumentation.ts`
// (D-13): initLangfuse() is the single explicit entry point, called by the
// Analyze route or the live execution seam. All keys optional (D-15): unset
// keys degrade to a no-op here, and the Analyze action surfaces "not configured" instead.
// Tests never register telemetry (D-16) — the NODE_ENV guard must stay first.

let langfuseClient: LangfuseClient | undefined;
let initialized = false;

const telemetryIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?!.*:\/\/)[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/)
  .refine((value) => !/(?:sk|pk)[_-](?:live|test)|api[_-]?key|secret|token|session|clerk|database/i.test(value));

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
      .string()
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

export function buildPhase33TelemetryMetadata(input: unknown): Phase33TelemetryMetadata {
  return phase33MetadataSchema.parse(input);
}

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
      new LangfuseSpanProcessor({
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
        baseUrl,
      }),
    ],
  });
  sdk.start();

  registerTelemetry(new LangfuseVercelAiSdkIntegration());

  getLangfuseClient();
}

export async function runWithPhase33Trace<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ readonly result: T; readonly traceId: string | null }> {
  // D-16 — test runs execute the callback directly and never register or call
  // Langfuse. D-15 — missing keys retain the same zero-observability behavior.
  if (process.env.NODE_ENV === 'test') return { result: await fn(), traceId: null };
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
    return { result: await fn(), traceId: null };
  }

  let callbackResult: { readonly result: T; readonly traceId: string | null } | undefined;
  let callbackStarted = false;
  try {
    initLangfuse();
    const observed = await startActiveObservation(
      name,
      async (span) => {
        callbackStarted = true;
        const result = await fn();
        callbackResult = { result, traceId: span.traceId };
        return callbackResult;
      },
      { asType: 'span' },
    );
    return { result: observed.result, traceId: observed.traceId ?? null };
  } catch (error: unknown) {
    if (callbackResult) return callbackResult;
    if (!callbackStarted) return { result: await fn(), traceId: null };
    throw error;
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
    await client.score.create({
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
  await client.score.create({
    traceId,
    name: 'correction',
    value: 0,
    comment: JSON.stringify(correction),
  });
  await client.flush();
}
