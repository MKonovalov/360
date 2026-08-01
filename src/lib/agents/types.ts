import { z } from 'zod';

// Single source of truth for the agent's structured-output shapes (D-01).
// airsRules.ts re-exports these (plan 09-01 L158 — keep ONE source of truth
// in types.ts); the gate validates the SAME schemas the model emits against.
export const signalTypeValues = [
  'cost_pressure',
  'immature_gbs_org',
  'new_cfo_or_gbs_head',
  'transformation_announcement',
] as const;
export const signalStrengthValues = ['low', 'medium', 'high'] as const;
export const reliabilitySchema = z.enum(['R1', 'R2', 'R3']);
export const confidenceSchema = z.enum(['C1', 'C2', 'C3']);

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
export type ProposalSignal = z.infer<typeof proposalSignalSchema>;

// Model-facing appendix shape (D-02: the model's recited appendix is always
// DISCARDED — the gate validates the server-derived one below).
export const evidenceAppendixSchema = z.array(
  z.object({
    url: z.string().url(),
    title: z.string(),
    snippet: z.string(),
  }),
);
export type EvidenceAppendix = z.infer<typeof evidenceAppendixSchema>;

// T-09-08: retention tags on derived appendix entries — classified server-side
// by host (personal-data platforms vs public business info). Required on the
// derived shape so an untagged entry can never reach agent_run.evidence_appendix.
export const retentionTagSchema = z.enum(['public_biz', 'personal_data']);
export const derivedEvidenceAppendixSchema = z.array(
  evidenceAppendixSchema.element.extend({ retentionTag: retentionTagSchema }),
);
export type DerivedEvidenceAppendix = z.infer<typeof derivedEvidenceAppendixSchema>;

// D-02: evidenceAppendix is populated server-side from REAL webSearch tool
// results (never model-recited) — the every_citation_must_resolve gate checks
// proposal evidenceUrls against it (T-09-03).
export const outputSchema = z.object({
  proposals: z.array(proposalSignalSchema).min(0),
  keyUncertainties: z.array(z.string()),
  evidenceAppendix: evidenceAppendixSchema,
});
export type RunOutput = z.infer<typeof outputSchema>;

// Minimal structural company shape the agent seam consumes. DB $inferSelect
// rows satisfy this via structural typing (id/name are the only required
// fields; the rest feed prompt context only).
export interface CompanyInput {
  id: number;
  name: string;
  domain?: string | null;
  industry?: string | null;
  hqLocation?: string | null;
  employeeCountBand?: string | null;
  revenueBand?: string | null;
  ownershipType?: string | null;
  techStack?: string[] | null;
}

// Minimal live-signal shape the dedup/prompt seams consume (D-11/ANLZ-05).
// Callers pass rows pre-scoped to the company (listSignalsForCompany), so the
// (companyId, signalType) key reduces to signalType here.
export interface LiveSignalInput {
  signalType: string;
}
