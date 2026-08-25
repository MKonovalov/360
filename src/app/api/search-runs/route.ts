import 'server-only';

import { createHash } from 'node:crypto';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { isSearchEnabled } from '@/lib/search/templateContracts';
import { searchLaunchRequestSchema } from '@/lib/search/contracts';
import { resolveSearchLaunch } from '@/lib/search/resolveSearchLaunch';
import {
  createSearchRun,
  findSearchRunIdempotency,
} from '@/lib/search/searchRuns';
import { submitSearchJob } from '@/lib/search/searchArcAgentnet';
import { noStoreJson, readJsonBody } from '@/lib/search/routeSupport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function launchFingerprint(input: {
  readonly subject: { readonly type: 'company'; readonly id: number };
  readonly templateVersionId: number;
  readonly resolution: Extract<Awaited<ReturnType<typeof resolveSearchLaunch>>, { readonly ok: true }>;
}): string {
  return createHash('sha256').update(JSON.stringify({
    subject: input.subject,
    templateVersionId: input.templateVersionId,
    company: input.resolution.company,
    template: input.resolution.template,
    buyerRoles: input.resolution.buyerRoles,
    buyerRoleEvidence: input.resolution.buyerRoleEvidence,
    evidencePolicy: input.resolution.evidencePolicy,
  }), 'utf8').digest('hex');
}

function resolutionFailureResponse(reason: Exclude<Awaited<ReturnType<typeof resolveSearchLaunch>>, { readonly ok: true }>['reason']): Response {
  switch (reason) {
    case 'company_not_found':
      return noStoreJson({ error: reason }, 404);
    case 'template_not_found':
      return noStoreJson({ error: reason }, 404);
    case 'template_inactive':
    case 'template_not_current':
      return noStoreJson({ error: reason }, 409);
    case 'buyer_role_rule_invalid':
    case 'buyer_role_rule_unresolved':
      return noStoreJson({ error: reason }, 422);
    default:
      return assertNever(reason);
  }
}

function partnerFailureResponse(kind: 'not_configured' | 'network' | 'invalid_input' | 'invalid_response' | 'http_error' | 'job_expired' | 'persistence'): Response {
  switch (kind) {
    case 'persistence':
      return noStoreJson({ error: 'persistence_unavailable' }, 503);
    case 'not_configured':
    case 'network':
    case 'invalid_input':
    case 'invalid_response':
    case 'http_error':
    case 'job_expired':
      return noStoreJson({ error: 'partner_unavailable' }, kind === 'not_configured' ? 503 : 502);
    default:
      return assertNever(kind);
  }
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await requireStaffAccess();
  const body = await readJsonBody(request);
  if (!body.ok) return noStoreJson({ error: 'invalid_input' }, 400);

  const parsed = searchLaunchRequestSchema.safeParse(body.body);
  if (!parsed.success) return noStoreJson({ error: 'invalid_input' }, 400);
  if (!isSearchEnabled()) return noStoreJson({ error: 'search_unavailable' }, 409);

  let resolution: Awaited<ReturnType<typeof resolveSearchLaunch>>;
  try {
    resolution = await resolveSearchLaunch({
      userId,
      companyId: parsed.data.subject.id,
      templateVersionId: parsed.data.templateVersionId,
    });
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'persistence_unavailable' }, 503);
    throw error;
  }
  if (!resolution.ok) return resolutionFailureResponse(resolution.reason);

  const inputFingerprint = launchFingerprint({
    subject: parsed.data.subject,
    templateVersionId: parsed.data.templateVersionId,
    resolution,
  });
  try {
    const existing = await findSearchRunIdempotency(userId, parsed.data.idempotencyKey);
    if (existing && existing.inputFingerprint !== inputFingerprint) return noStoreJson({ error: 'idempotency_conflict' }, 409);

    const created = await createSearchRun({
      initiatingUserId: userId,
      idempotencyKey: parsed.data.idempotencyKey,
      inputFingerprint,
      companyId: resolution.company.id,
      templateVersionId: resolution.template.templateVersionId,
      companySnapshot: resolution.company,
      templateSnapshot: resolution.template,
      buyerRoleSnapshot: resolution.buyerRoles,
      buyerRoleEvidenceSnapshot: resolution.buyerRoleEvidence,
      evidencePolicySnapshot: resolution.evidencePolicy,
    });
    switch (created.kind) {
      case 'idempotency_conflict':
        return noStoreJson({ error: created.kind }, 409);
      case 'active_run_exists':
        return noStoreJson({ error: created.kind }, 409);
      case 'replayed':
        return noStoreJson({ searchRunId: created.run.id, status: 'queued', replayed: true });
      case 'created':
        break;
      default:
        return assertNever(created);
    }

    const submitted = await submitSearchJob({
      idempotencyKey: parsed.data.idempotencyKey,
      context: {
        schemaVersion: resolution.template.schemaVersion,
        analysis: {
          resolvedInstructions: resolution.partnerInstructions,
          subjectType: 'company',
          company: resolution.company,
        },
      },
      runId: created.run.id,
      initiatingUserId: userId,
    });
    if (!submitted.ok) return partnerFailureResponse(submitted.kind);
    return noStoreJson({ searchRunId: created.run.id, status: 'queued', replayed: false }, 201);
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'persistence_unavailable' }, 503);
    throw error;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search launch result: ${String(value)}`);
}
