import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Phase 34 (34-04): tracked-source boundary audit for the whole-run review and
// confirmed-candidate work. Mirrors scripts/phase33-scope-audit.ts: scans the
// tracked inventory for forbidden provider imports and manifest packages
// globally, then applies Phase 34 boundary patterns (legacy writes, legacy
// proposal Accept reuse, live Signal/Offering/link writes, Phase 33 packet
// mutation, provider/Firecrawl calls, per-finding/bulk/scheduled/
// auto-confirmation surface, Phase 35/36 scope leakage, and new dependencies)
// to the Phase 34-owned production paths only. Tests are excluded from the
// write-pattern scan because integration suites legitimately seed catalog
// fixture rows (signal_offering_link/offering/company_signal/persona_signal).
// firecrawl is deliberately absent from the global patterns: Phase 33 owns the
// provider seam and legitimately imports it; the Phase 34 paths must not.

export interface ScopeAuditFinding {
  readonly category: string;
  readonly file: string;
  readonly detail: string;
}

export interface ScopeAuditResult {
  readonly scannedFileCount: number;
  readonly scannedCategories: readonly string[];
  readonly findings: readonly ScopeAuditFinding[];
}

const FORBIDDEN_MANIFEST_PACKAGE_PATTERN = /["'](?:@[^"']+\/)?(?:exa(?:-search|-sdk|-js)?|perplexity|tavily|serpapi|brave-search|google-generative-ai)["']\s*:/i;
const FORBIDDEN_IMPORT_PATTERN = /(?:from|import\s*\()\s*['"][^'"]*(?:exa|perplexity|tavily|serpapi|brave-search|google-generative-ai)/i;

// D-34-05/T-34-13: Phase 34 paths must not write the legacy proposal tables.
const LEGACY_WRITE_PATTERN =
  /(?:insert|update|delete|values|set)\s*\([^\n]*(?:agent_run|signal_proposal)|(?:agent_run|signal_proposal)[^\n]*(?:insert|update|delete|values|set)/i;
const SQL_LEGACY_WRITE_PATTERN = /\b(?:insert\s+into|update\s+|delete\s+from)\s*(?:agent_run|signal_proposal)\b/i;

// D-34-02/D-34-05: the whole-run path is structurally separate from legacy
// proposal Accept/Reject and never opens an interactive transaction.
const LEGACY_ACCEPT_PATTERN = /acceptProposalAction\s*\(|acceptProposal\s*\(|db\.transaction/i;

// D-34-04/D-34-05: no live Signal/Company Signal/Persona Signal/Offering or
// signal_offering_link writes from Phase 34 paths (read-only projection).
const LIVE_WRITE_PATTERN =
  /\b(?:insert\s+into|update\s+|delete\s+from)\s*(?:signal|company_signal|persona_signal|offering|signal_offering_link)\b/i;
const DRIZZLE_LIVE_WRITE_PATTERN =
  /\.(?:insert|update|delete)\(\s*schema\.(?:signal|companySignal|personaSignal|offering|signalOfferingLink)/i;

// D-34-01/D-34-02: analysis_run_result/analysis_finding/analysis_source/
// analysis_finding_source are immutable Phase 33 evidence; no packet content
// write. The analysis_run.status transition and analysis_run_event append are
// the legitimate lifecycle boundary and are intentionally not matched.
const PACKET_MUTATION_PATTERN =
  /\b(?:insert\s+into|update\s+|delete\s+from)\s*(?:analysis_run_result|analysis_finding_source|analysis_finding|analysis_source)\b/i;

// D-34-07/T-34-SC: no provider/Firecrawl calls inside Phase 34 paths. Scoped
// here (not globally) because Phase 33 owns the firecrawl seam.
const PROVIDER_CALL_PATTERN =
  /firecrawl|FirecrawlApp|createFirecrawl|exa\b|perplexity|tavily|serpapi|brave-search|google-generative-ai/i;

// 34-CONTEXT "Deferred / out of scope": no per-finding curation, bulk or
// scheduled execution, auto-confirmation, Phase 35 target-record UX, or Phase
// 36 template management surface.
const PER_FINDING_PATTERN = /per[-_]?finding|perFinding/i;
const BULK_SCHEDULED_AUTO_PATTERN = /\bbulk\b|\bschedul|\bauto[-_]?confirm/i;
const LATER_PHASE_PATTERN = /target[-_]?record|template[-_]?management|phase[-_]?3[56]/i;

// v1.7 boundary marker in src/app/actions/reviews.ts: the legacy Accept/Reject
// section above it legitimately references acceptProposal; the whole-run
// section below it must not.
const V1_7_MARKER = '// ---- v1.7 whole-run review actions below this line ----';

// Phase 34-owned production paths (schema/query/action/UI). reviews.ts is
// included whole; the legacy-accept check slices it below the v1.7 marker.
const PRODUCTION_PHASE34_PATHS = [
  'src/lib/analysis/reviewContracts',
  'src/lib/db/schema',
  'src/lib/db/queries/analysisReviews',
  'src/lib/db/queries/confirmedCandidates',
  'src/app/actions/reviews',
  'src/app/(dashboard)/reviews/page',
  'src/components/reviews/run-review',
] as const;

function trackedFiles(rootDir: string): readonly string[] {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  return output
    .split('\0')
    .filter((filePath) => filePath.length > 0)
    .filter((filePath) => {
      const isSource = /^(src|scripts)\//.test(filePath) && /\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(filePath);
      const isManifest = /^(package(?:-lock)?\.json|tsconfig[^/]*\.json|drizzle\.config\.[^/]+|vitest[^/]*\.[^/]+)$/.test(filePath);
      return isSource || isManifest;
    });
}

function isProductionPhase34Path(filePath: string): boolean {
  return (
    PRODUCTION_PHASE34_PATHS.some((prefix) => filePath.startsWith(prefix)) &&
    !filePath.endsWith('.test.ts') &&
    !filePath.endsWith('.test.tsx')
  );
}

// The legacy-accept scan target is the whole-run section below the marker. If
// the marker is missing, the whole file is scanned (a missing marker is itself
// a boundary regression that surfaces as a finding).
function wholeRunSection(source: string): string {
  const markerIndex = source.indexOf(V1_7_MARKER);
  return markerIndex === -1 ? source : source.slice(markerIndex);
}

function addFinding(findings: ScopeAuditFinding[], category: string, file: string, detail: string): void {
  findings.push({ category, file, detail });
}

function checkNewDependencies(rootDir: string, findings: ScopeAuditFinding[]): void {
  // T-34-SC: no dependency changes. Working-tree package.json keys are compared
  // against HEAD; the pre-existing working-tree churn (seed script addition,
  // @workflow/vitest section move) adds no keys, so this stays zero-finding.
  let headPkg: Record<string, unknown>;
  try {
    headPkg = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { cwd: rootDir, encoding: 'utf8' }));
  } catch {
    return;
  }
  const wtPkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8')) as Record<string, unknown>;
  const keySets = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
  const headKeys = new Set<string>();
  const wtKeys = new Set<string>();
  for (const section of keySets) {
    const headSection = (headPkg[section] ?? {}) as Record<string, unknown>;
    const wtSection = (wtPkg[section] ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(headSection)) headKeys.add(key);
    for (const key of Object.keys(wtSection)) wtKeys.add(key);
  }
  for (const key of wtKeys) {
    if (!headKeys.has(key)) {
      addFinding(findings, 'new-dependency', 'package.json', `dependency key added since HEAD: ${key}`);
    }
  }
}

export function runScopeAudit(rootDir: string): ScopeAuditResult {
  const files = trackedFiles(rootDir);
  const findings: ScopeAuditFinding[] = [];
  const scannedCategories = new Set<string>();

  for (const filePath of files) {
    const source = readFileSync(resolve(rootDir, filePath), 'utf8');
    const isManifest = /^(package(?:-lock)?\.json|tsconfig[^/]*\.json|drizzle\.config\.[^/]+|vitest[^/]*\.[^/]+)$/.test(filePath);
    const isSource = filePath.startsWith('src/') && /\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(filePath);
    const isScript = filePath.startsWith('scripts/');
    if (isSource) scannedCategories.add('source');
    if (isScript) scannedCategories.add('scripts');
    if (isManifest) scannedCategories.add('manifests');
    if (filePath.includes('/db/schema') || filePath.includes('/db/queries/')) scannedCategories.add('schema/query');

    if (isManifest && FORBIDDEN_MANIFEST_PACKAGE_PATTERN.test(source)) {
      addFinding(findings, 'provider/package', filePath, 'forbidden external provider or SDK token');
    }
    if (FORBIDDEN_IMPORT_PATTERN.test(source)) {
      addFinding(findings, 'provider/import', filePath, 'forbidden external provider import');
    }

    if (!isProductionPhase34Path(filePath)) continue;

    const acceptScanSource = filePath === 'src/app/actions/reviews.ts' ? wholeRunSection(source) : source;

    if (LEGACY_WRITE_PATTERN.test(source) || SQL_LEGACY_WRITE_PATTERN.test(source)) {
      addFinding(findings, 'legacy-write', filePath, 'legacy agent_run or signal_proposal write');
    }
    if (LEGACY_ACCEPT_PATTERN.test(acceptScanSource)) {
      addFinding(findings, 'legacy-accept', filePath, 'whole-run path reaches legacy proposal Accept or interactive transaction');
    }
    if (LIVE_WRITE_PATTERN.test(source) || DRIZZLE_LIVE_WRITE_PATTERN.test(source)) {
      addFinding(findings, 'live-write', filePath, 'live Signal, Company/Persona Signal, Offering, or signal_offering_link write');
    }
    if (PACKET_MUTATION_PATTERN.test(source)) {
      addFinding(findings, 'packet-mutation', filePath, 'Phase 33 packet content table write');
    }
    if (PROVIDER_CALL_PATTERN.test(source)) {
      addFinding(findings, 'provider-call', filePath, 'provider or Firecrawl call in Phase 34 path');
    }
    if (PER_FINDING_PATTERN.test(source)) {
      addFinding(findings, 'per-finding-surface', filePath, 'per-finding curation surface');
    }
    if (BULK_SCHEDULED_AUTO_PATTERN.test(source)) {
      addFinding(findings, 'bulk-scheduled-auto', filePath, 'bulk, scheduled, or auto-confirmation surface');
    }
    if (LATER_PHASE_PATTERN.test(source)) {
      addFinding(findings, 'later-phase-surface', filePath, 'Phase 35 target-record or Phase 36 template/E2E surface');
    }
  }

  checkNewDependencies(rootDir, findings);

  return {
    scannedFileCount: files.length,
    scannedCategories: [...scannedCategories].sort(),
    findings,
  };
}

function main(): void {
  const result = runScopeAudit(process.cwd());
  const summary = {
    scannedFileCount: result.scannedFileCount,
    scannedCategories: result.scannedCategories,
    findingCount: result.findings.length,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (result.findings.length > 0) {
    for (const finding of result.findings) {
      process.stderr.write(`${finding.category}: ${finding.file}: ${finding.detail}\n`);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('/phase34-scope-audit.ts') === true) main();
