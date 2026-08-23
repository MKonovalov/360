import { z } from 'zod';

import { analysisPreviewResponseSchema } from '@/lib/analysis/experienceContracts';
import type { DebugPreference } from '@/lib/analysis/debugLaunchPreference';
import { executionTargetSchema, type AnalysisExecutor } from '@/lib/analysis/executionTarget';

export type { AnalysisExecutor } from '@/lib/analysis/executionTarget';

const practiceAreaSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  shortCode: z.string().min(1),
});

// Intentionally not `.strict()`: the server may return additional display
// metadata (e.g. supportedEfforts/defaultEffort) that the client does not
// need. Unknown fields are silently stripped by Zod, never carried forward
// into the launch payload.
const fixedAgentOptionSchema = z.object({
  kind: z.literal('fixed'),
  templateVersionId: z.number().int().positive(),
  key: z.string().min(1),
  name: z.string().min(1),
  targetType: z.enum(['company', 'persona']),
  version: z.number().int().positive(),
  executor: executionTargetSchema,
});
const customAgentOptionSchema = z.object({
  kind: z.literal('custom'),
  customAgentId: z.string().min(1),
  templateVersionId: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().min(1),
  targetType: z.enum(['company', 'persona']),
  version: z.number().int().positive(),
  executor: executionTargetSchema,
});
const agentOptionSchema = z.discriminatedUnion('kind', [fixedAgentOptionSchema, customAgentOptionSchema]);

// Initial step: only Practice Areas are requested/returned.
const initialOptionsSchema = z.object({
  practiceAreas: z.array(practiceAreaSchema),
}).strict();
// Follow-up step (Practice Area selected): fixed option first, then every
// matching active custom option, alongside Practice Areas and the active
// target-specific signal categories for that Practice Area. `.default([])`
// keeps this tolerant of a server response that omits the field, matching
// the initial-step schema's own forward-compatible parsing posture.
// `executionTargets` is Company-only: the route includes it (possibly `[]`
// when Company Arc-agentnet is disabled) only for `subjectType=company` and
// omits the key entirely for `subjectType=persona`. `.optional()` accepts
// both shapes without making the field required for Persona; array values
// are still validated against the same enum the server enforces, so an
// unknown target value fails closed rather than being silently accepted.
const followUpOptionsBaseSchema = z.object({
  agents: z.array(agentOptionSchema),
  practiceAreas: z.array(practiceAreaSchema),
  signalCategories: z.array(z.string().min(1)).default([]),
  executionTargets: z.array(executionTargetSchema).optional(),
}).strict();
const companyFollowUpOptionsSchema = followUpOptionsBaseSchema.extend({
  executionTargets: z.array(executionTargetSchema).optional(),
}).strict();
const personaFollowUpOptionsSchema = followUpOptionsBaseSchema.strict();

const createRunResponseSchema = z.object({ applicationRunId: z.number().int().positive() }).strict();

export const ANALYSIS_LAUNCHER_ERROR_COPY = {
  invalid_input: 'Choose a valid Practice Area and Buying Signal Category, then try again.',
  template_not_found: 'No compatible analysis template is available for this record.',
  template_configuration_invalid: 'Analysis templates are not configured for this record type.',
  template_version_not_found: 'The analysis template is no longer available. Refresh and try again.',
  template_not_active: 'The analysis template is no longer active. Refresh and try again.',
  practice_area_not_found: 'That Practice Area is no longer available. Refresh and try again.',
  subject_not_found: 'This record could not be loaded. Refresh and try again.',
  subject_type_mismatch: 'The selected record is not compatible with this analysis.',
  active_run_exists: 'An active analysis run already exists for this record.',
  dispatch_failed: 'The analysis could not be started. Try again.',
  network: 'The analysis service could not be reached. Try again.',
} as const satisfies Readonly<Record<string, string>>;

export type AnalysisSubjectType = 'company' | 'persona';
export type PracticeArea = { readonly id: number; readonly name: string; readonly shortCode: string };
export type FixedAgentOption = z.infer<typeof fixedAgentOptionSchema>;
export type CustomAgentOption = z.infer<typeof customAgentOptionSchema>;
export type AgentOption = FixedAgentOption | CustomAgentOption;
export type AnalysisPreview = z.infer<typeof analysisPreviewResponseSchema>;

// Opaque fixed/custom selection identity. The browser never carries
// instructions, research queries, output schema, capabilities, actor,
// effort, model chain, budget, policy, provider, tool, credential, or any
// other authored execution configuration -- only the fixed templateVersionId
// or the custom identity/version pair the server re-resolves at launch.
export type AgentSelection =
  | { readonly kind: 'fixed'; readonly templateVersionId: number }
  | { readonly kind: 'custom'; readonly customAgentId: string; readonly templateVersionId: number };

export interface AnalysisRunPayloadInput {
  readonly subjectType: AnalysisSubjectType;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signalCategory: string;
  readonly selection: AgentSelection;
  readonly executor?: AnalysisExecutor;
}

// The confirmed session preference is the only signal that may select a
// launch endpoint -- Off always launches through the ordinary route, On
// through the debug route. Server-side authorization (requireStaffAccess /
// requireDebugAdminAccess) is the actual trust boundary; this mapping never
// infers or grants authorization on its own.
export function analysisRunEndpoint(
  preference: DebugPreference,
): '/api/analysis-runs' | '/api/debug/analysis-runs' {
  switch (preference) {
    case 'off':
      return '/api/analysis-runs';
    case 'on':
      return '/api/debug/analysis-runs';
    default:
      return assertNever(preference);
  }
}

export function createAnalysisRunPayload({
  subjectType,
  subjectId,
  practiceAreaId,
  signalCategory,
  selection,
  executor,
}: AnalysisRunPayloadInput) {
  const subject = { type: subjectType, id: subjectId };
  // Fixed selection preserves the existing flat request shape (no
  // `selection` wrapper) while carrying the required category.
  // Custom selection carries only its opaque identity/version inside a
  // discriminated `selection` object. Fields are picked explicitly (never
  // spread) so no extra property on a loosely-typed selection can leak in.
  const payload = (() => {
    switch (selection.kind) {
      case 'fixed':
        return { templateVersionId: selection.templateVersionId, subject, practiceAreaId, signalCategory };
      case 'custom':
        return {
          subject,
          practiceAreaId,
          signalCategory,
          selection: {
            kind: 'custom' as const,
            customAgentId: selection.customAgentId,
            templateVersionId: selection.templateVersionId,
          },
        };
      default:
        return assertNever(selection);
    }
  })();
  return executor === undefined ? payload : { ...payload, executor };
}

export interface ArcAgentnetRunPayloadInput {
  readonly subjectType: 'company';
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signalCategory: string;
  readonly selection: AgentSelection;
  readonly idempotencyKey: string;
}

export function createArcAgentnetRunPayload({
  subjectType,
  subjectId,
  practiceAreaId,
  signalCategory,
  selection,
  idempotencyKey,
}: ArcAgentnetRunPayloadInput) {
  return {
    subject: { type: subjectType, id: subjectId },
    practiceAreaId,
    signalCategory,
    selection: selection.kind === 'fixed'
      ? { kind: 'fixed' as const, templateVersionId: selection.templateVersionId }
      : {
        kind: 'custom' as const,
        customAgentId: selection.customAgentId,
        templateVersionId: selection.templateVersionId,
      },
    idempotencyKey,
  };
}

export type ArcAgentnetPollingResult =
  | { readonly kind: 'terminal'; readonly status: 'completed' | 'failed' | 'cancelled' }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'error'; readonly message: string };

interface ArcAgentnetPollingOptions {
  readonly applicationRunId: number;
  readonly signal: AbortSignal;
  readonly intervalMs?: number;
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const arcAgentnetStatusResponseSchema = z.object({
  applicationRunId: z.number().int().positive(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
}).loose();

export async function pollArcAgentnetRun({
  applicationRunId,
  signal,
  intervalMs = 2_000,
  fetchImpl = fetch,
}: ArcAgentnetPollingOptions): Promise<ArcAgentnetPollingResult> {
  while (!signal.aborted) {
    try {
      const response = await fetchImpl(`/api/analysis-runs/arc-agentnet/${applicationRunId}`, { signal });
      const payload = await readJson(response);
      if (signal.aborted) return { kind: 'aborted' };
      if (!response.ok) return { kind: 'error', message: 'The analysis status could not be loaded. Try again.' };
      const parsed = arcAgentnetStatusResponseSchema.safeParse(payload);
      if (!parsed.success) return { kind: 'error', message: 'The analysis status could not be loaded. Try again.' };
      if (parsed.data.status === 'completed' || parsed.data.status === 'failed' || parsed.data.status === 'cancelled') {
        return { kind: 'terminal', status: parsed.data.status };
      }
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
    } catch (error: unknown) {
      if (isAbortError(error) || signal.aborted) return { kind: 'aborted' };
      if (error instanceof TypeError) return { kind: 'error', message: 'The analysis status could not be reached. Try again.' };
      return { kind: 'error', message: 'The analysis status could not be loaded. Try again.' };
    }
  }
  return { kind: 'aborted' };
}

export type AnalysisOptionsResult =
  | {
      readonly ok: true;
      readonly practiceAreas: readonly PracticeArea[];
      readonly agents: readonly AgentOption[];
      readonly signalCategories: readonly string[];
      readonly executionTargets?: readonly AnalysisExecutor[];
    }
  | { readonly ok: false; readonly message: string };

// `practiceAreaId === undefined` requests/parses the initial `{ practiceAreas }`
// step. A defined `practiceAreaId` sends the follow-up query (subjectType +
// practiceAreaId) and parses the server-projected `{ agents, practiceAreas,
// signalCategories }` response -- fixed first, then every matching active
// custom option.
export async function fetchAnalysisOptions(
  subjectType: AnalysisSubjectType,
  practiceAreaId: number | undefined,
  signal: AbortSignal,
): Promise<AnalysisOptionsResult> {
  const params = new URLSearchParams({ subjectType });
  if (practiceAreaId !== undefined) params.set('practiceAreaId', String(practiceAreaId));
  const response = await fetch(`/api/analysis-options?${params.toString()}`, { signal });
  const payload = await readJson(response);
  if (!response.ok) return { ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' };

  if (practiceAreaId === undefined) {
    const parsed = initialOptionsSchema.safeParse(payload);
    return parsed.success
      ? { ok: true, practiceAreas: parsed.data.practiceAreas, agents: [], signalCategories: [] }
      : { ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' };
  }

  if (subjectType === 'company') {
    const parsed = companyFollowUpOptionsSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' };
    return {
      ok: true,
      practiceAreas: parsed.data.practiceAreas,
      agents: parsed.data.agents,
      signalCategories: parsed.data.signalCategories,
      ...(parsed.data.executionTargets === undefined ? {} : { executionTargets: parsed.data.executionTargets }),
    };
  }
  const parsed = personaFollowUpOptionsSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' };
  return {
    ok: true,
    practiceAreas: parsed.data.practiceAreas,
    agents: parsed.data.agents,
    signalCategories: parsed.data.signalCategories,
  };
}

export type AnalysisPreviewResult =
  | { readonly ok: true; readonly preview: AnalysisPreview }
  | { readonly ok: false; readonly message: string };

export interface AnalysisPreviewRequest {
  readonly subjectType: AnalysisSubjectType;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signalCategory: string;
  readonly selection: AgentSelection;
  readonly signal: AbortSignal;
}

export async function fetchAnalysisPreview({
  subjectType,
  subjectId,
  practiceAreaId,
  signalCategory,
  selection,
  signal,
}: AnalysisPreviewRequest): Promise<AnalysisPreviewResult> {
  const selectionPayload = (() => {
    switch (selection.kind) {
      case 'fixed':
        return { kind: 'fixed' as const, templateVersionId: selection.templateVersionId };
      case 'custom':
        return {
          kind: 'custom' as const,
          customAgentId: selection.customAgentId,
          templateVersionId: selection.templateVersionId,
        };
      default:
        return assertNever(selection);
    }
  })();
  const response = await fetch('/api/analysis-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({ subject: { type: subjectType, id: subjectId }, practiceAreaId, signalCategory, selection: selectionPayload }),
  });
  const payload = await readJson(response);
  if (!response.ok) return { ok: false, message: getErrorCopy(payload) };
  const parsed = analysisPreviewResponseSchema.safeParse(payload);
  return parsed.success
    ? { ok: true, preview: parsed.data }
    : { ok: false, message: 'The analysis preview could not be loaded. Refresh and try again.' };
}

export function getErrorCopy(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return 'The analysis request could not be completed. Try again.';
  const reason = payload.error;
  const match = typeof reason === 'string'
    ? Object.entries(ANALYSIS_LAUNCHER_ERROR_COPY).find(([key]) => key === reason)
    : undefined;
  return match?.[1] ?? 'The analysis request could not be completed. Try again.';
}

export function parseCreateRunResponse(payload: unknown): number | null {
  const parsed = createRunResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.applicationRunId : null;
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected analysis agent selection: ${String(value)}`);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
