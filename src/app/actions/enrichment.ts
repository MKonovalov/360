'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { getCompanyById, applyCompanyEnrichment } from '@/lib/db/queries/companies';
import { getPersonaById, applyPersonaEnrichment } from '@/lib/db/queries/personas';
import { enrichOrganization } from '@/lib/enrichment/apollo';
import { enrichPerson } from '@/lib/enrichment/prospeo';
import { buildEnrichmentPlan, type EnrichmentPlanRow } from '@/lib/enrichment/mergePlan';
import { env } from '@/lib/env';
import {
  companyAcceptedValuesSchema,
  createReviewProposal,
  personaAcceptedValuesSchema,
  runEnrichmentInputSchema,
  verifyReviewProposal,
} from '@/lib/enrichment/reviewProposal';

// Server Action controller for enrichment. Both actions call requireStaffAccess()
// FIRST (matches src/app/actions.ts / import.ts) — Server Actions are gated
// independently of the page that renders the trigger.

// Columns each entity allows an enrichment commit to write. Defense-in-depth
// (D-06/D-09): name/domain/email are NEVER writable via enrichment.
export type RunEnrichmentResult =
  | { ok: true; plan: EnrichmentPlanRow[]; proposalToken: string }
  | { ok: false; reason: string };

// Fetches vendor data for one record and returns the review plan (or a surfaced
// failure reason). Writes NOTHING — the review/commit is a separate action.
export async function runEnrichment(input: unknown): Promise<RunEnrichmentResult> {
  const { userId } = await requireStaffAccess();
  const parsed = runEnrichmentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_request' };
  const { entityType, recordId } = parsed.data;
  if (!env.ENRICHMENT_REVIEW_SECRET) {
    return { ok: false, reason: 'not_configured' };
  }

  try {
    if (entityType === 'company') {
      if (!env.APOLLO_API_KEY) return { ok: false, reason: 'not_configured' };
      const record = await getCompanyById(recordId);
      if (!record) return { ok: false, reason: 'not_found' };
      if (!record.domain) return { ok: false, reason: 'no_match_key' };
      const result = await enrichOrganization(record.domain);
      console.info(
        JSON.stringify({
          event: 'enrichment_run',
          entityType,
          recordId,
          ok: result.ok,
          reason: result.ok ? undefined : result.reason,
        })
      );
      if (!result.ok) return { ok: false, reason: result.reason };
      const plan = buildEnrichmentPlan(record, result.fields);
      const proposalToken = createReviewProposal(
        { userId, entityType, recordId, baseVersion: record.version, rows: plan },
        env.ENRICHMENT_REVIEW_SECRET
      );
      return { ok: true, plan, proposalToken };
    }

    if (!env.PROSPEO_API_KEY) return { ok: false, reason: 'not_configured' };
    const record = await getPersonaById(recordId);
    if (!record) return { ok: false, reason: 'not_found' };
    if (!record.email) return { ok: false, reason: 'no_match_key' };
    const result = await enrichPerson(record.email);
    console.info(
      JSON.stringify({
        event: 'enrichment_run',
        entityType,
        recordId,
        ok: result.ok,
        reason: result.ok ? undefined : result.reason,
      })
    );
    if (!result.ok) return { ok: false, reason: result.reason };
    const plan = buildEnrichmentPlan(record, result.fields);
    const proposalToken = createReviewProposal(
      { userId, entityType, recordId, baseVersion: record.version, rows: plan },
      env.ENRICHMENT_REVIEW_SECRET
    );
    return { ok: true, plan, proposalToken };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

// Commits ONLY the fields the user accepted in the review screen. Filters keys
// against the per-entity writable allowlist (defense-in-depth), writes via the
// query layer (which stamps per-field vendor provenance + lastEnrichedAt), then
// revalidates the detail route so the UI reflects the write.
export async function commitEnrichment(input: unknown): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { userId } = await requireStaffAccess();
  if (!env.ENRICHMENT_REVIEW_SECRET) return { ok: false, reason: 'not_configured' };
  const verified = verifyReviewProposal(input, {
    userId,
    secret: env.ENRICHMENT_REVIEW_SECRET,
  });
  if (!verified.ok) return verified;

  const { entityType, recordId, baseVersion } = verified.proposal;
  const wrote = Object.keys(verified.accepted).length;
  if (wrote === 0) return { ok: true };

  try {
    const updated =
      entityType === 'company'
        ? await applyCompanyEnrichment(
            recordId,
            baseVersion,
            companyAcceptedValuesSchema.parse(verified.accepted)
          )
        : await applyPersonaEnrichment(
            recordId,
            baseVersion,
            personaAcceptedValuesSchema.parse(verified.accepted)
          );
    if (!updated) return { ok: false, reason: 'stale_review' };

    revalidatePath(`/${entityType === 'company' ? 'companies' : 'personas'}/${recordId}`);
    revalidatePath(`/${entityType === 'company' ? 'companies' : 'personas'}`);
    console.info(JSON.stringify({ event: 'enrichment_commit', entityType, recordId, wrote }));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
