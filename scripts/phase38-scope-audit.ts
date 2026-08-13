import { main, runPhase38ScopeAudit } from '../src/lib/verification/phase38ScopeAudit';

export { runPhase38ScopeAudit };

if (process.argv[1]?.endsWith('phase38-scope-audit.ts')) main();
