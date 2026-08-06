'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BuyerRolePanel, type BuyerRolePanelRole } from './buyer-role-panel';
import { OfferingsFilters } from './offerings-filters';
import { OfferingsMatrix, type OfferingsMatrixProps } from './offerings-matrix';
import { ServicePortfolio, type ServicePortfolioProps } from './service-portfolio';

// OFR-02: the two-tab shell (Service Portfolio | Matrix), reusing the vendored
// Tabs primitive exactly as SignalsTabs does (D-02) — no new tab component.
// This component is a pure prop pass-through wrapper: the page's server
// component does ALL data fetching and hands the fully-shaped props down. It
// never fetches or mutates anything itself.
//
// "Manage Buyer Roles" (OFR-06/D-05) renders top-right on BOTH tabs per
// UI-SPEC line 159, as two INDEPENDENT BuyerRolePanel instances (same props,
// separate Sheet open state) — the correct pattern for a trigger that opens a
// self-contained overlay, matching how SignalForm's "New X" triggers are
// independently instantiated per tab in signals-tabs.tsx.
export interface OfferingsTabsProps {
  // Service Portfolio tab — every hierarchy level across ALL practice areas.
  practiceAreas: ServicePortfolioProps['practiceAreas'];
  domainsByPracticeAreaId: ServicePortfolioProps['domainsByPracticeAreaId'];
  offeringsByDomainId: ServicePortfolioProps['offeringsByDomainId'];
  offeringsWithoutDomainByPracticeAreaId: ServicePortfolioProps['offeringsWithoutDomainByPracticeAreaId'];
  buyerRoles: BuyerRolePanelRole[];
  rankedBuyerRolesByOfferingId: ServicePortfolioProps['rankedBuyerRolesByOfferingId'];
  linkedSignalsByOfferingId: ServicePortfolioProps['linkedSignalsByOfferingId'];
  // Matrix tab — the page pre-computes the practice-area-scoped subset (GBS
  // default or the ?practiceArea= filter) and passes it down pre-scoped.
  matrixDomains: OfferingsMatrixProps['domains'];
  matrixOfferingsByDomainId: OfferingsMatrixProps['offeringsByDomainId'];
  matrixOfferingsWithoutDomain: OfferingsMatrixProps['offeringsWithoutDomainForPracticeArea'];
  triggersByOfferingId: OfferingsMatrixProps['triggersByOfferingId'];
  hasActiveFilters: boolean;
  hasAnyOfferingsForPracticeArea: boolean;
}

export function OfferingsTabs({
  practiceAreas,
  domainsByPracticeAreaId,
  offeringsByDomainId,
  offeringsWithoutDomainByPracticeAreaId,
  buyerRoles,
  rankedBuyerRolesByOfferingId,
  linkedSignalsByOfferingId,
  matrixDomains,
  matrixOfferingsByDomainId,
  matrixOfferingsWithoutDomain,
  triggersByOfferingId,
  hasActiveFilters,
  hasAnyOfferingsForPracticeArea,
}: OfferingsTabsProps) {
  return (
    <Tabs defaultValue="portfolio" className="w-full">
      <TabsList>
        <TabsTrigger value="portfolio">Service Portfolio</TabsTrigger>
        <TabsTrigger value="matrix">Matrix</TabsTrigger>
      </TabsList>

      <TabsContent value="portfolio" className="space-y-4">
        {/* Service Portfolio has no filter bar — the empty spacer div keeps the
            "Manage Buyer Roles" button top-right (UI-SPEC line 159). */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div />
          <BuyerRolePanel
            buyerRoles={buyerRoles}
            trigger={<Button variant="outline">Manage Buyer Roles</Button>}
          />
        </div>
        <ServicePortfolio
          practiceAreas={practiceAreas}
          domainsByPracticeAreaId={domainsByPracticeAreaId}
          offeringsByDomainId={offeringsByDomainId}
          offeringsWithoutDomainByPracticeAreaId={offeringsWithoutDomainByPracticeAreaId}
          buyerRoles={buyerRoles}
          rankedBuyerRolesByOfferingId={rankedBuyerRolesByOfferingId}
          linkedSignalsByOfferingId={linkedSignalsByOfferingId}
        />
      </TabsContent>

      <TabsContent value="matrix" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <OfferingsFilters practiceAreas={practiceAreas} />
          <BuyerRolePanel
            buyerRoles={buyerRoles}
            trigger={<Button variant="outline">Manage Buyer Roles</Button>}
          />
        </div>
        <OfferingsMatrix
          domains={matrixDomains}
          offeringsByDomainId={matrixOfferingsByDomainId}
          offeringsWithoutDomainForPracticeArea={matrixOfferingsWithoutDomain}
          buyerRoles={buyerRoles}
          rankedBuyerRolesByOfferingId={rankedBuyerRolesByOfferingId}
          triggersByOfferingId={triggersByOfferingId}
          hasActiveFilters={hasActiveFilters}
          hasAnyOfferingsForPracticeArea={hasAnyOfferingsForPracticeArea}
        />
      </TabsContent>
    </Tabs>
  );
}
