'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SettingsTabs({
  modelSettings,
  dataSources,
}: {
  readonly modelSettings: ReactNode;
  readonly dataSources: ReactNode;
}) {
  return (
    <Tabs defaultValue="models" className="gap-6">
      <TabsList variant="line" aria-label="Settings sections">
        <TabsTrigger value="models">AI Models</TabsTrigger>
        <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
      </TabsList>
      <TabsContent value="models">{modelSettings}</TabsContent>
      <TabsContent value="data-sources">{dataSources}</TabsContent>
    </Tabs>
  );
}
