import {
  analysisAgentSelectionSchema,
  phase33PolicySnapshotSchema,
  signalCategorySchema,
  type AnalysisEffort,
  type AnalysisTargetType,
} from './contracts';
import { deriveActiveChecklist, deriveActiveChecklistForCategory } from './checklist';
import {
  validateCapabilitySelection,
} from './capabilityPresets';
import {
  getActiveCustomAgentLaunchVersion,
  type CustomAgentLaunchRead,
} from '@/lib/db/queries/customAgents';
import { getModelSettingsForUser } from '@/lib/db/queries/userModelSettings';
import { resolveModelChain } from '@/lib/agents/modelConfig';
import {
  resolveActivePracticeArea,
  resolveAnalysisSubject,
  resolveAnalysisTemplateVersion,
  type ResolvedAnalysisSubject,
  type ResolvedPracticeArea,
} from './subjects';

export const analysisCompatibilityReasons = [
  'invalid_input',
  'subject_not_found',
  'subject_type_mismatch',
  'practice_area_required',
  'practice_area_not_found',
  'template_version_not_found',
  'template_not_active',
  'template_version_not_current',
  'custom_agent_not_found',
  'custom_agent_not_active',
  'custom_agent_version_not_current',
  'custom_agent_target_mismatch',
  'custom_agent_practice_area_mismatch',
  'custom_effort_invalid',
  'custom_capability_invalid',
  'custom_output_invalid',
  'execution_policy_unavailable',
] as const;

export type AnalysisCompatibilityReason = (typeof analysisCompatibilityReasons)[number];

export type ResolvedAnalysisLaunch = {
  readonly kind: 'fixed' | 'custom';
  readonly template: {
    readonly templateId: number;
    readonly templateVersionId: number;
    readonly key: string;
    readonly name: string;
    readonly targetType: AnalysisTargetType;
    readonly version: number;
    readonly instruction: string;
    readonly effort: AnalysisEffort;
    readonly custom?: CustomAgentLaunchRead;
  };
  readonly subject: ResolvedAnalysisSubject;
  readonly practiceArea: ResolvedPracticeArea;
  readonly checklist: Awaited<ReturnType<typeof deriveActiveChecklist>>;
  readonly resolvedModelChain: ReturnType<typeof resolveModelChain>;
  readonly policy: ReturnType<typeof phase33PolicySnapshotSchema.parse>;
};

type Resolution =
  | { readonly ok: true; readonly value: ResolvedAnalysisLaunch }
  | { readonly ok: false; readonly reason: AnalysisCompatibilityReason };

export type AnalysisLaunchResolutionInput = {
  readonly userId: string;
  readonly subject: unknown;
  readonly practiceAreaId: unknown;
  readonly selection: unknown;
  readonly policy: unknown;
  // Optional only for legacy v1 callers (the flat pre-category request shape
  // in POST /api/analysis-runs' legacyFixedInputSchema fallback) that never
  // send a category and keep resolving the unfiltered v1 checklist. Every
  // new category-aware caller (analysis-preview, the structured
  // analysis-runs shape) sends this via its schema-required signalCategory.
  readonly signalCategory?: unknown;
};

type ChecklistResolution =
  | { readonly ok: true; readonly value: Awaited<ReturnType<typeof deriveActiveChecklist>> }
  | { readonly ok: false; readonly reason: 'invalid_input' };

// The sole path from a client-supplied category to a checklist: shape-checks
// the category, then re-resolves it against the server-derived targetType
// and practiceArea via deriveActiveChecklistForCategory -- the client never
// supplies signal ids or a checklist directly. That function throws (via
// checklistSnapshotV2Schema's items.min(1)) whenever the resolved
// (targetType, practiceArea, category) triple has no active signals, which
// covers malformed, unknown, stale, and wrong-target categories uniformly as
// invalid_input, never a persisted empty or mismatched v2 snapshot.
async function resolveChecklistForLaunch(
  targetType: AnalysisTargetType,
  practiceArea: ResolvedPracticeArea,
  signalCategoryInput: unknown,
): Promise<ChecklistResolution> {
  if (signalCategoryInput === undefined) {
    return { ok: true, value: await deriveActiveChecklist(targetType, practiceArea) };
  }
  const category = signalCategorySchema.safeParse(signalCategoryInput);
  if (!category.success) return { ok: false, reason: 'invalid_input' };
  try {
    return { ok: true, value: await deriveActiveChecklistForCategory(targetType, practiceArea, category.data) };
  } catch {
    return { ok: false, reason: 'invalid_input' };
  }
}

export async function resolveAnalysisLaunch(
  input: AnalysisLaunchResolutionInput,
): Promise<Resolution> {
  const selection = analysisAgentSelectionSchema.safeParse(input.selection);
  if (!selection.success) return { ok: false, reason: 'invalid_input' };

  const subjectType = getSubjectType(input.subject);
  if (subjectType === undefined) return { ok: false, reason: 'invalid_input' };

  const subjectResolution = await resolveAnalysisSubject(input.subject, subjectType);
  if (!subjectResolution.ok) return { ok: false, reason: subjectResolution.reason };
  const practiceAreaResolution = await resolveActivePracticeArea(input.practiceAreaId);
  if (!practiceAreaResolution.ok) return { ok: false, reason: practiceAreaResolution.reason };
  const checklistResolution = await resolveChecklistForLaunch(subjectType, practiceAreaResolution.value, input.signalCategory);
  if (!checklistResolution.ok) return { ok: false, reason: checklistResolution.reason };
  const checklist = checklistResolution.value;
  const modelSettings = await getModelSettingsForUser(input.userId);
  const resolvedModelChain = resolveModelChain(modelSettings);
  const policy = phase33PolicySnapshotSchema.safeParse(input.policy);
  if (!policy.success) return { ok: false, reason: 'execution_policy_unavailable' };

  if (selection.data.kind === 'fixed') {
    const template = await resolveAnalysisTemplateVersion(selection.data.templateVersionId);
    if (!template.ok) return { ok: false, reason: template.reason };
    if (template.value.targetType !== subjectType) return { ok: false, reason: 'subject_type_mismatch' };
    if (template.value.instruction === null) return { ok: false, reason: 'custom_output_invalid' };
    return {
      ok: true,
      value: {
        kind: 'fixed',
        template: {
          templateId: template.value.templateId,
          templateVersionId: template.value.templateVersionId,
          key: template.value.key,
          name: template.value.name,
          targetType: template.value.targetType,
          version: template.value.version,
          instruction: template.value.instruction,
          effort: 'standard',
        },
        subject: subjectResolution.value,
        practiceArea: practiceAreaResolution.value,
        checklist,
        resolvedModelChain,
        policy: policy.data,
      },
    };
  }

  const custom = await getActiveCustomAgentLaunchVersion(
    selection.data.customAgentId,
    selection.data.templateVersionId,
  );
  if (custom === undefined) return { ok: false, reason: 'custom_agent_not_found' };
  if (custom.status !== 'active') return { ok: false, reason: 'custom_agent_not_active' };
  if (custom.targetType !== subjectType) return { ok: false, reason: 'custom_agent_target_mismatch' };
  if (custom.practiceAreaId !== practiceAreaResolution.value.id) {
    return { ok: false, reason: 'custom_agent_practice_area_mismatch' };
  }
  const effort = custom.latest.defaultEffort;
  if (!custom.latest.supportedEfforts.includes(effort) || effort !== 'standard') {
    return { ok: false, reason: 'custom_effort_invalid' };
  }
  const capabilities = validateCapabilitySelection({
    targetType: subjectType,
    practiceAreaId: practiceAreaResolution.value.id,
    capabilityPresetIds: custom.latest.capabilityPresetIds,
  });
  if (!capabilities.ok) return { ok: false, reason: 'custom_capability_invalid' };

  const parsedOutput = custom.latest.outputSchema;
  if (parsedOutput !== null && typeof parsedOutput !== 'object') {
    return { ok: false, reason: 'custom_output_invalid' };
  }
  return {
    ok: true,
    value: {
      kind: 'custom',
      template: {
        templateId: custom.templateId,
        templateVersionId: custom.latest.templateVersionId,
        key: custom.customAgentId,
        name: custom.latest.name,
        targetType: custom.targetType,
        version: custom.latest.version,
        instruction: custom.latest.behaviorInstruction,
        effort: 'standard',
        custom,
      },
      subject: subjectResolution.value,
      practiceArea: practiceAreaResolution.value,
      checklist,
      resolvedModelChain,
      policy: policy.data,
    },
  };
}

function getSubjectType(input: unknown): AnalysisTargetType | undefined {
  if (typeof input !== 'object' || input === null || !('type' in input)) return undefined;
  const type = input.type;
  return type === 'company' || type === 'persona' ? type : undefined;
}
