import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// Phase 37 scans only its selected tracked implementation scope. Tests and
// planning history are intentionally excluded: they describe later-phase
// boundaries, while this gate protects the shipped application surface.
const phase37ImplementationFiles = [
  'drizzle/0007_custom_agent_definition.sql',
  'src/lib/analysis/capabilityPresets.ts',
  'src/lib/analysis/customAgentContracts.ts',
  'src/lib/analysis/templateContracts.ts',
  'src/lib/db/schema.ts',
  'src/lib/db/queries/analysisTemplates.ts',
  'src/lib/db/queries/customAgents.ts',
  'src/app/actions/analysisTemplates.ts',
  'src/app/(dashboard)/agents/page.tsx',
  'src/components/agents/agent-management.tsx',
  'src/components/agents/custom-agent-card.tsx',
  'src/components/agents/custom-agent-editor.tsx',
  'src/components/agents/structured-output-editor.tsx',
  'src/components/agents/capability-preset-card.tsx',
] as const;

const requiredCanaries = {
  'src/lib/analysis/customAgentContracts.ts': ['customAgentCreateSchema', 'customAgentVersionSchema'],
  'src/lib/analysis/capabilityPresets.ts': ['CAPABILITY_PRESETS', 'validateCapabilitySelection'],
  'src/lib/analysis/templateContracts.ts': ['FIXED_ANALYSIS_TEMPLATES'],
  'src/lib/db/queries/customAgents.ts': ['listManagedCustomAgents', 'createCustomAgent', 'saveCustomAgentVersion', 'setCustomAgentStatus'],
  'src/app/actions/analysisTemplates.ts': ['createCustomAgentAction', 'saveCustomAgentAction', 'setCustomAgentStatusAction'],
  'src/components/agents/agent-management.tsx': ['AgentTemplateCard', 'Custom Agents'],
  'src/components/agents/custom-agent-editor.tsx': ['createCustomAgentAction', 'practiceAreaId'],
  'drizzle/0007_custom_agent_definition.sql': ['analysis_template_kind', 'practice_area_id'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

const forbiddenSurfaces = [
  { label: 'new provider or Exa surface', pattern: /\b(?:exa|OPENROUTER|NOUSRESEARCH|OPENCODE|Firecrawl)\b/gi },
  { label: 'runtime/provider resolution', pattern: /(?:modelFactory|resolveModelChain|createAnalysisRun|executeGroundedAnalysis)/g },
  { label: 'preview, launch, or run creation', pattern: /(?:\/api\/analysis-(?:preview|runs)|startAnalysis|launchAnalysis|createRun\b)/g },
  { label: 'workflow, review, evidence, or candidate behavior', pattern: /(?:from ['"][^'"]*(?:workflow|analysisReviews|confirmedCandidates|analysisResults)[^'"]*['"]|reconcileCompletedRun|confirmedCandidates|analysisResult\b)/g },
  { label: 'forbidden management controls', pattern: /(?:\/reviews\/agents|\b(?:clone|cloning|fork|forking|hardDelete|deleteAgent|RBAC|credential(?:Id|s)?)\b)/gi },
  { label: 'analysis-run mutation', pattern: /(?:\b(?:INSERT|UPDATE|DELETE)\b[\s\S]{0,160}\banalysis_run\b|\banalysis_run\b[\s\S]{0,160}\b(?:INSERT|UPDATE|DELETE)\b)/gi },
] as const;

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

const findings: string[] = [];
const scannedFiles: string[] = [];

for (const relativePath of phase37ImplementationFiles) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    findings.push(`${relativePath}: selected Phase 37 implementation file is missing`);
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
}

for (const [relativePath, canaries] of Object.entries(requiredCanaries)) {
  const source = readFileSync(join(root, relativePath), 'utf8');
  for (const canary of canaries) {
    if (!source.includes(canary)) findings.push(`${relativePath}: required canary missing: ${canary}`);
  }
}

const report = {
  phase: 37,
  scannedFiles,
  findingCount: findings.length,
  findings,
  handoff: {
    phase38: 'Consumes the normalized immutable custom version read model; runtime resolution and execution remain out of Phase 37.',
    phase39: 'Owns adversarial, review-boundary, confirmed-only, and authenticated E2E proof.',
  },
};

console.log(JSON.stringify(report, null, 2));
if (findings.length > 0) process.exitCode = 1;
