import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export type Phase36ScopeFinding = Readonly<{
  readonly file: string;
  readonly rule: string;
}>;

const SELECTED_IMPLEMENTATION_FILES = [
  'src/lib/verification/phase36Fixtures.ts',
  'src/lib/verification/phase36Adversarial.integration.test.ts',
] as const;

const FORBIDDEN_PATTERNS = [
  { rule: 'nested_reviews_agents_route', pattern: /\/reviews\/agents/ },
  { rule: 'new_provider_or_firecrawl_import', pattern: /(?:from|require\()\s*['"](?:firecrawl|@ai-sdk\/)/ },
  { rule: 'direct_live_catalog_write', pattern: /(?:insert|update|delete)\s*\(?.*(?:signalOfferingLink|signal_offering_link|companySignal|personaSignal|offering)/is },
  { rule: 'packet_mutation', pattern: /(?:packet|resultPacket)\s*\.(?:findings|sources|links)\s*=/ },
  { rule: 'legacy_proposal_reuse', pattern: /(?:agent_run|signal_proposal)/ },
  { rule: 'client_secret_exposure', pattern: /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|KEY|DATABASE)/ },
] as const;

function tracked(path: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', path], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function runPhase36ScopeAudit(): readonly Phase36ScopeFinding[] {
  const findings: Phase36ScopeFinding[] = [];
  for (const file of SELECTED_IMPLEMENTATION_FILES) {
    if (!tracked(file) || !existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const check of FORBIDDEN_PATTERNS) {
      if (check.pattern.test(source)) findings.push({ file, rule: check.rule });
    }
  }
  return findings;
}

export function main(): void {
  const findings = runPhase36ScopeAudit();
  if (findings.length > 0) {
    for (const finding of findings) console.error(`${finding.file}: ${finding.rule}`);
    process.exitCode = 1;
    return;
  }
  console.log('Phase 36 scope audit: 0 findings (selected tracked implementation files only).');
}

if (process.argv[1]?.endsWith('phase36-scope-audit.ts')) main();
