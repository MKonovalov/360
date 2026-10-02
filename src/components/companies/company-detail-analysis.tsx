import { AnalysisHistory } from '@/components/analysis/analysis-history';
import { SearchReviewQueue } from '@/components/search/SearchReviewQueue';
import type { SearchReviewRoleOption } from '@/components/search/SearchReviewEditor';
import type { SearchReviewProjection } from '@/lib/search/contracts';
import type { projectRunReviewCards } from '@/components/analysis/analysis-history';
import { ConfirmedCandidateOfferings } from '@/components/analysis/confirmed-candidate-offerings';
import type { listAnalysisRunsForSubject } from '@/lib/db/queries/analysisRuns';
import type { ArcAgentnetRunHistoryRow } from '@/lib/db/queries/arcAgentnetRuns';
import type { listConfirmedCandidateOfferingsForSubject } from '@/lib/db/queries/confirmedCandidates';

type AnalysisRuns = Awaited<ReturnType<typeof listAnalysisRunsForSubject>>;
type ReviewCards = Awaited<ReturnType<typeof projectRunReviewCards>>;
type CandidateOfferings = Awaited<ReturnType<typeof listConfirmedCandidateOfferingsForSubject>>;

export function CompanyDetailAnalysis({
  analysisRuns,
  reviewCards,
  confirmedCandidateOfferings,
  partnerRuns = [],
  searchReviews = [],
  searchRoleOptions = [],
  searchReviewLoadError = false,
}: {
  readonly analysisRuns: AnalysisRuns | null;
  readonly reviewCards: ReviewCards;
  readonly confirmedCandidateOfferings: CandidateOfferings | null;
  readonly partnerRuns?: readonly ArcAgentnetRunHistoryRow[];
  readonly searchReviews?: readonly SearchReviewProjection[];
  readonly searchRoleOptions?: readonly SearchReviewRoleOption[];
  readonly searchReviewLoadError?: boolean;
}) {
  return (
    <>
      <AnalysisHistory rows={analysisRuns} reviewCards={reviewCards} partnerRuns={partnerRuns} />
      <SearchReviewQueue reviews={searchReviews} roleOptions={searchRoleOptions} loadError={searchReviewLoadError} />
      <ConfirmedCandidateOfferings items={confirmedCandidateOfferings} />
    </>
  );
}
