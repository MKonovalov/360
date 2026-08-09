'use client';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
export interface AnalysisMenuActionProps {
  readonly canAnalyze: boolean;
  readonly disabledReason: string;
  readonly onAnalyze: () => void;
}

export function analysisMenuLabel(canAnalyze: boolean, disabledReason: string): string {
  return canAnalyze ? 'Analyze' : `Analyze — ${disabledReason}`;
}

export function AnalysisMenuAction({
  canAnalyze,
  disabledReason,
  onAnalyze,
}: AnalysisMenuActionProps) {
  return (
    <DropdownMenuItem disabled={!canAnalyze} onSelect={onAnalyze}>
      {analysisMenuLabel(canAnalyze, disabledReason)}
    </DropdownMenuItem>
  );
}
