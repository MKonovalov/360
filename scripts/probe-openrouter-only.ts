// VER-03 child-env probe: dotenv-loads .env.local, resolves the seeded test
// staff user via Clerk Backend API (E2E_CLERK_USER_EMAIL), looks up the seeded
// test company BY NAME, stamps a synthetic *.test domain, upserts
// OpenRouter-only settings (anthropic/claude-sonnet-4.6, no fallbacks), and
// runs a REAL analyzeCompany against it. Prints ONLY shape fields
// ({ ok, modelUsed, modelChain }) as JSON for the parent vitest child-env test
// (src/lib/agents/openrouter-only-chain.test.ts) to assert — never env values,
// never key material (Security Domain / T-22-03).
//
// Deliberate placement: repo-root scripts/, NOT src/scripts/ — this probe is
// only ever spawned as a child process by the vitest test, and the Phase 18
// verification gate greps zero `child_process` in src/ (same rationale as
// scripts/refresh-model-catalog.ts:6-9).
import { config } from 'dotenv';

// tsx does not auto-load .env.local the way Next.js's own dev/build pipeline
// does (seed.ts:5-11 why-comment). src/lib/env.ts validates process.env at
// MODULE-EVALUATION time (envSchema.parse), and ES module imports are hoisted
// above this file's top-level code — a static import of any src/lib module
// would run (and fail) before the config() call below ever executes. Load
// .env.local first, then dynamically import everything that transitively
// touches src/lib/env.ts inside main().
config({ path: '.env.local' });

async function main() {
  const { createClerkClient } = await import('@clerk/backend');
  const { analyzeCompany } = await import('../src/lib/agents/analyzeCompany');
  const { getCompanyByName } = await import('../src/lib/db/queries/companies');
  const { upsertModelSettings } = await import('../src/lib/db/queries/userModelSettings');
  const { db } = await import('../src/lib/db');
  const { company } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  // Resolve the Clerk userId for the dedicated E2E test staff account
  // (provisioned in plan 22-03 Task 3). E2E_CLERK_USER_EMAIL must exist in
  // .env.local; getUserList returns { data, totalCount } — read data[0].
  const email = process.env.E2E_CLERK_USER_EMAIL;
  if (!email) {
    throw new Error(
      'E2E_CLERK_USER_EMAIL is missing from .env.local — provision the test staff account per plan 22-03 Task 3'
    );
  }
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const { data: users } = await clerk.users.getUserList({ emailAddress: [email] });
  const userId = users[0]?.id;
  if (!userId) {
    throw new Error(
      `No Clerk user found for "${email}" — provision the test staff account per plan 22-03 Task 3`
    );
  }

  // Pitfall 4: seed re-inserts companies with growing serial PKs — resolve
  // the seeded test company BY NAME, never by a hard-coded id.
  const row = await getCompanyByName('Acme Test Co');
  if (!row) {
    throw new Error('Acme Test Co not found — run `npm run seed` first');
  }

  // Claude's discretion (22-CONTEXT): stamp a synthetic *.test domain so the
  // probe never touches real ICP data. Idempotent — re-running sets the same
  // value on the same row; seed deletes all companies first so no other row
  // holds this domain (company.domain unique constraint is safe).
  await db.update(company).set({ domain: 'acmetest.arclumen.test' }).where(eq(company.id, row.id));

  // D-07 pinned concrete OpenRouter default slug, OpenRouter-only chain — no
  // Anthropic id anywhere in the chain (the child env strips ANTHROPIC_API_KEY).
  await upsertModelSettings({ userId, primaryModel: 'anthropic/claude-sonnet-4.6', fallbackModels: [] });

  // The real run entry — the chain-aware env gate (FAL-04 / D-20-01/02) must
  // pass with ONLY OPENROUTER_API_KEY set in the child env.
  const result = await analyzeCompany(row.id, userId);

  // Shapes only — never env contents, never key values (Security Domain).
  // AnalyzeResult is a discriminated union: modelUsed/modelChain live only on
  // the ok:true branch; emit null on the failure branch so the JSON contract
  // { ok, modelUsed, modelChain } stays stable for the parent to assert.
  const payload =
    result.ok === true
      ? { ok: true as const, modelUsed: result.modelUsed, modelChain: result.modelChain }
      : { ok: false as const, modelUsed: null, modelChain: null };
  console.log(JSON.stringify(payload));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
