import { sql, type SQL } from 'drizzle-orm';

import {
  searchApprovalDomainKey,
  searchApprovalEmailKey,
  searchApprovalLinkedInKey,
  searchApprovalNameKey,
} from '@/lib/db/queries/personas';

export interface ApprovalStatementInput {
  readonly reviewId: number;
  readonly expectedRevision: number;
  readonly actorUserId: string;
}

export function buildApproveSearchReviewSql(input: ApprovalStatementInput): SQL<unknown> {
  const approvalAuditChanges = [{ path: 'decision', before: null, after: 'approved' }];
  return sql`
    WITH candidate_state AS MATERIALIZED (
      SELECT candidate.id, candidate.status, candidate.revision, candidate.persona_snapshot,
        candidate.buyer_role_snapshot, candidate.match_snapshot, candidate.eligibility_snapshot,
        run.initiating_user_id AS owner_user_id, run.company_id, run.status AS run_status,
        run.company_snapshot, selected_company.name AS company_name, selected_company.domain AS company_domain
      FROM search_candidate AS candidate
      INNER JOIN search_run AS run ON run.id = candidate.search_run_id
      INNER JOIN company AS selected_company ON selected_company.id = run.company_id
      WHERE candidate.id = ${input.reviewId}
      FOR UPDATE OF candidate, run, selected_company
    ),
    candidate_keys AS MATERIALIZED (
      SELECT state.*,
        NULLIF(${searchApprovalEmailKey(sql`state.persona_snapshot->>'email'`)}, '') AS email_key,
        NULLIF(${searchApprovalLinkedInKey(sql`state.persona_snapshot->>'linkedinUrl'`)}, '') AS linkedin_key,
        NULLIF(${searchApprovalNameKey(sql`state.persona_snapshot->>'fullName'`)}, '') AS name_key,
        NULLIF(${searchApprovalDomainKey(sql`state.company_domain`)}, '') AS company_domain_key,
        (state.company_snapshot->>'id' = state.company_id::text AND state.company_snapshot->>'name' = state.company_name
          AND (state.company_snapshot->>'domain' IS NULL OR ${searchApprovalDomainKey(sql`state.company_snapshot->>'domain'`)} = ${searchApprovalDomainKey(sql`state.company_domain`)} )
          AND (state.persona_snapshot->>'companyDomain' IS NULL OR ${searchApprovalDomainKey(sql`state.persona_snapshot->>'companyDomain'`)} = ${searchApprovalDomainKey(sql`state.company_domain`)} )) AS company_identity_valid,
        NOT EXISTS (SELECT 1 FROM search_candidate_source source WHERE source.search_candidate_id = state.id
          AND (source.url !~ '^https://' OR btrim(source.title) = '' OR source.url ~ '[[:space:]]'))
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(state.claims_snapshot) claim
          CROSS JOIN LATERAL jsonb_array_elements_text(claim->'sourceIds') source_id
          WHERE NOT EXISTS (SELECT 1 FROM search_candidate_source source
            WHERE source.search_candidate_id = state.id AND source.packet_source_id = source_id)) AS evidence_data_valid,
        (state.persona_snapshot->>'seniority' IS NULL OR state.persona_snapshot->>'seniority' IN ('ic', 'manager', 'director', 'vp', 'c_level')) AS persona_values_valid
      FROM candidate_state state
    ),
    email_matches AS (
      SELECT keys.id AS candidate_id, matched.id AS persona_id FROM candidate_keys keys
      INNER JOIN persona matched ON keys.email_key IS NOT NULL AND ${searchApprovalEmailKey(sql`matched.email`)} = keys.email_key
    ),
    linkedin_matches AS (
      SELECT keys.id AS candidate_id, matched.id AS persona_id FROM candidate_keys keys
      INNER JOIN persona matched ON keys.linkedin_key IS NOT NULL AND ${searchApprovalLinkedInKey(sql`matched.linkedin_url`)} = keys.linkedin_key
    ),
    name_matches AS (
      SELECT keys.id AS candidate_id, matched.id AS persona_id FROM candidate_keys keys
      INNER JOIN company_persona_role current_role ON current_role.company_id = keys.company_id AND current_role.is_current = true
      INNER JOIN persona matched ON matched.id = current_role.persona_id AND ${searchApprovalNameKey(sql`matched.name`)} = keys.name_key
      WHERE keys.company_domain_key IS NOT NULL AND ${searchApprovalDomainKey(sql`keys.company_domain`)} = keys.company_domain_key
    ),
    email_stats AS (SELECT candidate_id, count(*)::int AS match_count, min(persona_id)::int AS persona_id FROM email_matches GROUP BY candidate_id),
    linkedin_stats AS (SELECT candidate_id, count(*)::int AS match_count, min(persona_id)::int AS persona_id FROM linkedin_matches GROUP BY candidate_id),
    name_stats AS (SELECT candidate_id, count(*)::int AS match_count, min(persona_id)::int AS persona_id FROM name_matches GROUP BY candidate_id),
    matching_persona_ids AS (
      SELECT candidate_id, persona_id FROM email_matches UNION SELECT candidate_id, persona_id FROM linkedin_matches
      UNION SELECT candidate_id, persona_id FROM name_matches
    ),
    locked_match_personas AS MATERIALIZED (
      SELECT ids.candidate_id, matched.id AS persona_id FROM matching_persona_ids ids
      INNER JOIN persona matched ON matched.id = ids.persona_id FOR UPDATE OF matched
    ),
    staged_fields AS (
      SELECT state.id AS candidate_id,
        bool_or(change->>'path' = 'persona.fullName') AS full_name_staged,
        bool_or(change->>'path' = 'persona.title') AS title_staged,
        bool_or(change->>'path' = 'persona.seniority') AS seniority_staged,
        bool_or(change->>'path' = 'persona.email') AS email_staged,
        bool_or(change->>'path' = 'persona.linkedinUrl') AS linkedin_staged
      FROM candidate_state state
      LEFT JOIN search_candidate_audit audit ON audit.search_candidate_id = state.id AND audit.event_type = 'search_candidate_edited'
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(audit.changes, '[]'::jsonb)) change ON true
      GROUP BY state.id
    ),
    match_state AS MATERIALIZED (
      SELECT keys.*, fields.full_name_staged, fields.title_staged, fields.seniority_staged, fields.email_staged, fields.linkedin_staged,
        locked.persona_id AS locked_persona_id,
        CASE WHEN COALESCE(email.match_count, 0) > 1 THEN 'ambiguous' WHEN COALESCE(email.match_count, 0) = 1 THEN 'existing'
          WHEN COALESCE(linkedin.match_count, 0) > 1 THEN 'ambiguous' WHEN COALESCE(linkedin.match_count, 0) = 1 THEN 'existing'
          WHEN COALESCE(name.match_count, 0) > 1 THEN 'ambiguous' WHEN COALESCE(name.match_count, 0) = 1 THEN 'existing' ELSE 'new' END AS match_kind,
        CASE WHEN COALESCE(email.match_count, 0) > 0 THEN 'email' WHEN COALESCE(linkedin.match_count, 0) > 0 THEN 'linkedin_url'
          WHEN COALESCE(name.match_count, 0) > 0 THEN 'name_company_domain' ELSE NULL END AS matched_by,
        CASE WHEN COALESCE(email.match_count, 0) > 0 THEN email.persona_id WHEN COALESCE(linkedin.match_count, 0) > 0 THEN linkedin.persona_id
          WHEN COALESCE(name.match_count, 0) > 0 THEN name.persona_id ELSE NULL END AS selected_persona_id
      FROM candidate_keys keys
      LEFT JOIN email_stats email ON email.candidate_id = keys.id
      LEFT JOIN linkedin_stats linkedin ON linkedin.candidate_id = keys.id
      LEFT JOIN name_stats name ON name.candidate_id = keys.id
      LEFT JOIN staged_fields fields ON fields.candidate_id = keys.id
      LEFT JOIN locked_match_personas locked ON locked.candidate_id = keys.id AND locked.persona_id = CASE
        WHEN COALESCE(email.match_count, 0) = 1 THEN email.persona_id
        WHEN COALESCE(email.match_count, 0) = 0 AND COALESCE(linkedin.match_count, 0) = 1 THEN linkedin.persona_id
        WHEN COALESCE(email.match_count, 0) = 0 AND COALESCE(linkedin.match_count, 0) = 0 AND COALESCE(name.match_count, 0) = 1 THEN name.persona_id
        ELSE NULL END
    ),
    requested_roles AS (
      SELECT DISTINCT state.id AS candidate_id, (item->>'buyerRoleId')::int AS buyer_role_id
      FROM match_state state CROSS JOIN LATERAL jsonb_array_elements(state.buyer_role_snapshot) item
    ),
    locked_buyer_roles AS MATERIALIZED (
      SELECT requested.candidate_id, role.id AS buyer_role_id FROM requested_roles requested
      INNER JOIN buyer_role role ON role.id = requested.buyer_role_id FOR SHARE OF role
    ),
    role_validation AS (
      SELECT state.id AS candidate_id,
        (SELECT count(*)::int FROM requested_roles requested WHERE requested.candidate_id = state.id) AS requested_count,
        (SELECT count(*)::int FROM locked_buyer_roles found WHERE found.candidate_id = state.id) AS found_count
      FROM match_state state
    ),
    eligible_state AS MATERIALIZED (
      SELECT state.*, validation.requested_count, validation.found_count FROM match_state state
      INNER JOIN role_validation validation ON validation.candidate_id = state.id
      WHERE state.owner_user_id = ${input.actorUserId} AND state.revision = ${input.expectedRevision} AND state.status = 'pending'
        AND state.run_status = 'succeeded' AND state.eligibility_snapshot->>'eligible' = 'true' AND state.company_identity_valid
        AND state.evidence_data_valid AND state.persona_values_valid AND state.match_kind <> 'ambiguous'
        AND (state.match_kind = 'new' OR state.locked_persona_id IS NOT NULL) AND validation.requested_count = validation.found_count
    ),
    updated_persona AS (
      UPDATE persona target SET name = CASE WHEN state.full_name_staged THEN state.persona_snapshot->>'fullName' ELSE target.name END,
        title = CASE WHEN state.title_staged THEN NULLIF(state.persona_snapshot->>'title', '') ELSE target.title END,
        seniority = CASE WHEN state.seniority_staged THEN NULLIF(state.persona_snapshot->>'seniority', '')::seniority ELSE target.seniority END,
        email = CASE WHEN state.email_staged THEN NULLIF(lower(btrim(state.persona_snapshot->>'email')), '') ELSE target.email END,
        linkedin_url = CASE WHEN state.linkedin_staged THEN NULLIF(state.persona_snapshot->>'linkedinUrl', '') ELSE target.linkedin_url END,
        version = target.version + 1
      FROM eligible_state state WHERE state.match_kind = 'existing' AND state.locked_persona_id = target.id
        AND (state.full_name_staged OR state.title_staged OR state.seniority_staged OR state.email_staged OR state.linkedin_staged)
      RETURNING target.id AS persona_id
    ),
    created_persona AS (
      INSERT INTO persona (name, title, seniority, email, linkedin_url)
      SELECT state.persona_snapshot->>'fullName', NULLIF(state.persona_snapshot->>'title', ''), NULLIF(state.persona_snapshot->>'seniority', '')::seniority,
        NULLIF(lower(btrim(state.persona_snapshot->>'email')), ''), NULLIF(state.persona_snapshot->>'linkedinUrl', '')
      FROM eligible_state state WHERE state.match_kind = 'new' ON CONFLICT (email) DO NOTHING RETURNING id, email, name
    ),
    resolved_persona AS MATERIALIZED (
      SELECT state.id AS candidate_id, state.company_id,
        COALESCE(updated.persona_id, state.locked_persona_id, created.id, fallback.id) AS persona_id,
        state.persona_snapshot->>'title' AS proposed_title
      FROM eligible_state state
      LEFT JOIN updated_persona updated ON state.match_kind = 'existing' AND updated.persona_id = state.locked_persona_id
      LEFT JOIN created_persona created ON state.match_kind = 'new' AND (state.email_key IS NULL OR ${searchApprovalEmailKey(sql`created.email`)} = state.email_key)
      LEFT JOIN persona fallback ON state.match_kind = 'new' AND state.email_key IS NOT NULL AND ${searchApprovalEmailKey(sql`fallback.email`)} = state.email_key
      WHERE COALESCE(updated.persona_id, state.locked_persona_id, created.id, fallback.id) IS NOT NULL
    ),
    created_company_persona_role AS (
      INSERT INTO company_persona_role (company_id, persona_id, title, is_current)
      SELECT resolved.company_id, resolved.persona_id, NULLIF(resolved.proposed_title, ''), true FROM resolved_persona resolved
      ON CONFLICT (company_id, persona_id) WHERE is_current = true DO NOTHING RETURNING id, company_id, persona_id
    ),
    resolved_company_persona_role AS MATERIALIZED (
      SELECT resolved.candidate_id, created.id, created.company_id, created.persona_id, true AS created
      FROM resolved_persona resolved INNER JOIN created_company_persona_role created ON created.company_id = resolved.company_id AND created.persona_id = resolved.persona_id
      UNION ALL
      SELECT resolved.candidate_id, existing.id, existing.company_id, existing.persona_id, false AS created
      FROM resolved_persona resolved INNER JOIN company_persona_role existing ON existing.company_id = resolved.company_id AND existing.persona_id = resolved.persona_id AND existing.is_current = true
      WHERE NOT EXISTS (SELECT 1 FROM created_company_persona_role created WHERE created.company_id = existing.company_id AND created.persona_id = existing.persona_id)
    ),
    created_role_links AS (
      INSERT INTO company_persona_role_buyer_role (company_persona_role_id, buyer_role_id)
      SELECT relationship.id, requested.buyer_role_id FROM resolved_company_persona_role relationship
      INNER JOIN requested_roles requested ON requested.candidate_id = relationship.candidate_id
      ON CONFLICT (company_persona_role_id, buyer_role_id) DO NOTHING RETURNING id, company_persona_role_id, buyer_role_id
    ),
    role_results AS (
      SELECT requested.candidate_id, requested.buyer_role_id,
        EXISTS (SELECT 1 FROM created_role_links created WHERE created.company_persona_role_id = relationship.id AND created.buyer_role_id = requested.buyer_role_id) AS created
      FROM requested_roles requested INNER JOIN resolved_company_persona_role relationship ON relationship.candidate_id = requested.candidate_id
    ),
    role_results_aggregate AS (
      SELECT candidate_id, jsonb_agg(jsonb_build_object('buyerRoleId', buyer_role_id, 'created', created) ORDER BY buyer_role_id) AS buyer_role_results
      FROM role_results GROUP BY candidate_id
    ),
    approval_audit AS (
      INSERT INTO search_candidate_audit (search_candidate_id, event_type, actor_id, revision, changes, created_at)
      SELECT relationship.candidate_id, 'search_candidate_approved', ${input.actorUserId}, state.revision + 1, ${JSON.stringify(approvalAuditChanges)}::jsonb, now()
      FROM resolved_company_persona_role relationship INNER JOIN eligible_state state ON state.id = relationship.candidate_id
      LEFT JOIN role_results_aggregate roles ON roles.candidate_id = relationship.candidate_id RETURNING id, search_candidate_id AS candidate_id
    ),
    updated_candidate AS (
      UPDATE search_candidate target SET matched_persona_id = resolved.persona_id, status = 'approved', revision = target.revision + 1, updated_at = now()
      FROM resolved_persona resolved INNER JOIN approval_audit audit ON audit.candidate_id = resolved.candidate_id
      WHERE target.id = resolved.candidate_id AND target.status = 'pending' AND target.revision = ${input.expectedRevision}
      RETURNING target.id, target.revision
    )
    SELECT CASE
      WHEN NOT EXISTS (SELECT 1 FROM candidate_state) THEN 'not_found'
      WHEN (SELECT owner_user_id FROM candidate_state) <> ${input.actorUserId} THEN 'unauthorized'
      WHEN (SELECT status FROM candidate_state) IN ('approved', 'rejected') THEN 'already_terminal'
      WHEN (SELECT revision FROM candidate_state) <> ${input.expectedRevision} THEN 'stale_revision'
      WHEN (SELECT status FROM candidate_state) = 'ambiguous_match' OR (SELECT match_kind FROM match_state) = 'ambiguous' THEN 'ambiguous_match'
      WHEN (SELECT status FROM candidate_state) = 'inconclusive' OR (SELECT eligibility_snapshot->>'eligible' FROM candidate_state) <> 'true' OR NOT (SELECT evidence_data_valid FROM candidate_keys) THEN 'inconclusive'
      WHEN NOT (SELECT company_identity_valid FROM candidate_keys) THEN 'company_mismatch'
      WHEN (SELECT requested_count <> found_count FROM role_validation) THEN 'unknown_buyer_role'
      WHEN NOT (SELECT persona_values_valid FROM candidate_keys) THEN 'invalid_persona'
      WHEN NOT EXISTS (SELECT 1 FROM updated_candidate) THEN 'persistence_failed'
      ELSE 'approved' END AS kind,
      (SELECT persona_id FROM resolved_persona) AS "personaId", (SELECT company_id FROM resolved_persona) AS "companyId",
      EXISTS (SELECT 1 FROM created_company_persona_role) AS "companyPersonaRoleCreated",
      COALESCE((SELECT buyer_role_results FROM role_results_aggregate), '[]'::jsonb) AS "buyerRoleResults",
      (SELECT id FROM approval_audit) AS "approvalAuditId"
  `;
}
