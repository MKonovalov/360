'use server';

import { revalidatePath } from 'next/cache';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  saveAnalysisTemplateVersion,
  setAnalysisTemplateStatus,
} from '@/lib/db/queries/analysisTemplates';
import {
  templateManagementInputSchema,
  type TemplateManagementResult,
} from '@/lib/analysis/templateContracts';

export type AnalysisTemplateActionResult =
  | TemplateManagementResult
  | { readonly ok: false; readonly reason: 'invalid_input' | 'action_failed' };

function revalidateChangedTemplate(result: TemplateManagementResult): void {
  if (!result.ok || result.kind === 'no_op') return;
  revalidatePath('/agents');
}

export async function saveAnalysisTemplateAction(
  input: unknown,
): Promise<AnalysisTemplateActionResult> {
  const { userId } = await requireStaffAccess();
  const parsed = templateManagementInputSchema.safeParse(input);

  if (!parsed.success || parsed.data.operation !== 'content') {
    return { ok: false, reason: 'invalid_input' };
  }

  try {
    const result = await saveAnalysisTemplateVersion(parsed.data, userId);
    revalidateChangedTemplate(result);
    return result;
  } catch (error: unknown) {
    if (error instanceof Error) return { ok: false, reason: 'action_failed' };
    return { ok: false, reason: 'action_failed' };
  }
}

export async function setAnalysisTemplateStatusAction(
  input: unknown,
): Promise<AnalysisTemplateActionResult> {
  const { userId } = await requireStaffAccess();
  const parsed = templateManagementInputSchema.safeParse(input);

  if (!parsed.success || parsed.data.operation !== 'lifecycle') {
    return { ok: false, reason: 'invalid_input' };
  }

  try {
    const result = await setAnalysisTemplateStatus(parsed.data, userId);
    revalidateChangedTemplate(result);
    return result;
  } catch (error: unknown) {
    if (error instanceof Error) return { ok: false, reason: 'action_failed' };
    return { ok: false, reason: 'action_failed' };
  }
}
