import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import type { ArcAgentnetJsonValue } from './client';

export const CALLBACK_HOSTS = [
  '360.arclumenpartners.com',
  'staging.360.arclumenpartners.com',
  'arc-agentnet.arclumen.de',
] as const;

export const CALLBACK_HEADERS = {
  timestamp: 'X-Partner-Timestamp',
  eventId: 'X-Partner-Event-Id',
  signature: 'X-Partner-Signature',
} as const;

export const MAX_CALLBACK_RESULT_BYTES = 5 * 1024 * 1024;
const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const SIGNATURE_PREFIX = 'sha256=';
const callbackHostSet: ReadonlySet<string> = new Set(CALLBACK_HOSTS);

const callbackJsonValueSchema: z.ZodType<ArcAgentnetJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(callbackJsonValueSchema),
    z.record(z.string(), callbackJsonValueSchema),
  ]),
);

const callbackPayloadSchema = z.discriminatedUnion('status', [
  z.object({
    event_id: z.string().min(1),
    job_id: z.string().min(1),
    request_id: z.string().min(1),
    status: z.literal('succeeded'),
    result: callbackJsonValueSchema,
  }).strict(),
  z.object({
    event_id: z.string().min(1),
    job_id: z.string().min(1),
    request_id: z.string().min(1),
    status: z.literal('failed'),
    result: callbackJsonValueSchema.optional(),
  }).strict(),
  z.object({
    event_id: z.string().min(1),
    job_id: z.string().min(1),
    request_id: z.string().min(1),
    status: z.literal('cancelled'),
    result: callbackJsonValueSchema.optional(),
  }).strict(),
]);

export type AnalyzeCallbackPayload = {
  readonly eventId: string;
  readonly jobId: string;
  readonly requestId: string;
  readonly status: 'succeeded' | 'failed' | 'cancelled';
  readonly result?: ArcAgentnetJsonValue;
};

export type CallbackEventApplicationInput = {
  readonly callback: AnalyzeCallbackPayload;
  readonly payloadHash: string;
  readonly resultSizeBytes: number;
  readonly receivedAt: Date;
  readonly expiresAt: Date;
};

export type CallbackEventApplicationResult =
  | { readonly kind: 'applied' }
  | { readonly kind: 'replayed' }
  | { readonly kind: 'unknown_job' }
  | { readonly kind: 'request_mismatch' }
  | { readonly kind: 'event_conflict' }
  | { readonly kind: 'database_failure' };

export interface CallbackEventStore {
  apply(input: CallbackEventApplicationInput): Promise<CallbackEventApplicationResult>;
}

type CallbackFailureKind =
  | 'not_configured'
  | 'disallowed_host'
  | 'missing_headers'
  | 'malformed_signature'
  | 'timestamp_skew'
  | 'invalid_signature'
  | 'malformed_payload'
  | 'result_too_large'
  | 'unknown_job'
  | 'request_mismatch'
  | 'event_conflict'
  | 'persistence_unavailable'
  | 'persistence_failure';

export type AnalyzeCallbackResult =
  | { readonly ok: true; readonly kind: 'accepted' | 'replayed'; readonly callback: AnalyzeCallbackPayload }
  | { readonly ok: false; readonly kind: CallbackFailureKind };

export type ReceiveAnalyzeCallbackOptions = {
  readonly secret: string | undefined;
  readonly nowMs?: number;
  readonly persistence?: CallbackEventStore;
};

function assertNever(value: never): never {
  throw new Error(`Unhandled callback status: ${String(value)}`);
}

function isAllowedHost(request: Request): boolean {
  return callbackHostSet.has(new URL(request.url).hostname.toLowerCase());
}

function parseSignature(value: string): Buffer | null {
  const signature = value.startsWith(SIGNATURE_PREFIX) ? value.slice(SIGNATURE_PREFIX.length) : value;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return null;
  return Buffer.from(signature, 'hex');
}

function verifySignature(
  rawBody: Uint8Array,
  timestamp: string,
  eventId: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const received = parseSignature(signatureHeader);
  if (received === null) return false;
  const bodyHash = createHash('sha256').update(rawBody).digest('hex');
  const signedPayload = `${timestamp}.${eventId}.${bodyHash}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function parseCallbackPayload(rawBody: Uint8Array): AnalyzeCallbackPayload | null {
  const parsed = callbackPayloadSchema.safeParse(JSON.parse(new TextDecoder().decode(rawBody)));
  if (!parsed.success) return null;
  const value = parsed.data;
  switch (value.status) {
    case 'succeeded':
      return {
        eventId: value.event_id,
        jobId: value.job_id,
        requestId: value.request_id,
        status: value.status,
        result: value.result,
      };
    case 'failed':
    case 'cancelled':
      return value.result === undefined
        ? {
            eventId: value.event_id,
            jobId: value.job_id,
            requestId: value.request_id,
            status: value.status,
          }
        : {
            eventId: value.event_id,
            jobId: value.job_id,
            requestId: value.request_id,
            status: value.status,
            result: value.result,
          };
    default:
      return assertNever(value);
  }
}

function resultSizeBytes(callback: AnalyzeCallbackPayload): number {
  if (callback.result === undefined) return 0;
  const serialized = JSON.stringify(callback.result);
  return Buffer.byteLength(serialized, 'utf8');
}

export async function receiveAnalyzeCallback(
  request: Request,
  options: ReceiveAnalyzeCallbackOptions,
): Promise<AnalyzeCallbackResult> {
  if (!options.secret) return { ok: false, kind: 'not_configured' };
  if (!isAllowedHost(request)) return { ok: false, kind: 'disallowed_host' };

  const timestamp = request.headers.get(CALLBACK_HEADERS.timestamp);
  const eventId = request.headers.get(CALLBACK_HEADERS.eventId);
  const signature = request.headers.get(CALLBACK_HEADERS.signature);
  if (!timestamp || !eventId || !signature) return { ok: false, kind: 'missing_headers' };
  if (!/^\d+$/.test(timestamp) || !/^[-A-Za-z0-9_:.]{1,200}$/.test(eventId)) {
    return { ok: false, kind: 'malformed_signature' };
  }

  const timestampMs = Number(timestamp) * 1000;
  const nowMs = options.nowMs ?? Date.now();
  if (!Number.isSafeInteger(timestampMs) || Math.abs(nowMs - timestampMs) > REPLAY_WINDOW_MS) {
    return { ok: false, kind: 'timestamp_skew' };
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (!verifySignature(rawBody, timestamp, eventId, signature, options.secret)) {
    return parseSignature(signature) === null
      ? { ok: false, kind: 'malformed_signature' }
      : { ok: false, kind: 'invalid_signature' };
  }

  let callback: AnalyzeCallbackPayload | null;
  try {
    callback = parseCallbackPayload(rawBody);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return { ok: false, kind: 'malformed_payload' };
    throw error;
  }
  if (callback === null || callback.eventId !== eventId) {
    return { ok: false, kind: 'malformed_payload' };
  }
  const callbackResultSizeBytes = resultSizeBytes(callback);
  if (callbackResultSizeBytes > MAX_CALLBACK_RESULT_BYTES) {
    return { ok: false, kind: 'result_too_large' };
  }
  const persistence = options.persistence;
  if (!persistence) return { ok: false, kind: 'persistence_unavailable' };

  let application: CallbackEventApplicationResult;
  try {
    application = await persistence.apply({
      callback,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
      resultSizeBytes: callbackResultSizeBytes,
      receivedAt: new Date(nowMs),
      expiresAt: new Date(timestampMs + REPLAY_WINDOW_MS),
    });
  } catch (error: unknown) {
    if (error instanceof Error) return { ok: false, kind: 'persistence_failure' };
    return { ok: false, kind: 'persistence_failure' };
  }

  switch (application.kind) {
    case 'applied':
      return { ok: true, kind: 'accepted', callback };
    case 'replayed':
      return { ok: true, kind: 'replayed', callback };
    case 'unknown_job':
      return { ok: false, kind: 'unknown_job' };
    case 'request_mismatch':
      return { ok: false, kind: 'request_mismatch' };
    case 'event_conflict':
      return { ok: false, kind: 'event_conflict' };
    case 'database_failure':
      return { ok: false, kind: 'persistence_failure' };
    default:
      return assertNever(application);
  }
}
