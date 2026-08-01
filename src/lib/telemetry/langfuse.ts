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

// Lazy client accessor shared by initLangfuse, getTraceUrl and the reject
// mirror. initLangfuse() runs only inside the Analyze route handler — Server
// Action invocations (rejectProposalAction) reach this module on cold starts
// without it, so the mirror must self-bootstrap the client or silently drop
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

export async function getTraceUrl(traceId: string): Promise<string | undefined> {
  // No-op when keys unset or in tests — the Analyze route stores the URL
  // only when Langfuse is actually configured (D-15).
  const client = getLangfuseClient();
  if (!client) return undefined;
  return client.getTraceUrl(traceId);
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
