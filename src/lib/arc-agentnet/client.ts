import 'server-only';

import { z } from 'zod';

import {
  registerPartnerJob,
  type RegisterPartnerJobResult,
} from '@/lib/db/queries/partnerCallbacks';
import { env } from '@/lib/env';

const PARTNER_JOBS_PATH = '/partner/jobs';
const DEFAULT_TIMEOUT_MS = 10_000;

const ARC_AGENTNET_STATUSES = [
  'queued',
  'running',
  'cancelling',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export type ArcAgentnetStatus = (typeof ARC_AGENTNET_STATUSES)[number];

export type ArcAgentnetJsonValue =
  | string
  | number
  | boolean
  | null
  | ArcAgentnetJsonValue[]
  | { readonly [key: string]: ArcAgentnetJsonValue };

export type ArcAgentnetJsonObject = {
  readonly [key: string]: ArcAgentnetJsonValue;
};

export type ArcAgentnetSubmitContext = ArcAgentnetJsonObject & {
  readonly analysis: ArcAgentnetJsonObject & {
    readonly resolvedInstructions: string;
  };
};

const jsonValueSchema: z.ZodType<ArcAgentnetJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jobResponseSchema = z.object({
  job_id: z.string().min(1),
  status: z.enum(ARC_AGENTNET_STATUSES),
  request_id: z.string().min(1),
  result: jsonValueSchema.optional(),
}).loose();

type JobResponse = z.infer<typeof jobResponseSchema>;

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ArcAgentnetClientConfig = {
  readonly baseUrl?: string;
  readonly partnerKey?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: FetchImplementation;
  readonly registerJob?: (input: {
    readonly job: AnalyzeJob;
    readonly idempotencyKey: string;
  }) => Promise<RegisterPartnerJobResult>;
};

export type AnalyzeSubmitInput = {
  readonly idempotencyKey: string;
  readonly input: ArcAgentnetSubmitContext;
};

export type AnalyzeJob = {
  readonly jobId: string;
  readonly status: ArcAgentnetStatus;
  readonly requestId: string;
  readonly result?: ArcAgentnetJsonValue;
};

export type ArcAgentnetClientFailure =
  | { readonly ok: false; readonly kind: 'not_configured'; readonly status: null }
  | { readonly ok: false; readonly kind: 'network'; readonly status: null }
  | { readonly ok: false; readonly kind: 'invalid_response'; readonly status: number }
  | { readonly ok: false; readonly kind: 'http_error'; readonly status: number }
  | { readonly ok: false; readonly kind: 'job_expired'; readonly status: 410 }
  | { readonly ok: false; readonly kind: 'persistence'; readonly status: null };

export type ArcAgentnetClientResult<T> =
  | { readonly ok: true; readonly value: T }
  | ArcAgentnetClientFailure;

export type ArcAgentnetClient = {
  readonly submit: (input: AnalyzeSubmitInput) => Promise<ArcAgentnetClientResult<AnalyzeJob>>;
  readonly poll: (input: { readonly jobId: string }) => Promise<ArcAgentnetClientResult<AnalyzeJob>>;
  readonly cancel: (input: { readonly jobId: string }) => Promise<ArcAgentnetClientResult<AnalyzeJob>>;
  readonly delete: (input: { readonly jobId: string }) => Promise<ArcAgentnetClientResult<undefined>>;
};

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.toString().replace(/\/$/, '');
  } catch (error: unknown) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

function toJob(value: JobResponse): AnalyzeJob {
  return value.result === undefined
    ? { jobId: value.job_id, status: value.status, requestId: value.request_id }
    : { jobId: value.job_id, status: value.status, requestId: value.request_id, result: value.result };
}

async function readSuccessfulJob(response: Response): Promise<AnalyzeJob | null> {
  try {
    const parsed = jobResponseSchema.safeParse(await response.json());
    return parsed.success ? toJob(parsed.data) : null;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError');
}

export function createArcAgentnetClient(config: ArcAgentnetClientConfig = {}): ArcAgentnetClient {
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? env.ARC_AGENTNET_BASE_URL);
  const partnerKey = config.partnerKey ?? env.X_Partner_Key;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = config.fetchImpl ?? fetch;

  type RequestOptions = {
    readonly method: 'GET' | 'POST' | 'DELETE';
    readonly body?: string;
    readonly idempotencyKey?: string;
    readonly response: 'job' | 'empty';
  };

  async function request(
    path: string,
    options: RequestOptions & { readonly response: 'job' },
  ): Promise<ArcAgentnetClientResult<AnalyzeJob>>;

  async function request(
    path: string,
    options: RequestOptions & { readonly response: 'empty' },
  ): Promise<ArcAgentnetClientResult<undefined>>;

  async function request(
    path: string,
    options: RequestOptions,
  ): Promise<ArcAgentnetClientResult<AnalyzeJob | undefined>> {
    if (!baseUrl || !partnerKey) {
      return { ok: false, kind: 'not_configured', status: null };
    }

    const headers = new Headers({ 'X-Partner-Key': partnerKey });
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (options.idempotencyKey !== undefined) headers.set('Idempotency-Key', options.idempotencyKey);

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: options.method,
        headers,
        body: options.body,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        return response.status === 410
          ? { ok: false, kind: 'job_expired', status: 410 }
          : { ok: false, kind: 'http_error', status: response.status };
      }

      if (options.response === 'empty') {
        return response.status === 204
          ? { ok: true, value: undefined }
          : { ok: false, kind: 'invalid_response', status: response.status };
      }

      const job = await readSuccessfulJob(response);
      return job === null
        ? { ok: false, kind: 'invalid_response', status: response.status }
        : { ok: true, value: job };
    } catch (error: unknown) {
      if (isNetworkError(error)) return { ok: false, kind: 'network', status: null };
      throw error;
    }
  }

  return {
    submit: ({ idempotencyKey, input }) =>
      request(PARTNER_JOBS_PATH, {
        method: 'POST',
        body: JSON.stringify({ task: input.analysis.resolvedInstructions, context: input }),
        idempotencyKey,
        response: 'job',
      }).then(async (submission) => {
        if (!submission.ok) return submission;
        try {
          const registration = await (config.registerJob ?? ((registrationInput) => registerPartnerJob({
            partnerJobId: registrationInput.job.jobId,
            requestId: registrationInput.job.requestId,
            idempotencyKey: registrationInput.idempotencyKey,
            status: registrationInput.job.status,
          })))(
            { job: submission.value, idempotencyKey },
          );
          return registration.ok
            ? submission
            : { ok: false as const, kind: 'persistence' as const, status: null };
        } catch (error: unknown) {
          if (error instanceof Error) {
            return { ok: false as const, kind: 'persistence' as const, status: null };
          }
          return { ok: false as const, kind: 'persistence' as const, status: null };
        }
      }),
    poll: ({ jobId }) =>
      request(`${PARTNER_JOBS_PATH}/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        response: 'job',
      }),
    cancel: ({ jobId }) =>
      request(`${PARTNER_JOBS_PATH}/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST',
        response: 'job',
      }),
    delete: ({ jobId }) =>
      request(`${PARTNER_JOBS_PATH}/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
        response: 'empty',
      }),
  };
}

export const arcAgentnetClient = createArcAgentnetClient();
