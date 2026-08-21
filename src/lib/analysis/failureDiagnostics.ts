import { createHash } from 'node:crypto';

import { redactRawAttemptText, redactRawAttemptUrl } from './rawAttemptRedaction';
import { telemetryIdentifierSchema } from '@/lib/telemetry/langfuseSafe';
import {
  FAILURE_DIAGNOSTIC_LIMITS,
  debugFailureRecordSchema,
  type DebugFailureRecord,
  type FailureDiagnosticContext,
  type FailureStage,
  type RedactedBoundedText,
} from './rawAttemptContracts';

export {
  FAILURE_DIAGNOSTIC_LIMITS,
  FAILURE_STAGES,
  debugFailureRecordSchema,
} from './rawAttemptContracts';
export type {
  DebugFailureRecord,
  FailureDiagnosticContext,
  FailureStage,
  RedactedBoundedText,
} from './rawAttemptContracts';

export type DebugFailureSpan = Readonly<{ readonly update: (input: Readonly<Record<string, unknown>>) => void }>;

const PROVIDER_PAYLOAD_KEYS = [
  'status',
  'statusCode',
  'code',
  'errorCode',
  'type',
  'provider',
  'service',
  'retryAfter',
  'requestId',
  'message',
  'publicMessage',
  'publicFacts',
  'company',
  'companyName',
  'domain',
  'industry',
  'fact',
  'publicFact',
  'facts',
  'details',
  'description',
  'name',
] as const;
const PROVIDER_ERROR_KEYS = ['status', 'statusCode', 'code', 'errorCode', 'type', 'provider'] as const; const PRIVATE_DIAGNOSTIC_TEXT = /(?:\bprompt\b|system message|developer message|chain[- ]of[- ]thought|private reasoning)/i;

interface SafeProviderObject {
  readonly [key: string]: SafeProviderValue;
}

interface SafeProviderArray extends ReadonlyArray<SafeProviderValue> {}

type SafeProviderValue = string | number | boolean | null | SafeProviderArray | SafeProviderObject;
type SafeProviderRecord = Readonly<Record<string, SafeProviderValue>>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSafely(record: object, key: string): unknown { try { return Reflect.get(record, key); } catch (caught) { return caught instanceof Error ? undefined : undefined; } }

function normalizeOneLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncateCodePoints(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join('');
}

function truncateUtf8(value: string, maxBytes: number): Readonly<{ value: string; truncated: boolean }> {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return { value, truncated: false };
  let result = '';
  for (const character of value) {
    const next = result + character;
    if (Buffer.byteLength(next, 'utf8') > maxBytes) break;
    result = next;
  }
  return { value: result, truncated: true };
}

function metadata(value: string, redaction: 'sensitive' | 'unsafe_url'): RedactedBoundedText {
  return {
    value: null,
    sha256: createHash('sha256').update(value).digest('hex'),
    originalLength: value.length,
    redaction,
    truncated: false,
  };
}

function mapRedaction(redaction: 'none' | 'sensitive' | 'unsafe_url' | 'persona'): RedactedBoundedText['redaction'] {
  return redaction === 'persona' ? 'metadata_only' : redaction;
}

function redactBoundedText(value: string, maxLength: number, preserveLines: boolean): RedactedBoundedText {
  const normalized = preserveLines
    ? value.replace(/\r\n?/g, '\n').replace(/[\t\f\v ]+/g, ' ').trim()
    : normalizeOneLine(value);
  if (PRIVATE_DIAGNOSTIC_TEXT.test(normalized)) return metadata(normalized, 'sensitive');
  const redacted = redactRawAttemptText(normalized, maxLength, false);
  const boundedValue = redacted.value === null ? null : truncateCodePoints(redacted.value, maxLength);
  return {
    value: boundedValue,
    sha256: redacted.sha256,
    originalLength: redacted.originalLength,
    redaction: mapRedaction(redacted.redaction),
    truncated: redacted.truncated || boundedValue !== redacted.value,
  };
}

function readSafeString(record: object, key: string): string | undefined {
  const value = readSafely(record, key);
  return typeof value === 'string' ? value : undefined;
}

function projectProviderValue(
  key: string,
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): SafeProviderValue | undefined {
  if (depth > 4 || value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return undefined;
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    if (PRIVATE_DIAGNOSTIC_TEXT.test(value)) return undefined;
    if (/url$/i.test(key) || key === 'url' || key === 'uri' || key === 'link') {
      const safeUrl = redactRawAttemptUrl(value, false);
      return safeUrl.value === null
        ? { value: null, sha256: safeUrl.sha256, originalLength: safeUrl.originalLength, redaction: 'unsafe_url', truncated: false }
        : safeUrl.value;
    }
    const safeText = redactRawAttemptText(value, FAILURE_DIAGNOSTIC_LIMITS.providerPayload, false);
    return safeText.value;
  }
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    const projected = value
      .map((item) => projectProviderValue(key, item, depth + 1, seen))
      .filter((item): item is SafeProviderValue => item !== undefined);
    return projected.length === 0 ? undefined : projected;
  }
  if (!isRecord(value)) return undefined;
  const projected = projectProviderRecord(value, depth + 1, seen);
  return Object.keys(projected).length === 0 ? undefined : projected;
}

function projectProviderRecord(
  value: object,
  depth = 0,
  seen = new WeakSet<object>(),
  keys: readonly string[] = PROVIDER_PAYLOAD_KEYS,
): SafeProviderRecord {
  const output: Record<string, SafeProviderValue> = {};
  for (const key of keys) {
    const projected = projectProviderValue(key, readSafely(value, key), depth, seen);
    if (projected !== undefined) output[key] = projected;
  }
  return output;
}

function projectProviderPayload(error: unknown, contextPayload: unknown): SafeProviderRecord | null {
  const merged: Record<string, SafeProviderValue> = {};
  if (error instanceof Error || isStructuredProviderError(error)) {
    Object.assign(merged, projectProviderRecord(error, 0, new WeakSet<object>(), PROVIDER_ERROR_KEYS));
  }
  if (isRecord(contextPayload)) Object.assign(merged, projectProviderRecord(contextPayload));
  return Object.keys(merged).length === 0 ? null : merged;
}

function providerPayloadText(error: unknown, contextPayload: unknown): RedactedBoundedText | null {
  const projected = projectProviderPayload(error, contextPayload);
  if (projected === null) return null;
  const serialized = JSON.stringify(projected);
  const redacted = redactRawAttemptText(serialized, Number.MAX_SAFE_INTEGER, false);
  if (redacted.value === null) {
    return {
      value: null,
      sha256: redacted.sha256,
      originalLength: redacted.originalLength,
      redaction: mapRedaction(redacted.redaction),
      truncated: false,
    };
  }
  const bounded = truncateUtf8(serialized, FAILURE_DIAGNOSTIC_LIMITS.providerPayload);
  return {
    value: bounded.value,
    sha256: redacted.sha256,
    originalLength: redacted.originalLength,
    redaction: mapRedaction(redacted.redaction),
    truncated: bounded.truncated,
  };
}

function isStructuredProviderError(value: unknown): value is Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return false;
  return PROVIDER_ERROR_KEYS.some((key) => readSafely(value, key) !== undefined);
}

function safeIdentifier(value: unknown): string | null {
  try {
    const parsed = telemetryIdentifierSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch (caught) {
    if (caught instanceof Error) return null;
    return null;
  }
}

function safeErrorName(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const redacted = redactBoundedText(value, FAILURE_DIAGNOSTIC_LIMITS.errorName, false);
  return redacted.value === null ? fallback : redacted.value;
}

function safeErrorMessage(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const redacted = redactBoundedText(value, FAILURE_DIAGNOSTIC_LIMITS.errorMessage, false);
  return redacted.value === null ? 'Failure details redacted' : redacted.value;
}

function errorDetails(error: unknown): Readonly<{ name: string; message: string; stack: string | undefined }> {
  if (error instanceof Error) {
    return {
      name: safeErrorName(readSafeString(error, 'name'), 'UnknownError'),
      message: safeErrorMessage(readSafeString(error, 'message'), 'Unrecognized failure'),
      stack: readSafeString(error, 'stack'),
    };
  }
  if (isStructuredProviderError(error)) {
    return {
      name: safeErrorName(readSafeString(error, 'name'), 'ProviderError'),
      message: safeErrorMessage(readSafeString(error, 'message'), 'Provider failure'),
      stack: undefined,
    };
  }
  return { name: 'UnknownError', message: 'Unrecognized failure', stack: undefined };
}

export function normalizeDebugFailure(
  error: unknown,
  failureStage: FailureStage,
  context: FailureDiagnosticContext,
): DebugFailureRecord {
  const details = errorDetails(error);
  const record: DebugFailureRecord = {
    schemaVersion: 1,
    failureStage,
    errorName: details.name,
    errorMessage: details.message,
    stackExcerpt: details.stack === undefined ? null : redactBoundedText(details.stack, FAILURE_DIAGNOSTIC_LIMITS.stackExcerpt, true),
    providerPayload: providerPayloadText(error, context.providerPayload),
    correlation: {
      runId: context.runId,
      traceId: safeIdentifier(context.traceId),
      observationId: safeIdentifier(context.observationId),
      parentObservationId: safeIdentifier(context.parentObservationId),
    },
  };
  return debugFailureRecordSchema.parse(record);
}

export function formatDebugFailureStatusMessage(record: DebugFailureRecord): string {
  return truncateCodePoints(
    `Analysis failed during ${record.failureStage}: ${record.errorMessage}`,
    FAILURE_DIAGNOSTIC_LIMITS.errorMessage,
  );
}
