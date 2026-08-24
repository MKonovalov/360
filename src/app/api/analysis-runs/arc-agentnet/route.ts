import 'server-only';

import { createHash } from 'node:crypto';

import { arcAgentnetClient, type ArcAgentnetSubmitContext } from '@/lib/arc-agentnet/client';
import { buildBoundedArcAgentnetInput } from '@/lib/analysis/buildArcAgentnetPayload';
import { resolveAnalysisLaunch, type ResolvedCompanyArcAgentnetLaunch } from '@/lib/analysis/compatibility';
import { buildPhase33AnalysisSnapshots } from '@/lib/analysis/snapshots';
import { arcAgentnetSubmitRequestSchema, type BoundedArcAgentnetInput } from '@/lib/analysis/arcAgentnetContracts';
import { isCompanyArcAgentnetEnabled } from '@/lib/env';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { getCompanyById } from '@/lib/db/queries/companies';
import {
  createArcAgentnetRunWithMapping,
  findArcAgentnetActiveRun,
  findArcAgentnetIdempotency,
} from '@/lib/db/queries/arcAgentnetRuns';
import { isPhase39FixtureMode, PHASE39_APPROVED_POLICY } from '@/lib/verification/phase39Fixtures';
import { isPhase36FixtureMode, PHASE36_APPROVED_POLICY } from '@/lib/verification/phase36Fixtures';
import { PHASE33_STANDARD_APPROVED_POLICY } from '@/lib/analysis/contracts';

export async function POST(request: Request): Promise<Response> {
  const { userId } = await requireStaffAccess();
  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return safeResponse({ error: 'invalid_input' }, 400);
    throw error;
  }

  const parsed = arcAgentnetSubmitRequestSchema.safeParse(body);
  if (!parsed.success) return safeResponse({ error: 'invalid_input' }, 400);
  if (!isCompanyArcAgentnetEnabled()) return safeResponse({ error: 'executor_unavailable' }, 409);

  const policy = isPhase39FixtureMode()
    ? PHASE39_APPROVED_POLICY
    : isPhase36FixtureMode()
      ? PHASE36_APPROVED_POLICY
      : PHASE33_STANDARD_APPROVED_POLICY;
  const resolved = await resolveAnalysisLaunch({
    ...parsed.data,
    userId,
    policy,
  });
  if (!resolved.ok) return resolutionErrorResponse(resolved.reason);
  if (resolved.executor !== 'arc-agentnet' || resolved.value.subject.type !== 'company') {
    return safeResponse({ error: 'executor_target_mismatch' }, 409);
  }

  const company = await getCompanyById(resolved.value.subject.id);
  if (!company) return safeResponse({ error: 'subject_not_found' }, 404);
  const input = buildBoundedArcAgentnetInput(toPartnerInput(resolved.value, parsed.data.signalCategory, company));
  if (!isBoundedInput(input)) return safeResponse({ error: input.reason }, input.reason === 'payload_too_large' ? 413 : 400);

  const payloadHash = createHash('sha256').update(JSON.stringify(input), 'utf8').digest('hex');
  const existing = await findArcAgentnetIdempotency({
    initiatingUserId: userId,
    companyId: resolved.value.subject.id,
    templateId: resolved.value.template.templateId,
    templateVersionId: resolved.value.template.templateVersionId,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (existing) {
    return existing.payloadHash === payloadHash
      ? safeResponse({ applicationRunId: existing.analysisRunId, replayed: true }, 200)
      : safeResponse({ error: 'idempotency_conflict' }, 409);
  }
  const activeRun = await findArcAgentnetActiveRun({
    initiatingUserId: userId,
    companyId: resolved.value.subject.id,
    templateId: resolved.value.template.templateId,
  });
  if (activeRun) return safeResponse({ error: 'active_run_exists' }, 409);

  const partnerJob = await arcAgentnetClient.submit({
    idempotencyKey: parsed.data.idempotencyKey,
    input: toPartnerJson(input),
  });
  if (!partnerJob.ok) return partnerErrorResponse(partnerJob.kind);

  const snapshots = buildPhase33AnalysisSnapshots({
    template: toTemplateSnapshot(resolved.value),
    subject: resolved.value.subject,
    checklist: resolved.value.checklist,
    resolvedModelChain: resolved.value.resolvedModelChain,
  }, resolved.value.policy);
  let persisted: Awaited<ReturnType<typeof createArcAgentnetRunWithMapping>>;
  try {
    persisted = await createArcAgentnetRunWithMapping({
      initiatingUserId: userId,
      createdBy: userId,
      companyId: resolved.value.subject.id,
      templateId: resolved.value.template.templateId,
      templateVersionId: resolved.value.template.templateVersionId,
      practiceAreaId: resolved.value.practiceArea.id,
      subjectSnapshot: snapshots.subjectSnapshot,
      templateSnapshot: snapshots.templateSnapshot,
      checklistSnapshot: snapshots.checklistSnapshot,
      executionSnapshot: { ...snapshots.executionSnapshot, executor: 'arc-agentnet' },
      policySnapshot: snapshots.policySnapshot,
      inputSnapshot: input,
      partnerJobId: partnerJob.value.jobId,
      requestId: partnerJob.value.requestId,
      idempotencyKey: parsed.data.idempotencyKey,
      payloadHash,
    });
  } catch (error: unknown) {
    if (error instanceof Error) return safeResponse({ error: 'persistence_unavailable' }, 503);
    throw error;
  }
  if (persisted.kind === 'idempotency_conflict') return safeResponse({ error: persisted.kind }, 409);
  if (persisted.kind === 'active_run_exists') return safeResponse({ error: persisted.kind }, 409);
  return safeResponse(
    { applicationRunId: persisted.run.id, ...(persisted.kind === 'replayed' ? { replayed: true } : {}) },
    persisted.kind === 'replayed' ? 200 : 201,
  );
}

function toPartnerInput(
  launch: ResolvedCompanyArcAgentnetLaunch,
  signalCategory: string,
  company: Awaited<ReturnType<typeof getCompanyById>>,
) {
  if (!company) throw new Error('Company disappeared after launch resolution');
  return {
    company: {
      id: company.id,
      name: company.name,
      domain: company.domain,
      profile: {
        industry: company.industry,
        headcount: null,
        headquarters: company.hqLocation,
        description: null,
      },
    },
    practiceArea: launch.practiceArea,
    buyingSignalCategory: signalCategory,
    template: toTemplateMetadata(launch),
    resolvedInstruction: launch.template.instruction,
    checklist: launch.checklist.items.map((item) => ({ id: item.signalId, label: item.name, required: true })),
    publicEvidenceUrls: [],
  };
}

function toTemplateMetadata(launch: ResolvedCompanyArcAgentnetLaunch) {
  const custom = launch.template.custom;
  return custom === undefined
    ? {
        kind: 'fixed' as const,
        templateId: launch.template.templateId,
        templateVersionId: launch.template.templateVersionId,
        templateKey: launch.template.key,
        templateName: launch.template.name,
        templateVersion: launch.template.version,
        targetType: 'company' as const,
        customAgentId: null,
        customAgentName: null,
        customAgentVersion: null,
      }
    : {
        kind: 'custom' as const,
        templateId: launch.template.templateId,
        templateVersionId: launch.template.templateVersionId,
        templateKey: launch.template.key,
        templateName: launch.template.name,
        templateVersion: launch.template.version,
        targetType: 'company' as const,
        customAgentId: custom.customAgentId,
        customAgentName: custom.latest.name,
        customAgentVersion: custom.latest.version,
      };
}

function toPartnerJson(input: BoundedArcAgentnetInput): ArcAgentnetSubmitContext {
  return {
    schemaVersion: input.schemaVersion,
    analysis: {
      subjectType: input.analysis.subjectType,
      company: {
        id: input.analysis.company.id,
        name: input.analysis.company.name,
        domain: input.analysis.company.domain,
        profile: {
          industry: input.analysis.company.profile.industry,
          headcount: input.analysis.company.profile.headcount,
          headquarters: input.analysis.company.profile.headquarters,
          description: input.analysis.company.profile.description,
        },
      },
      practiceArea: {
        id: input.analysis.practiceArea.id,
        name: input.analysis.practiceArea.name,
        shortCode: input.analysis.practiceArea.shortCode,
      },
      buyingSignalCategory: input.analysis.buyingSignalCategory,
      template: {
        kind: input.analysis.template.kind,
        templateId: input.analysis.template.templateId,
        templateVersionId: input.analysis.template.templateVersionId,
        templateKey: input.analysis.template.templateKey,
        templateName: input.analysis.template.templateName,
        templateVersion: input.analysis.template.templateVersion,
        targetType: input.analysis.template.targetType,
        customAgentId: input.analysis.template.customAgentId,
        customAgentName: input.analysis.template.customAgentName,
        customAgentVersion: input.analysis.template.customAgentVersion,
      },
      resolvedInstructions: input.analysis.resolvedInstructions,
      checklist: input.analysis.checklist.map((item) => ({ id: item.id, label: item.label, required: item.required })),
      publicEvidenceUrls: [...input.analysis.publicEvidenceUrls],
    },
  };
}

function toTemplateSnapshot(launch: ResolvedCompanyArcAgentnetLaunch) {
  const custom = launch.template.custom;
  return {
    schemaVersion: 1 as const,
    templateId: launch.template.templateId,
    templateVersionId: launch.template.templateVersionId,
    templateKey: launch.template.key,
    templateName: launch.template.name,
    targetType: 'company' as const,
    version: launch.template.version,
    resolvedInstruction: launch.template.instruction,
    effort: launch.template.effort,
    ...(custom === undefined ? {} : {
      custom: {
        schemaVersion: 1 as const,
        customAgentId: custom.customAgentId,
        templateVersionId: custom.latest.templateVersionId,
        version: custom.latest.version,
        name: custom.latest.name,
        description: custom.latest.description,
        researchQuery: custom.latest.researchQuery,
        behaviorInstruction: custom.latest.behaviorInstruction,
        capabilityPresetIds: custom.latest.capabilityPresetIds,
        outputSchema: custom.latest.outputSchema,
      },
    }),
  };
}

function isBoundedInput(input: ReturnType<typeof buildBoundedArcAgentnetInput>): input is Exclude<typeof input, { readonly ok: false }> {
  return !('ok' in input);
}

function resolutionErrorResponse(reason: string): Response {
  const status = reason === 'invalid_executor_configuration' ? 500
    : reason.endsWith('_not_found') || reason === 'custom_agent_not_found' ? 404
    : reason === 'invalid_input' || reason === 'practice_area_required' ? 400
      : 409;
  return safeResponse({ error: reason }, status);
}

function partnerErrorResponse(kind: string): Response {
  const error = kind === 'not_configured' ? 'partner_not_configured' : 'partner_unavailable';
  return safeResponse({ error }, 502);
}

function safeResponse(body: Readonly<Record<string, unknown>>, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
