import { AnalysisHistory } from '@/components/analysis/analysis-history';
import type { projectRunReviewCards } from '@/components/analysis/analysis-history';
import { ConfirmedCandidateOfferings } from '@/components/analysis/confirmed-candidate-offerings';
import type { listAnalysisRunsForSubject } from '@/lib/db/queries/analysisRuns';
import type { listConfirmedCandidateOfferingsForSubject } from '@/lib/db/queries/confirmedCandidates';

type AnalysisRuns = Awaited<ReturnType<typeof listAnalysisRunsForSubject>>;
type ReviewCards = Awaited<ReturnType<typeof projectRunReviewCards>>;
type CandidateOfferings = Awaited<ReturnType<typeof listConfirmedCandidateOfferingsForSubject>>;

export function CompanyDetailAnalysis({
  analysisRuns,
  reviewCards,
  confirmedCandidateOfferings,
}: {
  readonly analysisRuns: AnalysisRuns | null;
  readonly reviewCards: ReviewCards;
  readonly confirmedCandidateOfferings: CandidateOfferings | null;
}) {
  return (
    <>
      <AnalysisHistory rows={analysisRuns} reviewCards={reviewCards} />
      <ConfirmedCandidateOfferings items={confirmedCandidateOfferings} />
    </>
  );
}
