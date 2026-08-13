import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { z } from 'zod';

config({ path: '.env.local' });

const PREFLIGHT_ARGS = ['exec', 'tsx', 'src/lib/verification/databaseIdentity.ts', '--', '--phase39-preflight'];
const RESET_ARGS = ['exec', 'tsx', 'e2e/phase39-fixture-reset.ts'];
const PLAYWRIGHT_ARGS = ['run', 'e2e', '--', 'e2e/phase39-security-review.spec.ts'];
const lanes = [
  ['/agents lifecycle', 'lifecycle'],
  ['Company/Persona company', 'company'],
  ['Company/Persona persona', 'persona'],
] as const;

type FixtureIds = Readonly<{
  readonly companyId: number;
  readonly personaId: number;
  readonly practiceAreaId: number;
}>;

const fixtureIdsSchema = z.object({
  companyId: z.number().int().positive(),
  personaId: z.number().int().positive(),
  practiceAreaId: z.number().int().positive(),
});

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv, captureOutput = false): string | undefined {
  const result = spawnSync(command, [...args], {
    env,
    encoding: 'utf8',
    stdio: captureOutput ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
  return captureOutput ? result.stdout : undefined;
}

function resetFixtures(env: NodeJS.ProcessEnv): FixtureIds {
  const output = run('npm', RESET_ARGS, env, true);
  if (output === undefined) throw new Error('Phase 39 reset did not return fixture data');
  const line = output.trim().split('\n').at(-1);
  if (!line) throw new Error('Phase 39 reset did not return fixture data');
  const record = fixtureIdsSchema.parse(JSON.parse(line));
  return {
    companyId: record.companyId,
    personaId: record.personaId,
    practiceAreaId: record.practiceAreaId,
  };
}

function preflight(env: NodeJS.ProcessEnv): void {
  run('npm', PREFLIGHT_ARGS, env);
}

function markedEnvironment(): NodeJS.ProcessEnv {
  const databaseUrl = process.env.DATABASE_URL;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl || !testDatabaseUrl) return { ...process.env, PHASE39_FIXTURE_ONLY: '1' };
  const database = new URL(databaseUrl);
  database.hash = '#phase39-fixture';
  const fixture = new URL(testDatabaseUrl);
  fixture.hash = '#phase39-fixture';
  return {
    ...process.env,
    DATABASE_URL: database.toString(),
    TEST_DATABASE_URL: fixture.toString(),
    PHASE39_FIXTURE_ONLY: '1',
  };
}

function laneEnvironment(baseEnvironment: NodeJS.ProcessEnv, ids: FixtureIds): NodeJS.ProcessEnv {
  return {
    ...baseEnvironment,
    PHASE39_FIXTURE_ONLY: '1',
    PHASE39_COMPANY_ID: String(ids.companyId),
    PHASE39_PERSONA_ID: String(ids.personaId),
    PHASE39_PRACTICE_AREA_ID: String(ids.practiceAreaId),
  };
}

function main(): number {
  process.env.PHASE39_FIXTURE_ONLY = '1';
  const results: number[] = [];
  const baseEnvironment = markedEnvironment();
  for (const [grep, name] of lanes) {
    const guardedEnv = { ...baseEnvironment };
    try {
      preflight(guardedEnv);
      const ids = resetFixtures(guardedEnv);
      const env = laneEnvironment(guardedEnv, ids);
      preflight(env);
      const result = spawnSync('npm', [...PLAYWRIGHT_ARGS, '-g', grep], {
        env,
        stdio: 'inherit',
      });
      if (result.error) throw result.error;
      results.push(result.status ?? 1);
      console.log(`Phase 39 ${name} lane exited with status ${result.status ?? 1}`);
    } catch (error: unknown) {
      results.push(1);
      console.error(error instanceof Error ? error.message : `Phase 39 ${name} lane failed`);
    }
  }
  return results.some((status) => status !== 0) ? 1 : 0;
}

process.exitCode = main();
