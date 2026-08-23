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
const boundedOpaqueString = (max: number) => z.string().trim().min(1).max(max);

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
      customAgentId: boundedOpaqueString(120),
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
    signalCategory: boundedOpaqueString(200),
    selection: arcAgentnetSelectionSchema,
    idempotencyKey: boundedOpaqueString(200),
  })
  .strict();

export type ArcAgentnetSubmitRequest = {
  readonly subject: { readonly type: ArcAgentnetSubjectType; readonly id: number };
  readonly practiceAreaId: number;
  readonly signalCategory: string;
  readonly selection: AgentSelection;
  readonly idempotencyKey: string;
};

// Re-exported so downstream Arc-agentnet contract modules (bounded
// payload, result projection) consume the partner client's own JSON
// value types instead of redeclaring them.
export type { ArcAgentnetJsonObject, ArcAgentnetJsonValue };
