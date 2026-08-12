import { z } from 'zod';

import { analysisPreviewResponseSchema } from '@/lib/analysis/experienceContracts';

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
});
const customAgentOptionSchema = z.object({
  kind: z.literal('custom'),
  customAgentId: z.string().min(1),
  templateVersionId: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().min(1),
  targetType: z.enum(['company', 'persona']),
  version: z.number().int().positive(),
});
const agentOptionSchema = z.discriminatedUnion('kind', [fixedAgentOptionSchema, customAgentOptionSchema]);

// Initial step: only Practice Areas are requested/returned.
const initialOptionsSchema = z.object({
  practiceAreas: z.array(practiceAreaSchema),
}).strict();
// Follow-up step (Practice Area selected): fixed option first, then every
// matching active custom option, alongside Practice Areas.
const followUpOptionsSchema = z.object({
  agents: z.array(agentOptionSchema),
  practiceAreas: z.array(practiceAreaSchema),
}).strict();

const createRunResponseSchema = z.object({ applicationRunId: z.number().int().positive() }).strict();

export const ANALYSIS_LAUNCHER_ERROR_COPY = {
  invalid_input: 'Choose a valid Practice Area, then try again.',
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
  readonly selection: AgentSelection;
}

export function createAnalysisRunPayload({
  subjectType,
  subjectId,
  practiceAreaId,
  selection,
}: AnalysisRunPayloadInput) {
  const subject = { type: subjectType, id: subjectId };
  // Fixed selection preserves the existing flat request shape exactly (no
  // `selection` wrapper) for compatibility with the legacy launch path.
  // Custom selection carries only its opaque identity/version inside a
  // discriminated `selection` object. Fields are picked explicitly (never
  // spread) so no extra property on a loosely-typed selection can leak in.
  return selection.kind === 'fixed'
    ? { templateVersionId: selection.templateVersionId, subject, practiceAreaId }
    : {
        subject,
        practiceAreaId,
        selection: {
          kind: 'custom' as const,
          customAgentId: selection.customAgentId,
          templateVersionId: selection.templateVersionId,
        },
      };
}

export type AnalysisOptionsResult =
  | { readonly ok: true; readonly practiceAreas: readonly PracticeArea[]; readonly agents: readonly AgentOption[] }
  | { readonly ok: false; readonly message: string };

// `practiceAreaId === undefined` requests/parses the initial `{ practiceAreas }`
// step. A defined `practiceAreaId` sends the follow-up query (subjectType +
// practiceAreaId) and parses the server-projected `{ agents, practiceAreas }`
// response -- fixed first, then every matching active custom option.
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
      ? { ok: true, practiceAreas: parsed.data.practiceAreas, agents: [] }
      : { ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' };
  }

  const parsed = followUpOptionsSchema.safeParse(payload);
  return parsed.success
    ? { ok: true, practiceAreas: parsed.data.practiceAreas, agents: parsed.data.agents }
    : { ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' };
}

export type AnalysisPreviewResult =
  | { readonly ok: true; readonly preview: AnalysisPreview }
  | { readonly ok: false; readonly message: string };

export interface AnalysisPreviewRequest {
  readonly subjectType: AnalysisSubjectType;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signal: AbortSignal;
}

export async function fetchAnalysisPreview({
  subjectType,
  subjectId,
  practiceAreaId,
  signal,
}: AnalysisPreviewRequest): Promise<AnalysisPreviewResult> {
  const response = await fetch('/api/analysis-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({ subject: { type: subjectType, id: subjectId }, practiceAreaId }),
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
