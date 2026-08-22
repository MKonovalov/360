import { firstValue } from './companyFilters';

export const COMPANY_TABS = ['general', 'personas', 'knowledge', 'analysis'] as const;
export type CompanyTab = (typeof COMPANY_TABS)[number];

type RouteParams = Readonly<Record<string, string | string[] | undefined>>;

export function parseCompanyId(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined;

  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export function parseCompanyTab(raw: string | string[] | undefined): CompanyTab {
  const value = firstValue(raw);
  switch (value) {
    case 'general':
    case 'personas':
    case 'knowledge':
    case 'analysis':
      return value;
    default:
      return 'general';
  }
}

export function buildCompanyCanonicalPath(id: number, tab: CompanyTab): string {
  return tab === 'general' ? `/companies/${id}` : `/companies/${id}?tab=${tab}`;
}

export function buildCompanyLegacyRedirect(params: RouteParams): string | undefined {
  const id = parseCompanyId(firstValue(params.selected) ?? '');
  if (id === undefined) return undefined;

  return buildCompanyCanonicalPath(id, parseCompanyTab(params.tab));
}
