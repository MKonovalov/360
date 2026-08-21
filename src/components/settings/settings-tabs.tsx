'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SettingsTabs({
  modelSettings,
  dataSources,
  canUseDebugLaunches = false,
  debugSettings = null,
}: {
  readonly modelSettings: ReactNode;
  readonly dataSources: ReactNode;
  readonly canUseDebugLaunches?: boolean;
  readonly debugSettings?: ReactNode;
}) {
  return (
    <Tabs defaultValue="models" className="min-w-0 gap-6">
      <TabsList
        variant="line"
        className="max-w-full flex-wrap max-sm:h-auto max-sm:w-full max-sm:flex-col max-sm:items-stretch"
        aria-label="Settings sections"
      >
        <TabsTrigger
          value="models"
          className="max-sm:h-auto max-sm:w-full max-sm:justify-start"
        >
          AI Models
        </TabsTrigger>
        <TabsTrigger
          value="data-sources"
          className="max-sm:h-auto max-sm:w-full max-sm:justify-start"
        >
          Data Sources
        </TabsTrigger>
        {canUseDebugLaunches ? (
          <TabsTrigger
            value="debug"
            className="max-sm:h-auto max-sm:w-full max-sm:justify-start"
          >
            Debug
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="models">{modelSettings}</TabsContent>
      <TabsContent value="data-sources">{dataSources}</TabsContent>
      {canUseDebugLaunches ? (
        <TabsContent value="debug">
          {debugSettings}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
