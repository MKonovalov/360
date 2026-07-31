import { registerTelemetry } from 'ai';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { LangfuseClient } from '@langfuse/client';
import { env } from '../env';

// Phase 9 observability bootstrap (D-13, D-15, D-16). No `instrumentation.ts`
// (D-13): initLangfuse() is the single explicit entry point, called once by
// the Analyze route at startup. All keys optional (D-15): unset keys degrade
// to a no-op here, and the Analyze action surfaces "not configured" instead.
// Tests never register telemetry (D-16) — the NODE_ENV guard must stay first.

let langfuseClient: LangfuseClient | undefined;
let initialized = false;

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

  langfuseClient = new LangfuseClient({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl,
  });
}

export async function getTraceUrl(traceId: string): Promise<string | undefined> {
  // No-op when keys unset or in tests — the Analyze route stores the URL
  // only when Langfuse is actually configured (D-15).
  if (!langfuseClient) return undefined;
  return langfuseClient.getTraceUrl(traceId);
}

export async function mirrorCorrectionAnnotation(
  traceId: string,
  correction: { reason: string; note?: string },
): Promise<void> {
  // D-14: the DB is the source of truth; this is the observability mirror
  // only. Optional-chained — no-op when keys unset or in tests.
  if (!langfuseClient) return;
  langfuseClient.score.create({
    traceId,
    name: 'correction',
    value: 0,
    comment: JSON.stringify(correction),
  });
}
