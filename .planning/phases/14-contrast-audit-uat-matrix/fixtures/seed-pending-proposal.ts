// Phase 14 UAT badge-gating fixture (T-14-02): inserts ONE pending
// signalProposal so the live /reviews badge/dot/Reviews (N) branch can be
// asserted, then deletes it on --cleanup. Run with tsx. NEVER prints the
// connection string or secrets — only the inserted row id.

// tsx does not auto-load .env.local (Next.js does); src/lib/env.ts validates
// process.env at module-evaluation time, so .env.local must load BEFORE any
// dynamic import that transitively touches it. Mirrors src/scripts/seed.ts.
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createHash } from 'node:crypto';

// SAFETY GATE (T-14-02, 08-06-UAT precedent): confirm the connection is the
// dev/QA Neon instance BEFORE any write. The host fragment below is the local
// dev project's pooler endpoint (the only DATABASE_URL this repo has — the
// .env.local dev connection). A production URL would fail the host check and
// abort with exit 1. Log the SHA-256 prefix (never the string) for the audit.
const DEV_HOST_FRAGMENT = 'ep-proud-bread-agmksetk-pooler';

function assertDevDatabase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('FATAL: DATABASE_URL is not set in .env.local');
    process.exit(1);
  }
  const host = new URL(url).hostname;
  if (!host.includes(DEV_HOST_FRAGMENT)) {
    console.error(
      `FATAL: refusing to write — host '${host}' does not match the dev/QA Neon project (${DEV_HOST_FRAGMENT}). Aborting.`
    );
    process.exit(1);
  }
  const sha = createHash('sha256').update(url).digest('hex');
  console.log(`dev-DB gate: sha256 prefix ${sha.slice(0, 12)}… host ${host}`);
}

async function main() {
  assertDevDatabase();

  const [{ db }] = await Promise.all([import('../../../../src/lib/db')]);
  const { signalProposal, company } = await import('../../../../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const mode = process.argv[2]; // undefined = insert, '--cleanup' = delete

  if (mode === '--cleanup') {
    const id = Number(process.argv[3]);
    if (!Number.isInteger(id)) {
      console.error('FATAL: --cleanup requires a numeric row id');
      process.exit(1);
    }
    const deleted = await db.delete(signalProposal).where(eq(signalProposal.id, id)).returning({ id: signalProposal.id });
    console.log(deleted.length > 0 ? `deleted proposal id ${deleted[0].id}` : `no row found for id ${id}`);
    return;
  }

  // Pick an existing company (signalProposal.companyId is NOT NULL with an FK).
  const companyRows = await db.select({ id: company.id }).from(company).limit(1);
  const companyId = companyRows[0]?.id ?? null;
  if (!companyId) {
    console.error('FATAL: no company rows in dev DB to attach the fixture to');
    process.exit(1);
  }

  const [row] = await db
    .insert(signalProposal)
    .values({
      companyId,
      signalType: 'cost_pressure',
      strength: 'medium',
      detectedAt: new Date().toISOString().slice(0, 10),
      evidenceUrl: 'https://example.com/evidence',
      reliability: 'R1',
      confidence: 'C1',
      evidenceSnippet: 'Phase 14 UAT badge fixture',
      reasoning: 'Phase 14 UAT fixture — badge gating proof',
    })
    .returning({ id: signalProposal.id });

  console.log(`inserted proposal id ${row.id}`);
}

main().catch((err) => {
  console.error('fixture failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
