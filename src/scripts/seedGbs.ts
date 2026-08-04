// Seeds the full spec Section 7 GBS dataset into Neon via the typed query
// layer (NOT raw db.insert), so every row is validated by the same guards the
// future app will use — e.g. insertSignalOfferingLink's cross-practice-area
// check. Run with `npm run seed:gbs` (tsx src/scripts/seedGbs.ts).
import { config } from 'dotenv';

// tsx does not auto-load .env.local the way Next.js's own dev/build
// pipeline does. src/lib/env.ts validates process.env at MODULE-EVALUATION
// time (envSchema.parse), and ES module imports are hoisted above this
// file's top-level code — a static `import { db } from '../lib/db'` would
// therefore run (and fail) before the config() call below ever executes.
// Load .env.local first, then dynamically import everything that
// transitively touches src/lib/env.ts inside main().
config({ path: '.env.local' });

// env.ts fail-fast requires the Clerk keys at module-evaluation time even
// though a CLI seed never touches Clerk (30-RESEARCH.md Assumption A2).
// .env.local carries no Clerk keys, so supply placeholder values exactly
// like the TEST_DATABASE_URL-gated integration tests do (pk_test_placeholder /
// sk_test_placeholder). Never read by anything in this script.
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??= 'pk_test_placeholder';
process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';

// Sentinel createdBy/updatedBy for every row this script inserts — no Clerk
// session exists in a CLI context (30-RESEARCH.md Assumption A2).
const SEEDED_BY = 'seed-script';

// Spec Section 7.1: one practice area, three domains.
const DOMAINS: { name: string; sortOrder: number }[] = [
  { name: 'Design', sortOrder: 1 },
  { name: 'Build', sortOrder: 2 },
  { name: 'Run', sortOrder: 3 },
];

// Spec Section 7.2: five reusable buyer roles, inserted in catalogue order.
const BUYER_ROLES: string[] = ['CFO', 'COO', 'Head of GBS', 'Transformation Sponsor', 'CIO'];

type OfferType =
  | 'entry'
  | 'core'
  | 'programme'
  | 'retainer'
  | 'on_request'
  | 'operator_differentiator'
  | 'productised';

// Spec Section 7.3: 11 offerings across the three domains. description and
// commercialModelText are Claude-authored one-liners (the source catalogue
// .docx is not in this repo) — flagged in 30-06-SUMMARY.md. Buyers are
// [rank 1, rank 2] per the catalogue's primary/secondary ordering.
interface OfferingSeed {
  domainName: string;
  name: string;
  offerType: OfferType;
  sortOrder: number;
  description: string;
  commercialModelText: string;
  triggerText: string;
  buyers: [string, string];
}

const OFFERINGS: OfferingSeed[] = [
  {
    domainName: 'Design',
    name: 'GBS Maturity & Readiness Assessment',
    offerType: 'entry',
    sortOrder: 1,
    description:
      "An honest, structured baseline of the client's current shared-services/GBS maturity, benchmarked against comparable transformations, used to decide whether and how to proceed.",
    commercialModelText: 'Fixed fee, short, ≈3–5 weeks',
    triggerText:
      'Organisation runs (or is considering) GBS / shared services and wants an honest baseline before committing.',
    buyers: ['CFO', 'Head of GBS'],
  },
  {
    domainName: 'Design',
    name: 'Target Operating Model & Business Case',
    offerType: 'core',
    sortOrder: 2,
    description:
      'Designs the future-state GBS operating model and builds the quantified business case for the investment decision to build or reshape it.',
    commercialModelText: 'Fixed fee, scoped by deliverable, ≈6–10 weeks',
    triggerText:
      'Decision to build or reshape GBS; the client needs the future-state design and the case for change.',
    buyers: ['CFO', 'COO'],
  },
  {
    domainName: 'Design',
    name: 'Footprint & Location Strategy',
    offerType: 'core',
    sortOrder: 3,
    description:
      'Evaluates delivery footprint options — captive, BPO, or hybrid — and recommends locations and geographies aligned to cost, talent, and risk objectives.',
    commercialModelText: 'Fixed fee, scoped by deliverable, ≈6–10 weeks',
    triggerText:
      'The client is weighing where and how to deliver — captive, BPO, hybrid, and which geographies.',
    buyers: ['CFO', 'Head of GBS'],
  },
  {
    domainName: 'Build',
    name: 'Transition & Migration Management',
    offerType: 'programme',
    sortOrder: 1,
    description:
      'Plans and executes the move of in-scope processes and people into the GBS without disrupting live service delivery.',
    commercialModelText: 'Programme-based, milestone-billed',
    triggerText: 'Scope has been decided and work must move into the GBS without breaking service.',
    buyers: ['Head of GBS', 'Transformation Sponsor'],
  },
  {
    domainName: 'Build',
    name: 'Service Management & SLA Framework Set-up',
    offerType: 'core',
    sortOrder: 2,
    description:
      'Stands up the service-management machinery — SLAs, KPIs, governance cadence — a GBS needs to run as a service rather than a back office.',
    commercialModelText: 'Fixed fee, scoped by deliverable, ≈6–10 weeks',
    triggerText:
      'A new or reshaped GBS needs the machinery to run as a service, not a back office.',
    buyers: ['Head of GBS', 'COO'],
  },
  {
    domainName: 'Build',
    name: 'Change, Adoption & Capability Build',
    offerType: 'core',
    sortOrder: 3,
    description:
      'Builds the organisational capability and change adoption needed so people and process actually run the new GBS model, not just the design.',
    commercialModelText: 'Fixed fee, scoped by deliverable, ≈6–10 weeks',
    triggerText:
      'The model and processes are designed, but the organisation and its people are not yet ready to run them.',
    buyers: ['Head of GBS', 'Transformation Sponsor'],
  },
  {
    domainName: 'Build',
    name: 'Carve-out / Integration Support',
    offerType: 'operator_differentiator',
    sortOrder: 4,
    description:
      'Provides hands-on, operator-grade execution support for shared-services aspects of an M&A carve-out or integration.',
    commercialModelText: 'Day-rate, deployed as needed, scope varies with the deal',
    triggerText:
      'An M&A separation or integration is touching shared services and the client needs operator-grade execution.',
    buyers: ['CFO', 'Transformation Sponsor'],
  },
  {
    domainName: 'Run',
    name: 'Governance Advisory',
    offerType: 'retainer',
    sortOrder: 1,
    description:
      'An independent design authority and governance advisor for a GBS programme or operation already underway.',
    commercialModelText: 'Retainer, ongoing',
    triggerText:
      'A GBS programme or operation is underway and the client wants independent governance and a design authority.',
    buyers: ['CFO', 'Head of GBS'],
  },
  {
    domainName: 'Run',
    name: 'Service Performance Assurance',
    offerType: 'retainer',
    sortOrder: 2,
    description:
      'Independent oversight of live SLA/KPI performance with a continuous-improvement cadence for an operating GBS.',
    commercialModelText: 'Retainer, ongoing',
    triggerText:
      'Service is live and the client wants independent SLA / KPI oversight and a continuous-improvement cadence.',
    buyers: ['Head of GBS', 'COO'],
  },
  {
    domainName: 'Run',
    name: 'Interim GBS Leadership',
    offerType: 'on_request',
    sortOrder: 3,
    description:
      'Places hands-on interim leadership into the GBS function or programme when the client needs execution, not advice.',
    commercialModelText: 'Day-rate, on request, duration set by engagement',
    triggerText:
      'The client needs hands-on leadership of the GBS function or programme rather than advice.',
    buyers: ['CFO', 'COO'],
  },
  {
    domainName: 'Run',
    name: 'Automation & AI Portfolio Governance & Benefit Realisation',
    offerType: 'retainer',
    sortOrder: 4,
    description:
      "Governs the GBS's automation/AI portfolio end-to-end and protects the realisation of its intended benefits.",
    commercialModelText: 'Retainer, ongoing',
    triggerText:
      'Automation / AI is being deployed across the GBS and the client wants the benefit protected and the portfolio governed.',
    buyers: ['CFO', 'Head of GBS'],
  },
];

async function main() {
  const { db } = await import('../lib/db');
  const {
    practiceArea,
    domain,
    buyerRole,
    offering,
    offeringBuyerRole,
    trigger,
    companySignal,
    personaSignal,
    signalOfferingLink,
  } = await import('../lib/db/schema');
  const practiceAreas = await import('../lib/db/queries/practiceAreas');
  const domains = await import('../lib/db/queries/domains');
  const buyerRoles = await import('../lib/db/queries/buyerRoles');
  const offerings = await import('../lib/db/queries/offerings');

  // This script fully owns the 9 Phase 30 tables — clear prior seed-managed
  // rows (children first, respecting FK constraints) so re-running `npm run
  // seed:gbs` is idempotent. The delete step only ever targets these 9 tables,
  // never company/persona/signal or any other existing entity (T-30-09b).
  // Sequential deletes only — the neon-http driver has no transaction support.
  await db.delete(signalOfferingLink);
  await db.delete(trigger);
  await db.delete(offeringBuyerRole);
  await db.delete(offering);
  await db.delete(domain);
  await db.delete(personaSignal);
  await db.delete(companySignal);
  await db.delete(buyerRole);
  await db.delete(practiceArea);

  // Spec Section 7.1: practice area.
  const gbs = await practiceAreas.insertPracticeArea({
    name: 'GBS — Design, Build & Run',
    shortCode: 'GBS',
    sortOrder: 1,
    status: 'active',
    createdBy: SEEDED_BY,
  });

  // Spec Section 7.1: domains.
  const domainNameToId = new Map<string, number>();
  for (const row of DOMAINS) {
    const inserted = await domains.insertDomain({
      practiceAreaId: gbs.id,
      name: row.name,
      sortOrder: row.sortOrder,
      createdBy: SEEDED_BY,
    });
    domainNameToId.set(row.name, inserted.id);
  }

  // Spec Section 7.2: buyer roles.
  const buyerRoleNameToId = new Map<string, number>();
  for (const name of BUYER_ROLES) {
    const inserted = await buyerRoles.insertBuyerRole({
      name,
      createdBy: SEEDED_BY,
    });
    buyerRoleNameToId.set(name, inserted.id);
  }

  // Spec Section 7.3: offerings, one trigger row each, two ranked
  // offering_buyer_role rows each.
  const offeringNameToId = new Map<string, number>();
  for (const row of OFFERINGS) {
    const domainId = domainNameToId.get(row.domainName);
    if (!domainId) {
      throw new Error(
        `Offering "${row.name}" references unknown domain "${row.domainName}" — must match a domain seeded above.`
      );
    }
    const inserted = await offerings.insertOffering({
      practiceAreaId: gbs.id,
      domainId,
      name: row.name,
      offerType: row.offerType,
      description: row.description,
      commercialModelText: row.commercialModelText,
      sortOrder: row.sortOrder,
      status: 'active',
      createdBy: SEEDED_BY,
    });
    offeringNameToId.set(row.name, inserted.id);

    await offerings.insertTrigger({
      offeringId: inserted.id,
      triggerText: row.triggerText,
      sortOrder: 1,
      createdBy: SEEDED_BY,
    });

    for (let rank = 0; rank < row.buyers.length; rank += 1) {
      const buyerRoleName = row.buyers[rank];
      const buyerRoleId = buyerRoleNameToId.get(buyerRoleName);
      if (!buyerRoleId) {
        throw new Error(
          `Offering "${row.name}" references unknown buyer role "${buyerRoleName}" — must match a buyer role seeded above.`
        );
      }
      await offerings.insertOfferingBuyerRole({
        offeringId: inserted.id,
        buyerRoleId,
        rank: rank + 1,
        createdBy: SEEDED_BY,
      });
    }
  }

  // TODO Task 2: signals-side inserts (company signals, persona signals,
  // signal-offering links) + main() invocation.
}
