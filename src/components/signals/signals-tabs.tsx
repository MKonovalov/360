'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignalFilters } from './signal-filters';
import { SignalForm } from './signal-form';
import { SignalTable, CompanySignalRow, PersonaSignalRow } from './signal-table';

export interface SignalsTabsProps {
  companySignals: CompanySignalRow[];
  personaSignals: PersonaSignalRow[];
  hasActiveFilters: boolean;
  practiceAreas: Array<{ id: number; name: string }>;
  buyerRoles: Array<{ id: number; name: string }>;
  companyCategories: string[];
  personaCategories: string[];
  activeOfferingsByPracticeAreaId: Record<number, Array<{ id: number; name: string }>>;
  offeringNamesById: Record<number, string>;
  companyLinkedOfferingIdsByRowId: Record<number, number[]>;
  personaLinkedOfferingIdsByRowId: Record<number, number[]>;
}

export function SignalsTabs({
  companySignals,
  personaSignals,
  hasActiveFilters,
  practiceAreas,
  buyerRoles,
  companyCategories,
  personaCategories,
  activeOfferingsByPracticeAreaId,
  offeringNamesById,
  companyLinkedOfferingIdsByRowId,
  personaLinkedOfferingIdsByRowId,
}: SignalsTabsProps) {
  return (
    <Tabs defaultValue="company" className="w-full">
      <TabsList>
        <TabsTrigger value="company">Company Signals</TabsTrigger>
        <TabsTrigger value="persona">Persona Signals</TabsTrigger>
      </TabsList>

      <TabsContent value="company" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SignalFilters practiceAreas={practiceAreas} categories={companyCategories} />
          <SignalForm
            signalKind="company"
            mode="create"
            practiceAreas={practiceAreas}
            buyerRoles={buyerRoles}
            categories={companyCategories}
            activeOfferingsByPracticeAreaId={activeOfferingsByPracticeAreaId}
            trigger={<Button variant="default">New Company Signal</Button>}
          />
        </div>
        <SignalTable
          signalKind="company"
          rows={companySignals}
          hasActiveFilters={hasActiveFilters}
          practiceAreas={practiceAreas}
          buyerRoles={buyerRoles}
          categories={companyCategories}
          activeOfferingsByPracticeAreaId={activeOfferingsByPracticeAreaId}
          offeringNamesById={offeringNamesById}
          linkedOfferingIdsByRowId={companyLinkedOfferingIdsByRowId}
        />
      </TabsContent>

      <TabsContent value="persona" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SignalFilters practiceAreas={practiceAreas} categories={personaCategories} />
          <SignalForm
            signalKind="persona"
            mode="create"
            practiceAreas={practiceAreas}
            buyerRoles={buyerRoles}
            categories={personaCategories}
            activeOfferingsByPracticeAreaId={activeOfferingsByPracticeAreaId}
            trigger={<Button variant="default">New Persona Signal</Button>}
          />
        </div>
        <SignalTable
          signalKind="persona"
          rows={personaSignals}
          hasActiveFilters={hasActiveFilters}
          practiceAreas={practiceAreas}
          buyerRoles={buyerRoles}
          categories={personaCategories}
          activeOfferingsByPracticeAreaId={activeOfferingsByPracticeAreaId}
          offeringNamesById={offeringNamesById}
          linkedOfferingIdsByRowId={personaLinkedOfferingIdsByRowId}
        />
      </TabsContent>
    </Tabs>
  );
}
