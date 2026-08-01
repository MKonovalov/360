// Port of the AIRS Stage-8 validation gate rules (D-03) from the sibling
// standards repo (validate_report.py + airs-validation-rules.json), scoped to
// the hybrid proposal shape (D-01). Full-report rules (compliance_footer
// human approval, dissemination semantics) are intentionally NOT ported —
// approval here is per-proposal, not per-report (D-03).
//
// FAILS CLOSED: every rule returns a list of violations; validateRunArtifacts
// in validateReport.ts rejects when any rule reports a violation (Pitfall 4).
import { z } from 'zod';
import { reliabilitySchema, confidenceSchema, outputSchema } from '../agents/types';

// ── Hybrid artifact shapes (D-01) ─────────────────────────────────────────
// Single source of truth is src/lib/agents/types.ts (plan 09-01 L158) — the
// gate validates the SAME schemas the agent emits against. These shapes are
// re-exported here so this module's consumers (validateReport.ts, the rules
// below) keep one import surface; only the gate-specific verdict schema and
// RunArtifactsInput stay defined in this file.
export {
  signalTypeValues,
  signalStrengthValues,
  reliabilitySchema,
  confidenceSchema,
  proposalSignalSchema,
  evidenceAppendixSchema,
  outputSchema,
} from '../agents/types';
export type { EvidenceAppendix } from '../agents/types';

export const verdictSchema = z.enum(['active', 'emerging', 'no_intent']);
export type Verdict = z.infer<typeof verdictSchema>;

// The full artifact set the gate validates: agent output (outputSchema) plus
// the run record's lightweight verdict (D-04 — required by the
// empty_signals_implies_no_intent rule, mirroring validate_report.py §11).
export type RunArtifactsInput = z.infer<typeof outputSchema> & {
  verdict: Verdict;
};

// ── Ported rules (validate_report.py sections, hybrid analog) ─────────────
// Each rule is a pure function returning violations; empty array = pass.

// §5 every_citation_must_resolve — every proposal evidenceUrl must resolve to
// the evidenceAppendix. The appendix is derived server-side from REAL tool
// results (D-02), so the model cannot invent citations that pass (T-09-03).
// Resolution tolerates benign URL variance (scheme, query, fragment, case,
// trailing slash) AND the model extending a fetched URL with an extra path
// segment — observed live: Firecrawl returns …/714139/ but the model cites
// …/714139/trade lifted from snippet text. The REVERSE (citing a parent of a
// fetched URL) stays forbidden — it would let a bare section page or homepage
// resolve as a citation.
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return (u.host.toLowerCase() + u.pathname).replace(/\/+$/, '');
  } catch {
    return raw.toLowerCase().replace(/\/+$/, '');
  }
}

export function checkCitationsResolve(input: RunArtifactsInput): string[] {
  const appendix = input.evidenceAppendix.map((e) => normalizeUrl(e.url));
  const violations: string[] = [];
  input.proposals.forEach((p, i) => {
    const citation = normalizeUrl(p.evidenceUrl);
    const resolves = appendix.some((entry) => citation === entry || citation.startsWith(`${entry}/`));
    if (!resolves) {
      violations.push(
        `proposal[${i}].evidenceUrl: citation does not resolve to evidence_appendix (${p.evidenceUrl})`,
      );
    }
  });
  return violations;
}

// §4/§7 R/C enums in range — reliability R1|R2|R3, confidence C1|C2|C3.
export function checkRCEnumsInRange(input: RunArtifactsInput): string[] {
  const violations: string[] = [];
  input.proposals.forEach((p, i) => {
    if (!reliabilitySchema.safeParse(p.reliability).success) {
      violations.push(
        `proposal[${i}].reliability: invalid value ${String(p.reliability)} (expected R1|R2|R3)`,
      );
    }
    if (!confidenceSchema.safeParse(p.confidence).success) {
      violations.push(
        `proposal[${i}].confidence: invalid value ${String(p.confidence)} (expected C1|C2|C3)`,
      );
    }
  });
  return violations;
}

// §6 bluf_cannot_use_R3C3 — no R3·C3 pair on "strong" claims. In the hybrid
// shape, "strong" = proposals with strength 'high' (the analog of the BLUF's
// strongest evidence). Per AIRS Rule R1, R3·C3 may appear in the appendix but
// never as a strong claim.
export function checkNoR3C3OnStrongClaims(input: RunArtifactsInput): string[] {
  const violations: string[] = [];
  input.proposals.forEach((p, i) => {
    if (p.strength === 'high' && p.reliability === 'R3' && p.confidence === 'C3') {
      violations.push(
        `proposal[${i}]: claim rated R3.C3 not permitted on a strong (high-strength) claim`,
      );
    }
  });
  return violations;
}

// key_uncertainties non-empty — the run must surface what it does not know.
export function checkKeyUncertaintiesNonEmpty(input: RunArtifactsInput): string[] {
  if (input.keyUncertainties.length === 0) {
    return ['keyUncertainties: must not be empty'];
  }
  return [];
}

// §11 empty_signals_implies_no_intent — empty proposals require a no_intent
// verdict (the hybrid analog of "no signals present but verdict != no_intent").
export function checkEmptySignalsImpliesNoIntent(input: RunArtifactsInput): string[] {
  if (input.proposals.length === 0 && input.verdict !== 'no_intent') {
    return [
      `verdict: no proposals present but verdict is '${input.verdict}' (must be 'no_intent')`,
    ];
  }
  return [];
}
