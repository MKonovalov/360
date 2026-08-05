// Tooltip-label copy for the collapsed rail (D-08). The labels are contract-
// locked (10-UI-SPEC §Copywriting Contract — the reviews tooltip embeds the
// pending count only when it is positive), so the exact strings live here
// under Vitest — a drive-by wording edit in the sidebar can never silently
// break the copy contract. The routing-key union is reused from nav.ts for
// type-safe mapping.

import type { NavKey } from '@/lib/nav';

export function getCollapseToggleLabel(state: 'expanded' | 'collapsed'): 'Collapse' | 'Expand' {
  return state === 'collapsed' ? 'Expand' : 'Collapse';
}

export function getNavTooltipLabel(key: NavKey, pendingCount: number): string {
  if (key === 'reviews') return pendingCount > 0 ? `Reviews (${pendingCount})` : 'Reviews';
  return { start: 'Start', companies: 'Companies', personas: 'Key Personas', signals: 'Signals', settings: 'Settings' }[key];
}
