import {
  createScopeSource,
  SCOPE_AUDIT_MODES,
  type HistoricalScopeRefs,
  type ScopeAuditMode,
  type ScopeSource,
} from './historical-scope-source';

export interface ScopeAuditFinding {
  readonly category: string;
  readonly file: string;
  readonly detail: string;
}

export interface ScopeAuditResult {
  readonly mode: ScopeAuditMode;
  readonly targetRef: string;
  readonly baseRef: string;
  readonly scannedFileCount: number;
  readonly scannedCategories: readonly string[];
  readonly findings: readonly ScopeAuditFinding[];
}

export const PHASE35_HISTORICAL_REFS = {
  targetRef: 'cbf6525e9a1cd3d9f43f95ee0c2a2ee012dd0c88',
  baseRef: '18d2f4461d20b602de022f0e9c3b754669524882',
} as const satisfies HistoricalScopeRefs;

const MANIFEST_PATTERN = /^(package(?:-lock)?\.json|tsconfig[^/]*\.json|(?:playwright|vitest)[^/]*\.[^/]+|drizzle\.config\.[^/]+)$/;
const SOURCE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs|json)$/;

// Phase 33 owns the provider seam. Phase 35 may display fixture data, but it
// must not import an SDK or invoke a provider from its preview/history paths.
const PROVIDER_IMPORT_PATTERN = /(?:from|import\s*\(|require\s*\()\s*['"][^'"]*(?:firecrawl|exa|perplexity|tavily|serpapi|brave-search|google-generative-ai)/i;
const PROVIDER_EXECUTION_PATTERN = /(?:FirecrawlApp|createFirecrawl|firecrawl\.(?:crawl|search|extract)|(?:exa|perplexity|tavily|serpapi|brave)\w*\s*\()/i;

const LEGACY_WRITE_PATTERN = /(?:insert|update|delete|values|set)\s*\([^\n]*(?:agent_run|signal_proposal)|(?:agent_run|signal_proposal)[^\n]*(?:insert|update|delete|values|set)/i;
const LEGACY_PATH_PATTERN = /(?:\/api\/companies\/[^'"`\s]+\/analyze|AnalyzeRunStatus|acceptProposalAction|rejectProposalAction)/i;
const LIVE_WRITE_PATTERN = /\b(?:insert\s+into|update\s+|delete\s+from)\s*(?:signal|company_signal|persona_signal|offering|signal_offering_link)\b|\.(?:insert|update|delete)\(\s*schema\.(?:signal|companySignal|personaSignal|offering|signalOfferingLink)/i;
const PACKET_MUTATION_PATTERN = /\b(?:insert\s+into|update\s+|delete\s+from)\s*(?:analysis_run_result|analysis_finding_source|analysis_finding|analysis_source)\b/i;

const PHASE36_PATTERN = /(?:phase[-_ ]?36|template[-_ ]?(?:management|lifecycle|editor|crud)|(?:dynamic|constructible)[-_ ](?:agent|builder)|agent[-_ ]?(?:builder|playground)|EXA[-_ ]?style|provider[-_ ]?(?:control|selection)|model[-_ ]?(?:control|selection))/i;
const CLIENT_TRUST_PATTERN = /JSON\.stringify\([\s\S]{0,320}\b(?:instruction|checklist|actor(?:Id|Kind)?|resolvedModelChain|provider|model(?:Id|Chain)?)\b/i;
const GLOBAL_FILTER_PATTERN = /list(?:RunReviewItems|ConfirmedCandidateOfferings)\(\)[\s\S]{0,400}\.filter\(/i;
const FINDING_DECISION_PATTERN = /(?:confirm|dismiss)(?:Finding|Evidence)|(?:Finding|Evidence)(?:Confirm|Dismiss)/i;

const PHASE35_PATHS = [
  'src/app/api/analysis-preview/',
  'src/components/analysis/',
  'src/components/companies/company-detail.tsx',
  'src/components/personas/persona-detail.tsx',
  'src/components/reviews/run-review-card.tsx',
  'src/lib/analysis/experienceContracts',
  'src/lib/analysis/pollingClient',
  'src/lib/db/queries/analysisRuns',
  'src/lib/db/queries/confirmedCandidates',
] as const;

function scanFiles(source: ScopeSource): readonly string[] {
  return source.files.filter((filePath) => {
      const source = /^(src|scripts|e2e)\//.test(filePath) && SOURCE_PATTERN.test(filePath);
      return source || MANIFEST_PATTERN.test(filePath);
  });
}

function isPhase35Path(filePath: string): boolean {
  const isTestFile = filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx') || filePath.endsWith('.spec.ts');
  return !isTestFile && PHASE35_PATHS.some((prefix) => filePath.startsWith(prefix));
}

function addFinding(findings: ScopeAuditFinding[], category: string, file: string, detail: string): void {
  findings.push({ category, file, detail });
}

function checkManifestAndSchemaChanges(source: ScopeSource, findings: ScopeAuditFinding[]): void {
  for (const filePath of [...source.changedFiles].filter((candidate) =>
    candidate === 'package.json' || candidate === 'package-lock.json')) {
    addFinding(findings, 'package-change', filePath, 'package manifest changed during Phase 35');
  }

  for (const filePath of [...source.changedFiles].filter((candidate) =>
    candidate.startsWith('drizzle/') || candidate.startsWith('src/lib/db/schema'),
  )) {
    addFinding(findings, 'schema-change', filePath, 'schema or migration changed during Phase 35');
  }
}

function checkDependencies(source: ScopeSource, findings: ScopeAuditFinding[]): void {
  const headPackage = JSON.parse(source.readBaseFile('package.json')) as Record<string, unknown>;
  const workingPackage = JSON.parse(source.readFile('package.json')) as Record<string, unknown>;
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
  for (const section of sections) {
    const headDependencies = (headPackage[section] ?? {}) as Record<string, unknown>;
    const workingDependencies = (workingPackage[section] ?? {}) as Record<string, unknown>;
    for (const dependency of Object.keys(workingDependencies)) {
      if (!Object.hasOwn(headDependencies, dependency)) {
        addFinding(findings, 'new-dependency', 'package.json', `dependency key added since HEAD: ${dependency}`);
      }
    }
  }
}

export function runScopeAudit(
  rootDir: string,
  mode: ScopeAuditMode = SCOPE_AUDIT_MODES.historical,
): ScopeAuditResult {
  const source = createScopeSource(rootDir, mode, PHASE35_HISTORICAL_REFS);
  const files = scanFiles(source);
  const findings: ScopeAuditFinding[] = [];
  const scannedCategories = new Set<string>();

  for (const filePath of files) {
    const isManifest = MANIFEST_PATTERN.test(filePath);
    const isSource = /^(src|scripts|e2e)\//.test(filePath) && SOURCE_PATTERN.test(filePath);
    const fileSource = source.readFile(filePath);
    if (isSource) scannedCategories.add('source');
    if (filePath.startsWith('scripts/')) scannedCategories.add('scripts');
    if (filePath.startsWith('e2e/')) scannedCategories.add('e2e');
    if (isManifest) scannedCategories.add('manifests');

    if (isManifest && PROVIDER_IMPORT_PATTERN.test(fileSource)) {
      addFinding(findings, 'provider/import', filePath, 'forbidden provider import in a manifest/configuration file');
    }

    if (!isPhase35Path(filePath)) continue;
    if (PROVIDER_IMPORT_PATTERN.test(fileSource) || PROVIDER_EXECUTION_PATTERN.test(fileSource)) {
      addFinding(findings, 'provider-execution', filePath, 'provider or Firecrawl import/call in a Phase 35 path');
    }
    if (LEGACY_WRITE_PATTERN.test(fileSource) || LEGACY_PATH_PATTERN.test(fileSource)) {
      addFinding(findings, 'legacy-write', filePath, 'legacy proposal path or agent_run/signal_proposal write');
    }
    if (LIVE_WRITE_PATTERN.test(fileSource)) {
      addFinding(findings, 'live-write', filePath, 'live Signal, Offering, or signal_offering_link write');
    }
    if (PACKET_MUTATION_PATTERN.test(fileSource)) {
      addFinding(findings, 'packet-mutation', filePath, 'immutable Phase 33 packet table mutation');
    }
    if (PHASE36_PATTERN.test(fileSource)) {
      addFinding(findings, 'phase36-leakage', filePath, 'template lifecycle, dynamic agent, or provider/model control surface');
    }
    if (CLIENT_TRUST_PATTERN.test(fileSource)) {
      addFinding(findings, 'client-trust', filePath, 'client sends instruction, checklist, actor, provider, or model data');
    }
    if (GLOBAL_FILTER_PATTERN.test(fileSource)) {
      addFinding(findings, 'subject-isolation', filePath, 'global read followed by client-side subject filtering');
    }
    if (FINDING_DECISION_PATTERN.test(fileSource)) {
      addFinding(findings, 'finding-decision', filePath, 'per-finding Confirm/Dismiss control');
    }
  }

  for (const filePath of files) {
    if (
      source.changedFiles.has(filePath) &&
      filePath.startsWith('src/app/') &&
      /(?:^|\/)agents(?:\/|$)/.test(filePath)
    ) {
      addFinding(findings, 'agents-route', filePath, 'new agents or dynamic-agent route');
    }
  }

  checkManifestAndSchemaChanges(source, findings);
  checkDependencies(source, findings);

  return {
    mode: source.mode,
    targetRef: source.targetRef,
    baseRef: source.baseRef,
    scannedFileCount: files.length,
    scannedCategories: [...scannedCategories].sort(),
    findings,
  };
}

function main(): void {
  // no-excuse-ok: catch — CLI boundaries must return a sanitized failure, not a stack trace.
  try {
    const mode = process.argv.includes('--working-tree')
      ? SCOPE_AUDIT_MODES.workingTree
      : SCOPE_AUDIT_MODES.historical;
    const result = runScopeAudit(process.cwd(), mode);
    process.stdout.write(`${JSON.stringify({
      mode: result.mode,
      targetRef: result.targetRef,
      baseRef: result.baseRef,
      scannedFileCount: result.scannedFileCount,
      scannedCategories: result.scannedCategories,
      findingCount: result.findings.length,
    })}\n`);
    for (const finding of result.findings) {
      process.stderr.write(`${finding.category}: ${finding.file}: ${finding.detail}\n`);
    }
    if (result.findings.length > 0) process.exitCode = 1;
  } catch (error: unknown) {
    process.stderr.write(`scope audit failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('/phase35-scope-audit.ts') === true) main();
