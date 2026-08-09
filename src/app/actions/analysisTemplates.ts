'use server';

import { revalidatePath } from 'next/cache';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  createCustomAgent,
  listManagedCustomAgents,
  saveCustomAgentVersion,
  saveAnalysisTemplateVersion,
  setCustomAgentStatus,
  setAnalysisTemplateStatus,
} from '@/lib/db/queries/analysisTemplates';
import { listActivePracticeAreas } from '@/lib/db/queries/practiceAreas';
import {
  customAgentLifecycleInputSchema,
  parseCustomAgentCreateInput,
  parseCustomAgentSaveInput,
  type CustomAgentValidationIssue,
} from '@/lib/analysis/customAgentContracts';
import { validateCapabilitySelection } from '@/lib/analysis/capabilityPresets';
import type { CustomAgentManagementResult } from '@/lib/db/queries/customAgents';
import {
  templateManagementInputSchema,
  type TemplateManagementResult,
} from '@/lib/analysis/templateContracts';

export type AnalysisTemplateActionResult =
  | TemplateManagementResult
  | { readonly ok: false; readonly reason: 'invalid_input' | 'action_failed' };

export type CustomAgentActionResult =
  | CustomAgentManagementResult
  | { readonly ok: false; readonly reason: 'invalid_input' | 'action_failed'; readonly issues?: readonly CustomAgentValidationIssue[] };

function revalidateChangedTemplate(result: TemplateManagementResult): void {
  if (!result.ok || result.kind === 'no_op') return;
  revalidatePath('/agents');
}

function revalidateChangedCustomAgent(result: CustomAgentManagementResult): void {
  if (result.ok) revalidatePath('/agents');
}

function invalidInput(issues: readonly CustomAgentValidationIssue[]): CustomAgentActionResult {
  return { ok: false, reason: 'invalid_input', issues };
}

function actionFailed(): CustomAgentActionResult {
  return { ok: false, reason: 'action_failed' };
}

export async function createCustomAgentAction(input: unknown): Promise<CustomAgentActionResult> {
  const { userId } = await requireStaffAccess();
  const parsed = parseCustomAgentCreateInput(input);
  if (!parsed.ok) return invalidInput(parsed.issues);

  try {
    const activePracticeAreas = await listActivePracticeAreas();
    const matches = activePracticeAreas.filter((practiceArea) => practiceArea.id === parsed.value.practiceAreaId);
    if (matches.length !== 1) {
      return invalidInput([{ path: 'practiceAreaId', code: 'invalid_value', message: 'Select one active approved Practice Area' }]);
    }
    const result = await createCustomAgent(parsed.value, userId);
    revalidateChangedCustomAgent(result);
    return result;
  } catch (error: unknown) {
    if (error instanceof Error) return actionFailed();
    return actionFailed();
  }
}

export async function saveCustomAgentAction(input: unknown): Promise<CustomAgentActionResult> {
  const { userId } = await requireStaffAccess();
  const parsed = parseCustomAgentSaveInput(input);
  if (!parsed.ok) return invalidInput(parsed.issues);

  try {
    const agent = (await listManagedCustomAgents()).find((candidate) => candidate.customAgentId === parsed.value.customAgentId);
    if (!agent) return { ok: false, reason: 'not_found' };
    const capabilityResult = validateCapabilitySelection({
      targetType: agent.targetType,
      practiceAreaId: agent.practiceAreaId,
      capabilityPresetIds: parsed.value.capabilityPresetIds,
    });
    if (!capabilityResult.ok) return invalidInput(capabilityResult.issues);
    const { customAgentId, ...content } = parsed.value;
    const result = await saveCustomAgentVersion(customAgentId, { ...content, targetType: agent.targetType, practiceAreaId: agent.practiceAreaId }, userId);
    revalidateChangedCustomAgent(result);
    return result;
  } catch (error: unknown) {
    if (error instanceof Error) return actionFailed();
    return actionFailed();
  }
}

export async function setCustomAgentStatusAction(input: unknown): Promise<CustomAgentActionResult> {
  const { userId } = await requireStaffAccess();
  const parsed = customAgentLifecycleInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error.issues.map((entry) => ({ path: entry.path.join('.'), code: entry.code, message: entry.message })));

  try {
    const result = await setCustomAgentStatus(parsed.data.customAgentId, parsed.data.status, userId);
    revalidateChangedCustomAgent(result);
    return result;
  } catch (error: unknown) {
    if (error instanceof Error) return actionFailed();
    return actionFailed();
  }
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
