import { neon } from '@neondatabase/serverless';
import { parseFixtureDatabaseUrl } from '../src/lib/verification/databaseIdentity';

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
  const testDatabase = parseFixtureDatabaseUrl(testUrl);
  if (!testDatabase) throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
  if (process.env.DATABASE_URL) {
    const applicationDatabase = parseFixtureDatabaseUrl(process.env.DATABASE_URL);
    if (!applicationDatabase || applicationDatabase.identity === testDatabase.identity) {
      throw new Error('Refusing Phase 36 reset because TEST_DATABASE_URL identifies DATABASE_URL');
    }
  }
  return testUrl;
}

function positiveId(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Fixture reset returned an invalid ${label}`);
  }
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
        SELECT id
        FROM analysis_run
        WHERE (subject_type = 'company' AND subject_id = ANY(${companyIds}))
           OR (subject_type = 'persona' AND subject_id = ANY(${personaIds}))
      `;
      // Subject identity is the disposable boundary. Browser-created runs use
      // the Clerk actor, so created_by cannot distinguish fixture data here.
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
    }
  }

  // Fixed templates and versions are historical parents of analysis runs. They
  // must be reused, never deleted and recreated during fixture setup.
  const [practiceArea] = priorPracticeAreas.length > 0 ? priorPracticeAreas : await sql`
    INSERT INTO practice_area (name, short_code, sort_order, description, status, created_by, updated_by)
    VALUES ('Phase 36 E2E GBS', ${FIXTURE_SHORT_CODE}, 999, 'Disposable Phase 36 fixture', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id
  `;
  const practiceAreaId = positiveId(practiceArea?.id, 'practiceAreaId');

  const priorCompanies = await sql`SELECT id FROM company WHERE domain = ${FIXTURE_DOMAIN}`;
  const [company] = priorCompanies.length > 0 ? priorCompanies : await sql`
    INSERT INTO company (name, domain, industry, field_sources)
    VALUES ('Phase 36 E2E Company', ${FIXTURE_DOMAIN}, 'Business Services', '{}'::jsonb)
    RETURNING id
  `;
  const priorPersonas = await sql`SELECT id FROM persona WHERE email = ${FIXTURE_EMAIL}`;
  const [persona] = priorPersonas.length > 0 ? priorPersonas : await sql`
    INSERT INTO persona (name, title, email, field_sources)
    VALUES ('Phase 36 E2E Persona', 'Chief Financial Officer', ${FIXTURE_EMAIL}, '{}'::jsonb)
    RETURNING id
  `;

  const priorCompanySignals = await sql`SELECT id FROM company_signal WHERE practice_area_id = ${practiceAreaId} AND name = 'Phase 36 cost pressure'`;
  const [companySignal] = priorCompanySignals.length > 0 ? priorCompanySignals : await sql`
    INSERT INTO company_signal (practice_area_id, name, category, description, status, created_by, updated_by)
    VALUES (${practiceAreaId}, 'Phase 36 cost pressure', 'Financial', 'Disposable company checklist signal', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id
  `;
  const priorBuyerRoles = await sql`SELECT id FROM buyer_role WHERE name = 'Phase 36 CFO'`;
  const [buyerRole] = priorBuyerRoles.length > 0 ? priorBuyerRoles : await sql`
    INSERT INTO buyer_role (name, description, created_by, updated_by)
    VALUES ('Phase 36 CFO', 'Disposable buyer role', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id
  `;
  const priorPersonaSignals = await sql`SELECT id FROM persona_signal WHERE practice_area_id = ${practiceAreaId} AND buyer_role_id = ${buyerRole?.id} AND name = 'Phase 36 persona pressure'`;
  const [personaSignal] = priorPersonaSignals.length > 0 ? priorPersonaSignals : await sql`
    INSERT INTO persona_signal (practice_area_id, buyer_role_id, name, category, description, status, created_by, updated_by)
    VALUES (${practiceAreaId}, ${buyerRole?.id}, 'Phase 36 persona pressure', 'Financial', 'Disposable persona checklist signal', 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
    RETURNING id
  `;

  for (const [key, name, targetType] of [
    ['company-buying-signal-analysis', 'Company Buying Signal Analysis', 'company'],
    ['persona-buying-signal-analysis', 'Persona Buying Signal Analysis', 'persona'],
  ] as const) {
    await sql`
      INSERT INTO analysis_template (key, name, target_type, status, created_by, updated_by)
      VALUES (${key}, ${name}, ${targetType}, 'active', ${FIXTURE_ACTOR}, ${FIXTURE_ACTOR})
      ON CONFLICT (key) DO NOTHING
    `;
    const [template] = await sql`SELECT id FROM analysis_template WHERE key = ${key}`;
    await sql`
      INSERT INTO analysis_template_version (template_id, version, instruction, supported_efforts, default_effort, future_budget, created_by)
      VALUES (${template?.id}, 1, ${`Phase 36 deterministic ${key} instruction`}, '["standard"]'::jsonb, 'standard', '{"maxAttempts":2,"maxToolCalls":6,"maxExecutionSeconds":300,"maxSpendUsd":2.5}'::jsonb, ${FIXTURE_ACTOR})
      ON CONFLICT (template_id, version) DO NOTHING
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

if (process.argv[1]?.endsWith('phase36-fixture-reset.ts')) {
  void main().catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Phase 36 fixture reset failed');
    }
    process.exitCode = 1;
  });
}
