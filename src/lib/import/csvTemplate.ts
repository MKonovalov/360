// CSV template generation for the Import wizard's "Download Template" button.
// Enum values are read directly from schema.ts — never hardcoded here — so
// the template can never drift from the DB schema by construction (IMPT-06).
import { stringify } from 'csv-stringify/sync';
import { revenueBandEnum, ownershipTypeEnum, seniorityEnum } from '@/lib/db/schema';

// Exact column order for the Company import template.
const COMPANY_HEADERS = [
  'name',
  'domain',
  'industry',
  'employee_count_band',
  'hq_location',
  'revenue_band',
  'ownership_type',
  'tech_stack',
];

// Exact column order for the Persona import template.
const PERSONA_HEADERS = [
  'name',
  'title',
  'seniority',
  'email',
  'linkedin_url',
];

// Generate a downloadable Company CSV template with one example row.
// Enum columns use the FIRST canonical value so the file is immediately
// valid if re-imported as-is. The full set of valid enum values is surfaced
// via enumHelpText() for wizard UI copy, not crammed into one CSV cell.
export function generateCompanyTemplate(): string {
  const exampleRow = {
    name: 'Acme Example Co',
    domain: 'acme-example.com',
    industry: 'Manufacturing',
    employee_count_band: '201-1000',
    hq_location: 'Chicago, USA',
    revenue_band: revenueBandEnum.enumValues[0],
    ownership_type: ownershipTypeEnum.enumValues[0],
    tech_stack: 'SAP ERP|Excel',
  };
  return stringify([exampleRow], { header: true, columns: COMPANY_HEADERS });
}

// Generate a downloadable Persona CSV template with one example row.
export function generatePersonaTemplate(): string {
  const exampleRow = {
    name: 'Jane Smith',
    title: 'VP of Finance',
    seniority: seniorityEnum.enumValues[0],
    email: 'jane.smith@acme-example.com',
    linkedin_url: 'https://linkedin.com/in/janesmith',
  };
  return stringify([exampleRow], { header: true, columns: PERSONA_HEADERS });
}

// Helper copy shown near the download link in the wizard UI — generated
// from the same schema arrays, so it can never drift from the DB schema.
export function enumHelpText(): {
  revenue_band: string;
  ownership_type: string;
  seniority: string;
} {
  return {
    revenue_band: `Valid values: ${revenueBandEnum.enumValues.join(', ')}`,
    ownership_type: `Valid values: ${ownershipTypeEnum.enumValues.join(', ')}`,
    seniority: `Valid values: ${seniorityEnum.enumValues.join(', ')}`,
  };
}
