import type { ProposalSignal } from '@/lib/agents/types';
import type { CanonicalSource, GroundedPacket } from '@/lib/analysis/groundedContracts';

const CONFIDENCE_TO_PROPOSAL = {
  low: 'C3',
  medium: 'C2',
  high: 'C1',
} as const;

// Public business sources are the strongest default, restricted sources are
// reviewable but less reproducible, and personal-data sources are the weakest
// proposal evidence. A no-source fallback is deliberately R3.
const SOURCE_CLASSIFICATION_TO_RELIABILITY = {
  public_biz: 'R1',
  restricted: 'R2',
  personal_data: 'R3',
} as const;

type ProposalDerivationInput = {
  readonly packet: GroundedPacket;
  readonly runId: number;
  readonly now?: Date;
};

function primarySourceForFinding(packet: GroundedPacket, findingId: string): CanonicalSource | undefined {
  const link = packet.links.find(
    (candidate) => candidate.findingId === findingId && candidate.supportRole === 'primary',
  );
  if (!link) return undefined;
  return packet.sources.find((source) => source.sourceId === link.sourceId);
}

function evidenceForFinding(
  packet: GroundedPacket,
  findingId: string,
  input: ProposalDerivationInput,
): Pick<ProposalSignal, 'detectedAt' | 'evidenceUrl' | 'evidenceSnippet' | 'reliability'> {
  const source = primarySourceForFinding(packet, findingId);
  if (source) {
    return {
      detectedAt: source.retrievedAt.slice(0, 10),
      evidenceUrl: source.canonicalUrl,
      evidenceSnippet: source.excerpt,
      reliability: SOURCE_CLASSIFICATION_TO_RELIABILITY[source.classification],
    };
  }

  // Proposal columns require non-null evidence even when a finding explicitly
  // has no source. Point reviewers to a stable run/finding location and make
  // the absence of source evidence explicit instead of inventing a citation.
  return {
    detectedAt: (input.now ?? new Date()).toISOString().slice(0, 10),
    evidenceUrl: `https://360.arclumenpartners.com/analysis-runs/${input.runId}/findings/${encodeURIComponent(findingId)}`,
    evidenceSnippet: 'No primary source was linked to this finding.',
    reliability: 'R3',
  };
}

export function deriveProposalsFromPacket(input: ProposalDerivationInput): ProposalSignal[] {
  return input.packet.findings.map((finding) => {
    const signalType = input.packet.targetType === 'company' ? 'cost_pressure' : 'immature_gbs_org';
    return {
      signalType,
      signalId: finding.identity.signalId,
      signalRecordType: input.packet.targetType,
      strength: finding.confidence,
      ...evidenceForFinding(input.packet, finding.findingId, input),
      confidence: CONFIDENCE_TO_PROPOSAL[finding.confidence],
      reasoning: finding.reasoningSummary ?? finding.claim,
      demonstrated: finding.status === 'strong' || finding.status === 'weak',
    };
  });
}
