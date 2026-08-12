import { neon } from '@neondatabase/serverless';

import { assertPhase39Preflight, parseFixtureDatabaseUrl } from '../src/lib/verification/databaseIdentity';

const FIXTURE_ACTOR = 'phase39-fixture-reset';
const FIXTURE_SHORT_CODE = 'phase39-e2e';
const FIXTURE_DOMAIN = 'phase39-e2e.example';
const FIXTURE_EMAIL = 'phase39-e2e@example.invalid';
const FIXTURE_CUSTOM_AGENT_NAMES = ['Phase 39 E2E Company Agent', 'Phase 39 E2E Persona Agent'] as const;
const FIXTURE_CUSTOM_AGENT_KEYS = ['phase39-fixture-company', 'phase39-fixture-persona'] as const;
const FIXTURE_CUSTOM_AGENT_DESCRIPTION = 'Disposable custom agent for authenticated Phase 39 browser verification.';
const FIXTURE_CUSTOM_AGENT_RESEARCH_QUERIES = [
  'Find durable Phase 39 company evidence for cost pressure.',
  'Find durable Phase 39 persona evidence for cost pressure.',
] as const;
const FIXTURE_CUSTOM_AGENT_BEHAVIOR_INSTRUCTIONS = [
  'Return only source-backed company findings.',
  'Return only source-backed persona findings.',
] as const;

type FixtureIds = Readonly<{
  readonly companyId: number;
  readonly personaId: number;
  readonly practiceAreaId: number;
  readonly companySignalId: number;
  readonly personaSignalId: number;
}>;

function requireTestDatabaseUrl(): string {
  if (process.env.PHASE39_FIXTURE_ONLY !== '1') throw new Error('PHASE39_FIXTURE_ONLY=1 is required for the Phase 39 fixture reset');
  assertPhase39Preflight();
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || !parseFixtureDatabaseUrl(testUrl)) throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
  return testUrl;
}

function positiveId(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new Error(`Fixture reset returned an invalid ${label}`);
  return value;
}

export async function resetFixtures(): Promise<FixtureIds> {
  const sql = neon(requireTestDatabaseUrl());
  const priorPracticeAreas = await sql`SELECT id FROM practice_area WHERE short_code = ${FIXTURE_SHORT_CODE}`;
  const priorPracticeAreaId = priorPracticeAreas[0]?.id;
  if (priorPracticeAreaId) {
    const companies = await sql`SELECT id FROM company WHERE domain = ${FIXTURE_DOMAIN}`;
    const personas = await sql`SELECT id FROM persona WHERE email = ${FIXTURE_EMAIL}`;
    const companyIds = companies.map((row) => row.id);
    const personaIds = personas.map((row) => row.id);
    if (companyIds.length > 0 || personaIds.length > 0) {
      const runs = await sql`
        SELECT id FROM analysis_run
        WHERE (subject_type = 'company' AND subject_id = ANY(${companyIds}))
           OR (subject_type = 'persona' AND subject_id = ANY(${personaIds}))
      `;
      const runIds = runs.map((row) => row.id);
      if (runIds.length > 0) {
        await sql`DELETE FROM analysis_run_review_event WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_run_review WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_result_retention WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${runIds}))`;
        await sql`DELETE FROM analysis_finding_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${runIds}))`;
        await sql`DELETE FROM analysis_finding WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${runIds}))`;
        await sql`DELETE FROM analysis_run_result WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_run_event WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_run WHERE id = ANY(${runIds})`;
      }
    }
  }
  const [practiceArea] = priorPracticeAreas.length > 0 ? priorPracticeAreas : await sql`
    INSERT INTO practice_area (name, short_code, sort_order, description, status, created_by, updated_by)
    VALUES ('Phase 39 E2E GBS', ${FIXTURE_SHORT_CODE}, 999, 'Disposable Phase 39 fixture', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR}) RETURNING id
  `;
  const practiceAreaId = positiveId(practiceArea?.id, 'practiceAreaId');
  const [company] = (await sql`SELECT id FROM company WHERE domain = ${FIXTURE_DOMAIN}`).length > 0
    ? await sql`SELECT id FROM company WHERE domain = ${FIXTURE_DOMAIN}`
    : await sql`INSERT INTO company (name, domain, industry, field_sources) VALUES ('Phase 39 E2E Company', ${FIXTURE_DOMAIN}, 'Business Services', '{}'::jsonb) RETURNING id`;
  const [persona] = (await sql`SELECT id FROM persona WHERE email = ${FIXTURE_EMAIL}`).length > 0
    ? await sql`SELECT id FROM persona WHERE email = ${FIXTURE_EMAIL}`
    : await sql`INSERT INTO persona (name, title, email, field_sources) VALUES ('Phase 39 E2E Persona', 'Chief Financial Officer', ${FIXTURE_EMAIL}, '{}'::jsonb) RETURNING id`;
  const priorCompanySignals = await sql`SELECT id FROM company_signal WHERE practice_area_id = ${practiceAreaId} AND name = 'Phase 39 cost pressure'`;
  const [companySignal] = priorCompanySignals.length > 0 ? priorCompanySignals : await sql`INSERT INTO company_signal (practice_area_id, name, category, description, status, created_by, updated_by)
    VALUES (${practiceAreaId}, 'Phase 39 cost pressure', 'Financial', 'Disposable company checklist signal', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id`;
  const priorBuyerRoles = await sql`SELECT id FROM buyer_role WHERE name = 'Phase 39 CFO'`;
  const [buyerRole] = priorBuyerRoles.length > 0 ? priorBuyerRoles : await sql`INSERT INTO buyer_role (name, description, created_by, updated_by)
    VALUES ('Phase 39 CFO', 'Disposable buyer role', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR}) RETURNING id`;
  const priorPersonaSignals = await sql`SELECT id FROM persona_signal WHERE practice_area_id = ${practiceAreaId} AND name = 'Phase 39 persona pressure'`;
  const [personaSignal] = priorPersonaSignals.length > 0 ? priorPersonaSignals : await sql`INSERT INTO persona_signal (practice_area_id, buyer_role_id, name, category, description, status, created_by, updated_by)
    VALUES (${practiceAreaId}, ${buyerRole?.id}, 'Phase 39 persona pressure', 'Financial', 'Disposable persona checklist signal', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id`;

  const staleCustomAgents = await sql`
    SELECT t.id
    FROM analysis_template AS t
    INNER JOIN analysis_template_version AS v ON v.template_id = t.id
    WHERE t.kind = 'custom'
      AND t.practice_area_id = ${practiceAreaId}
      AND t.target_type IN ('company', 'persona')
      AND v.kind = 'custom'
      AND (
        t.key IN (${FIXTURE_CUSTOM_AGENT_KEYS[0]}, ${FIXTURE_CUSTOM_AGENT_KEYS[1]})
        OR (
          v.description = ${FIXTURE_CUSTOM_AGENT_DESCRIPTION}
          AND v.version = 1
          AND v.custom_name IN (${FIXTURE_CUSTOM_AGENT_NAMES[0]}, ${FIXTURE_CUSTOM_AGENT_NAMES[1]})
        )
      )
  `;
  const staleCustomAgentIds = [...new Set(staleCustomAgents.map((row) => row.id))];
  if (staleCustomAgentIds.length > 0) {
    const staleRuns = await sql`
      SELECT id
      FROM analysis_run
      WHERE template_id = ANY(${staleCustomAgentIds})
    `;
    const staleRunIds = staleRuns.map((row) => row.id);
    if (staleRunIds.length > 0) {
      await sql`DELETE FROM analysis_run_review_event WHERE analysis_run_id = ANY(${staleRunIds})`;
      await sql`DELETE FROM analysis_run_review WHERE analysis_run_id = ANY(${staleRunIds})`;
      await sql`DELETE FROM analysis_result_retention WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${staleRunIds}))`;
      await sql`DELETE FROM analysis_finding_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${staleRunIds}))`;
      await sql`DELETE FROM analysis_finding WHERE analysis_run_id = ANY(${staleRunIds})`;
      await sql`DELETE FROM analysis_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${staleRunIds}))`;
      await sql`DELETE FROM analysis_run_result WHERE analysis_run_id = ANY(${staleRunIds})`;
      await sql`DELETE FROM analysis_run_event WHERE analysis_run_id = ANY(${staleRunIds})`;
      await sql`DELETE FROM analysis_run WHERE id = ANY(${staleRunIds})`;
    }
    await sql`DELETE FROM analysis_template_version WHERE template_id = ANY(${staleCustomAgentIds})`;
    await sql`DELETE FROM analysis_template WHERE id = ANY(${staleCustomAgentIds})`;
  }
  const targetTypes = ['company', 'persona'] as const;
  for (const targetType of targetTypes) {
    const index = targetType === 'company' ? 0 : 1;
    const fixtureName = FIXTURE_CUSTOM_AGENT_NAMES[index];
    await sql`
      WITH inserted_template AS (
        INSERT INTO analysis_template (
          key, name, target_type, kind, practice_area_id, status, created_by, updated_by
        ) VALUES (
          ${`phase39-fixture-${targetType}`}, ${fixtureName}, ${targetType}, 'custom', ${practiceAreaId}, 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR}
        )
        RETURNING id
      )
      INSERT INTO analysis_template_version (
        template_id, version, kind, instruction, custom_name, description, research_query,
        behavior_instruction, structured_output_schema, capability_preset_ids,
        supported_efforts, default_effort, future_budget, created_by
      )
      SELECT
        id, 1, 'custom', NULL, ${fixtureName}, ${FIXTURE_CUSTOM_AGENT_DESCRIPTION},
        ${FIXTURE_CUSTOM_AGENT_RESEARCH_QUERIES[index]}, ${FIXTURE_CUSTOM_AGENT_BEHAVIOR_INSTRUCTIONS[index]},
        NULL, '[]'::jsonb, '["standard"]'::jsonb, 'standard',
        '{"maxAttempts":2,"maxToolCalls":12,"maxExecutionSeconds":300,"maxSpendUsd":2.5}'::jsonb,
        ${FIXTURE_ACTOR}
      FROM inserted_template
    `;
  }
  return {
    companyId: positiveId(company?.id, 'companyId'),
    personaId: positiveId(persona?.id, 'personaId'),
    practiceAreaId,
    companySignalId: positiveId(companySignal?.id, 'companySignalId'),
    personaSignalId: positiveId(personaSignal?.id, 'personaSignalId'),
  };
}

async function main(): Promise<void> {
  requireTestDatabaseUrl();
  if (process.argv.includes('--check')) {
    process.stdout.write(JSON.stringify({ ready: true, reset: false }) + '\n');
    return;
  }
  process.stdout.write(`${JSON.stringify(await resetFixtures())}\n`);
}

if (process.argv[1]?.endsWith('phase39-fixture-reset.ts')) {
  void main().catch((error: unknown) => {
    if (error instanceof Error) console.error(error.message);
    else console.error('Phase 39 fixture reset failed');
    process.exitCode = 1;
  });
}
