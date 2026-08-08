import { neon } from '@neondatabase/serverless';

const FIXTURE_ACTOR = 'phase36-fixture-reset';
const FIXTURE_SHORT_CODE = 'phase36-e2e';
const FIXTURE_DOMAIN = 'phase36-e2e.example';
const FIXTURE_EMAIL = 'phase36-e2e@example.invalid';

type FixtureIds = Readonly<{
  companyId: number;
  personaId: number;
  practiceAreaId: number;
  companySignalId: number;
  personaSignalId: number;
}>;

function requireTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL is required for the Phase 36 fixture reset');
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('Refusing Phase 36 reset because TEST_DATABASE_URL equals DATABASE_URL');
  }
  return testUrl;
}

function positiveId(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Fixture reset returned an invalid ${label}`);
  }
  return value;
}

async function resetFixtures(): Promise<FixtureIds> {
  const sql = neon(requireTestDatabaseUrl());
  const priorPracticeAreas = await sql`
    SELECT id FROM practice_area WHERE short_code = ${FIXTURE_SHORT_CODE}
  `;
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
        await sql`DELETE FROM analysis_run_review WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_result_retention WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${runIds}))`;
        await sql`DELETE FROM analysis_finding_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${runIds}))`;
        await sql`DELETE FROM analysis_finding WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ANY(${runIds}))`;
        await sql`DELETE FROM analysis_run_result WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_run_event WHERE analysis_run_id = ANY(${runIds})`;
        await sql`DELETE FROM analysis_run WHERE id = ANY(${runIds})`;
      }
      await sql`DELETE FROM company_persona_role WHERE company_id = ANY(${companyIds}) OR persona_id = ANY(${personaIds})`;
      await sql`DELETE FROM company WHERE id = ANY(${companyIds})`;
      await sql`DELETE FROM persona WHERE id = ANY(${personaIds})`;
    }
    await sql`DELETE FROM persona_signal WHERE practice_area_id = ${priorPracticeAreaId}`;
    await sql`DELETE FROM company_signal WHERE practice_area_id = ${priorPracticeAreaId}`;
    await sql`DELETE FROM practice_area WHERE id = ${priorPracticeAreaId}`;
  }

  await sql`DELETE FROM analysis_template_version WHERE template_id IN (SELECT id FROM analysis_template WHERE key IN ('company-buying-signal-analysis', 'persona-buying-signal-analysis'))`;
  await sql`DELETE FROM analysis_template WHERE key IN ('company-buying-signal-analysis', 'persona-buying-signal-analysis')`;

  const [practiceArea] = await sql`
    INSERT INTO practice_area (name, short_code, sort_order, description, status, created_by, updated_by)
    VALUES ('Phase 36 E2E GBS', ${FIXTURE_SHORT_CODE}, 999, 'Disposable Phase 36 fixture', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id
  `;
  const practiceAreaId = positiveId(practiceArea?.id, 'practiceAreaId');
  const [company] = await sql`
    INSERT INTO company (name, domain, industry, field_sources)
    VALUES ('Phase 36 E2E Company', ${FIXTURE_DOMAIN}, 'Business Services', '{}'::jsonb)
    RETURNING id
  `;
  const [persona] = await sql`
    INSERT INTO persona (name, title, email, field_sources)
    VALUES ('Phase 36 E2E Persona', 'Chief Financial Officer', ${FIXTURE_EMAIL}, '{}'::jsonb)
    RETURNING id
  `;
  const [companySignal] = await sql`
    INSERT INTO company_signal (practice_area_id, name, category, description, status, created_by, updated_by)
    VALUES (${practiceAreaId}, 'Phase 36 cost pressure', 'Financial', 'Disposable company checklist signal', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id
  `;
  const [buyerRole] = await sql`
    INSERT INTO buyer_role (name, description, created_by, updated_by)
    VALUES ('Phase 36 CFO', 'Disposable buyer role', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id
  `;
  const [personaSignal] = await sql`
    INSERT INTO persona_signal (practice_area_id, buyer_role_id, name, category, description, status, created_by, updated_by)
    VALUES (${practiceAreaId}, ${buyerRole?.id}, 'Phase 36 persona pressure', 'Financial', 'Disposable persona checklist signal', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id
  `;

  for (const [key, name, targetType] of [
    ['company-buying-signal-analysis', 'Company Buying Signal Analysis', 'company'],
    ['persona-buying-signal-analysis', 'Persona Buying Signal Analysis', 'persona'],
  ] as const) {
    const [template] = await sql`
      INSERT INTO analysis_template (key, name, target_type, status, created_by, updated_by)
      VALUES (${key}, ${name}, ${targetType}, 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
      RETURNING id
    `;
    await sql`
      INSERT INTO analysis_template_version (template_id, version, instruction, supported_efforts, default_effort, future_budget, created_by)
      VALUES (${template?.id}, 1, ${`Phase 36 deterministic ${key} instruction`}, '["standard"]'::jsonb, 'standard', '{"maxAttempts":2,"maxToolCalls":12,"maxExecutionSeconds":300,"maxSpendUsd":2.5}'::jsonb, ${FIXTURE_ACTOR})
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

void main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Phase 36 fixture reset failed');
  }
  process.exitCode = 1;
});
