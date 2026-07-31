// Port of the AIRS Stage-8 validation gate rules (D-03) from the sibling
// standards repo (validate_report.py + airs-validation-rules.json), scoped to
// the hybrid proposal shape (D-01). Full-report rules (compliance_footer
// human approval, dissemination semantics) are intentionally NOT ported —
// approval here is per-proposal, not per-report (D-03).
//
// FAILS CLOSED: every rule returns a list of violations; validateRunArtifacts
// in validateReport.ts rejects when any rule reports a violation (Pitfall 4).
import { z } from 'zod';

// ── Hybrid artifact shapes (D-01) ─────────────────────────────────────────
// Single source of truth moves to src/lib/agents/types.ts in Task 4; these
// definitions mirror the RESEARCH.md L349-361 sketch + Task 4 types contract.
export const signalTypeValues = [
  'cost_pressure',
  'immature_gbs_org',
  'new_cfo_or_gbs_head',
  'transformation_announcement',
] as const;
export const signalStrengthValues = ['low', 'medium', 'high'] as const;
export const reliabilitySchema = z.enum(['R1', 'R2', 'R3']);
export const confidenceSchema = z.enum(['C1', 'C2', 'C3']);
export const verdictSchema = z.enum(['active', 'emerging', 'no_intent']);
export type Verdict = z.infer<typeof verdictSchema>;

export const proposalSignalSchema = z.object({
  signalType: z.enum(signalTypeValues),
  strength: z.enum(signalStrengthValues),
  detectedAt: z.string(), // ISO date
  evidenceUrl: z.string().url(),
  reliability: reliabilitySchema,
  confidence: confidenceSchema,
  evidenceSnippet: z.string(),
  reasoning: z.string(),
});

export const evidenceAppendixSchema = z.array(
  z.object({
    url: z.string().url(),
    title: z.string(),
    snippet: z.string(),
  }),
);
export type EvidenceAppendix = z.infer<typeof evidenceAppendixSchema>;

export const outputSchema = z.object({
  proposals: z.array(proposalSignalSchema).min(0),
  keyUncertainties: z.array(z.string()),
  evidenceAppendix: evidenceAppendixSchema,
});

// The full artifact set the gate validates: agent output (outputSchema) plus
// the run record's lightweight verdict (D-04 — required by the
// empty_signals_implies_no_intent rule, mirroring validate_report.py §11).
export type RunArtifactsInput = z.infer<typeof outputSchema> & {
  verdict: Verdict;
};

// ── Ported rules (validate_report.py sections, hybrid analog) ─────────────
// Each rule is a pure function returning violations; empty array = pass.

// §5 every_citation_must_resolve — every proposal evidenceUrl must appear in
// the evidenceAppendix. The appendix is derived server-side from REAL tool
// results (D-02), so the model cannot invent citations that pass (T-09-03).
export function checkCitationsResolve(input: RunArtifactsInput): string[] {
  const appendixUrls = new Set(input.evidenceAppendix.map((e) => e.url));
  const violations: string[] = [];
  input.proposals.forEach((p, i) => {
    if (!appendixUrls.has(p.evidenceUrl)) {
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
