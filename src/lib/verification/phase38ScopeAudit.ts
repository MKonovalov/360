import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// Phase 38 scans only its selected tracked implementation scope — the fixed/
// custom execution-compatibility surface built across Plans 38-01..38-05.
// Tests, planning history, and the audit script itself are intentionally
// excluded: they describe later-phase boundaries or verification tooling,
// while this gate protects the shipped compatibility/execution surface.
const phase38ImplementationFiles = [
  'src/lib/analysis/contracts.ts',
  'src/lib/analysis/experienceContracts.ts',
  'src/lib/analysis/snapshots.ts',
  'src/lib/analysis/customAgentContracts.ts',
  'src/lib/analysis/compatibility.ts',
  'src/lib/analysis/subjects.ts',
  'src/lib/db/queries/customAgents.ts',
  'src/app/api/analysis-options/route.ts',
  'src/app/api/analysis-preview/route.ts',
  'src/app/api/analysis-runs/route.ts',
  'src/components/analysis/analysisLauncherClient.ts',
  'src/components/analysis/AnalysisLauncher.tsx',
  'src/lib/analysis/execution.ts',
  'src/lib/analysis/groundedContracts.ts',
  'src/lib/analysis/results.ts',
  'src/workflows/analysisRun.ts',
  'src/lib/db/queries/analysisResults.ts',
] as const;

// phase38Fixtures.ts (a real Plan 38-05 file) is currently untracked in this
// workspace; "tracked scope" excludes it rather than treating an uncommitted
// file as audited. Its untracked state is recorded in 38-VERIFICATION.md.

// Positive canaries prove the required Phase 38 seams are present rather than
// merely absent-of-forbidden-content (a vacuous audit would pass on an empty
// file). Each canary names an existing symbol/seam the plan requires: one
// GroundedExecutionAdapter, the existing analysisRun(applicationRunId)
// workflow entry, existing packet/evidence normalization and persistence,
// existing review/candidate seams (reused, not reimplemented), and
// server-owned provider/tool resolution (modelFactory/resolveModelChain).
const requiredCanaries = {
  'src/lib/analysis/execution.ts': ['class GroundedExecutionAdapter', "from '@/lib/agents/modelFactory'"],
  'src/workflows/analysisRun.ts': [
    'export async function analysisRun(applicationRunId: number)',
    'GroundedExecutionAdapter',
    'reconcileCompletedRunForReview',
    'persistAnalysisPacket',
  ],
  'src/lib/analysis/results.ts': ['normalizeAnalysisPacketWithCustomOutput', 'normalizeAnalysisPacket'],
  'src/lib/db/queries/analysisResults.ts': ['persistAnalysisPacket', 'prepareAnalysisPacket'],
  'src/lib/analysis/compatibility.ts': ['resolveAnalysisLaunch', 'analysisCompatibilityReasons'],
  'src/lib/analysis/customAgentContracts.ts': ['customAgentCreateSchema', 'customAgentVersionSchema'],
  'src/lib/analysis/groundedContracts.ts': ['validateCustomOutput', 'buildCustomOutputValueSchema'],
  'src/lib/analysis/experienceContracts.ts': ['confirmedCandidateDisplayRowSchema', 'analysisRunLaunchInputSchema'],
  'src/lib/db/queries/customAgents.ts': ['getActiveCustomAgentLaunchVersion', 'listActiveCustomAgentOptions'],
  'src/components/analysis/analysisLauncherClient.ts': ['fetchAnalysisOptions', 'createAnalysisRunPayload'],
  'src/components/analysis/AnalysisLauncher.tsx': ['export function AnalysisLauncher', 'analysisAgentSelection'],
  'src/lib/analysis/snapshots.ts': ['buildPhase33AnalysisSnapshots'],
  'src/lib/analysis/contracts.ts': ['PHASE33_STANDARD_APPROVED_POLICY', 'PHASE32_NOOP_POLICY'],
  'src/lib/analysis/subjects.ts': ['resolveAnalysisSubject', 'resolveActivePracticeArea'],
  'src/app/api/analysis-options/route.ts': ['export async function GET'],
  'src/app/api/analysis-preview/route.ts': ['export async function POST'],
  'src/app/api/analysis-runs/route.ts': ['export async function POST'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

// Function names already legitimately named "*Packet*" in the selected scope
// (the one real packet/evidence normalization and persistence path). Any
// other packet/ledger function definition inside scope is a second path.
const allowedPacketFunctionNames = new Set([
  'validateGroundedPacket',
  'normalizeAnalysisPacketInternal',
  'normalizeAnalysisPacket',
  'normalizeAnalysisPacketWithCustomOutput',
  'normalizeGroundedPacket',
  'persistGroundedPacket',
  'prepareAnalysisPacket',
  'retentionForPacket',
  'persistAnalysisPacket',
  'getAnalysisPacket',
]);

// The one execution adapter class already present in scope. Any other
// Executor/Queue/Ledger/ExecutionAdapter class definition is a second
// executor, queue, or run ledger.
const allowedExecutorClassNames = new Set(['GroundedExecutionAdapter']);

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

function isTracked(relativePath: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relativePath], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function findSecondPacketFunctions(relativePath: string, source: string): string[] {
  const findings: string[] = [];
  const pattern = /function\s+([A-Za-z0-9_]*[Pp]acket[A-Za-z0-9_]*)\s*\(/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    if (name && !allowedPacketFunctionNames.has(name)) {
      findings.push(`${relativePath}: second packet/evidence path function: ${name}`);
    }
  }
  return findings;
}

function findSecondExecutorClasses(relativePath: string, source: string): string[] {
  const findings: string[] = [];
  const pattern = /class\s+([A-Za-z0-9_]*(?:Executor|Queue|Ledger|ExecutionAdapter)[A-Za-z0-9_]*)/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    if (name && !allowedExecutorClassNames.has(name)) {
      findings.push(`${relativePath}: second executor/queue/run-ledger class: ${name}`);
    }
  }
  return findings;
}

const forbiddenSurfaces = [
  { label: 'new run-ledger table definition', pattern: /\bpgTable\(/g },
  {
    label: 'review/candidate route or table write',
    pattern: /(?:\/(?:api\/)?(?:analysis-review|candidates|reviews\/agents)\b|\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:analysis_review|confirmed_candidate)\b)/gi,
  },
  {
    label: 'arbitrary provider/tool/data source',
    pattern: /(?:from\s+['"](?:firecrawl|exa-js|@exa)['"]|\b(?:OPENROUTER_API_KEY|NOUSRESEARCH|OPENCODE_API_KEY|EXA_API_KEY)\b)/g,
  },
  { label: 'direct Signal/Offering/link write', pattern: /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:signal|offering|signal_offering_link)\b/gi },
  { label: 'bulk or scheduled execution', pattern: /\b(?:bulk|scheduled|cron)\b/gi },
  { label: 'global subject uniqueness', pattern: /ON\s+CONFLICT\s*\(\s*subject_type\s*,\s*subject_id\s*\)/gi },
] as const;

const findings: string[] = [];
const scannedFiles: string[] = [];

for (const relativePath of phase38ImplementationFiles) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    findings.push(`${relativePath}: selected Phase 38 implementation file is missing`);
    continue;
  }
  if (!isTracked(relativePath)) {
    findings.push(`${relativePath}: selected scope file is not tracked`);
    continue;
  }

  scannedFiles.push(relativePath);
  const source = stripComments(readFileSync(absolutePath, 'utf8'));

  for (const surface of forbiddenSurfaces) {
    if (surface.pattern.test(source)) {
      findings.push(`${relativePath}: forbidden ${surface.label}`);
    }
    surface.pattern.lastIndex = 0;
  }

  findings.push(...findSecondPacketFunctions(relativePath, source));
  findings.push(...findSecondExecutorClasses(relativePath, source));
}

for (const [relativePath, canaries] of Object.entries(requiredCanaries)) {
  const source = readFileSync(join(root, relativePath), 'utf8');
  for (const canary of canaries) {
    if (!source.includes(canary)) findings.push(`${relativePath}: required canary missing: ${canary}`);
  }
}

const report = {
  phase: 38,
  scannedFiles,
  findingCount: findings.length,
  findings,
  handoff: {
    phase39:
      'Owns broad adversarial verification, no-live-write invariants, whole-run review idempotency, confirmed-only candidate aggregation, canonical /agents routing, and authenticated Company/Persona custom-agent E2E. None of that is claimed by this audit.',
  },
};

console.log(JSON.stringify(report, null, 2));
if (findings.length > 0) process.exitCode = 1;
