import { isPrivateOrUnsafeSourceHost, type SearchMatch } from './contracts';
import type { NormalizedSearchCandidate, NormalizedSearchSource } from './normalizeSearchPacket';
import type { EvidencePolicy } from './templateContracts';

export type SearchEvidencePolicy = EvidencePolicy;

export interface SearchEvidenceCandidate extends NormalizedSearchCandidate {
  readonly match?: SearchMatch;
}

export interface SearchEligibility {
  readonly status: 'pending' | 'inconclusive' | 'ambiguous_match';
  readonly eligible: boolean;
  readonly deficiencies: readonly string[];
}

function isCountableSource(source: NormalizedSearchSource, policy: SearchEvidencePolicy): boolean {
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return false;
  }
  if (policy.allowedSourceKinds.length > 0 && !policy.allowedSourceKinds.includes(source.kind)) return false;
  if (policy.requireHttps && url.protocol !== 'https:') return false;
  if (!policy.allowPrivateSources && isPrivateOrUnsafeSourceHost(url.hostname)) return false;
  return source.isPublicHttps || policy.allowPrivateSources;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function ambiguousDeficiency(match: Extract<SearchMatch, { kind: 'ambiguous' }>): string {
  return `ambiguous_match:${match.matchedBy}:${[...match.personaIds].sort((left, right) => left - right).join(',')}`;
}

export function evaluateSearchEvidence(
  candidate: SearchEvidenceCandidate,
  evidencePolicy: SearchEvidencePolicy,
  resolvedRuleIds: readonly string[],
): SearchEligibility {
  if (candidate.match?.kind === 'ambiguous') {
    return {
      status: 'ambiguous_match',
      eligible: false,
      deficiencies: [ambiguousDeficiency(candidate.match)],
    };
  }

  const deficiencies: string[] = [];
  const countableSources = candidate.sources.filter((source) => isCountableSource(source, evidencePolicy));
  const uniqueSourceUrls = new Set(countableSources.map((source) => source.url));
  if (
    uniqueSourceUrls.size === 0 &&
    candidate.sources.length > 0 &&
    evidencePolicy.minimumPublicSources > 0 &&
    evidencePolicy.allowedSourceKinds.length > 0
  ) {
    deficiencies.push('no_allowed_public_sources');
  } else if (uniqueSourceUrls.size < evidencePolicy.minimumPublicSources) {
    deficiencies.push(`insufficient_public_sources:${evidencePolicy.minimumPublicSources}`);
  }

  const proposedRuleIds = new Set(candidate.buyerRoleProposals.flatMap((proposal) => proposal.matchedRuleIds));
  for (const ruleId of resolvedRuleIds) {
    if (!proposedRuleIds.has(ruleId)) deficiencies.push(`missing_required_rule:${ruleId}`);
  }

  const countableSourceIds = new Set(countableSources.map((source) => source.sourceId));
  for (const claim of candidate.claims) {
    if (!claim.supported) {
      deficiencies.push(`unsupported_claim:${claim.claimId}`);
      continue;
    }
    if (!claim.verified) {
      deficiencies.push(`unverified_claim:${claim.claimId}`);
      continue;
    }
    if (!claim.sourceIds.some((sourceId) => countableSourceIds.has(sourceId))) {
      deficiencies.push(`claim_without_eligible_source:${claim.claimId}`);
    }
  }

  const stableDeficiencies = uniqueSorted(deficiencies);
  return {
    status: stableDeficiencies.length === 0 ? 'pending' : 'inconclusive',
    eligible: stableDeficiencies.length === 0,
    deficiencies: stableDeficiencies,
  };
}
