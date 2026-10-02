'use client';

import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildPersonaCanonicalPath,
  PERSONA_TABS,
  type PersonaTab,
} from '@/lib/params/personaRoute';

const PERSONA_TAB_LABELS = {
  general: 'General',
  knowledge: 'Related Knowledge',
  analysis: 'Analysis',
} satisfies Readonly<Record<PersonaTab, string>>;

export function PersonaDetailTabs({
  id,
  activeTab,
}: {
  readonly id: number;
  readonly activeTab: PersonaTab;
}) {
  return (
    <nav aria-label="Persona detail sections">
      <Tabs value={activeTab} className="min-w-0 gap-6">
        <TabsList
          variant="line"
          className="max-w-full flex-wrap max-sm:h-auto max-sm:w-full max-sm:flex-col max-sm:items-stretch"
          aria-label="Persona detail sections"
        >
          {PERSONA_TABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              asChild
              className="max-sm:h-auto max-sm:w-full max-sm:justify-start"
            >
              <Link
                href={buildPersonaCanonicalPath(id, tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                aria-selected={activeTab === tab}
              >
                {PERSONA_TAB_LABELS[tab]}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
