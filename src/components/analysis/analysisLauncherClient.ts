import { z } from 'zod';

import { analysisPreviewResponseSchema } from '@/lib/analysis/experienceContracts';

const optionsSchema = z.object({
  templates: z.array(z.object({ templateVersionId: z.number().int().positive() })),
  practiceAreas: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    shortCode: z.string().min(1),
  })),
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
export type AnalysisPreview = z.infer<typeof analysisPreviewResponseSchema>;

export interface AnalysisRunPayloadInput {
  readonly templateVersionId: number;
  readonly subjectType: AnalysisSubjectType;
  readonly subjectId: number;
  readonly practiceAreaId: number;
}

export function createAnalysisRunPayload({
  templateVersionId,
  subjectType,
  subjectId,
  practiceAreaId,
}: AnalysisRunPayloadInput) {
  return {
    templateVersionId,
    subject: { type: subjectType, id: subjectId },
    practiceAreaId,
  };
}

export type AnalysisOptionsResult =
  | { readonly ok: true; readonly practiceAreas: readonly PracticeArea[] }
  | { readonly ok: false; readonly message: string };

export async function fetchAnalysisOptions(
  subjectType: AnalysisSubjectType,
  signal: AbortSignal,
): Promise<AnalysisOptionsResult> {
  const response = await fetch(`/api/analysis-options?subjectType=${encodeURIComponent(subjectType)}`, { signal });
  const payload = await readJson(response);
  if (!response.ok) return { ok: false, message: 'Analysis options could not be loaded. Refresh and try again.' };
  const parsed = optionsSchema.safeParse(payload);
  return parsed.success
    ? { ok: true, practiceAreas: parsed.data.practiceAreas }
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
