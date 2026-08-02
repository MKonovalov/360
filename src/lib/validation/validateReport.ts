// AIRS validation gate (fails closed) — D-03 port of the sibling standards
// Stage-8 gate (validate_report.py), scoped to the hybrid proposal shape
// (D-01). Runs every ported rule and rejects on ANY violation (Pitfall 4):
// never warnings-then-accept.
import {
  checkCitationsResolve,
  checkRCEnumsInRange,
  checkNoR3C3OnStrongClaims,
  checkKeyUncertaintiesNonEmpty,
  checkEmptySignalsImpliesNoIntent,
  type RunArtifactsInput,
} from './airsRules';

export interface GateResult {
  valid: boolean;
  errors: string[];
}

export function validateRunArtifacts(input: RunArtifactsInput): GateResult {
  const errors: string[] = [
    ...checkCitationsResolve(input),
    ...checkRCEnumsInRange(input),
    ...checkNoR3C3OnStrongClaims(input),
    ...checkKeyUncertaintiesNonEmpty(input),
    ...checkEmptySignalsImpliesNoIntent(input),
  ];
  return { valid: errors.length === 0, errors };
}
