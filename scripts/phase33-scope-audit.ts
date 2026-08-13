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

export const PHASE33_HISTORICAL_REFS = {
  targetRef: 'b40502c42c3a0ae3a69c7ce926438fe7fe0b1d43',
  baseRef: '711ca8fd826fd831624ad444f62ab0385be3367e',
} as const satisfies HistoricalScopeRefs;

const FORBIDDEN_MANIFEST_PACKAGE_PATTERN = /["'](?:@[^"']+\/)?(?:exa(?:-search|-sdk|-js)?|perplexity|tavily|serpapi|brave-search|google-generative-ai)["']\s*:/i;
const FORBIDDEN_IMPORT_PATTERN = /(?:from|import\s*\()\s*['"][^'"]*(?:exa|perplexity|tavily|serpapi|brave-search|google-generative-ai)/i;
const LEGACY_WRITE_PATTERN = /(?:insert|update|delete|values|set)\s*\([^\n]*(?:agent_run|signal_proposal)|(?:agent_run|signal_proposal)[^\n]*(?:insert|update|delete|values|set)/i;
const LATER_PHASE_IMPORT_PATTERN = /(?:from|import\s*\()\s*['"][^'"]*(?:reviews?|candidates?|template-management|bulk|schedule|scheduled|phase-35|phase-36)/i;
const LATER_PHASE_WRITE_PATTERN = /(?:insert|update|delete|values|set)\s*\([^\n]*(?:review|candidate|signal[_-]?offering|company[_-]?signal|persona[_-]?signal|offering)|(?:review|candidate|signal[_-]?offering|company[_-]?signal|persona[_-]?signal|offering)[^\n]*(?:insert|update|delete|values|set)/i;
const PRIVATE_REASONING_PATTERN = /(?:persist|insert|values|set|telemetry|metadata|audit)[^\n]{0,120}(?:chain[-_ ]of[-_ ]thought|private reasoning|private_reasoning)|(?:chain[-_ ]of[-_ ]thought|private reasoning|private_reasoning)[^\n]{0,120}(?:persist|insert|values|set|telemetry|metadata|audit)/i;

const PRODUCTION_PHASE33_PATHS = [
  'src/lib/analysis/',
  'src/lib/db/analysisResults',
  'src/lib/db/queries/analysisResults',
  'src/lib/telemetry/langfuse',
  'src/lib/agents/runAgent',
  'src/lib/agents/tools',
  'src/lib/agents/modelFactory',
  'src/workflows/analysisRun',
  'src/app/api/analysis-runs/',
] as const;

function trackedFiles(source: ScopeSource): readonly string[] {
  return source.files.filter((filePath) => {
      const isSource = /^(src|scripts)\//.test(filePath) && /\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(filePath);
      const isManifest = /^(package(?:-lock)?\.json|tsconfig[^/]*\.json|drizzle\.config\.[^/]+|vitest[^/]*\.[^/]+)$/.test(filePath);
      return isSource || isManifest;
  });
}

function isProductionPhase33Path(filePath: string): boolean {
  return PRODUCTION_PHASE33_PATHS.some((prefix) => filePath.startsWith(prefix)) && !filePath.endsWith('.test.ts');
}

function addFinding(findings: ScopeAuditFinding[], category: string, file: string, detail: string): void {
  findings.push({ category, file, detail });
}

export function runScopeAudit(
  rootDir: string,
  mode: ScopeAuditMode = SCOPE_AUDIT_MODES.historical,
): ScopeAuditResult {
  const source = createScopeSource(rootDir, mode, PHASE33_HISTORICAL_REFS);
  const files = trackedFiles(source);
  const findings: ScopeAuditFinding[] = [];
  const scannedCategories = new Set<string>();

  for (const filePath of files) {
    const fileSource = source.readFile(filePath);
    const isManifest = /^(package(?:-lock)?\.json|tsconfig[^/]*\.json|drizzle\.config\.[^/]+|vitest[^/]*\.[^/]+)$/.test(filePath);
    const isSource = filePath.startsWith('src/') && /\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(filePath);
    const isScript = filePath.startsWith('scripts/');
    if (isSource) scannedCategories.add('source');
    if (isScript) scannedCategories.add('scripts');
    if (isManifest) scannedCategories.add('manifests');
    if (filePath.includes('/db/schema') || filePath.includes('/db/queries/')) scannedCategories.add('schema/query');

    if (isManifest && FORBIDDEN_MANIFEST_PACKAGE_PATTERN.test(fileSource)) {
      addFinding(findings, 'provider/package', filePath, 'forbidden external provider or SDK token');
    }
    if (FORBIDDEN_IMPORT_PATTERN.test(fileSource)) {
      addFinding(findings, 'provider/import', filePath, 'forbidden external provider import');
    }

    if (!isProductionPhase33Path(filePath)) continue;
    if (LEGACY_WRITE_PATTERN.test(fileSource)) {
      addFinding(findings, 'legacy-write', filePath, 'legacy agent_run or signal_proposal write');
    }
    if (LATER_PHASE_IMPORT_PATTERN.test(fileSource)) {
      addFinding(findings, 'later-phase-surface', filePath, 'review, candidate, bulk, scheduled, or later-phase surface');
    }
    if (LATER_PHASE_WRITE_PATTERN.test(fileSource)) {
      addFinding(findings, 'direct-write', filePath, 'review, candidate, Signal, or Offering write');
    }
    if (PRIVATE_REASONING_PATTERN.test(fileSource)) {
      addFinding(findings, 'private-reasoning', filePath, 'private reasoning or chain-of-thought persistence marker');
    }
  }

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
  const mode = process.argv.includes('--working-tree')
    ? SCOPE_AUDIT_MODES.workingTree
    : SCOPE_AUDIT_MODES.historical;
  const result = runScopeAudit(process.cwd(), mode);
  const summary = {
    mode: result.mode,
    targetRef: result.targetRef,
    baseRef: result.baseRef,
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

if (process.argv[1]?.endsWith('/phase33-scope-audit.ts') === true) main();
