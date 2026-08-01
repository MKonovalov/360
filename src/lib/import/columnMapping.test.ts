import { describe, it, expect } from 'vitest';
import {
  normalizeHeader,
  suggestColumnMapping,
  suggestValueMapping,
  COMPANY_FIELD_ALIASES,
  PERSONA_FIELD_ALIASES,
  REVENUE_BAND_ALIASES,
  OWNERSHIP_TYPE_ALIASES,
  SENIORITY_ALIASES,
} from './columnMapping';

describe('normalizeHeader', () => {
  it('lowercases and trims', () => {
    expect(normalizeHeader('  Company Name  ')).toBe('company name');
  });

  it('collapses underscores to single space', () => {
    expect(normalizeHeader('company_name')).toBe('company name');
  });

  it('collapses hyphens to single space', () => {
    expect(normalizeHeader('company-name')).toBe('company name');
  });

  it('collapses repeated whitespace to single space', () => {
    expect(normalizeHeader('company  name')).toBe('company name');
  });

  it('company_name, Company Name, company  name all resolve identically', () => {
    const a = normalizeHeader('company_name');
    const b = normalizeHeader('Company Name');
    const c = normalizeHeader('company  name');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('handles mixed underscores, hyphens, and spaces', () => {
    expect(normalizeHeader('hq_location')).toBe('hq location');
    expect(normalizeHeader('hq-location')).toBe('hq location');
    expect(normalizeHeader('HQ Location')).toBe('hq location');
  });
});

describe('suggestColumnMapping — COMPANY_FIELD_ALIASES', () => {
  it('maps "Company Name" to "name"', () => {
    const result = suggestColumnMapping(['Company Name'], COMPANY_FIELD_ALIASES);
    expect(result['Company Name']).toBe('name');
  });

  it('maps "Website" to "domain"', () => {
    const result = suggestColumnMapping(['Website'], COMPANY_FIELD_ALIASES);
    expect(result['Website']).toBe('domain');
  });

  it('maps "Unknown Column" to null', () => {
    const result = suggestColumnMapping(['Unknown Column'], COMPANY_FIELD_ALIASES);
    expect(result['Unknown Column']).toBeNull();
  });

  it('maps a mix of known and unknown headers correctly', () => {
    const result = suggestColumnMapping(
      ['Company Name', 'Website', 'Unknown Column'],
      COMPANY_FIELD_ALIASES
    );
    expect(result['Company Name']).toBe('name');
    expect(result['Website']).toBe('domain');
    expect(result['Unknown Column']).toBeNull();
  });

  it('maps "Industry" to "industry"', () => {
    const result = suggestColumnMapping(['Industry'], COMPANY_FIELD_ALIASES);
    expect(result['Industry']).toBe('industry');
  });

  it('maps "Sector" to "industry"', () => {
    const result = suggestColumnMapping(['Sector'], COMPANY_FIELD_ALIASES);
    expect(result['Sector']).toBe('industry');
  });

  it('maps "Headcount" to "employee_count_band"', () => {
    const result = suggestColumnMapping(['Headcount'], COMPANY_FIELD_ALIASES);
    expect(result['Headcount']).toBe('employee_count_band');
  });

  it('maps "HQ Location" to "hq_location"', () => {
    const result = suggestColumnMapping(['HQ Location'], COMPANY_FIELD_ALIASES);
    expect(result['HQ Location']).toBe('hq_location');
  });

  it('maps "Revenue" to "revenue_band"', () => {
    const result = suggestColumnMapping(['Revenue'], COMPANY_FIELD_ALIASES);
    expect(result['Revenue']).toBe('revenue_band');
  });

  it('maps "Ownership" to "ownership_type"', () => {
    const result = suggestColumnMapping(['Ownership'], COMPANY_FIELD_ALIASES);
    expect(result['Ownership']).toBe('ownership_type');
  });

  it('maps "Tech Stack" to "tech_stack"', () => {
    const result = suggestColumnMapping(['Tech Stack'], COMPANY_FIELD_ALIASES);
    expect(result['Tech Stack']).toBe('tech_stack');
  });

  it('returns null for every header when aliases dict is empty', () => {
    const result = suggestColumnMapping(['Company Name', 'Website'], {});
    expect(result['Company Name']).toBeNull();
    expect(result['Website']).toBeNull();
  });

  it('returns empty object for empty headers array', () => {
    const result = suggestColumnMapping([], COMPANY_FIELD_ALIASES);
    expect(result).toEqual({});
  });

  it('does NOT do fuzzy matching — "Compny Name" (typo) maps to null', () => {
    const result = suggestColumnMapping(['Compny Name'], COMPANY_FIELD_ALIASES);
    expect(result['Compny Name']).toBeNull();
  });

  it('normalizes underscore-separated header before matching', () => {
    // "company_name" normalizes to "company name" which is in COMPANY_FIELD_ALIASES.name
    const result = suggestColumnMapping(['company_name'], COMPANY_FIELD_ALIASES);
    expect(result['company_name']).toBe('name');
  });
});

describe('suggestColumnMapping — PERSONA_FIELD_ALIASES', () => {
  it('maps "Full Name" to "name"', () => {
    const result = suggestColumnMapping(['Full Name'], PERSONA_FIELD_ALIASES);
    expect(result['Full Name']).toBe('name');
  });

  it('maps "Job Title" to "title"', () => {
    const result = suggestColumnMapping(['Job Title'], PERSONA_FIELD_ALIASES);
    expect(result['Job Title']).toBe('title');
  });

  it('maps "Email Address" to "email"', () => {
    const result = suggestColumnMapping(['Email Address'], PERSONA_FIELD_ALIASES);
    expect(result['Email Address']).toBe('email');
  });

  it('maps "LinkedIn" to "linkedin_url"', () => {
    const result = suggestColumnMapping(['LinkedIn'], PERSONA_FIELD_ALIASES);
    expect(result['LinkedIn']).toBe('linkedin_url');
  });

  it('maps "Seniority Level" to "seniority"', () => {
    const result = suggestColumnMapping(['Seniority Level'], PERSONA_FIELD_ALIASES);
    expect(result['Seniority Level']).toBe('seniority');
  });
});

describe('suggestValueMapping — REVENUE_BAND_ALIASES', () => {
  it('maps "50-250M" to "50m_250m"', () => {
    const result = suggestValueMapping(['50-250M'], REVENUE_BAND_ALIASES);
    expect(result['50-250M']).toBe('50m_250m');
  });

  it('maps "Unknown Band" to null', () => {
    const result = suggestValueMapping(['Unknown Band'], REVENUE_BAND_ALIASES);
    expect(result['Unknown Band']).toBeNull();
  });

  it('maps a mix of known and unknown values', () => {
    const result = suggestValueMapping(['50-250M', 'Unknown Band'], REVENUE_BAND_ALIASES);
    expect(result['50-250M']).toBe('50m_250m');
    expect(result['Unknown Band']).toBeNull();
  });

  it('maps "under 50m" (case-insensitive) to "under_50m"', () => {
    const result = suggestValueMapping(['Under 50M'], REVENUE_BAND_ALIASES);
    expect(result['Under 50M']).toBe('under_50m');
  });

  it('maps "<50m" to "under_50m"', () => {
    const result = suggestValueMapping(['<50m'], REVENUE_BAND_ALIASES);
    expect(result['<50m']).toBe('under_50m');
  });

  it('maps "5b+" to "5b_plus"', () => {
    const result = suggestValueMapping(['5b+'], REVENUE_BAND_ALIASES);
    expect(result['5b+']).toBe('5b_plus');
  });

  it('maps ">5b" to "5b_plus"', () => {
    const result = suggestValueMapping(['>5b'], REVENUE_BAND_ALIASES);
    expect(result['>5b']).toBe('5b_plus');
  });

  it('maps "1b-5b" to "1b_5b"', () => {
    const result = suggestValueMapping(['1b-5b'], REVENUE_BAND_ALIASES);
    expect(result['1b-5b']).toBe('1b_5b');
  });

  it('returns empty object for empty rawValues array', () => {
    const result = suggestValueMapping([], REVENUE_BAND_ALIASES);
    expect(result).toEqual({});
  });

  it('trims whitespace before lookup', () => {
    const result = suggestValueMapping(['  50-250M  '], REVENUE_BAND_ALIASES);
    expect(result['  50-250M  ']).toBe('50m_250m');
  });
});

describe('suggestValueMapping — OWNERSHIP_TYPE_ALIASES', () => {
  it.each([
    'public',
    'private',
    'family_owned',
    'pe_backed',
    'cooperative',
    'state_owned',
    'subsidiary',
  ])('maps canonical value "%s" to itself', (value) => {
    const result = suggestValueMapping([value], OWNERSHIP_TYPE_ALIASES);
    expect(result[value]).toBe(value);
  });

  it('maps "Private" to "private"', () => {
    const result = suggestValueMapping(['Private'], OWNERSHIP_TYPE_ALIASES);
    expect(result['Private']).toBe('private');
  });

  it('maps "PE Backed" to "pe_backed"', () => {
    const result = suggestValueMapping(['PE Backed'], OWNERSHIP_TYPE_ALIASES);
    expect(result['PE Backed']).toBe('pe_backed');
  });

  it('maps "Family Owned" to "family_owned"', () => {
    const result = suggestValueMapping(['Family Owned'], OWNERSHIP_TYPE_ALIASES);
    expect(result['Family Owned']).toBe('family_owned');
  });

  it('maps "Publicly Traded" to "public"', () => {
    const result = suggestValueMapping(['Publicly Traded'], OWNERSHIP_TYPE_ALIASES);
    expect(result['Publicly Traded']).toBe('public');
  });

  it('maps "Co-op" to "cooperative"', () => {
    const result = suggestValueMapping(['Co-op'], OWNERSHIP_TYPE_ALIASES);
    expect(result['Co-op']).toBe('cooperative');
  });

  it('maps "Government-Owned" to "state_owned"', () => {
    const result = suggestValueMapping(['Government-Owned'], OWNERSHIP_TYPE_ALIASES);
    expect(result['Government-Owned']).toBe('state_owned');
  });

  it('leaves an unknown ownership structure unmapped', () => {
    const result = suggestValueMapping(['Unknown Structure'], OWNERSHIP_TYPE_ALIASES);
    expect(result['Unknown Structure']).toBeNull();
  });
});

describe('suggestValueMapping — SENIORITY_ALIASES', () => {
  it('maps "IC" to "ic"', () => {
    const result = suggestValueMapping(['IC'], SENIORITY_ALIASES);
    expect(result['IC']).toBe('ic');
  });

  it('maps "Individual Contributor" to "ic"', () => {
    const result = suggestValueMapping(['Individual Contributor'], SENIORITY_ALIASES);
    expect(result['Individual Contributor']).toBe('ic');
  });

  it('maps "VP" to "vp"', () => {
    const result = suggestValueMapping(['VP'], SENIORITY_ALIASES);
    expect(result['VP']).toBe('vp');
  });

  it('maps "C-Level" to "c_level"', () => {
    const result = suggestValueMapping(['C-Level'], SENIORITY_ALIASES);
    expect(result['C-Level']).toBe('c_level');
  });

  it('maps "Director" to "director"', () => {
    const result = suggestValueMapping(['Director'], SENIORITY_ALIASES);
    expect(result['Director']).toBe('director');
  });

  it('maps "CEO" to "c_level"', () => {
    const result = suggestValueMapping(['CEO'], SENIORITY_ALIASES);
    expect(result['CEO']).toBe('c_level');
  });
});
