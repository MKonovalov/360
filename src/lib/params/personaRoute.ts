import { firstValue } from './companyFilters';

export const PERSONA_TABS = ['general', 'knowledge', 'analysis'] as const;
export type PersonaTab = (typeof PERSONA_TABS)[number];

type RouteParams = Readonly<Record<string, string | string[] | undefined>>;

export function parsePersonaId(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined;

  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export function parsePersonaTab(raw: string | string[] | undefined): PersonaTab {
  const value = firstValue(raw);
  switch (value) {
    case 'general':
    case 'knowledge':
    case 'analysis':
      return value;
    default:
      return 'general';
  }
}

export function buildPersonaCanonicalPath(id: number, tab: PersonaTab): string {
  return tab === 'general' ? `/personas/${id}` : `/personas/${id}?tab=${tab}`;
}

export function buildPersonaLegacyRedirect(params: RouteParams): string | undefined {
  const id = parsePersonaId(firstValue(params.selected) ?? '');
  if (id === undefined) return undefined;

  return buildPersonaCanonicalPath(id, parsePersonaTab(params.tab));
}
