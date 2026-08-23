import { z } from 'zod';

import type { AgentSelection, AnalysisSubjectType } from '@/components/analysis/analysisLauncherClient';
import type { ArcAgentnetJsonObject, ArcAgentnetJsonValue } from '@/lib/arc-agentnet/client';

// Company Analysis is the only Arc-agentnet-eligible subject. Binding the
// submit request's subject type to the existing AnalysisSubjectType union
// (rather than a bare 'company' literal) means removing 'company' from
// that union breaks this file at compile time instead of silently
// widening this contract to accept Persona requests.
type ArcAgentnetSubjectType = Extract<AnalysisSubjectType, 'company'>;
const ARC_AGENTNET_SUBJECT_TYPE: ArcAgentnetSubjectType = 'company';

const positiveIdSchema = z.number().int().positive();
// Opaque identities/categories the server re-resolves or scopes itself
// (customAgentId, signalCategory, idempotencyKey). Non-empty is the only
// structural requirement -- no `.trim()` (which would silently mutate a
// caller-controlled opaque value) and no invented length ceiling.
const nonEmptyOpaqueStringSchema = z.string().min(1);

// Mirrors AgentSelection's own fixed/custom discriminated shape exactly.
// Declared as its own schema (rather than z.custom<AgentSelection>()) so
// unknown keys and invalid values are rejected at parse time, not merely
// asserted away at the type level.
const arcAgentnetSelectionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('fixed'),
      templateVersionId: positiveIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('custom'),
      customAgentId: nonEmptyOpaqueStringSchema,
      templateVersionId: positiveIdSchema,
    })
    .strict(),
]);

// The browser may send only subject identity, Practice Area identity,
// Buying Signal Category, opaque template/custom identity, and an opaque
// idempotency key. No callback URLs, partner IDs, credentials,
// instructions, or transport configuration belong in this schema --
// unknown keys are rejected outright at every level, never silently
// stripped.
export const arcAgentnetSubmitRequestSchema = z
  .object({
    subject: z
      .object({
        type: z.literal(ARC_AGENTNET_SUBJECT_TYPE),
        id: positiveIdSchema,
      })
      .strict(),
    practiceAreaId: positiveIdSchema,
    signalCategory: nonEmptyOpaqueStringSchema,
    selection: arcAgentnetSelectionSchema,
    idempotencyKey: nonEmptyOpaqueStringSchema,
  })
  .strict();

export type ArcAgentnetSubmitRequest = {
  readonly subject: { readonly type: ArcAgentnetSubjectType; readonly id: number };
  readonly practiceAreaId: number;
  readonly signalCategory: string;
  readonly selection: AgentSelection;
  readonly idempotencyKey: string;
};

export interface BoundedCompanyProfile {
  readonly industry: string | null;
  readonly headcount: number | null;
  readonly headquarters: string | null;
  readonly description: string | null;
}

export type ResolvedCompanyProfile = Partial<BoundedCompanyProfile>;

export interface BoundedTemplateMetadata {
  readonly kind: 'fixed' | 'custom';
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly templateKey: string;
  readonly templateName: string;
  readonly templateVersion: number;
  readonly targetType: 'company';
  readonly customAgentId: string | null;
  readonly customAgentName: string | null;
  readonly customAgentVersion: number | null;
}

export type ResolvedTemplateMetadata = Omit<BoundedTemplateMetadata, 'customAgentId' | 'customAgentName' | 'customAgentVersion'> & {
  readonly customAgentId?: string | null;
  readonly customAgentName?: string | null;
  readonly customAgentVersion?: number | null;
};

export interface BoundedChecklistItem {
  readonly id: number;
  readonly label: string;
  readonly required: boolean;
}

export type BoundedArcAgentnetInput = {
  readonly schemaVersion: 1;
  readonly analysis: {
    readonly subjectType: 'company';
    readonly company: {
      readonly id: number;
      readonly name: string;
      readonly domain: string | null;
      readonly profile: BoundedCompanyProfile;
    };
    readonly practiceArea: { readonly id: number; readonly name: string; readonly shortCode: string };
    readonly buyingSignalCategory: string;
    readonly template: BoundedTemplateMetadata;
    readonly resolvedInstructions: string;
    readonly checklist: readonly BoundedChecklistItem[];
    readonly publicEvidenceUrls: readonly string[];
  };
};

export type ResolvedCompanyAnalysisForArcAgentnet = {
  readonly company: {
    readonly id: number;
    readonly name: string;
    readonly domain: string | null;
    readonly profile: ResolvedCompanyProfile;
  };
  readonly practiceArea: { readonly id: number; readonly name: string; readonly shortCode: string };
  readonly buyingSignalCategory: string;
  readonly template: ResolvedTemplateMetadata;
  readonly resolvedInstruction: string;
  readonly checklist: readonly BoundedChecklistItem[];
  readonly publicEvidenceUrls: readonly string[];
};

// Re-exported so downstream Arc-agentnet contract modules (bounded
// payload, result projection) consume the partner client's own JSON
// value types instead of redeclaring them.
export type { ArcAgentnetJsonObject, ArcAgentnetJsonValue };
