import { z } from 'zod';

import {
  searchRunStatusSchema,
  type SearchLaunchRequest,
  type SearchRunStatus,
  type SearchStatusProjection,
} from '@/lib/search/contracts';

export interface SearchCompanyIdentity {
  readonly id: number;
  readonly name: string;
  readonly domain: string | null;
}

export interface SearchBuyerRolePreview {
  readonly id: number;
  readonly name: string;
}

export interface SearchBuyerRoleEvidencePreview {
  readonly buyerRoleId: number;
  readonly buyerRoleName: string;
  readonly matchedRules: readonly {
    readonly ruleId: string;
    readonly label: string;
    readonly required: boolean;
    readonly match: 'any_selector' | 'all_selectors';
    readonly matchedSelectors: readonly { readonly kind: string; readonly value: string }[];
  }[];
}

export interface SearchEvidencePolicyPreview {
  readonly minimumPublicSources: number;
  readonly allowedSourceKinds: readonly string[];
  readonly requireHttps: boolean;
  readonly allowPrivateSources: boolean;
}

export interface SearchTemplateProjection {
  readonly id: number;
  readonly versionId: number;
  readonly name: string;
  readonly version: number;
  readonly buyerRoles: readonly SearchBuyerRolePreview[];
  readonly buyerRoleEvidence: readonly SearchBuyerRoleEvidencePreview[];
  readonly evidencePolicy: SearchEvidencePolicyPreview;
}

const searchCompanyIdentitySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  domain: z.string().nullable(),
}).strict();

const searchTemplateProjectionSchema = z.object({
  id: z.number().int().positive(),
  versionId: z.number().int().positive(),
  name: z.string(),
  version: z.number().int().positive(),
}).strict();

const searchStatusProjectionSchema = z.object({
  searchRunId: z.number().int().positive(),
  status: searchRunStatusSchema,
  company: searchCompanyIdentitySchema,
  template: searchTemplateProjectionSchema,
  candidateCounts: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    inconclusive: z.number().int().nonnegative(),
    ambiguous: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }).strict(),
  reviewsUrl: z.string().startsWith('/reviews?searchRunId=').nullable(),
}).strict();

const searchLaunchResponseSchema = z.object({
  searchRunId: z.number().int().positive(),
  status: searchRunStatusSchema,
  replayed: z.boolean().optional(),
}).strict();

const errorResponseSchema = z.object({ error: z.string().min(1) }).loose();

export const SEARCH_POLL_INTERVAL_MS = 2_000;
const MAX_SEARCH_POLL_ATTEMPTS = 150;
const MIN_SEARCH_POLL_INTERVAL_MS = 250;
const MAX_SEARCH_POLL_INTERVAL_MS = 10_000;

export const SEARCH_ERROR_COPY = {
  active_run_exists: 'An active Search run already exists for this Company.',
  dispatch_failed: 'Search could not be started. Try again.',
  idempotency_conflict: 'This Search request conflicted with an earlier attempt. Try again.',
  invalid_input: 'The Search request was invalid. Refresh and try again.',
  job_expired: 'Search expired before results were available. Start a new run.',
  partner_unavailable: 'Search could not reach the Search service. Try again.',
  persistence_unavailable: 'Search could not be saved. Try again.',
  search_run_not_found: 'This Search run is no longer available.',
  search_status_unavailable: 'Search status could not be loaded. Refresh and try again.',
  search_unavailable: 'Search is not available right now.',
} as const satisfies Readonly<Record<string, string>>;

export type SearchClientErrorReason = keyof typeof SEARCH_ERROR_COPY;

export function searchErrorMessage(reason: string): string {
  return SEARCH_ERROR_COPY[reason as SearchClientErrorReason] ?? 'Search could not be completed. Try again.';
}

export function createSearchLaunchPayload(input: {
  readonly companyId: number;
  readonly templateVersionId: number;
  readonly idempotencyKey: string;
}): SearchLaunchRequest {
  return {
    subject: { type: 'company', id: input.companyId },
    templateVersionId: input.templateVersionId,
    idempotencyKey: input.idempotencyKey,
  };
}

export type SearchLaunchResult =
  | {
      readonly kind: 'started';
      readonly searchRunId: number;
      readonly status: SearchRunStatus;
      readonly replayed: boolean;
    }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'error'; readonly message: string };

export async function launchSearchRun(input: {
  readonly payload: SearchLaunchRequest;
  readonly signal: AbortSignal;
}): Promise<SearchLaunchResult> {
  try {
    const response = await fetch('/api/search-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
      signal: input.signal,
    });
    const payload = await readJson(response);
    if (input.signal.aborted) return { kind: 'aborted' };
    if (!response.ok) return { kind: 'error', message: errorMessageFromPayload(payload) };

    const parsed = searchLaunchResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return { kind: 'error', message: searchErrorMessage('search_status_unavailable') };
    }
    return {
      kind: 'started',
      searchRunId: parsed.data.searchRunId,
      status: parsed.data.status,
      replayed: parsed.data.replayed ?? false,
    };
  } catch (error: unknown) {
    if (isAbortError(error) || input.signal.aborted) return { kind: 'aborted' };
    return { kind: 'error', message: searchErrorMessage('partner_unavailable') };
  }
}

export type SearchPollingResult =
  | { readonly kind: 'terminal'; readonly projection: SearchStatusProjection }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'error'; readonly message: string };

export async function pollSearchRun(input: {
  readonly searchRunId: number;
  readonly signal: AbortSignal;
  readonly intervalMs?: number;
  readonly onUpdate?: (projection: SearchStatusProjection) => void;
}): Promise<SearchPollingResult> {
  const intervalMs = Math.min(
    Math.max(input.intervalMs ?? SEARCH_POLL_INTERVAL_MS, MIN_SEARCH_POLL_INTERVAL_MS),
    MAX_SEARCH_POLL_INTERVAL_MS,
  );
  let attempts = 0;

  while (!input.signal.aborted && attempts < MAX_SEARCH_POLL_ATTEMPTS) {
    try {
      const response = await fetch(`/api/search-runs/${input.searchRunId}`, {
        cache: 'no-store',
        signal: input.signal,
      });
      const payload = await readJson(response);
      if (input.signal.aborted) return { kind: 'aborted' };
      if (!response.ok) return { kind: 'error', message: errorMessageFromPayload(payload) };

      const parsed = searchStatusProjectionSchema.safeParse(payload);
      if (!parsed.success) {
        return { kind: 'error', message: searchErrorMessage('search_status_unavailable') };
      }
      const projection = parsed.data;
      input.onUpdate?.(projection);
      if (projection.status !== 'queued' && projection.status !== 'running') {
        return { kind: 'terminal', projection };
      }

      attempts += 1;
      if (attempts >= MAX_SEARCH_POLL_ATTEMPTS) {
        return { kind: 'error', message: 'Search status timed out. Refresh to check again.' };
      }
      await waitForNextPoll(intervalMs, input.signal);
    } catch (error: unknown) {
      if (isAbortError(error) || input.signal.aborted) return { kind: 'aborted' };
      return { kind: 'error', message: searchErrorMessage('search_status_unavailable') };
    }
  }

  return { kind: 'aborted' };
}

async function waitForNextPoll(intervalMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, intervalMs);
    signal.addEventListener('abort', finish, { once: true });
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorMessageFromPayload(payload: unknown): string {
  const parsed = errorResponseSchema.safeParse(payload);
  return parsed.success ? searchErrorMessage(parsed.data.error) : searchErrorMessage('search_status_unavailable');
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
