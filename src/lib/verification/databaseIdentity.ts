export type FixtureDatabaseUrl = Readonly<{ identity: string; marker: string }>;

export function parseFixtureDatabaseUrl(value: string | undefined): FixtureDatabaseUrl | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return undefined;
    const hostname = url.hostname.replace(/-pooler(?=\.)/, '');
    return {
      identity: `${url.username}@${hostname}:${url.port}${url.pathname}`,
      marker: url.hash.slice(1),
    };
  } catch (error: unknown) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

function requireFixtureDatabaseUrl(name: 'DATABASE_URL' | 'TEST_DATABASE_URL'): FixtureDatabaseUrl {
  const parsed = parseFixtureDatabaseUrl(process.env[name]);
  if (!parsed) throw new Error(`${name} must be a PostgreSQL URL for Phase 39 preflight`);
  return parsed;
}

export function assertPhase39Preflight(): void {
  const database = requireFixtureDatabaseUrl('DATABASE_URL');
  const fixture = requireFixtureDatabaseUrl('TEST_DATABASE_URL');
  if (fixture.marker !== 'phase39-fixture') throw new Error('TEST_DATABASE_URL must carry the phase39-fixture marker');
  if (database.identity === fixture.identity) throw new Error('TEST_DATABASE_URL must not identify DATABASE_URL');
}

if (process.argv.includes('--phase39-preflight')) {
  try {
    assertPhase39Preflight();
    process.stdout.write('Phase 39 disposable database preflight passed\n');
  } catch (error: unknown) {
    if (error instanceof Error) {
      process.stderr.write(`Phase 39 disposable database preflight blocked: ${error.message}\n`);
      process.exitCode = 2;
    } else {
      throw error;
    }
  }
}
