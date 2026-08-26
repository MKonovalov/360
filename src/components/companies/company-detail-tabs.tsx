'use client';

import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildCompanyCanonicalPath,
  COMPANY_TABS,
  type CompanyTab,
} from '@/lib/params/companyRoute';

const COMPANY_TAB_LABELS = {
  general: 'General',
  personas: 'Linked Personas',
  knowledge: 'Related Knowledge',
  analysis: 'Analysis',
} satisfies Readonly<Record<CompanyTab, string>>;

export function CompanyDetailTabs({
  id,
  activeTab,
}: {
  readonly id: number;
  readonly activeTab: CompanyTab;
  }) {
  return (
    <nav aria-label="Company detail sections">
      <Tabs value={activeTab} className="min-w-0 gap-6">
        <TabsList
          variant="line"
          className="max-w-full flex-wrap max-sm:h-auto max-sm:w-full max-sm:flex-col max-sm:items-stretch"
          aria-label="Company detail sections"
        >
        {COMPANY_TABS.map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            asChild
            className="max-sm:h-auto max-sm:w-full max-sm:justify-start"
          >
            <Link
              href={buildCompanyCanonicalPath(id, tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
              aria-selected={activeTab === tab}
            >
              {COMPANY_TAB_LABELS[tab]}
            </Link>
          </TabsTrigger>
        ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
