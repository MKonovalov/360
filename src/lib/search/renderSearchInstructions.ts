import type { SearchCompanySnapshot } from '@/lib/db/schema';

const COMPANY_TOKEN = /<company\.[^<>\s]*>/u;

// Values land inside JSON string literals in the contract ("name": "<company.name>"),
// so escape as JSON string content; a quote or backslash must not break the block.
function jsonStringContent(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

// Returns undefined when any <company.*> token is left after rendering, so the
// caller fails closed instead of sending the partner an unrendered contract.
export function renderSearchInstructions(
  template: string,
  company: SearchCompanySnapshot,
): string | undefined {
  const rendered = template
    .replaceAll('"<company.domain>"', company.domain === null ? 'null' : `"${jsonStringContent(company.domain)}"`)
    .replaceAll('<company.id>', String(company.id))
    .replaceAll('<company.name>', jsonStringContent(company.name))
    .replaceAll('<company.domain>', company.domain === null ? 'unknown' : jsonStringContent(company.domain));
  return COMPANY_TOKEN.test(rendered) ? undefined : rendered;
}
