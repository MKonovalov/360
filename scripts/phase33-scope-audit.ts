import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

function isProductionPhase33Path(filePath: string): boolean {
  return PRODUCTION_PHASE33_PATHS.some((prefix) => filePath.startsWith(prefix)) && !filePath.endsWith('.test.ts');
}

function addFinding(findings: ScopeAuditFinding[], category: string, file: string, detail: string): void {
  findings.push({ category, file, detail });
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

    if (!isProductionPhase33Path(filePath)) continue;
    if (LEGACY_WRITE_PATTERN.test(source)) {
      addFinding(findings, 'legacy-write', filePath, 'legacy agent_run or signal_proposal write');
    }
    if (LATER_PHASE_IMPORT_PATTERN.test(source)) {
      addFinding(findings, 'later-phase-surface', filePath, 'review, candidate, bulk, scheduled, or later-phase surface');
    }
    if (LATER_PHASE_WRITE_PATTERN.test(source)) {
      addFinding(findings, 'direct-write', filePath, 'review, candidate, Signal, or Offering write');
    }
    if (PRIVATE_REASONING_PATTERN.test(source)) {
      addFinding(findings, 'private-reasoning', filePath, 'private reasoning or chain-of-thought persistence marker');
    }
  }

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

if (process.argv[1]?.endsWith('/phase33-scope-audit.ts') === true) main();
